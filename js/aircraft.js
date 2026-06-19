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

/** 현재 진영의 반대 진영 key 반환 */
function getOpposingSideKey() {
  const sideKey = getCurrentSideKey();
  if (!sideKey) return null;
  const sides = currentScenario?.sides ? Object.keys(currentScenario.sides) : [];
  return sides.find(k => k !== sideKey) ?? null;
}

/** 'own' | 'opposing' | 구체적 sideKey 문자열 → 실제 sideKey로 해석 */
function resolveSideKey(which) {
  if (which === 'own')      return getCurrentSideKey();
  if (which === 'opposing') return getOpposingSideKey();
  return which || null;
}

/** 특정 진영(sideKey)에 속한 항공기 목록을 평탄화하여 반환: [{...aircraft, group}] */
function getAircraftOptionsForSide(sideKey) {
  if (!currentAircraftData?.aircraft || !sideKey) return [];

  const lookupKeys = _getAircraftLookupKeys(sideKey);
  const seen = new Set();
  const list = [];

  lookupKeys.forEach(key => {
    const group = currentAircraftData.aircraft[key];
    if (!group) return;
    group.forEach(ac => {
      if (seen.has(ac.id)) return;
      seen.add(ac.id);
      list.push({ ...ac, group: key });
    });
  });

  return list;
}

/** 진영 키로 항공기 데이터를 찾기 위한 후보 키 목록 생성
 *  (nations 배열 → side.en → side.label → sideKey 순으로 시도, 매칭되는 키를 모두 사용) */
function _getAircraftLookupKeys(sideKey) {
  if (!sideKey) return [];
  const side = currentScenario?.sides?.[sideKey];
  const keys = [];
  if (side?.nations && Array.isArray(side.nations)) keys.push(...side.nations);
  if (side?.en)    keys.push(side.en);
  if (side?.label) keys.push(side.label);
  keys.push(sideKey); // axis, soviet 같은 진영 키 자체로도 시도
  return keys;
}

/** 현재 진영(아군)에 속한 항공기 목록 — getAircraftOptionsForSide에 위임 */
function getAircraftOptionsForCurrentSide() {
  return getAircraftOptionsForSide(getCurrentSideKey());
}

/** id로 항공기 데이터 단건 조회 (현재 진영 범위 내) */
function findAircraftById(id) {
  return getAircraftOptionsForCurrentSide().find(ac => ac.id === id) || null;
}

/** <select> 옵션 HTML 생성 — 국가별 <optgroup>으로 묶음
 *  sideKey를 생략하면 현재 진영(아군) 기준으로 조회 */
function buildAircraftSelectOptionsHTML(selectedId, sideKey) {
  const options = getAircraftOptionsForSide(sideKey || getCurrentSideKey());
  if (!options.length) return '';

  const byGroup = {};
  options.forEach(ac => {
    if (!byGroup[ac.group]) byGroup[ac.group] = [];
    byGroup[ac.group].push(ac);
  });

  return Object.entries(byGroup).map(([group, list]) => `
    <optgroup label="${group}">
      ${list.map(ac => `<option value="${ac.id}" ${ac.id === selectedId ? 'selected' : ''}>${ac.name}</option>`).join('')}
    </optgroup>`).join('');
}