// ============================================================
// 포격/폭격 (Barrage)
// ============================================================
// 테이블 데이터(BRT_COLS/BRT/DENSITY_*/CHECKLIST, FBRT_COLS/FBRT_RAW)는
// data/barrage-tables/*.json 에서 fetch — loadBarrageTables() 참고.

let BRT_COLS         = null;
let BRT              = null;
let DENSITY_SHIFT    = null;
let DENSITY_LABEL    = null;
let BRT_RESULT_LABEL = null;
let CHECKLIST        = null;
let FBRT_COLS        = null;
let FBRT_RAW         = null;

let _barrageTablesLoaded = null; // 로딩 완료 후의 Promise 캐시

function loadBarrageTables() {
  if (_barrageTablesLoaded) return _barrageTablesLoaded;
  _barrageTablesLoaded = Promise.all([
    fetch('data/barrage-tables/barrage-table.json').then(r => r.json()),
    fetch('data/barrage-tables/facility-bombardment-table.json').then(r => r.json()),
  ]).then(([brt, fbrt]) => {
    // JSON은 Infinity를 표현할 수 없어 null로 저장 — 로드 시점에 복원
    BRT_COLS = brt.cols.map(c => ({ ...c, max: c.max === null ? Infinity : c.max }));
    BRT              = brt.table;
    DENSITY_SHIFT    = brt.densityShift;
    DENSITY_LABEL    = brt.densityLabel;
    BRT_RESULT_LABEL = brt.resultLabel;
    CHECKLIST        = brt.checklist;
    FBRT_COLS = fbrt.cols.map(c => ({ ...c, max: c.max === null ? Infinity : c.max }));
    FBRT_RAW  = fbrt.table;
  }).catch(() => {
    _barrageTablesLoaded = null; // 실패 시 재시도 가능하도록 캐시 해제
  });
  return _barrageTablesLoaded;
}

// 함선 포격 결과 조정
// [1/2], 1/2 → DG, 1 → 1/2, 2 → 1, 3 → 2
function applyNavalAdjustment(raw) {
  if (raw === 'HALF_COND' || raw === 'HALF') return { adjusted: 'DG',  note: '함선 포격: 1/2 → DG' };
  if (raw === '1')                           return { adjusted: 'HALF', note: '함선 포격: 1 → 1/2' };
  if (raw === '2')                           return { adjusted: '1',    note: '함선 포격: 2 → 1 스텝' };
  if (raw === '3')                           return { adjusted: '2',    note: '함선 포격: 3 → 2 스텝' };
  return { adjusted: raw, note: '' };
}

function getBRTResultDesc(raw, barrageType, hasObserver, fortLevel) {
  // 함선 포격 조정 먼저 적용
  let effectiveRaw = raw;
  let navalNote = '';
  if (barrageType === 'naval') {
    const { adjusted, note } = applyNavalAdjustment(raw);
    effectiveRaw = adjusted;
    navalNote = note;
  }

  if (effectiveRaw === 'HALF_COND') {
    const isDegraded =
      fortLevel >= 3 ||
      barrageType === 'air' ||
      barrageType === 'naval' ||
      !hasObserver;
    if (isDegraded) return { display: 'DG', desc: (navalNote ? navalNote + ' → ' : '') + '[1/2] → DG 적용', cls: 'brt-dg' };
    return { display: '1/2', desc: '[1/2] — 주사위 4-6: 1스텝+DG / 1-3: DG', cls: 'brt-half' };
  }
  if (effectiveRaw === 'HALF') {
    return { display: '1/2', desc: (navalNote || '') + (navalNote ? '' : '') + ' 주사위 4-6: 1스텝+DG / 1-3: DG', cls: 'brt-half', navalNote };
  }
  const label = BRT_RESULT_LABEL[effectiveRaw];
  return { display: label.text, desc: navalNote, cls: label.cls };
}

function getBarrageColIndex(str) {
  for (let i = 0; i < BRT_COLS.length; i++) {
    if (str <= BRT_COLS[i].max) return i;
  }
  return BRT_COLS.length - 1;
}

let barrageType    = 'artillery';
let barrageFort    = 0;
let barrageDensity = 'le3';

function getChecklistShift() {
  const checks = document.querySelectorAll('.bcl-item input[type=checkbox]');
  let total = 0;
  checks.forEach((cb, i) => { if (cb.checked) total += CHECKLIST[i].shift; });
  return total;
}

function setBarrageType(type, btn) {
  barrageType = type;
  document.querySelectorAll('.btype-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  calcBarrage();
}

function setBarrageFort(val, btn) {
  barrageFort = val;
  document.querySelectorAll('.barrage-fort-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  calcBarrage();
}

function setDensity(val, btn) {
  barrageDensity = val;
  document.querySelectorAll('.density-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  calcBarrage();
}

function calcBarrage() {
  if (!document.getElementById('barrageStr') || !BRT_COLS) return;
  const raw         = parseFloat(document.getElementById('barrageStr').value) || 0;
  const baseColIdx  = getBarrageColIndex(raw);
  const densShift   = DENSITY_SHIFT[barrageDensity];
  const checkShift  = getChecklistShift();
  const totalShift  = densShift + checkShift;
  const finalColIdx = Math.max(0, Math.min(BRT_COLS.length - 1, baseColIdx + totalShift));
  const baseCol     = BRT_COLS[baseColIdx];
  const finalCol    = BRT_COLS[finalColIdx];

  const showCost = barrageType === 'artillery';

  document.getElementById('bBaseColLabel').textContent = baseCol.label;
  document.getElementById('bColLabel').textContent     = finalCol.label;
  document.getElementById('bColCost').textContent      = showCost ? baseCol.cost : '—';

  const costEl = document.getElementById('bColCost').closest('.bcol-cost');
  if (costEl) costEl.style.display = showCost ? '' : 'none';

  const TYPE_LABEL = { artillery: '포병', air: '항공', naval: '함선' };
  const rows = [
    ['화력', raw, ''],
    ['포격 유형', TYPE_LABEL[barrageType], ''],
    ['밀집도', DENSITY_LABEL[barrageDensity], ''],
  ];
  if (densShift !== 0)
    rows.push(['밀집도 컬럼 보정', `${densShift > 0 ? '+' : ''}${densShift}`, '']);

  const checks = document.querySelectorAll('.bcl-item input[type=checkbox]');
  checks.forEach((cb, i) => {
    if (cb.checked) {
      const s = CHECKLIST[i].shift;
      rows.push([CHECKLIST[i].desc, `${s > 0 ? '+' : ''}${s}`, '']);
    }
  });

  if (totalShift !== 0)
    rows.push(['총 컬럼 보정', `${totalShift > 0 ? '+' : ''}${totalShift}`, '']);

  // 함선 포격 안내
  if (barrageType === 'naval') {
    rows.push(['※ 함선 포격 결과 조정', '[1/2]·1/2→DG / 1→1/2 / 2→1', '']);
  }

  document.getElementById('barrageBreakdown').innerHTML = rows.map(([label, val, note]) =>
    `<div class="bd-row">
      <span class="bd-label">${label}${note ? ` <span class="bd-note">${note}</span>` : ''}</span>
      <span class="bd-val">${val}</span>
    </div>`
  ).join('');
}

function rollBarrage() {
  if (!BRT_COLS) return;
  const area = document.getElementById('barrageDiceResult');
  const tag  = document.getElementById('barrageDiceTag');
  area.innerHTML = '';

  const r = () => Math.floor(Math.random() * 6) + 1;
  const [v1, v2] = [r(), r()];
  const diceVal  = v1 + v2;

  const raw         = parseFloat(document.getElementById('barrageStr').value) || 0;
  const baseColIdx  = getBarrageColIndex(raw);
  const densShift   = DENSITY_SHIFT[barrageDensity];
  const checkShift  = getChecklistShift();
  const totalShift  = densShift + checkShift;
  const finalColIdx = Math.max(0, Math.min(BRT_COLS.length - 1, baseColIdx + totalShift));
  const baseCol     = BRT_COLS[baseColIdx];
  const finalCol    = BRT_COLS[finalColIdx];

  const obsCheck = document.querySelectorAll('.bcl-item input[type=checkbox]')[6];
  const hasNoObs = obsCheck && obsCheck.checked;

  const rowIdx    = Math.min(Math.max(diceVal - 2, 0), 10);
  const rawResult = BRT[rowIdx][finalColIdx];
  const { display, desc, cls } = getBRTResultDesc(rawResult, barrageType, !hasNoObs, barrageFort);

  area.appendChild(makeDie(v1, 'ivory'));
  area.appendChild(makeDie(v2, 'ivory'));

  let lossRollVal = null;
  let lossResult  = null;
  const needsLossRoll = display === '1/2';
  if (needsLossRoll) {
    lossRollVal = r();
    lossResult  = lossRollVal >= 4 ? '1 스텝 손실 + DG' : 'DG만';
  }

  let lossHtml = '';
  if (needsLossRoll) {
    const lossClass = lossRollVal >= 4 ? 'brt-step' : 'brt-dg';
    lossHtml = `
      <div class="loss-roll-row">
        <span class="loss-roll-label">손실 굴림</span>
        <span class="loss-die-val">${lossRollVal}</span>
        <span class="loss-roll-result ${lossClass}">${lossResult}</span>
      </div>`;
  }

  const colDesc = baseColIdx !== finalColIdx
    ? `${baseCol.label} → ${finalCol.label} (${totalShift > 0 ? '+' : ''}${totalShift})`
    : finalCol.label;

  const modDiv = document.createElement('div');
  modDiv.className = 'dice-modified-total';
  modDiv.innerHTML = `
    <div class="crt-result ${cls}">${display}</div>
    <div class="drm-line">주사위 ${diceVal} → ${colDesc} 컬럼</div>
    ${desc ? `<div class="crt-col-label">${desc}</div>` : ''}
    ${lossHtml}`;
  area.appendChild(modDiv);

  const TYPE_LABEL = { artillery: '포병', air: '항공', naval: '함선' };
  tag.textContent = `포격 굴림 — ${TYPE_LABEL[barrageType]}`;
  tag.className = 'dice-result-tag combat';
}


// ============================================================
// 시설 포격/폭격 (Facility Barrage/Bombing)
// ============================================================
// FBRT_COLS / FBRT_RAW 데이터는 loadBarrageTables()에서 채워짐 (위 참고)

function parseFBRTCell(cell) {
  let num   = null;
  let star  = false;
  let paren = null;

  const parenMatch = cell.match(/\((\d+)\)/);
  if (parenMatch) paren = parseInt(parenMatch[1]);

  const core = cell.replace(/\(\d+\)/, '').trim();

  if      (core === '2*' || core === '*2') { num = 2; star = true; }
  else if (core === '1*' || core === '*1') { num = 1; star = true; }
  else if (core === '2')                   { num = 2; }
  else if (core === '1')                   { num = 1; }
  else if (core === '*')                   { star = true; }
  // '-' 또는 '' → num/star 모두 null/false

  return { num, star, paren };
}

function getFBRTColIndex(str) {
  for (let i = 0; i < FBRT_COLS.length; i++) {
    if (str <= FBRT_COLS[i].max) return i;
  }
  return FBRT_COLS.length - 1;
}

// ── 탭 전환 ──────────────────────────────────────────────────
let barrageTab = 'normal';

function setBarrageTab(tab) {
  barrageTab = tab;
  document.getElementById('barrageTabNormal').classList.toggle('active', tab === 'normal');
  document.getElementById('barrageTabFacility').classList.toggle('active', tab === 'facility');
  document.getElementById('barrageNormalContent').style.display    = tab === 'normal'   ? '' : 'none';
  document.getElementById('barrageFacilityContent').style.display  = tab === 'facility' ? '' : 'none';
  if (tab === 'facility') calcFacility();
}

// ── 대상 시설 ────────────────────────────────────────────────
const FAC_TARGET_LABEL = { rail: '철도', airbase: '항공 기지', port: '항구' };

let facilityTarget = 'rail';
let facilityUnits  = [];   // 항공 기지 개별 확인 판정용: [{ id, name, aircraftId, roll, lost }]
// (#) 판정이 발생했을 때만 채워지는 임계값. null이면 유닛 입력 카드 자체를 숨김 — 전장의 안개 보호:
// 메인 굴림 결과가 나오기 전에는 어떤 유닛이 체크 대상인지 미리 알 수 없어야 함.
let facilityCheckThreshold = null;

function setFacilityTarget(target, btn) {
  facilityTarget = target;
  document.querySelectorAll('.fac-target-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  facilityCheckThreshold = null;
  facilityUnits = [];
  renderFacilityUnitsContainer();
}

function addFacilityUnit() {
  facilityUnits.push({ id: facilityUnits.length, name: `유닛 ${facilityUnits.length + 1}`, aircraftId: null, roll: null, lost: false });
  renderFacilityUnitsContainer();
}

function removeFacilityUnit(i) {
  facilityUnits.splice(i, 1);
  facilityUnits.forEach((u, idx) => { u.id = idx; if (!u.aircraftId) u.name = `유닛 ${idx + 1}`; });
  renderFacilityUnitsContainer();
}

function facilityPickAircraft(i, aircraftId) {
  const u = facilityUnits[i];
  if (!u) return;

  if (!aircraftId) {
    u.aircraftId = null;
    u.name = `유닛 ${i + 1}`;
    renderFacilityUnitsContainer();
    return;
  }

  const sideKey = (typeof resolveSideKey === 'function') ? resolveSideKey('opposing') : null;
  const ac = (typeof getAircraftOptionsForSide === 'function')
    ? getAircraftOptionsForSide(sideKey).find(a => a.id === aircraftId)
    : null;
  if (!ac) return;

  u.aircraftId = ac.id;
  u.name       = ac.name;
  renderFacilityUnitsContainer();
}

function facilitySetUnitName(i, val) {
  const u = facilityUnits[i];
  if (u) u.name = val;
}

function rollFacilityUnitChecks() {
  if (facilityCheckThreshold === null) return;
  const r = () => Math.floor(Math.random() * 6) + 1;
  facilityUnits.forEach(u => {
    const roll = r();
    u.roll = roll;
    u.lost = roll >= facilityCheckThreshold;
  });
  renderFacilityUnitsContainer();
}

function renderFacilityUnitsHTML() {
  const sideKey    = (typeof resolveSideKey === 'function') ? resolveSideKey('opposing') : null;
  const hasPresets = (typeof getAircraftOptionsForSide === 'function') && getAircraftOptionsForSide(sideKey).length > 0;

  const rows = facilityUnits.map((u, i) => `
    <div class="bom-unit-row">
      <div class="bom-unit-idx">${i + 1}</div>
      <div class="bom-unit-fields">
        ${hasPresets ? `
        <div class="field-group">
          <label class="field-label">기종 선택</label>
          <select class="field-input" style="width:160px;" onchange="facilityPickAircraft(${i}, this.value)">
            <option value="">직접 입력</option>
            ${buildAircraftSelectOptionsHTML(u.aircraftId, sideKey)}
          </select>
        </div>` : ''}
        ${!u.aircraftId ? `
        <div class="field-group">
          <label class="field-label">유닛 이름</label>
          <input class="field-input" type="text" style="width:120px;" value="${u.name}" oninput="facilitySetUnitName(${i}, this.value)">
        </div>` : `
        <div class="field-group">
          <label class="field-label">기종</label>
          <div class="fac-unit-name">${u.name}</div>
        </div>`}
        ${u.roll !== null ? `
        <div class="fac-unit-roll ${u.lost ? 'fac-unit-lost' : 'fac-unit-safe'}">
          굴림 ${u.roll} → ${u.lost ? '1스텝 손실' : '무사'}
        </div>` : ''}
      </div>
      ${facilityUnits.length > 1 ? `<button class="bom-del-btn" onclick="removeFacilityUnit(${i})">✕</button>` : ''}
    </div>`).join('');

  return `
    <div class="fac-note" style="margin-bottom:10px;">주사위 <strong>${facilityCheckThreshold} 이상</strong>이면 해당 유닛 1스텝 손실. 비행장에 있던 유닛만 입력한 뒤 판정 굴림을 누르세요.</div>
    <div class="bom-unit-list">${rows}</div>
    <button class="btn btn-secondary" style="margin-top:6px;width:100%;" onclick="addFacilityUnit()">+ 항공 유닛 추가</button>
    <button class="dice-roll-btn combat-btn" style="width:100%;margin-top:10px;" onclick="rollFacilityUnitChecks()" ${facilityUnits.length === 0 ? 'disabled' : ''}>
      <span class="roll-label">유닛별 손실 판정 굴림</span>
      <span class="roll-formula">1d6 ea</span>
    </button>`;
}

function renderFacilityUnitsContainer() {
  const card = document.getElementById('facilityUnitsCard');
  const el   = document.getElementById('facilityUnitsContainer');
  if (!card || !el) return;
  const show = facilityTarget === 'airbase' && facilityCheckThreshold !== null;
  card.style.display = show ? '' : 'none';
  el.innerHTML = show ? renderFacilityUnitsHTML() : '';
}

function initFacility() {
  const targetEl = document.getElementById('facTargetBtns');
  if (targetEl) {
    targetEl.innerHTML = Object.entries(FAC_TARGET_LABEL).map(([val, label]) => `
      <button class="fac-target-btn${val === facilityTarget ? ' active' : ''}" onclick="setFacilityTarget('${val}', this)">${label}</button>
    `).join('');
  }
  renderFacilityUnitsContainer();
  calcFacility();
}

// ── 시설 화력 컬럼 계산 ──────────────────────────────────────
function calcFacility() {
  const el = document.getElementById('facilityStr');
  if (!el || !FBRT_COLS) return;
  const raw    = parseFloat(el.value) || 0;
  const colIdx = getFBRTColIndex(raw);
  const col    = FBRT_COLS[colIdx];
  document.getElementById('fColLabel').textContent = col.label;
  document.getElementById('fColCost').textContent  = col.cost;
}

// 결과 코드(num/star/paren) → 대상 시설에 맞는 해설 라인
function getFacilityResultLines(parsed, target) {
  const { num, star, paren } = parsed;

  if (target === 'rail') {
    return star
      ? [{ cls: 'fac-star', text: '★ 철도 방해 포격/폭격 성공' }]
      : [{ cls: 'fac-none', text: '효과 없음' }];
  }

  const lines = [];
  if (target === 'airbase') {
    if (num)   lines.push({ cls: 'fac-num',   text: `비행장 ${num}레벨 감소 (최소 Level 1)` });
    if (paren) lines.push({ cls: 'fac-paren', text: `주둔 항공 유닛 개별 확인 — 주사위 ${paren} 이상 시 1스텝 손실` });
  } else if (target === 'port') {
    if (num)   lines.push({ cls: 'fac-num',   text: `항구 ${num} 손실 (최대 4 손실)` });
  }
  if (!lines.length) lines.push({ cls: 'fac-none', text: '효과 없음' });
  return lines;
}

// ── 시설 포격 굴림 ──────────────────────────────────────────
function rollFacility() {
  const el = document.getElementById('facilityStr');
  if (!el || !FBRT_COLS) return;
  const raw    = parseFloat(el.value) || 0;
  const colIdx = getFBRTColIndex(raw);
  const col    = FBRT_COLS[colIdx];

  const diceVal = Math.floor(Math.random() * 6) + 1;
  const cell    = FBRT_RAW[diceVal - 1][colIdx];
  const parsed  = parseFBRTCell(cell);

  const area = document.getElementById('facilityDiceResult');
  const tag  = document.getElementById('facilityDiceTag');
  area.innerHTML = '';

  // 주사위 면 렌더링
  area.appendChild(makeDie(diceVal, 'ivory'));

  const lines = getFacilityResultLines(parsed, facilityTarget);
  const html  = lines.map(l => `<div class="fac-result-line ${l.cls}">${l.text}</div>`).join('');

  const modDiv = document.createElement('div');
  modDiv.className = 'dice-modified-total';
  modDiv.innerHTML = `
    <div class="fac-result-box">${html}</div>
    <div class="drm-line">주사위 ${diceVal} / 화력 컬럼: ${col.label} (보급 ${col.cost})</div>`;
  area.appendChild(modDiv);

  // 항공 기지 대상이고 (#) 결과가 나온 경우에만 개별 유닛 확인 카드를 노출.
  // 결과가 나오기 전까지는 어떤 유닛이 위험한지 알 수 없어야 하므로, 유닛 입력은 항상 빈 목록에서 새로 시작.
  facilityCheckThreshold = (facilityTarget === 'airbase' && parsed.paren) ? parsed.paren : null;
  facilityUnits = [];
  renderFacilityUnitsContainer();

  tag.textContent = `시설 포격/폭격 굴림 — ${FAC_TARGET_LABEL[facilityTarget]}`;
  tag.className   = 'dice-result-tag combat';
}

// ============================================================
// 대상 조건 UI 초기화
// ============================================================

function initBarrage() {
  loadBarrageTables().then(() => {
    if (!BRT_COLS) return; // fetch 실패 시 조용히 중단 (콘솔에서 원인 확인)

    // 밀집도 버튼
    const densityEl = document.getElementById('densityBtns');
    if (densityEl) {
      densityEl.innerHTML = Object.entries(DENSITY_LABEL).map(([val, label]) => `
        <button class="density-btn${val === barrageDensity ? ' active' : ''}"
                onclick="setDensity('${val}', this)">${label}</button>
      `).join('');
    }

    // Hedgehog 버튼
    const fortEl = document.getElementById('barrFortBtns');
    if (fortEl) {
      fortEl.innerHTML = [0,1,2,3,4].map(v => `
        <button class="fort-btn barrage-fort-btn${barrageFort === v ? ' active' : ''}"
                onclick="setBarrageFort(${v}, this)">${v === 0 ? '없음' : v}</button>
      `).join('');
    }

    // 컬럼 시프트 체크리스트
    const checkEl = document.getElementById('barrageChecklist');
    if (checkEl) {
      checkEl.innerHTML = CHECKLIST.map((item, i) => {
        const shiftCls = item.shift > 0 ? 'bcl-R' : 'bcl-L';
        const isOptional = item.desc.includes('옵션');
        const isNoObs = item.shift === -3;
        const itemCls = isOptional ? 'bcl-item bcl-optional' : isNoObs ? 'bcl-item bcl-no-obs-item' : 'bcl-item';
        return `
          <label class="${itemCls}">
            <input type="checkbox" onchange="calcBarrage()">
            <span class="bcl-shift ${shiftCls}">${item.shift > 0 ? '+' : ''}${item.shift}</span>
            <span class="bcl-desc">${item.desc}</span>
          </label>`;
      }).join('');
    }

    calcBarrage();
    initFacility();
  });
}