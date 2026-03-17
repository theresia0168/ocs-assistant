// ============================================================
// 시나리오 로더 & 로비
// ============================================================

// 현재 로드된 시나리오 (null = 미선택)
let currentScenario = null;

// 로비 단계: 'game' | 'scenario'
let lobbyStage = 'game';
let lobbySelectedGameId = null;
let lobbyIsCustomMode = false; // 커스텀 시나리오 추가 모드 여부

// ============================================================
// 시나리오 등록
// 새 시나리오 추가 시 아래 배열에 파일 경로만 추가하세요.
// ============================================================

const SCENARIO_INDEX = [
  // 더미 시나리오
  'data/scenarios/dummy-series/dummy-001.json',
  // The Forgotten Battles
  'data/scenarios/022/022-001.json',
];

// ============================================================
// 로비 진입 / 탈출
// ============================================================

function showLobby(resetStage = true) {
  if (resetStage) {
    lobbyStage = 'game';
    lobbySelectedGameId = null;
  }
  document.getElementById('lobbyScreen').style.display = 'block';
  document.getElementById('mainApp').style.display    = 'none';
  renderLobby();
}

function hideLobby() {
  document.getElementById('lobbyScreen').style.display = 'none';
  document.getElementById('mainApp').style.display    = 'block';
}

// ============================================================
// 로비 렌더링 — 단계에 따라 분기
// ============================================================

let _scenarioCache = null; // 로드된 시나리오 목록 캐시

function renderLobby() {
  const container = document.getElementById('lobbyContent');
  if (!container) return;

  if (lobbyIsCustomMode) {
    renderCustomForm(container);
    return;
  }

  if (_scenarioCache) {
    _renderLobbyStage(container, _getAllScenarios());
    return;
  }

  container.innerHTML = '<div class="lobby-loading">시나리오 목록 로드 중...</div>';

  Promise.all(
    SCENARIO_INDEX.map(file =>
      fetch(file).then(r => r.json()).catch(() => null)
    )
  ).then(results => {
    _scenarioCache = results.filter(Boolean);
    _renderLobbyStage(container, _getAllScenarios());
  });
}

// 파일 시나리오 + localStorage 커스텀 시나리오 병합
function _getAllScenarios() {
  const custom = _loadCustomScenarios();
  return [...(_scenarioCache || []), ...custom];
}

function _renderLobbyStage(container, scenarios) {
  if (lobbyStage === 'game') renderGameSelect(container, scenarios);
  else                       renderScenarioSelect(container, scenarios);
}

// ── 게임 선택 화면 ──────────────────────────────────────────

function renderGameSelect(container, scenarios) {
  const gameMap = {};
  scenarios.forEach(s => {
    const gid = s.gameId || 'unknown';
    if (!gameMap[gid]) gameMap[gid] = { gameId: gid, series: s.series || gid, scenarios: [] };
    gameMap[gid].scenarios.push(s);
  });

  const cards = Object.values(gameMap).map(g => `
    <div class="lobby-game-card" onclick="selectGame('${g.gameId}')">
      <div class="lobby-game-title">${g.series}</div>
      <div class="lobby-game-meta">시나리오 ${g.scenarios.length}개</div>
    </div>`).join('');

  container.innerHTML = `
    <div class="lobby-stage-label">게임 선택</div>
    <div class="lobby-game-list">${cards}</div>
    <button class="lobby-add-scenario-btn" onclick="showCustomForm()">＋ 시나리오 직접 추가</button>`;
}

// ── 시나리오 선택 화면 ────────────────────────────────────────

function renderScenarioSelect(container, scenarios) {
  const filtered  = scenarios.filter(s => s.gameId === lobbySelectedGameId);
  const seriesName = filtered[0]?.series || lobbySelectedGameId;

  const cards = filtered.map(s => {
    const start = s.startTurn;
    const end   = s.endTurn;
    const turns = countTurns(start, end);
    const sidesHtml = Object.values(s.sides || {})
      .map(side => `<span class="lobby-side-tag">${side.label}</span>`)
      .join('');

    return `
      <div class="lobby-scenario-card" onclick="selectScenario('${s.id}')">
        <div class="lobby-card-header">
          <div class="lobby-card-turns">${turns}턴</div>
        </div>
        <div class="lobby-card-title">
          ${s.title}
          ${s.isCustom ? `<span class="custom-badge">사용자 추가</span>` : ''}
          ${s.isCustom ? `<button class="custom-del-btn" onclick="event.stopPropagation();_deleteCustomScenario('${s.id}')">✕</button>` : ''}
        </div>
        ${s.subtitle ? `<div class="lobby-card-subtitle">${s.subtitle}</div>` : ''}
        <div class="lobby-card-meta">
          <span class="lobby-meta-date">
            ${formatTurnDate(start.year, start.month, start.day)}
            &nbsp;→&nbsp;
            ${formatTurnDate(end.year, end.month, end.day)}
          </span>
        </div>
        <div class="lobby-card-sides">${sidesHtml}</div>
        ${s.specialRules && s.specialRules.length
          ? `<div class="lobby-card-rules">특수 규칙 ${s.specialRules.length}개</div>`
          : ''}
      </div>`;
  }).join('');

  container.innerHTML = `
    <div class="lobby-stage-header">
      <button class="lobby-back-btn" onclick="backToGameSelect()">◀ 게임 선택</button>
      <div class="lobby-stage-label">${seriesName}</div>
    </div>
    <div class="lobby-scenario-list">${cards}</div>`;
}

// ============================================================
// 게임 / 시나리오 선택 액션
// ============================================================

function selectGame(gameId) {
  lobbySelectedGameId = gameId;
  lobbyStage = 'scenario';
  renderLobby();
}

function backToGameSelect() {
  lobbyStage = 'game';
  lobbySelectedGameId = null;
  renderLobby();
}

function selectScenario(id) {
  const scenario = _getAllScenarios().find(s => s.id === id);
  if (!scenario) return;

  const tableFile = scenario.weather?.tableFile;

  if (tableFile) {
    fetch(`data/${tableFile}`)
      .then(r => r.json())
      .then(tableData => {
        scenario.weather.tableData = tableData;
        currentScenario = scenario;
        applyScenarioToState(scenario);
        hideLobby();
      })
      .catch(err => {
        console.warn('날씨 테이블 로드 실패:', tableFile, err);
        // 실패해도 시나리오는 로드 (날씨 레이블 없이 id 그대로 표시)
        currentScenario = scenario;
        applyScenarioToState(scenario);
        hideLobby();
      });
  } else {
    // tableFile 없는 시나리오는 바로 로드
    currentScenario = scenario;
    applyScenarioToState(scenario);
    hideLobby();
  }
}

async function applyScenarioToState(scenario) {
  const st = scenario.startTurn;
  const en = scenario.endTurn;

  state.year        = st.year;
  state.month       = st.month;
  state.day         = st.day;
  state.step        = resolveStartStep(st);
  state.firstPlayer = st.firstPlayer || null;
  state.collapsed   = {};

  // 종료 턴 정보 저장
  state.endYear   = en.year;
  state.endMonth  = en.month;
  state.endDay    = en.day;

  // 전체 턴 수 & 현재 턴 번호
  state.totalTurns   = countTurns(st, en);
  state.currentTurnN = 1;

  // 시나리오 제목 / 시리즈 표시
  const titleEl  = document.getElementById('scenarioTitle');
  const seriesEl = document.getElementById('scenarioSeries');
  if (titleEl)  titleEl.textContent  = scenario.title  || '—';
  if (seriesEl) seriesEl.textContent = scenario.series || '—';

  // 진행도 블록 표시
  const progressBlock = document.getElementById('turnProgressBlock');
  if (progressBlock) progressBlock.style.display = '';

  // 날씨 초기화
  const w = scenario.weather;
  if (w && w.initial) {
    state.weatherEnabled = true;
    state.weatherSlots   = [];
    state.weatherLabels  = {};

    const tbl = w.tableData || null;

    // displayOrder가 있으면 그 순서대로 슬롯 구성
    // 없으면 initial의 키 순서대로 fallback
    const order = tbl?.displayOrder || Object.keys(w.initial);

    order.forEach(key => {
      const stateId = w.initial[key] ?? null;
      state.weatherSlots.push({ key, stateId });

      // tableData[key]로 직접 섹션 접근
      const section = tbl?.[key];
      state.weatherLabels[key] = {};
      if (section?.states) {
        section.states.forEach(s => { state.weatherLabels[key][s.id] = s.label; });
      }
    });
  } else {
    state.weatherEnabled = false;
    state.weatherSlots   = [];
    state.weatherLabels  = {};
  }

  updateTurnUI();
}

// startTurn.phase 값으로 FLAT 인덱스 결정
function resolveStartStep(startTurn) {
  const phase       = startTurn.phase || 'weather';
  const startPlayer = startTurn.startPlayer || 'first'; // 기본값 first

  // weather / initiative 는 선/후 구분 없는 solo 단계 → 그대로 id 매칭
  if (phase === 'weather' || phase === 'initiative') {
    const idx = FLAT.findIndex(s => s.id === phase);
    return idx >= 0 ? idx : 0;
  }

  // 플레이어 단계: startPlayer에 따라 prefix 결정
  const prefix = startPlayer === 'second' ? 's' : 'f';

  // 페이즈 진입점(isStep=false) 우선 탐색, 없으면 첫 번째 하위 step
  const idx = FLAT.findIndex(s => {
    const targetId = `${prefix}_${phase}`;
    if (s.id === targetId) return true;                       // 페이즈 자체 id 직접 매칭
    if (s.groupId === `${prefix === 'f' ? 'first' : 'second'}` // 그룹 소속 확인
        && s.phaseLabel                                       // 하위 step인 경우
        && s.id.startsWith(targetId)) return true;
    return false;
  });
  return idx >= 0 ? idx : 0;
}

// ============================================================
// 턴 수 계산 유틸
// ============================================================

function countTurns(start, end) {
  let count = 1;
  let cur = { year: start.year, month: start.month, day: start.day };
  const endKey = `${end.year}-${end.month}-${end.day}`;

  // 최대 500턴 방어
  for (let i = 0; i < 500; i++) {
    const key = `${cur.year}-${cur.month}-${cur.day}`;
    if (key === endKey) break;
    cur = getNextTurnDate(cur.year, cur.month, cur.day);
    count++;
  }
  return count;
}

// 새 턴 시작 시 currentTurnN 증가 (turn.js의 newTurn에서 호출)
function onNewTurn() {
  if (state.currentTurnN < state.totalTurns) {
    state.currentTurnN++;
  }
}

// ============================================================
// 커스텀 시나리오 — localStorage 저장/불러오기
// ============================================================

const CUSTOM_STORAGE_KEY = 'ocs_custom_scenarios';

function _loadCustomScenarios() {
  try {
    return JSON.parse(localStorage.getItem(CUSTOM_STORAGE_KEY) || '[]');
  } catch { return []; }
}

function _saveCustomScenarios(list) {
  localStorage.setItem(CUSTOM_STORAGE_KEY, JSON.stringify(list));
}

function _deleteCustomScenario(id) {
  const list = _loadCustomScenarios().filter(s => s.id !== id);
  _saveCustomScenarios(list);
  _scenarioCache = null; // 캐시 무효화 후 재로드
  renderLobby();
}

// ============================================================
// 커스텀 시나리오 입력 폼
// ============================================================

function showCustomForm() {
  lobbyIsCustomMode = true;
  renderLobby();
}

function hideCustomForm() {
  lobbyIsCustomMode = false;
  renderLobby();
}

function renderCustomForm(container) {
  container.innerHTML = `
    <div class="lobby-stage-header">
      <button class="lobby-back-btn" onclick="hideCustomForm()">◀ 취소</button>
      <div class="lobby-stage-label">새 시나리오 추가</div>
    </div>
    <div class="custom-form-wrap">

      <div class="custom-form-row">
        <label class="custom-label">게임 시리즈 <span class="custom-req">*</span></label>
        <input class="custom-input" id="cf_series" placeholder="예) OCS Tunisia" />
      </div>
      <div class="custom-form-row">
        <label class="custom-label">시나리오 제목 <span class="custom-req">*</span></label>
        <input class="custom-input" id="cf_title" placeholder="예) Baptism of Fire" />
      </div>

      <div class="custom-form-divider">턴 설정</div>

      <div class="custom-form-cols">
        <div>
          <label class="custom-label">시작 턴 <span class="custom-req">*</span></label>
          <div class="custom-date-row">
            <input class="custom-input custom-num" id="cf_sy" type="number" placeholder="연도" min="1900" max="2100" />
            <select class="custom-input custom-sel" id="cf_sm">
              ${Array.from({length:12},(_,i)=>`<option value="${i+1}">${i+1}월</option>`).join('')}
            </select>
            <select class="custom-input custom-sel" id="cf_sd">
              ${[1,4,8,15,22,29].map(d=>`<option value="${d}">${d}일</option>`).join('')}
            </select>
          </div>
        </div>
        <div>
          <label class="custom-label">종료 턴 <span class="custom-req">*</span></label>
          <div class="custom-date-row">
            <input class="custom-input custom-num" id="cf_ey" type="number" placeholder="연도" min="1900" max="2100" />
            <select class="custom-input custom-sel" id="cf_em">
              ${Array.from({length:12},(_,i)=>`<option value="${i+1}">${i+1}월</option>`).join('')}
            </select>
            <select class="custom-input custom-sel" id="cf_ed">
              ${[1,4,8,15,22,29].map(d=>`<option value="${d}">${d}일</option>`).join('')}
            </select>
          </div>
        </div>
      </div>

      <div class="custom-form-divider">진영 설정</div>

      <div class="custom-form-cols">
        <div>
          <label class="custom-label">진영 1 <span class="custom-req">*</span></label>
          <input class="custom-input" id="cf_side1" placeholder="예) 추축군" />
        </div>
        <div>
          <label class="custom-label">진영 2 <span class="custom-req">*</span></label>
          <input class="custom-input" id="cf_side2" placeholder="예) 연합군" />
        </div>
      </div>

      <div class="custom-form-divider">특수 규칙 (선택)</div>
      <div id="cf_rules_wrap"></div>
      <button class="custom-add-rule-btn" onclick="addCustomRuleField()">+ 특수 규칙 추가</button>

      <div class="custom-form-divider"></div>
      <div id="cf_error" class="custom-error" style="display:none;"></div>
      <button class="custom-submit-btn" onclick="submitCustomScenario()">저장</button>
    </div>`;
}

let _customRuleCount = 0;
function addCustomRuleField() {
  _customRuleCount++;
  const wrap = document.getElementById('cf_rules_wrap');
  const div = document.createElement('div');
  div.className = 'custom-rule-row';
  div.id = `cf_rule_${_customRuleCount}`;
  div.innerHTML = `
    <input class="custom-input" placeholder="규칙 내용" id="cf_rd_${_customRuleCount}" style="flex:1;" />
    <button class="custom-rule-del" onclick="document.getElementById('cf_rule_${_customRuleCount}').remove()">✕</button>`;
  wrap.appendChild(div);
}

function submitCustomScenario() {
  const errEl = document.getElementById('cf_error');
  errEl.style.display = 'none';

  const series   = document.getElementById('cf_series').value.trim();
  const title    = document.getElementById('cf_title').value.trim();
  const sy = parseInt(document.getElementById('cf_sy').value);
  const sm = parseInt(document.getElementById('cf_sm').value);
  const sd = parseInt(document.getElementById('cf_sd').value);
  const ey = parseInt(document.getElementById('cf_ey').value);
  const em = parseInt(document.getElementById('cf_em').value);
  const ed = parseInt(document.getElementById('cf_ed').value);
  const side1 = document.getElementById('cf_side1').value.trim();
  const side2 = document.getElementById('cf_side2').value.trim();

  // 유효성 검사
  if (!series || !title || !side1 || !side2 || isNaN(sy) || isNaN(ey)) {
    errEl.textContent = '필수 항목(*)을 모두 입력해주세요.';
    errEl.style.display = 'block';
    return;
  }
  if (sy > ey || (sy === ey && sm > em) || (sy === ey && sm === em && sd >= ed)) {
    errEl.textContent = '종료 턴은 시작 턴보다 이후여야 합니다.';
    errEl.style.display = 'block';
    return;
  }

  // 특수 규칙 수집
  const rules = [];
  document.querySelectorAll('[id^="cf_rule_"]').forEach(row => {
    const idx = row.id.split('_')[2];
    const d = document.getElementById(`cf_rd_${idx}`)?.value.trim();
    if (d) rules.push({ id: `sr-${idx}`, title: d, description: d, appliesTo: 'both', appliesToTurn: null });
  });

  const id = `custom-${Date.now()}`;
  const scenario = {
    id, isCustom: true,
    gameId: `custom-${series.toLowerCase().replace(/\s+/g,'-')}`,
    series, title,
    startTurn: { year: sy, month: sm, day: sd },
    endTurn:   { year: ey, month: em, day: ed },
    sides: {
      first:  { label: side1, en: side1 },
      second: { label: side2, en: side2 },
    },
    specialRules: rules,
    weather: { tableFile: null, initial: { air: 'clear', ground: 'dry' } },
  };

  const list = _loadCustomScenarios();
  list.push(scenario);
  _saveCustomScenarios(list);

  _scenarioCache = null; // 캐시 초기화 → 재로드 시 병합
  lobbyIsCustomMode = false;
  renderLobby();
}

// ============================================================
// 커스텀 시나리오 삭제 버튼 — 카드에 표시
// (renderScenarioSelect 내 카드 HTML에 isCustom 조건 추가 필요 — 변경 4 참고)
// ============================================================