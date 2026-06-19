// ============================================================
// aircraft.js
// 게임별 항공기 데이터 로드 & 조회
// ============================================================

let _aircraftDataCache  = {};   // { [gameId]: parsedJson | null }
let currentAircraftData = null; // 현재 시나리오(gameId)의 항공기 데이터 (없으면 null)

/** 시나리오 선택 시 호출 — gameId 기준으로 항공기 데이터 로드 (실패해도 조용히 폴백) */
function loadAircraftDataForGame(gameId) {
  if (_aircraftDataCache[gameId] !== undefined) {
    currentAircraftData = _aircraftDataCache[gameId];
    return Promise.resolve(currentAircraftData);
  }
  return fetch(`data/aircraft-tables/${gameId}-aircraft.json`)
    .then(r => { if (!r.ok) throw new Error('not found'); return r.json(); })
    .then(data => {
      _aircraftDataCache[gameId] = data;
      currentAircraftData = data;
      return data;
    })
    .catch(() => {
      _aircraftDataCache[gameId] = null;
      currentAircraftData = null;
      return null;
    });
}

/** 현재 진행 중인 플레이어(선/후)의 진영 key 반환 — turn.js의 getPlayerForStep, state 사용 */
function getCurrentSideKey() {
  const p = (typeof getPlayerForStep === 'function') ? getPlayerForStep(state.step) : null;
  if (!p) return null;

  const firstKey  = state.firstPlayer;
  const sides     = currentScenario?.sides ? Object.keys(currentScenario.sides) : [];
  const secondKey = sides.find(k => k !== firstKey) ?? null;

  return p === 'first' ? firstKey : secondKey;
}

/** 현재 진영(국가들)에 속한 항공기 목록을 평탄화하여 반환: [{...aircraft, nation}] */
function getAircraftOptionsForCurrentSide() {
  if (!currentAircraftData?.aircraft) return [];

  const sideKey = getCurrentSideKey();
  const nations = sideKey ? (currentScenario?.sides?.[sideKey]?.nations || []) : [];
  if (!nations.length) return [];

  const list = [];
  nations.forEach(nation => {
    (currentAircraftData.aircraft[nation] || []).forEach(ac => {
      list.push({ ...ac, nation });
    });
  });
  return list;
}

/** id로 항공기 데이터 단건 조회 (현재 진영 범위 내) */
function findAircraftById(id) {
  return getAircraftOptionsForCurrentSide().find(ac => ac.id === id) || null;
}

/** <select> 옵션 HTML 생성 — 국가별 <optgroup>으로 묶음 */
function buildAircraftSelectOptionsHTML(selectedId) {
  const options = getAircraftOptionsForCurrentSide();
  if (!options.length) return '';

  const byNation = {};
  options.forEach(ac => {
    if (!byNation[ac.nation]) byNation[ac.nation] = [];
    byNation[ac.nation].push(ac);
  });

  return Object.entries(byNation).map(([nation, list]) => `
    <optgroup label="${nation}">
      ${list.map(ac => `<option value="${ac.id}" ${ac.id === selectedId ? 'selected' : ''}>${ac.name}</option>`).join('')}
    </optgroup>`).join('');
}