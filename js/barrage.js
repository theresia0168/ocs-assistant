// ============================================================
// 포격/폭격 (Barrage)
// ============================================================

const BRT_COLS = [
  { max: 1,   label: '1 이하', cost: '1T' },
  { max: 2,   label: '2',      cost: '1T' },
  { max: 4,   label: '3-4',    cost: '2T' },
  { max: 7,   label: '5-7',    cost: '2T' },
  { max: 11,  label: '8-11',   cost: '2T' },
  { max: 16,  label: '12-16',  cost: '3T' },
  { max: 24,  label: '17-24',  cost: '3T' },
  { max: 40,  label: '25-40',  cost: '4T' },
  { max: 68,  label: '41-68',  cost: '6T' },
  { max: 116, label: '69-116', cost: '8T' },
  { max: Infinity, label: '117+', cost: '10T' },
];

const BRT = [
  ['-','-','-','-','-','-','-','-','-','DG','DG'],
  ['-','-','-','-','-','-','-','-','DG','DG','DG'],
  ['-','-','-','-','-','-','-','DG','DG','DG','DG'],
  ['-','-','-','-','-','-','DG','DG','DG','DG','HALF_COND'],
  ['-','-','-','-','-','DG','DG','DG','DG','HALF_COND','HALF_COND'],
  ['-','-','-','-','DG','DG','DG','DG','HALF_COND','HALF_COND','HALF'],
  ['-','-','-','DG','DG','DG','DG','HALF_COND','HALF_COND','HALF','HALF'],
  ['-','-','DG','DG','DG','HALF_COND','HALF_COND','HALF_COND','HALF','HALF','HALF'],
  ['-','DG','DG','DG','HALF_COND','HALF_COND','HALF','HALF','HALF','1','1'],
  ['DG','DG','DG','HALF_COND','HALF_COND','HALF','HALF','HALF','1','1','2'],
  ['DG','HALF','HALF','HALF','HALF','1','1','1','1','2','3'],
];

const DENSITY_SHIFT = {
  le1: -1,
  le3:  0,
  le4: +1,
  le5: +2,
  le6: +3,
  gt6: +4,
};
const DENSITY_LABEL = {
  le1: '1 RE 이하 (1L)',
  le3: '3 RE 이하 (No Effect)',
  le4: '4 RE 이하 (1R)',
  le5: '5 RE 이하 (2R)',
  le6: '6 RE 이하 (3R)',
  gt6: '6 RE 초과 (4R)',
};
const BRT_RESULT_LABEL = {
  '-':        { text: '효과 없음',   cls: 'brt-none' },
  'DG':       { text: 'DG',         cls: 'brt-dg'   },
  'HALF_COND':{ text: '[1/2]',      cls: 'brt-half-cond' },
  'HALF':     { text: '1/2',        cls: 'brt-half' },
  '1':        { text: '1 스텝',     cls: 'brt-step' },
  '2':        { text: '2 스텝',     cls: 'brt-step' },
  '3':        { text: '3 스텝',     cls: 'brt-step' },
};

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

const CHECKLIST = [
  { shift: -1, desc: '아무 레벨의 진지 존재 (1L)' },
  { shift: -1, desc: 'Close / Very Close 헥스 (1L)' },
  { shift: -2, desc: 'Extr Close 헥스 (2L)' },
  { shift: +3, desc: '목표 헥스 내 유닛 전략 이동 모드 (3R)' },
  { shift: +1, desc: '모든 항공 유닛이 10헥스 이내 기지 출격 (1R)' },
  { shift: -1, desc: '항공 유닛 항속 거리 절반 이상 이동 (1L, 옵션)' },
  { shift: -3, desc: '관측 유닛 없음 (3L)' },
];

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
  if (!document.getElementById('barrageStr')) return;
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

// 화력 컬럼: 1이하, 2, 3-4, 5-10, 11-20, 21-40, 41-80, 81+
// 보급 소모: 1T, 1T, 1T, 1T, 2T, 4T, 6T, 8T
const FBRT_COLS = [
  { max: 1,        label: '1 이하', cost: '1T' },
  { max: 2,        label: '2',      cost: '1T' },
  { max: 4,        label: '3-4',    cost: '1T' },
  { max: 10,       label: '5-10',   cost: '1T' },
  { max: 20,       label: '11-20',  cost: '2T' },
  { max: 40,       label: '21-40',  cost: '4T' },
  { max: 80,       label: '41-80',  cost: '6T' },
  { max: Infinity, label: '81+',    cost: '8T' },
];

// 시설 포격/폭격 결과 테이블
// 행: 주사위 1~6 (인덱스 0~5), 열: 화력 컬럼 0~7
// 셀 표기: '-' 효과없음, '*' 철도방해, 숫자 시설손실, '(N)' 항공유닛확인, 조합 가능
const FBRT_RAW = [
  // 주사위 1
  ['-',   '-',   '-',   '-',   '-',   '-',  '-(5)', '1(5)'    ],
  // 주사위 2
  ['-',   '-',   '-',   '-',   '-',   '-(5)',  '1(4)', '1(4)' ],
  // 주사위 3
  ['-',   '-',   '-',   '-',   '-(5)','1(5)',  '1(4)', '1(4)' ],
  // 주사위 4
  ['-',   '-',   '-',   '*(6)','1*(5)','1*(4)', '1*(4)','2*(4)'],
  // 주사위 5
  ['-',   '-(6)','*(6)','1*(5)','1*(4)','2*(4)','2*(4)','2*(3)'],
  // 주사위 6
  ['(6)', '*(5)','1*(5)','1*(4)','1*(4)','2*(4)','2*(3)','2*(3)'],
];

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

// ── 시설 화력 컬럼 계산 ──────────────────────────────────────
function calcFacility() {
  const el = document.getElementById('facilityStr');
  if (!el) return;
  const raw    = parseFloat(el.value) || 0;
  const colIdx = getFBRTColIndex(raw);
  const col    = FBRT_COLS[colIdx];
  document.getElementById('fColLabel').textContent = col.label;
  document.getElementById('fColCost').textContent  = col.cost;
}

// ── 시설 포격 굴림 ──────────────────────────────────────────
function rollFacility() {
  const el = document.getElementById('facilityStr');
  if (!el) return;
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

  const { num, star, paren } = parsed;
  const noEffect = !num && !star && !paren;

  let html = '';
  if (noEffect) {
    html += `<div class="fac-result-line fac-none">— 효과 없음</div>`;
  } else {
    if (star) html += `<div class="fac-result-line fac-star">★ 철도방해(항공 저지) 성공</div>`;
    if (num)  html += `<div class="fac-result-line fac-num">시설 ${num} 손실</div>`;
    if (paren) html += `<div class="fac-result-line fac-paren">항공 유닛 개별 확인 (${paren}+)</div>`;
  }

  const modDiv = document.createElement('div');
  modDiv.className = 'dice-modified-total';
  modDiv.innerHTML = `
    <div class="fac-result-box">${html}</div>
    <div class="drm-line">주사위 ${diceVal} / 화력 컬럼: ${col.label} (보급 ${col.cost})</div>`;
  area.appendChild(modDiv);

  tag.textContent = '시설 포격/폭격 굴림';
  tag.className   = 'dice-result-tag combat';
}
