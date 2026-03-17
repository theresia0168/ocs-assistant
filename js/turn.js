// ============================================================
// OCS 날짜 턴 시스템
// ============================================================

const OCS_TURN_DAYS = [1, 5, 8, 12, 15, 19, 22, 26, 29];

function getValidDaysForMonth(year, month) {
  if (month === 2) return OCS_TURN_DAYS.slice(0, 8);
  return OCS_TURN_DAYS.slice();
}

function getNextTurnDate(year, month, day) {
  const validDays = getValidDaysForMonth(year, month);
  const idx = validDays.indexOf(day);
  if (idx !== -1 && idx < validDays.length - 1) {
    return { year, month, day: validDays[idx + 1] };
  }
  let nextMonth = month + 1;
  let nextYear  = year;
  if (nextMonth > 12) { nextMonth = 1; nextYear++; }
  return { year: nextYear, month: nextMonth, day: getValidDaysForMonth(nextYear, nextMonth)[0] };
}

function formatTurnDate(year, month, day) {
  return `${year}년 ${month}월 ${day}일`;
}

// ============================================================
// 페이즈 정의
// ============================================================

// | 값 | 의미 |
// |----|------|
// | `weather` 또는 생략 | 날씨 결정 페이즈 (턴 맨 처음) |
// | `initiative` | 선 플레이어 결정 페이즈 |
// | `air` | 항공 정비 페이즈 |
// | `reinf` | 증원 페이즈 |
// | `move` | 이동 페이즈 (이동 단계 첫 번째) |
// | `supply` | 보급 페이즈 |
// | `reaction` | 반응 페이즈 |
// | `combat` | 전투 페이즈 |
// | `exploit` | 돌파 페이즈 |
// | `clean` | 정리 페이즈 |

const PLAYER_PHASES = (prefix) => [
  { id: `${prefix}_air`,      label: '항공 정비 페이즈', en: 'Aircraft Refit Phase',  steps: null },
  { id: `${prefix}_reinf`,    label: '증원 페이즈',      en: 'Reinforcement Phase',   steps: null },
  { id: `${prefix}_move`,     label: '이동 페이즈',      en: 'Movement Phase',
    steps: [
      { id: `${prefix}_move_withdraw`, label: '탈출 단계',          en: 'Breakout'          },
      { id: `${prefix}_move_move`,     label: '이동 단계',          en: 'Movement'          },
      { id: `${prefix}_move_bombard`,  label: '항공/해군 포격 단계', en: 'Air/Naval Barrage' },
    ]},
  { id: `${prefix}_supply`,   label: '보급 페이즈',  en: 'Supply Phase',   steps: null },
  { id: `${prefix}_reaction`, label: '반응 페이즈',  en: 'Reaction Phase',
    steps: [
      { id: `${prefix}_react_move`, label: '이동 단계', en: 'Movement' },
      { id: `${prefix}_react_fire`, label: '포격 단계', en: 'Barrage'  },
    ]},
  { id: `${prefix}_combat`,   label: '전투 페이즈',  en: 'Combat Phase',
    steps: [
      { id: `${prefix}_combat_arty`,   label: '포병 포격 단계', en: 'Artillery Barrage' },
      { id: `${prefix}_combat_combat`, label: '전투 단계',      en: 'Combat'            },
    ]},
  { id: `${prefix}_exploit`,  label: '돌파 페이즈',  en: 'Exploitation Phase',
    steps: [
      { id: `${prefix}_exploit_move`,   label: '이동 단계', en: 'Movement' },
      { id: `${prefix}_exploit_fire`,   label: '포격 단계', en: 'Barrage'  },
      { id: `${prefix}_exploit_combat`, label: '전투 단계', en: 'Combat'   },
    ]},
  { id: `${prefix}_clean`,    label: '정리 페이즈',  en: 'Clean Phase',    steps: null },
];

const SEQUENCE = [
  { type: 'solo',   id: 'weather',    label: '날씨 결정 페이즈',       en: 'Weather Determination',      icon: '🌦' },
  { type: 'solo',   id: 'initiative', label: '선 플레이어 결정 페이즈', en: 'First Player Determination', icon: '🎲' },
  { type: 'player', id: 'first',      label: '선 플레이어', en: 'First Player',  icon: '①', phases: PLAYER_PHASES('f') },
  { type: 'player', id: 'second',     label: '후 플레이어', en: 'Second Player', icon: '②', phases: PLAYER_PHASES('s') },
];

function buildFlatSteps() {
  const steps = [];
  SEQUENCE.forEach((grp) => {
    if (grp.type === 'solo') {
      steps.push({ id: grp.id, label: grp.label, en: grp.en, icon: grp.icon, groupLabel: null, groupId: null, phaseLabel: null, isStep: false });
    } else {
      grp.phases.forEach((ph) => {
        if (!ph.steps) {
          steps.push({ id: ph.id, label: ph.label, en: ph.en, icon: grp.icon, groupLabel: grp.label, groupId: grp.id, phaseLabel: null, isStep: false });
        } else {
          ph.steps.forEach((st) => {
            steps.push({ id: st.id, label: st.label, en: st.en, icon: grp.icon, groupLabel: grp.label, groupId: grp.id, phaseLabel: ph.label, isStep: true });
          });
        }
      });
    }
  });
  return steps;
}

const FLAT = buildFlatSteps();

function getPlayerForStep(stepIdx) {
  const s = FLAT[stepIdx];
  if (!s) return null;
  if (s.groupId === 'first')  return 'first';
  if (s.groupId === 'second') return 'second';
  return null;
}

// 플레이어 턴 레이블 — 플레이어 페이즈에 진입했을 때만 반환
function getPlayerLabel(stepIdx) {
  const p = getPlayerForStep(stepIdx);
  if (p === 'first')  return '선 플레이어 턴';
  if (p === 'second') return '후 플레이어 턴';
  return null;
}

// 페이즈 > 단계 계층만 (그룹/플레이어 레벨 제외)
function getCurrentPhaseLabel(stepIdx) {
  const cur = FLAT[stepIdx];
  if (!cur) return '턴 완료';
  if (cur.isStep && cur.phaseLabel) return `${cur.phaseLabel} › ${cur.label}`;
  return cur.label;
}

// ============================================================
// 상태 — 시나리오 로드 전까지 null
// ============================================================

let state = {
  year:  null,
  month: null,
  day:   null,
  step:  0,
  collapsed: {},
  // 시나리오 로드 시 채워지는 필드
  endYear:      null,
  endMonth:     null,
  endDay:       null,
  totalTurns:   null,
  currentTurnN: null,
  // 날씨
  weatherEnabled: false,
  // weatherSlots: displayOrder 순서대로 { key, stateId } 배열
  // 예: [{ key: 'ground', stateId: 'dry' }, { key: 'flight', stateId: 'full-flight' }]
  weatherSlots:   [],
  // weatherLabels: { [key]: { [stateId]: label } } 형태의 레이블 맵
  weatherLabels:  {},
};

// ============================================================
// 렌더링
// ============================================================

function getPlayerStepRange(grpId) {
  let first = -1, last = -1, flatIdx = 0;
  SEQUENCE.forEach((grp) => {
    if (grp.type === 'solo') { flatIdx++; return; }
    const start = flatIdx;
    grp.phases.forEach((ph) => { if (!ph.steps) flatIdx++; else flatIdx += ph.steps.length; });
    if (grp.id === grpId) { first = start; last = flatIdx - 1; }
  });
  return { first, last };
}

function toggleCollapse(grpId) {
  state.collapsed[grpId] = !state.collapsed[grpId];
  renderPhases();
}

function renderPhases() {
  const list = document.getElementById('phaseList');
  if (!list) return;
  list.innerHTML = '';

  const WINDOW = 2;
  const total  = FLAT.length;
  const winStart = Math.max(0, state.step - WINDOW);
  const winEnd   = Math.min(total - 1, state.step + WINDOW);

  // 연결선 헬퍼
  function addConnector(strong) {
    const div = document.createElement('div');
    div.className = 'phase-connector' + (strong ? ' phase-connector-strong' : '');
    list.appendChild(div);
  }

  // 말줄임 헬퍼
  function addEllipsis(count, dir) {
    if (count <= 0) return;
    const div = document.createElement('div');
    div.className = 'phase-ellipsis-row';
    div.textContent = dir === 'before' ? `⋯ 이전 ${count}개` : `⋯ 이후 ${count}개`;
    list.appendChild(div);
  }

  addEllipsis(winStart, 'before');

  let nextCount = 0; // 현재 이후 항목 카운터

  for (let i = winStart; i <= winEnd; i++) {
    const f    = FLAT[i];
    const done = i < state.step;
    const cur  = i === state.step;
    const next = i > state.step;

    // 그룹 헤더: 이 항목이 윈도우 내 그룹의 첫 번째이고, 완료 그룹이 아닐 때만 표시
    const prevF = i > winStart ? FLAT[i - 1] : null;
    const isGroupFirst = f.groupLabel && (!prevF || prevF.groupId !== f.groupId);
    if (isGroupFirst) {
      // 완료 그룹이면 헤더 생략
      const grpRange   = FLAT.filter(s => s.groupId === f.groupId);
      const grpAllDone = grpRange.every(s => FLAT.indexOf(s) < state.step);
      if (!grpAllDone) {
        const grpActive  = grpRange.some(s => FLAT.indexOf(s) === state.step);
        const hdr = document.createElement('div');
        hdr.className = 'phase-group-row' + (grpActive ? ' group-row-active' : '');
        hdr.innerHTML = `<span class="phase-group-icon">${f.icon || ''}</span><span class="phase-group-text">${f.groupLabel}</span>`;
        list.appendChild(hdr);
      }
    }

    // 연결선
    if (i > winStart) {
      addConnector(cur || (i === state.step + 1));
    }

    // 행 생성
    const row = document.createElement('div');

    // 아이콘
    let iconHtml = '';
    if (done) {
      iconHtml = `<span class="phase-row-icon phase-icon-done">✓</span>`;
    } else if (cur) {
      iconHtml = `<span class="phase-row-icon phase-icon-cur">▶</span>`;
    } else {
      nextCount++;
      iconHtml = `<span class="phase-row-icon phase-icon-next">${nextCount}</span>`;
    }

    // 레이블 — 부모 페이즈가 있으면 별도 span으로 위에 표시 (줄바꿈 방지)
    const parentHtml = (f.isStep && f.phaseLabel)
      ? `<span class="phase-row-parent">${f.phaseLabel} ›</span>`
      : '';
    const labelHtml = `<span class="phase-row-label">${f.label}</span>`;

    row.className = 'phase-row'
      + (done ? ' phase-row-done'     : '')
      + (cur  ? ' phase-row-current'  : '')
      + (!done && !cur && i === state.step + 1 ? ' phase-row-next' : '')
      + (!done && !cur && i !== state.step + 1 ? ' phase-row-upcoming' : '');

    row.innerHTML = `
      ${iconHtml}
      <span class="phase-row-body">
        ${parentHtml}
        <span class="phase-row-main">${labelHtml}</span>
      </span>`;

    row.onclick = ((idx) => () => { state.step = idx; updateTurnUI(); })(i);
    list.appendChild(row);
  }

  if (winEnd < total - 1) addEllipsis(total - 1 - winEnd, 'after');
}

// ============================================================
// 이번 페이즈 행동 패널
// ============================================================

const PHASE_ACTIONS = {
  'weather': {
    desc: '주사위를 굴려 이번 턴의 날씨를 결정합니다.',
    render(el) {
      const handler = getWeatherHandler();
      if (handler) handler.renderUI(el);
      else el.innerHTML = `<p class="phase-action-desc">날씨 핸들러가 로드되지 않았습니다.</p>`;
    },
  },
  'initiative': {
    desc:   '주사위를 굴려 이번 턴의 선 플레이어를 결정합니다.',
    render: null,  // 추후 구현
  },
};

// weather Handler 브릿지 — HTML onclick에서 호출
function weatherHandlerRoll() {
  const handler = getWeatherHandler();
  if (handler) {
    handler.roll();
    handler.renderUI(document.getElementById('phaseActionContent'));
  }
}

function weatherHandlerApply() {
  const handler = getWeatherHandler();
  if (handler) {
    handler.apply();
    nextPhase();
  }
}

function renderPhaseAction() {
  const actionArea = document.getElementById('phaseActionArea');
  const actionEl   = document.getElementById('phaseActionContent');
  const descEl     = document.getElementById('phaseDescContent');

  const cur = FLAT[state.step];
  const def = cur ? PHASE_ACTIONS[cur.id] : null;

  // ── 배너 설명 텍스트 갱신 ──
  if (descEl) {
    let descText;
    if (!cur) {
      descText = '이번 턴의 모든 페이즈가 완료되었습니다.';
    } else {
      descText = def?.desc || `${cur.label} 페이즈입니다.`;
    }
    descEl.innerHTML = `<p class="phase-banner-desc-text">${descText}</p>`;
  }

  // ── 액션 영역 갱신 ──
  if (!actionArea || !actionEl) return;

  if (def?.render) {
    actionArea.style.display = '';
    def.render(actionEl);
  } else {
    actionArea.style.display = 'none';
    actionEl.innerHTML = '';
  }
}

function updateTurnUI() {
  const playerLabel = getPlayerLabel(state.step);
  const phaseLabel  = getCurrentPhaseLabel(state.step);

  const hasDate = !!(state.year && state.month && state.day);

  // 현재 턴 / 다음 턴 행 show/hide
  const rowNext = document.getElementById('rowNextTurnDate');
  if (rowNext) rowNext.style.display = hasDate ? '' : 'none';

  if (hasDate) {
    const next    = getNextTurnDate(state.year, state.month, state.day);
    const nextEl  = document.getElementById('nextTurnDate');
    if (nextEl) nextEl.textContent = formatTurnDate(next.year, next.month, next.day);
  }

  const curPhaseLabelEl = document.getElementById('curPhaseLabel');
  if (curPhaseLabelEl) curPhaseLabelEl.textContent = phaseLabel;

  // 배너 갱신
  updateBannerUI();

  // 마지막 턴 / 진행도 업데이트
  updateProgressUI();

  // 날씨 렌더
  updateWeatherUI();

  // 페이즈 액션 / 설명 렌더
  renderPhaseAction();

  renderPhases();
}

function updateWeatherUI() {
  const row = document.getElementById('rowWeather');
  const val = document.getElementById('weatherValue');
  if (!row) return;

  if (!state.weatherEnabled || state.weatherSlots.length === 0) {
    row.style.display = 'none';
    return;
  }

  row.style.display = '';

  // 각 슬롯의 레이블을 순서대로 이어붙임
  const parts = state.weatherSlots.map(slot => {
    const labelMap = state.weatherLabels[slot.key] || {};
    return labelMap[slot.stateId] || slot.stateId || '—';
  });

  if (val) val.textContent = parts.length > 0 ? parts.join(' — ') : '날씨 정보 없음';
}

function updateBannerUI() {
  const cur = FLAT[state.step];

  const nameEl   = document.getElementById('bannerPhaseName');
  const enEl     = document.getElementById('bannerPhaseEn');
  const playerEl = document.getElementById('bannerPlayer');
  const dateEl   = document.getElementById('bannerDate');

  // 페이즈명
  if (nameEl) {
    if (!cur) {
      nameEl.textContent = '턴 완료';
    } else {
      nameEl.textContent = cur.isStep && cur.phaseLabel
        ? `${cur.phaseLabel} › ${cur.label}`
        : cur.label;
    }
  }
  if (enEl)   enEl.textContent = cur ? (cur.en || '') : '';

  // 플레이어 뱃지
  const player = getPlayerLabel(state.step);
  if (playerEl) {
    playerEl.textContent  = player || '';
    playerEl.style.display = player ? '' : 'none';
  }

  // 날짜 — "1944년 6월 6일" 형식
  if (dateEl) {
    const hasDate = !!(state.year && state.month && state.day);
    dateEl.textContent  = hasDate ? formatTurnDate(state.year, state.month, state.day) : '';
    dateEl.style.display = hasDate ? '' : 'none';
  }
}

function updateProgressUI() {
  const rowEnd  = document.getElementById('rowEndTurnDate');
  const endEl   = document.getElementById('endTurnDate');
  const fillEl  = document.getElementById('turnProgressFill');
  const countEl = document.getElementById('turnProgressCount');

  const hasScenario = !!(state.endYear && state.totalTurns);

  if (rowEnd)  rowEnd.style.display  = hasScenario ? '' : 'none';
  if (!hasScenario) return;

  if (endEl)   endEl.textContent   = formatTurnDate(state.endYear, state.endMonth, state.endDay);
  if (countEl) countEl.textContent = `${state.currentTurnN} / ${state.totalTurns}`;

  const pct = Math.round((state.currentTurnN / state.totalTurns) * 100);
  if (fillEl)  fillEl.style.width = `${pct}%`;
}

function nextPhase() {
  if (state.step < FLAT.length - 1) { state.step++; updateTurnUI(); }
  else { newTurn(); }
}

function newTurn() {
  if (!state.year) return;
  const next = getNextTurnDate(state.year, state.month, state.day);
  state.year  = next.year;
  state.month = next.month;
  state.day   = next.day;
  state.step  = 0;
  state.collapsed = {};
  if (typeof onNewTurn === 'function') onNewTurn();
  updateTurnUI();
}
function prevPhase() {
  if (state.step > 0) { state.step--; updateTurnUI(); }
}