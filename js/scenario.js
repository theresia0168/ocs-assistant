// ============================================================
// 시나리오 로더 & 로비
// ============================================================

// 현재 로드된 시나리오 (null = 미선택)
let currentScenario = null;

// 로비 단계: 'game' | 'scenario'
let lobbyStage = 'game';
let lobbySelectedGameId = null;

// ============================================================
// 시나리오 등록
// 새 시나리오 추가 시 아래 배열에 파일 경로만 추가하세요.
// ============================================================

const SCENARIO_INDEX = [
  'data/scenarios/dummy-series/dummy-001.json',
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

  if (_scenarioCache) {
    _renderLobbyStage(container, _scenarioCache);
    return;
  }

  container.innerHTML = '<div class="lobby-loading">시나리오 목록 로드 중...</div>';

  Promise.all(
    SCENARIO_INDEX.map(file =>
      fetch(file).then(r => r.json()).catch(() => null)
    )
  ).then(results => {
    _scenarioCache = results.filter(Boolean);
    if (!_scenarioCache.length) {
      container.innerHTML = '<div class="lobby-empty">사용 가능한 시나리오가 없습니다.</div>';
      return;
    }
    _renderLobbyStage(container, _scenarioCache);
  });
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
    <div class="lobby-game-list">${cards}</div>`;
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
        <div class="lobby-card-title">${s.title}</div>
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
  const scenario = (_scenarioCache || []).find(s => s.id === id);
  if (!scenario) return;
  currentScenario = scenario;
  applyScenarioToState(scenario);
  hideLobby();
}

function applyScenarioToState(scenario) {
  const st = scenario.startTurn;
  const en = scenario.endTurn;

  state.year      = st.year;
  state.month     = st.month;
  state.day       = st.day;
  state.step      = resolveStartStep(st);
  state.collapsed = {};

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

  updateTurnUI();
}

// startTurn.phase 값으로 FLAT 인덱스 결정
function resolveStartStep(startTurn) {
  if (!startTurn.phase || startTurn.phase === 'weather') return 0;

  const idx = FLAT.findIndex(s => {
    // step id 직접 매칭
    if (s.id && s.id === startTurn.phase) return true;
    // groupId 매칭 (플레이어 그룹 진입점)
    if (s.groupId === startTurn.phase && !s.isStep) return true;
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
