// ============================================================
// 증원 페이즈 (Reinforcement Phase)
// ============================================================
// 구조:
//   - REINF_DATA[sideKey]          : 진영별 OOA 데이터 캐시 (시나리오.reinforcement.tableFiles[sideKey]에서 로드)
//   - SUPPLY_STATUS_DATA[sideKey]  : 진영별 보급 테이블(German Supply Table류) 데이터 캐시
//                                    (시나리오.reinforcement.supplyStatusTables[sideKey]에서 로드)
//   - renderReinfUI(el)            : turn.js의 PHASE_ACTIONS['f_reinf'/'s_reinf']가 호출하는 단일 진입점
//
//   OOA 데이터 스키마 (data/reinf-tables/*-ooa-*.json) — 진영별 파일 분리:
//     {
//       "gameId": "008", "side": "axis", "maps": ["GBII","EatG","CB"],
//       "schedule": [
//         { "turn": {"year":1941,"month":10,"day":1}, "schwerpunkt": "GBII", "entries": [
//           { "map": "GBII" | ["EatG","CB"] | "Any", "type": "arrival"|"optional"|"remove"|"conditional"|"exchange"|"note",
//             "condition": "...", "pool": "emergency", "description": "...", "text": "...",
//             "units": [ { "label": "...", "components": [...] } ], "extras": [...], "note": "..." },
//           { "type": "transfer", "fromMap": "EatG", "toMap": "GBII", "units": [...], "note": "..." }
//         ]}
//       ]
//     }
//   - 맵 필터링 (Axis OOA 노트 2·3 규칙):
//     · map !== 'transfer' : entry.map(문자열/배열/"Any") 중 하나라도 scenario.reinforcement.maps에 포함되면 표시
//     · type === 'transfer': fromMap/toMap 모두 maps에 포함 → 숨김 / toMap만 포함 → 증원으로 표시 /
//                             fromMap만 포함 → 제거로 표시 / 둘 다 미포함 → 숨김
//
//   보급 테이블(German Supply Table) 데이터 스키마 (data/reinf-tables/*-supply-status-table.json):
//     {
//       "dice": "2d6",
//       "diceBuckets": [{ "key": "2-3", "min": 2, "max": 3 }, ...],
//       "columns": ["1-","2",...,"12","13+"],
//       "table": { "2-3": [..13개..], ... },
//       "supplyStatusByPeriod": [
//         { "label": "Oct-Nov 41", "start": {"year":1941,"month":10}, "end": {"year":1941,"month":11}|null,
//           "values": { "GBII": 6, "EatG": 2, "CB": 0 } }
//       ],
//       "modifiers": [
//         { "id": "schwerpunkt", "label": "...", "amount": 2, "auto": true },   // OOA의 schwerpunkt 필드로 자동 판정
//         { "id": "maikop", "label": "...", "amount": 1, "auto": false }        // 사용자가 체크박스로 직접 토글
//       ]
//     }
//   - Supply Status = scenario.reinforcement.supplyMaps(또는 maps) 중 현재 기간에 해당하는 값의 합
//                     + (schwerpunkt가 활성 맵에 포함되면 자동 +해당 amount)
//                     + (사용자가 체크한 수동 modifier들의 amount)
//   - 2d6을 굴려 diceBuckets로 행을 정하고, Supply Status를 컬럼에 맞게 clamp(1- / 13+)해 결과 SP를 조회
// ============================================================

let REINF_DATA               = {}; // { [sideKey]: OOA 데이터 }
let SUPPLY_STATUS_DATA       = {}; // { [sideKey]: 보급 테이블 데이터 }
let _reinfLoadedKeys         = new Set(); // 로드 완료(또는 시도 완료)된 "scenarioId:sideKey" 집합 — 진영별로 독립 캐시
let _reinfLastTurnSideKey    = null;      // 마지막으로 렌더링된 턴+진영 key (변경 시 굴림 상태 초기화)

let reinfSupplyRollState  = null; // { d1, d2, total, status, resultText }
let reinfReplaceRollState = null; // { d1, d2, total, resultText }
let reinfSupplyModifiers  = {};   // { [modifierId]: boolean } — 수동 modifier 체크 상태 (턴 변경에도 유지)

// ── 데이터 로드 ──────────────────────────────────────────────
function loadReinforcementTable(scenario, sideKey) {
  const file = scenario?.reinforcement?.tableFiles?.[sideKey];
  if (!file) { REINF_DATA[sideKey] = null; return Promise.resolve(null); }
  return fetch(`data/${file}`)
    .then(r => r.json())
    .then(data => { REINF_DATA[sideKey] = data; return data; })
    .catch(() => { REINF_DATA[sideKey] = null; return null; });
}

function loadSupplyStatusTable(scenario, sideKey) {
  const file = scenario?.reinforcement?.supplyStatusTables?.[sideKey];
  if (!file) { SUPPLY_STATUS_DATA[sideKey] = null; return Promise.resolve(null); }
  return fetch(`data/${file}`)
    .then(r => r.json())
    .then(data => { SUPPLY_STATUS_DATA[sideKey] = data; return data; })
    .catch(() => { SUPPLY_STATUS_DATA[sideKey] = null; return null; });
}

// ── 단일 렌더링 진입점 ─────────────────────────────────────────
function renderReinfUI(el) {
  if (!el) return;

  const sideKey = getSideKeyForStep(state.step);
  const loadKey = `${currentScenario?.id || ''}:${sideKey}`;

  // 이 진영의 데이터를 아직 로드한 적 없으면 (재)로드 후 다시 렌더
  // (진영별로 독립적으로 캐시하므로, 진영을 왕복해도 이미 로드된 쪽은 재요청하지 않음)
  if (!_reinfLoadedKeys.has(loadKey)) {
    el.innerHTML = `<div class="card"><p class="phase-action-desc">증원 데이터 로딩 중...</p></div>`;
    Promise.all([
      loadReinforcementTable(currentScenario, sideKey),
      loadSupplyStatusTable(currentScenario, sideKey),
    ]).then(() => {
      _reinfLoadedKeys.add(loadKey);
      const liveEl = document.getElementById('phaseActionContent');
      if (liveEl) renderReinfUI(liveEl);
    });
    return;
  }

  const sideLabel    = (sideKey && currentScenario?.sides?.[sideKey]?.label) || sideKey || '—';
  const activeMaps   = currentScenario?.reinforcement?.maps || [];
  const sideData     = REINF_DATA[sideKey] || null;
  const supplyData   = SUPPLY_STATUS_DATA[sideKey] || null;

  // 턴 또는 진영이 바뀌면 이전 굴림 상태 초기화 (modifier 체크 상태는 유지 — 보드 상태이므로)
  const turnSideKey = `${state.year}-${state.month}-${state.day}-${sideKey}`;
  if (_reinfLastTurnSideKey !== turnSideKey) {
    _reinfLastTurnSideKey  = turnSideKey;
    reinfSupplyRollState   = null;
    reinfReplaceRollState  = null;
  }

  el.innerHTML = `
    <div class="phase-info-ui reinf-ui">
      ${renderReinfUnitsCard(sideData, activeMaps, sideLabel)}
      <div class="reinf-roll-row">
        ${renderGermanSupplyCard(supplyData, sideData, activeMaps)}
        ${renderReinfReplaceCard(sideData)}
      </div>
      ${renderReinfReorgCard()}
    </div>`;
}

// ── 맵 필터링 — 노트 2·3 규칙 적용 ────────────────────────────────
// 반환: null (숨김) | { displayType, displayMapNote }
function resolveEntryVisibility(entry, activeMaps) {
  if (entry.type === 'transfer') {
    const fromIn = activeMaps.includes(entry.fromMap);
    const toIn   = activeMaps.includes(entry.toMap);
    if (fromIn && toIn) return null;                 // 둘 다 포함 → 무시 (내부 이동)
    if (toIn)  return { displayType: 'arrival', displayMapNote: `${entry.fromMap} → ${entry.toMap} 이동` };
    if (fromIn) return { displayType: 'remove',  displayMapNote: `${entry.fromMap} → ${entry.toMap} 이동 (철수)` };
    return null;                                      // 둘 다 미포함 → 무시
  }

  const maps = Array.isArray(entry.map) ? entry.map : [entry.map];
  if (maps.includes('Any')) return { displayType: entry.type, displayMapNote: null };
  const visible = maps.some(m => activeMaps.includes(m));
  return visible ? { displayType: entry.type, displayMapNote: null } : null;
}

const REINF_TYPE_LABEL = {
  arrival:     null,
  optional:    '[선택]',
  remove:      '[제거/철수]',
  conditional: '[조건부]',
  exchange:    '[교체]',
  note:        '[참고]',
};

// ── 증원 유닛 출력 ───────────────────────────────────────────
function renderReinfUnitsCard(sideData, activeMaps, sideLabel) {
  if (!sideData) {
    return `
      <div class="card">
        <div class="card-title"><span class="icon">🪖</span> 증원 유닛</div>
        <p class="phase-action-desc">이 진영의 증원 테이블(OOA) 데이터가 아직 등록되지 않았습니다.</p>
      </div>`;
  }

  const turnEntry = (sideData.schedule || []).find(t =>
    t.turn && t.turn.year === state.year && t.turn.month === state.month && t.turn.day === state.day
  );

  const visibleEntries = (turnEntry?.entries || [])
    .map(e => ({ entry: e, vis: resolveEntryVisibility(e, activeMaps) }))
    .filter(x => x.vis);

  if (!visibleEntries.length) {
    return `
      <div class="card">
        <div class="card-title"><span class="icon">🪖</span> 증원 유닛 — ${sideLabel}</div>
        <p class="phase-action-desc">이번 턴 ${sideLabel} 증원 유닛이 없습니다.</p>
      </div>`;
  }

  const rows = visibleEntries.map(({ entry, vis }) => {
    const tag      = REINF_TYPE_LABEL[vis.displayType] || `[${vis.displayType}]`;
    const condText = entry.condition ? ` <em>(${entry.condition})</em>` : '';
    const mapNote  = vis.displayMapNote ? ` <span class="reinf-map-note">${vis.displayMapNote}</span>` : '';

    if (entry.type === 'exchange') {
      return `<li>${tag ? `<strong>${tag}</strong> ` : ''}${entry.description}</li>`;
    }
    if (entry.type === 'note') {
      return `<li>${tag ? `<strong>${tag}</strong> ` : ''}${entry.text}</li>`;
    }

    const unitsText = (entry.units || []).map(u => {
      const comp = u.components && u.components.length ? ` (${u.components.join(', ')})` : '';
      const note = u.note ? ` — ${u.note}` : '';
      return `${u.label}${comp}${note}`;
    }).join(', ');

    const extrasText = (entry.extras || []).map(x => `${x.amount} ${x.kind}`).join(', ');
    const noteText   = entry.note ? `<br><span class="reinf-entry-note">※ ${entry.note}</span>` : '';

    return `<li>${tag ? `<strong>${tag}</strong> ` : ''}${unitsText}${extrasText ? `, ${extrasText}` : ''}${condText}${mapNote}${noteText}</li>`;
  }).join('');

  return `
    <div class="card">
      <div class="card-title"><span class="icon">🪖</span> 증원 유닛 — ${sideLabel}</div>
      <ul class="phase-info-list">${rows}</ul>
    </div>`;
}

// ── 보급 테이블 (German Supply Table류) — Supply Status 산출 + 2d6 굴림 ────
function findSupplyStatusPeriod(supplyData) {
  const ym = state.year * 100 + state.month;
  return (supplyData.supplyStatusByPeriod || []).find(p => {
    const startYm = p.start.year * 100 + p.start.month;
    const endYm   = p.end ? (p.end.year * 100 + p.end.month) : Infinity;
    return ym >= startYm && ym <= endYm;
  }) || null;
}

// OOA schedule에서 현재 턴 이전(포함)에 지정된 가장 최근 schwerpunkt를 찾음
function getCurrentSchwerpunkt(sideData) {
  if (!sideData) return null;
  const curNum = state.year * 10000 + state.month * 100 + state.day;
  let best = null, bestNum = -Infinity;
  (sideData.schedule || []).forEach(t => {
    if (t.schwerpunkt && t.turn) {
      const n = t.turn.year * 10000 + t.turn.month * 100 + (t.turn.day || 1);
      if (n <= curNum && n > bestNum) { bestNum = n; best = t.schwerpunkt; }
    }
  });
  return best;
}

function computeSupplyStatus(supplyData, sideData, activeMaps) {
  const period      = findSupplyStatusPeriod(supplyData);
  const supplyMaps  = currentScenario?.reinforcement?.supplyMaps || activeMaps;
  const breakdown   = [];
  let total = 0;

  if (period) {
    supplyMaps.forEach(m => {
      const v = period.values[m];
      if (v !== undefined) { total += v; breakdown.push({ label: m, amount: v }); }
    });
  }

  const schwerpunkt = getCurrentSchwerpunkt(sideData);
  (supplyData.modifiers || []).forEach(mod => {
    if (mod.auto) {
      if (mod.id === 'schwerpunkt' && schwerpunkt && activeMaps.includes(schwerpunkt)) {
        total += mod.amount;
        breakdown.push({ label: `${mod.label} (${schwerpunkt})`, amount: mod.amount });
      }
    } else if (reinfSupplyModifiers[mod.id]) {
      total += mod.amount;
      breakdown.push({ label: mod.label, amount: mod.amount });
    }
  });

  return { total, breakdown, periodLabel: period?.label || null };
}

function clampSupplyColumnIndex(columns, statusTotal) {
  if (statusTotal <= 1) return 0;
  if (statusTotal >= columns.length - 1) return columns.length - 1;
  return statusTotal - 1; // columns[1] === "2" → statusTotal 2 → index 1
}

function renderGermanSupplyCard(supplyData, sideData, activeMaps) {
  if (!supplyData) {
    return `
      <div class="card reinf-roll-card">
        <div class="card-title"><span class="icon">📦</span> 보급 테이블 (증원 SP)</div>
        <p class="phase-action-desc">이 시나리오는 보급 테이블 굴림이 없습니다.</p>
      </div>`;
  }

  const status      = computeSupplyStatus(supplyData, sideData, activeMaps);
  const manualMods  = (supplyData.modifiers || []).filter(m => !m.auto);
  const roll        = reinfSupplyRollState;

  return `
    <div class="card reinf-roll-card">
      <div class="card-title">
        <span class="icon">📦</span> ${supplyData.label}
        ${supplyData.rule ? `<span class="air-step-en">${supplyData.rule}</span>` : ''}
      </div>
      ${status.periodLabel ? `<p class="phase-action-desc" style="margin-top:6px;">기간: ${status.periodLabel}</p>` : ''}

      <div class="reinf-status-breakdown">
        ${status.breakdown.map(b => `<div class="reinf-status-row"><span>${b.label}</span><span>+${b.amount}</span></div>`).join('')}
        <div class="reinf-status-row reinf-status-total"><span>Supply Status</span><span>${status.total}</span></div>
      </div>

      ${manualMods.length ? `
        <div class="field-group" style="margin-top:8px;">
          ${manualMods.map(m => `
            <label class="supply-drm-check">
              <input type="checkbox" ${reinfSupplyModifiers[m.id] ? 'checked' : ''} onchange="reinfToggleModifier('${m.id}')">
              ${m.label} (+${m.amount})
            </label>`).join('')}
        </div>` : ''}

      <div class="combat-dice-inner" style="margin-top:10px;">
        <div class="combat-dice-controls">
          <button class="dice-roll-btn combat-btn" style="width:100%;" onclick="reinfRollSupplyStatus()">
            <span class="roll-label">보급 굴림</span>
            <span class="roll-formula">${supplyData.dice || '2d6'}</span>
          </button>
        </div>
        <div class="combat-dice-result-wrap">
          <div class="dice-result-area combat-dice-result">
            ${roll ? renderReinfDiceHTML(roll) : `<span class="dice-placeholder">버튼을 눌러 굴리세요</span>`}
          </div>
          ${roll ? `<div class="supply-result-box supply-result-box-big"><strong>🛢️ ${roll.resultText} SP</strong></div>` : ''}
        </div>
      </div>
    </div>`;
}

function reinfToggleModifier(id) {
  reinfSupplyModifiers[id] = !reinfSupplyModifiers[id];
  const el = document.getElementById('phaseActionContent');
  if (el) renderReinfUI(el);
}

function reinfRollSupplyStatus() {
  const sideKey    = getSideKeyForStep(state.step);
  const supplyData = SUPPLY_STATUS_DATA[sideKey];
  if (!supplyData) return;
  const sideData   = REINF_DATA[sideKey];
  const activeMaps = currentScenario?.reinforcement?.maps || [];
  const status     = computeSupplyStatus(supplyData, sideData, activeMaps);

  const r = () => Math.floor(Math.random() * 6) + 1;
  const d1 = r(), d2 = r();
  const total = d1 + d2;

  const bucket   = (supplyData.diceBuckets || []).find(b => total >= b.min && total <= b.max);
  const colIdx   = clampSupplyColumnIndex(supplyData.columns, status.total);
  const resultText = bucket ? supplyData.table[bucket.key][colIdx] : '—';

  reinfSupplyRollState = { d1, d2, total, status: status.total, resultText };

  const el = document.getElementById('phaseActionContent');
  if (el) renderReinfUI(el);
}

// ── 보충 테이블 (간단한 flat 2d6/1d6 → 결과 매핑) ────────────────────
function renderReinfReplaceCard(sideData) {
  const cfg = sideData?.replacementRoll;

  if (!sideData || !cfg) {
    return `
      <div class="card reinf-roll-card">
        <div class="card-title"><span class="icon">🔧</span> 보충 테이블</div>
        <p class="phase-action-desc">이 시나리오는 보충 테이블 굴림이 없습니다.</p>
      </div>`;
  }

  const rollState = reinfReplaceRollState;

  return `
    <div class="card reinf-roll-card">
      <div class="card-title">
        <span class="icon">🔧</span> ${cfg.label || '보충 테이블'}
        ${cfg.rule ? `<span class="air-step-en">${cfg.rule}</span>` : ''}
      </div>
      ${cfg.description ? `<p class="phase-action-desc" style="margin-top:6px;">${cfg.description}</p>` : ''}

      <div class="combat-dice-inner">
        <div class="combat-dice-controls">
          <button class="dice-roll-btn combat-btn" style="width:100%;" onclick="reinfReplaceRoll()">
            <span class="roll-label">굴림</span>
            <span class="roll-formula">${cfg.dice || '1d6'}</span>
          </button>
        </div>
        <div class="combat-dice-result-wrap">
          <div class="dice-result-area combat-dice-result">
            ${rollState ? renderReinfDiceHTML(rollState) : `<span class="dice-placeholder">버튼을 눌러 굴리세요</span>`}
          </div>
          ${rollState ? `<div class="supply-result-box">${rollState.resultText}</div>` : ''}
        </div>
      </div>
    </div>`;
}

function reinfReplaceRoll() {
  const sideKey = getSideKeyForStep(state.step);
  const cfg     = REINF_DATA[sideKey]?.replacementRoll;
  if (!cfg || !cfg.table) return;

  const r = () => Math.floor(Math.random() * 6) + 1;
  const twoDice = cfg.dice === '2d6';
  const d1 = r();
  const d2 = twoDice ? r() : null;
  const total = twoDice ? d1 + d2 : d1;

  reinfReplaceRollState = { d1, d2, total, resultText: cfg.table[String(total)] ?? '—' };

  const el = document.getElementById('phaseActionContent');
  if (el) renderReinfUI(el);
}

function renderReinfDiceHTML(roll) {
  const dice = supplyDieBadge(roll.d1) + (roll.d2 !== null && roll.d2 !== undefined ? supplyDieBadge(roll.d2) : '');
  return `${dice}<div class="dice-total">${roll.total}</div>`;
}

// ── 유닛 재편성 / 통합 안내 ──────────────────────────────────────
function renderReinfReorgCard() {
  return `
    <div class="card">
      <div class="card-title"><span class="icon">🔄</span> 유닛 재편성 / 통합</div>
      <ul class="phase-info-list">
        <li>이 페이즈에 유닛의 <strong>재편(Reorganization)</strong> 및 <strong>통합(Consolidation)</strong>을 수행할 수 있습니다.</li>
        <li>세부 조건 및 비용은 룰북을 참고하세요.<br>
            <span style="font-size:0.78rem;color:var(--ink-faded);">※ 현재 본 앱에는 별도 판정/계산 기능이 추가되지 않았습니다.</span></li>
      </ul>
    </div>`;
}
