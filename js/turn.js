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
      steps.push({ label: grp.label, en: grp.en, icon: grp.icon, groupLabel: null, groupId: null, phaseLabel: null, isStep: false });
    } else {
      grp.phases.forEach((ph) => {
        if (!ph.steps) {
          steps.push({ label: ph.label, en: ph.en, icon: grp.icon, groupLabel: grp.label, groupId: grp.id, phaseLabel: null, isStep: false });
        } else {
          ph.steps.forEach((st) => {
            steps.push({ label: st.label, en: st.en, icon: grp.icon, groupLabel: grp.label, groupId: grp.id, phaseLabel: ph.label, isStep: true });
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
// 상태 — 날짜는 적용 전까지 null
// ============================================================

let state = {
  year:  null,
  month: null,
  day:   null,
  step:  0,
  collapsed: {},
};

// ============================================================
// 날짜 입력 UI
// ============================================================

function updateStartDayOptions() {
  const monthEl = document.getElementById('startMonth');
  const dayEl   = document.getElementById('startDay');
  if (!monthEl || !dayEl) return;
  const month = parseInt(monthEl.value) || 1;
  const year  = parseInt(document.getElementById('startYear').value) || 1950;
  const valid = getValidDaysForMonth(year, month);
  const prev  = parseInt(dayEl.value);
  dayEl.innerHTML = valid.map(d => `<option value="${d}"${d === prev ? ' selected' : ''}>${d}일</option>`).join('');
  if (valid.includes(prev)) dayEl.value = prev;
  else dayEl.value = valid[0];
}

function applyStartDate() {
  const year  = parseInt(document.getElementById('startYear').value);
  const month = parseInt(document.getElementById('startMonth').value);
  const day   = parseInt(document.getElementById('startDay').value);
  if (!year || !month || !day) return;
  state.year    = year;
  state.month   = month;
  state.day     = day;
  state.step    = 0;
  state.collapsed = {};
  updateTurnUI();
}

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
  list.innerHTML = '';
  let flatIdx = 0;
  SEQUENCE.forEach((grp) => {
    if (grp.type === 'solo') {
      const idx = flatIdx++;
      const li = document.createElement('li');
      li.className = 'phase-item solo-phase' + (idx < state.step ? ' done' : '') + (idx === state.step ? ' current' : '');
      li.innerHTML = `<span class="phase-num">${grp.icon}</span><span class="phase-name">${grp.label}</span><span class="phase-en">${grp.en}</span>`;
      li.onclick = ((i) => () => { state.step = i; updateTurnUI(); })(idx);
      list.appendChild(li);
    } else {
      const { first, last } = getPlayerStepRange(grp.id);
      const allDone  = last < state.step;
      const isActive = state.step >= first && state.step <= last;
      const isCollapsed = state.collapsed[grp.id] !== undefined ? state.collapsed[grp.id] : allDone;
      const header = document.createElement('li');
      header.className = 'phase-group-header' + (allDone ? ' group-done' : '') + (isActive ? ' group-active' : '');
      header.innerHTML = `<span class="group-icon">${grp.icon}</span><span class="group-label-text">${grp.label}</span><span class="group-en">${grp.en}</span><span class="collapse-toggle">${isCollapsed ? '▶' : '▼'}</span>`;
      header.onclick = () => toggleCollapse(grp.id);
      list.appendChild(header);
      if (!isCollapsed) {
        grp.phases.forEach((ph) => {
          if (!ph.steps) {
            const idx = flatIdx++;
            const li = document.createElement('li');
            li.className = 'phase-item sub-phase' + (idx < state.step ? ' done' : '') + (idx === state.step ? ' current' : '');
            li.innerHTML = `<span class="phase-num">${ph.en.substring(0,3).toUpperCase()}</span><span class="phase-name">${ph.label}</span><span class="phase-en">${ph.en}</span>`;
            li.onclick = ((i) => () => { state.step = i; updateTurnUI(); })(idx);
            list.appendChild(li);
          } else {
            const firstIdx = flatIdx, lastIdx = flatIdx + ph.steps.length - 1;
            const phAllDone = lastIdx < state.step, phActive = state.step >= firstIdx && state.step <= lastIdx;
            const phHeader = document.createElement('li');
            phHeader.className = 'phase-sub-header' + (phAllDone ? ' done' : '') + (phActive ? ' current' : '');
            phHeader.innerHTML = `<span class="phase-num">${ph.en.substring(0,3).toUpperCase()}</span><span class="phase-name">${ph.label}</span><span class="phase-en">${ph.en}</span>`;
            list.appendChild(phHeader);
            ph.steps.forEach((st) => {
              const idx = flatIdx++;
              const li = document.createElement('li');
              li.className = 'phase-item step-phase' + (idx < state.step ? ' done' : '') + (idx === state.step ? ' current' : '');
              li.innerHTML = `<span class="phase-num step-dot">·</span><span class="phase-name">${st.label}</span><span class="phase-en">${st.en}</span>`;
              li.onclick = ((i) => () => { state.step = i; updateTurnUI(); })(idx);
              list.appendChild(li);
            });
          }
        });
      } else {
        grp.phases.forEach((ph) => { if (!ph.steps) flatIdx++; else flatIdx += ph.steps.length; });
      }
    }
  });
}

function updateTurnUI() {
  const playerLabel = getPlayerLabel(state.step);
  const phaseLabel  = getCurrentPhaseLabel(state.step);

  // 날짜가 설정되지 않은 경우 — 대시 표시
  let turnDisplay, nextDisplay;
  if (state.year && state.month && state.day) {
    const datePart = formatTurnDate(state.year, state.month, state.day);
    turnDisplay = playerLabel ? `${datePart}  ${playerLabel}` : datePart;
    const next  = getNextTurnDate(state.year, state.month, state.day);
    nextDisplay = formatTurnDate(next.year, next.month, next.day);
  } else {
    turnDisplay = '—';
    nextDisplay = '—';
  }

  document.getElementById('turnDate').textContent      = turnDisplay;
  document.getElementById('curPhaseLabel').textContent = phaseLabel;
  document.getElementById('progressLabel').textContent = (state.step + 1) + ' / ' + FLAT.length;

  const nextEl = document.getElementById('nextTurnDate');
  if (nextEl) nextEl.textContent = nextDisplay;

  renderPhases();
}

function nextPhase() {
  if (state.step < FLAT.length - 1) { state.step++; updateTurnUI(); } else { newTurn(); }
}
function prevPhase() {
  if (state.step > 0) { state.step--; updateTurnUI(); }
}
function resetTurn() { state.step = 0; state.collapsed = {}; updateTurnUI(); }
function newTurn() {
  if (!state.year) return;
  const next = getNextTurnDate(state.year, state.month, state.day);
  state.year  = next.year;
  state.month = next.month;
  state.day   = next.day;
  state.step  = 0;
  state.collapsed = {};
  updateTurnUI();
}
