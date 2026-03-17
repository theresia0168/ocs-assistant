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
  // 날씨 결정 페이즈
  'weather': {
    title: '날씨 결정 페이즈',
    en:    'Weather Determination Phase',
    render(el) { renderWeatherPhaseAction(el); },
  },
  // 선 플레이어 결정 페이즈
  'initiative': {
    title: '선 플레이어 결정 페이즈',
    en:    'First Player Determination Phase',
    render(el) {
      el.innerHTML = `
        <p class="phase-action-desc">주사위를 굴려 선 플레이어를 결정합니다.</p>
        <div class="phase-action-placeholder">(선 플레이어 결정 UI — 추후 구현)</div>`;
    },
  },
};

function renderPhaseAction() {
  const el = document.getElementById('phaseActionContent');
  if (!el) return;

  const cur = FLAT[state.step];

  if (!cur) {
    el.innerHTML = '<p class="phase-action-desc">이번 턴의 모든 페이즈가 완료되었습니다.</p>';
    return;
  }

  const def = PHASE_ACTIONS[cur.id];
  if (def) {
    def.render(el);
  } else {
    el.innerHTML = `<p class="phase-action-desc">${cur.label} 페이즈의 행동을 여기에 표시합니다.</p>`;
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

  renderPhases();
  renderPhaseAction();
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

// ============================================================
// 날씨 굴림 (TFB 방식: Ground 1d6 → Flight 2d6)
// ============================================================

// 현재 날씨 굴림 대기 결과 (적용 전 임시 보관)
let _weatherPendingResult = null;

// ── 유틸 ──────────────────────────────────────────────────────

// 현재 턴 날짜로 Ground 테이블에서 해당 행 찾기
function _findGroundRow(tbl) {
  const m = state.month, d = state.day;
  return tbl.groundCondition.table.find(row => {
    const fromOk = (m > row.monthFrom) || (m === row.monthFrom && d >= row.dayFrom);
    const toOk   = (m < row.monthTo)   || (m === row.monthTo   && d <= row.dayTo);
    return fromOk && toOk;
  }) || null;
}

// results 객체에서 주사위 눈에 해당하는 결과 id 찾기
// results: { "dry": [1,2], "mud": [3,4,5,6], "freeze": null, ... }
// "auto"인 항목이 있으면 굴림 없이 그게 결과
function _resolveResult(results, dieValue) {
  // auto 먼저 확인
  for (const [id, val] of Object.entries(results)) {
    if (val === 'auto') return { id, auto: true };
  }
  // 눈 범위 탐색
  for (const [id, val] of Object.entries(results)) {
    if (Array.isArray(val) && val.includes(dieValue)) return { id, auto: false };
  }
  return null;
}

// 1d6 굴림
function _roll1d6() { return Math.floor(Math.random() * 6) + 1; }

// 2d6 굴림
function _roll2d6() {
  return [Math.floor(Math.random() * 6) + 1, Math.floor(Math.random() * 6) + 1];
}

// April Mud 3연속 체크
function _checkAprilMudRule(groundId) {
  if (state.month !== 4 || groundId !== 'mud') return null;
  const recent = (state.weatherHistory || []).slice(-2);
  if (recent.length === 2 && recent.every(h => h.groundCondition === 'mud')) {
    return 'April Mud 3연속 — 즉시 게임 종료 조건 달성 (룰북 1.8 참조)';
  }
  return null;
}

// ── 주 굴림 함수 ──────────────────────────────────────────────

function weatherRoll() {
  const tbl = currentScenario?.weather?.tableData;
  if (!tbl) return;

  const groundRow = _findGroundRow(tbl);
  if (!groundRow) {
    alert('현재 날짜에 해당하는 Ground 테이블 행이 없습니다.');
    return;
  }

  // ── Ground 굴림 ──
  let groundDie   = null;
  let groundAuto  = false;
  let groundId;

  // auto가 있는 행인지 먼저 확인
  const autoEntry = Object.entries(groundRow.results).find(([, v]) => v === 'auto');
  if (autoEntry) {
    groundId   = autoEntry[0];
    groundAuto = true;
  } else {
    groundDie = _roll1d6();
    const resolved = _resolveResult(groundRow.results, groundDie);
    if (!resolved) return; // 이론상 발생 안 함
    groundId = resolved.id;
  }

  // ── Flight 굴림 ──
  const flightRow = tbl.flightCondition.table[groundId];
  let flightDice  = null;
  let flightAuto  = false;
  let flightId;

  const flightAutoEntry = flightRow
    ? Object.entries(flightRow).find(([, v]) => v === 'auto')
    : null;

  if (flightAutoEntry) {
    flightId   = flightAutoEntry[0];
    flightAuto = true;
  } else if (flightRow) {
    flightDice = _roll2d6();
    const total    = flightDice[0] + flightDice[1];
    const resolved = _resolveResult(flightRow, total);
    flightId = resolved?.id || null;
  }

  // April Mud 특수 규칙 체크
  const warning = _checkAprilMudRule(groundId);

  // 결과 임시 저장
  _weatherPendingResult = { groundId, groundDie, groundAuto, flightId, flightDice, flightAuto, warning };

  // UI 갱신
  renderWeatherPhaseAction(document.getElementById('phaseActionContent'));
}

// ── 적용 ──────────────────────────────────────────────────────

function weatherApply() {
  if (!_weatherPendingResult) return;
  const { groundId, flightId } = _weatherPendingResult;

  // state 슬롯 갱신
  state.weatherSlots = state.weatherSlots.map(slot => {
    if (slot.key === 'groundCondition') return { ...slot, stateId: groundId };
    if (slot.key === 'flightCondition') return { ...slot, stateId: flightId };
    return slot;
  });

  // 히스토리 기록
  if (!state.weatherHistory) state.weatherHistory = [];
  state.weatherHistory.push({
    year:  state.year, month: state.month, day: state.day,
    groundCondition: groundId,
    flightCondition: flightId,
  });

  _weatherPendingResult = null;
  updateWeatherUI();
  renderWeatherPhaseAction(document.getElementById('phaseActionContent'));
}

// ── 렌더 ──────────────────────────────────────────────────────

function renderWeatherPhaseAction(el) {
  if (!el) return;
  const tbl = currentScenario?.weather?.tableData;

  if (!tbl) {
    el.innerHTML = `<p class="phase-action-desc">이 시나리오는 날씨 테이블이 없습니다.</p>`;
    return;
  }

  const pending = _weatherPendingResult;
  const groundLabels  = state.weatherLabels['groundCondition'] || {};
  const flightLabels  = state.weatherLabels['flightCondition'] || {};

  // 현재 적용된 날씨
  const curGround = state.weatherSlots.find(s => s.key === 'groundCondition')?.stateId;
  const curFlight = state.weatherSlots.find(s => s.key === 'flightCondition')?.stateId;
  const curGroundLabel = groundLabels[curGround] || curGround || '—';
  const curFlightLabel = flightLabels[curFlight] || curFlight || '—';

  let html = `<p class="phase-action-desc">주사위를 굴려 이번 턴의 날씨를 결정합니다.</p>`;

  // 현재 날씨 표시
  html += `
    <div class="weather-current-row">
      <span class="weather-current-label">현재 날씨</span>
      <span class="weather-current-value">${curGroundLabel} — ${curFlightLabel}</span>
    </div>`;

  if (!pending) {
    // 굴림 전
    html += `
      <button class="dice-roll-btn combat-btn weather-main-btn" onclick="weatherRoll()">
        <span class="roll-label">날씨 굴림</span>
        <span class="roll-formula">Ground 1d6 → Flight 2d6</span>
      </button>`;
  } else {
    // 굴림 후 결과 표시
    const nextGroundLabel = groundLabels[pending.groundId] || pending.groundId || '—';
    const nextFlightLabel = flightLabels[pending.flightId] || pending.flightId || '—';

    // Ground 주사위 렌더
    let groundDiceHtml;
    if (pending.groundAuto) {
      groundDiceHtml = `<span class="weather-auto-badge">AUTO</span>`;
    } else {
      groundDiceHtml = `
        <div class="die-wrap">
          ${makeDieFaceHTML(pending.groundDie, 'ivory')}
          <div class="die-val">${pending.groundDie}</div>
        </div>`;
    }

    // Flight 주사위 렌더
    let flightDiceHtml;
    if (pending.flightAuto) {
      flightDiceHtml = `<span class="weather-auto-badge">AUTO</span>`;
    } else if (pending.flightDice) {
      const total = pending.flightDice[0] + pending.flightDice[1];
      flightDiceHtml = `
        <div class="die-wrap">
          ${makeDieFaceHTML(pending.flightDice[0], 'ivory')}
          <div class="die-val">${pending.flightDice[0]}</div>
        </div>
        <div class="die-wrap">
          ${makeDieFaceHTML(pending.flightDice[1], 'ivory')}
          <div class="die-val">${pending.flightDice[1]}</div>
        </div>
        <div class="dice-total">${total}<small>합계</small></div>`;
    }

    html += `
      <div class="weather-roll-result-block">

        <div class="weather-roll-section">
          <div class="weather-roll-section-label">지면 상황 (1d6)</div>
          <div class="weather-roll-dice-row">
            <div class="dice-result-area weather-dice-area">${groundDiceHtml}</div>
            <div class="weather-roll-arrow">→</div>
            <div class="weather-roll-next-state">${nextGroundLabel}</div>
          </div>
        </div>

        <div class="weather-roll-section">
          <div class="weather-roll-section-label">비행 상황 (2d6)</div>
          <div class="weather-roll-dice-row">
            <div class="dice-result-area weather-dice-area">${flightDiceHtml}</div>
            <div class="weather-roll-arrow">→</div>
            <div class="weather-roll-next-state">${nextFlightLabel}</div>
          </div>
        </div>

        ${pending.warning ? `
          <div class="weather-warning">
            ⚠ ${pending.warning}
          </div>` : ''}

        <div class="weather-apply-row">
          <button class="dice-roll-btn combat-btn" style="flex:1;" onclick="weatherRoll()">다시 굴리기</button>
          <button class="btn btn-primary weather-apply-btn" onclick="weatherApply()">적용 ▶</button>
        </div>

      </div>`;
  }

  el.innerHTML = html;
}