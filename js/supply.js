// ============================================================
// 보급 판정 (Supply Tables) — 소모 / 포획 / 보급 파괴
// ============================================================
// 구조:
//   - loadSupplyTables() : data/supply-tables/*.json 3개를 fetch, SUPPLY_TABLES에 캐시
//   - supplyUI()          : 단일 렌더링 진입점. supplyAction에 따라 분기.
//   - 소모(attrition) / 포획(capture) / 보급 파괴(destruction) 각각 독립 상태 객체 사용
// ============================================================

let SUPPLY_TABLES   = null;   // { attrition, capture, destruction }
let supplyAction     = null;  // null | 'attrition' | 'capture' | 'destruction'

const SUPPLY_ACTIONS = [
  { id: 'attrition',   label: '소모 판정',     en: 'Attrition Table',          icon: '💀' },
  { id: 'capture',     label: '포획 판정',     en: 'Capture Table',            icon: '🎯' },
  { id: 'destruction', label: '보급 파괴 판정', en: 'Supply Destruction Table', icon: '🔥' },
];

function loadSupplyTables() {
  if (SUPPLY_TABLES) return Promise.resolve(SUPPLY_TABLES);
  const files = ['attrition-table', 'capture-table', 'supply-destruction-table'];
  return Promise.all(files.map(f =>
    fetch(`data/supply-tables/${f}.json`).then(r => r.json())
  )).then(([attrition, capture, destruction]) => {
    SUPPLY_TABLES = { attrition, capture, destruction };
    return SUPPLY_TABLES;
  }).catch(() => { SUPPLY_TABLES = null; return null; });
}

// ── 공용 헬퍼 ────────────────────────────────────────────────
function roundHalfUp(x) { return Math.floor(x + 0.5); }

function formatSPT(totalT) {
  const sp = Math.floor(totalT / 4);
  const t  = totalT - sp * 4;
  const parts = [];
  if (sp > 0) parts.push(`${sp}SP`);
  if (t > 0 || sp === 0) parts.push(`${t}T`);
  return parts.join(' ');
}

// ── 단일 렌더링 진입점 ─────────────────────────────────────────
function supplyUI() {
  const el = document.getElementById('supplyContent');
  if (!el) return;
  if (!SUPPLY_TABLES) { el.innerHTML = `<div class="card"><p class="phase-action-desc">테이블 로딩 중...</p></div>`; return; }
  if      (!supplyAction)               el.innerHTML = renderSupplyActionSelect();
  else if (supplyAction === 'attrition')   el.innerHTML = renderAttritionTable();
  else if (supplyAction === 'capture')     el.innerHTML = renderCaptureTable();
  else if (supplyAction === 'destruction') el.innerHTML = renderDestructionTable();
}

// app.js에서 호출하는 초기화 별칭
function renderSupplyActionGrid() {
  loadSupplyTables().then(() => supplyUI());
}

// ── 임무 선택 화면 ──────────────────────────────────────────────
function renderSupplyActionSelect() {
  return `
    <div class="card">
      <div class="card-title"><span class="icon">📦</span> 보급 판정 선택</div>
      <div class="air-action-grid">
        ${SUPPLY_ACTIONS.map(a => `
          <button class="air-action-btn" onclick="selectSupplyAction('${a.id}')">
            <span class="air-action-icon">${a.icon}</span>
            <span class="air-action-label">${a.label}</span>
            <span class="air-action-en">${a.en}</span>
          </button>
        `).join('')}
      </div>
    </div>`;
}

function selectSupplyAction(id) {
  supplyAction = id;
  if      (id === 'attrition')   attrInit();
  else if (id === 'capture')     captureInit();
  else if (id === 'destruction') destructionInit();
  supplyUI();
}

function backToSupplySelect() {
  supplyAction = null;
  supplyUI();
}

function supplyBackBtn() {
  return `<button class="air-back-btn" onclick="backToSupplySelect()">← 보급 판정 선택으로</button>`;
}

// ─────────────────────────────────────────────────────────────
// ██  소모 판정표 (Attrition Table — Rule 12.8b)
// ─────────────────────────────────────────────────────────────
let attrState = { ar: null, drm: false, roll: null };

function attrInit() { attrState = { ar: null, drm: false, roll: null }; }

function attrSetAR(v) { attrState.ar = v; attrState.roll = null; supplyUI(); }
function attrToggleDRM() { attrState.drm = !attrState.drm; attrState.roll = null; supplyUI(); }

function attrRoll() {
  if (attrState.ar === null) return;
  const r = () => Math.floor(Math.random() * 6) + 1;
  const d1 = r(), d2 = r();
  const drmVal = attrState.drm ? 3 : 0;
  const total = d1 + d2 + drmVal;
  const col = SUPPLY_TABLES.attrition.table[String(attrState.ar)];
  const seg = col.find(s => s.max === null || total <= s.max);
  attrState.roll = { d1, d2, drmVal, total, resultCode: seg.result };
  supplyUI();
}

function renderAttritionTable() {
  const t = SUPPLY_TABLES.attrition;
  const roll = attrState.roll;
  const resultDef = roll ? t.results[roll.resultCode] : null;

  return `
    <div class="card">
      <div class="card-title"><span class="icon">💀</span> ${t.label} <span class="air-step-en">${t.rule}</span></div>
      ${supplyBackBtn()}
      <p class="phase-action-desc" style="margin-top:10px;">${t.description}</p>

      <div class="field-group" style="margin-top:12px;">
        <label class="field-label">스택 내 최고 AR (Attack Rating)</label>
        <div class="supply-ar-btns">
          ${t.columns.map(c => `
            <button class="supply-ar-btn${attrState.ar === c ? ' active' : ''}" onclick="attrSetAR('${c}')">${c}</button>
          `).join('')}
        </div>
      </div>

      <div class="field-group">
        <label class="supply-drm-check">
          <input type="checkbox" ${attrState.drm ? 'checked' : ''} onchange="attrToggleDRM()">
          헥스 내 유닛 스텝 총합 5 이상 (+3 DRM)
        </label>
      </div>
    </div>

    <div class="card">
      <div class="card-title"><span class="icon">🎲</span> 소모 판정 굴림 (2d6)</div>
      <div class="combat-dice-inner">
        <div class="combat-dice-controls">
          <div class="combat-roll-btns">
            <button class="dice-roll-btn combat-btn" style="width:100%;" ${attrState.ar === null ? 'disabled' : ''} onclick="attrRoll()">
              <span class="roll-label">소모 판정 굴림</span>
              <span class="roll-formula">2d6</span>
            </button>
          </div>
        </div>
        <div class="combat-dice-result-wrap">
          <div class="dice-result-area combat-dice-result" id="attrDiceResult">
            ${roll ? renderAttrDiceHTML(roll) : `<span class="dice-placeholder">AR을 선택하고 굴리세요</span>`}
          </div>
          ${resultDef ? `<div class="supply-result-box result-${roll.resultCode}">${resultDef.label}</div>` : ''}
        </div>
      </div>
    </div>`;
}

function renderAttrDiceHTML(roll) {
  let drmDesc = `${roll.d1}+${roll.d2}`;
  if (roll.drmVal) drmDesc += ` +${roll.drmVal}`;
  drmDesc += ` = ${roll.total}`;
  return `
    ${supplyDieBadge(roll.d1)}
    ${supplyDieBadge(roll.d2)}
    <div class="dice-total">${roll.total}<small>${drmDesc}</small></div>`;
}

function supplyDieBadge(v, color = 'ivory') {
  return `<div class="die-wrap">${makeDieFaceHTML(v, color)}<div class="die-val">${v}</div></div>`;
}

// ─────────────────────────────────────────────────────────────
// ██  포획 판정표 (Capture Table — Rule 9.14b & 9.14c)
// ─────────────────────────────────────────────────────────────
let capTableState = null;

function captureInit() {
  capTableState = {};
  SUPPLY_TABLES?.capture?.categories.forEach(c => {
    capTableState[c.id] = { sp: 0, t: 0, roll: null };
  });
}

function capSetSP(cat, val) {
  capTableState[cat].sp = Math.max(0, Math.floor(parseFloat(val)) || 0);
  capTableState[cat].roll = null;
}

function capSetT(cat, val) {
  capTableState[cat].t = Math.max(0, Math.floor(parseFloat(val)) || 0);
  capTableState[cat].roll = null;
}

function capRoll(cat) {
  const r = () => Math.floor(Math.random() * 6) + 1;
  const roll = r();
  const pct = SUPPLY_TABLES.capture.table[cat][String(roll)];
  const st = capTableState[cat];
  const totalT = st.sp * 4 + st.t;
  const capturedT = roundHalfUp(totalT * pct / 100);
  capTableState[cat].roll = { roll, pct, capturedT };
  supplyUI();
}

function renderCaptureTable() {
  const t = SUPPLY_TABLES.capture;
  if (!capTableState) captureInit();

  return `
    <div class="card">
      <div class="card-title"><span class="icon">🎯</span> ${t.label} <span class="air-step-en">${t.rule}</span></div>
      ${supplyBackBtn()}
      <p class="phase-action-desc" style="margin-top:10px;">${t.description}</p>
    </div>

    ${t.categories.map(cat => renderCaptureCategoryCard(t, cat)).join('')}

    <div class="card">
      <p class="phase-action-desc">${t.note}</p>
    </div>`;
}

function renderCaptureCategoryCard(t, cat) {
  const st = capTableState[cat.id];
  const roll = st.roll;

  return `
    <div class="card">
      <div class="card-title">${cat.label} <span class="air-step-en">${cat.en}</span></div>
      <div class="field-group">
        <label class="field-label">보유량</label>
        <div class="supply-spt-row">
          <input type="number" class="field-input" min="0" step="1" value="${st.sp}"
                 oninput="capSetSP('${cat.id}', this.value)" style="max-width:90px;">
          <span class="supply-spt-unit">SP</span>
          <span class="supply-spt-plus">+</span>
          <input type="number" class="field-input" min="0" step="1" value="${st.t}"
                 oninput="capSetT('${cat.id}', this.value)" style="max-width:90px;">
          <span class="supply-spt-unit">T</span>
        </div>
      </div>

      <div class="combat-dice-inner">
        <div class="combat-dice-controls">
          <button class="dice-roll-btn combat-btn" style="width:100%;" onclick="capRoll('${cat.id}')">
            <span class="roll-label">포획 판정 굴림</span>
            <span class="roll-formula">1d6</span>
          </button>
        </div>
        <div class="combat-dice-result-wrap">
          <div class="dice-result-area combat-dice-result">
            ${roll ? renderCapDiceHTML(roll) : `<span class="dice-placeholder">굴리세요</span>`}
          </div>
          ${roll ? `<div class="supply-result-box">${roll.pct}% 포획 → <strong>${formatSPT(roll.capturedT)}</strong></div>` : ''}
        </div>
      </div>

      <ul class="phase-info-list" style="margin-top:10px;">
        ${cat.footnotes.map(n => `<li>${t.footnotes[n]}</li>`).join('')}
      </ul>
    </div>`;
}

function renderCapDiceHTML(roll) {
  return `
    ${supplyDieBadge(roll.roll)}
    <div class="dice-total">${roll.roll}<small>주사위</small></div>`;
}

// ─────────────────────────────────────────────────────────────
// ██  보급 파괴 판정표 (Supply Destruction Table — Rule 12.11a)
// ─────────────────────────────────────────────────────────────
let destState = { sp: 0, t: 0, roll: null };

function destructionInit() { destState = { sp: 0, t: 0, roll: null }; }

function destSetSP(val) { destState.sp = Math.max(0, Math.floor(parseFloat(val)) || 0); destState.roll = null; }
function destSetT(val)  { destState.t  = Math.max(0, Math.floor(parseFloat(val)) || 0); destState.roll = null; }

function destRoll() {
  const r = () => Math.floor(Math.random() * 6) + 1;
  const roll = r();
  const pct = SUPPLY_TABLES.destruction.table[String(roll)];
  const totalT = destState.sp * 4 + destState.t;
  const destroyedT = roundHalfUp(totalT * pct / 100);
  destState.roll = { roll, pct, destroyedT };
  supplyUI();
}

function renderDestructionTable() {
  const t = SUPPLY_TABLES.destruction;
  const roll = destState.roll;

  return `
    <div class="card">
      <div class="card-title"><span class="icon">🔥</span> ${t.label} <span class="air-step-en">${t.rule}</span></div>
      ${supplyBackBtn()}
      <p class="phase-action-desc" style="margin-top:10px;">${t.description}</p>

      <div class="field-group" style="margin-top:12px;">
        <label class="field-label">대상량</label>
        <div class="supply-spt-row">
          <input type="number" class="field-input" min="0" step="1" value="${destState.sp}"
                 oninput="destSetSP(this.value)" style="max-width:90px;">
          <span class="supply-spt-unit">SP</span>
          <span class="supply-spt-plus">+</span>
          <input type="number" class="field-input" min="0" step="1" value="${destState.t}"
                 oninput="destSetT(this.value)" style="max-width:90px;">
          <span class="supply-spt-unit">T</span>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-title"><span class="icon">🎲</span> 보급 파괴 판정 굴림 (1d6)</div>
      <div class="combat-dice-inner">
        <div class="combat-dice-controls">
          <button class="dice-roll-btn combat-btn" style="width:100%;" onclick="destRoll()">
            <span class="roll-label">보급 파괴 굴림</span>
            <span class="roll-formula">1d6</span>
          </button>
        </div>
        <div class="combat-dice-result-wrap">
          <div class="dice-result-area combat-dice-result">
            ${roll ? renderDestDiceHTML(roll) : `<span class="dice-placeholder">SP를 입력하고 굴리세요</span>`}
          </div>
          ${roll ? `<div class="supply-result-box">${roll.pct}% 파괴 → <strong>${formatSPT(roll.destroyedT)} 파괴</strong></div>` : ''}
        </div>
      </div>
    </div>`;
}

function renderDestDiceHTML(roll) {
  return `
    ${supplyDieBadge(roll.roll)}
    <div class="dice-total">${roll.roll}<small>주사위</small></div>`;
}
