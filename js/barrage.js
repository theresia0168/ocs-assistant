// ============================================================
// 포격/폭격 (Barrage)
// ============================================================

// 화력 컬럼 정의
// [컬럼 상한값, 레이블, 공급 비용]
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

// BRT 결과표
// 행: 주사위 2~12 (인덱스 0~10)
// 열: 화력 컬럼 0~10
// 결과값: '-' | 'DG' | 'HALF' | 'HALF_COND' | '1' | '2' | '3'
// HALF_COND = [1/2], HALF = 1/2
const BRT = [
  // 주사위 2
  ['-','-','-','-','-','-','-','-','-','DG','DG'],
  // 3
  ['-','-','-','-','-','-','-','-','DG','DG','DG'],
  // 4
  ['-','-','-','-','-','-','-','DG','DG','DG','DG'],
  // 5
  ['-','-','-','-','-','-','DG','DG','DG','DG','HALF_COND'],
  // 6
  ['-','-','-','-','-','DG','DG','DG','DG','HALF_COND','HALF_COND'],
  // 7
  ['-','-','-','-','DG','DG','DG','DG','HALF_COND','HALF_COND','HALF'],
  // 8
  ['-','-','-','DG','DG','DG','DG','HALF_COND','HALF_COND','HALF','HALF'],
  // 9
  ['-','-','DG','DG','DG','HALF_COND','HALF_COND','HALF_COND','HALF','HALF','HALF'],
  // 10
  ['-','DG','DG','DG','HALF_COND','HALF_COND','HALF','HALF','HALF','1','1'],
  // 11
  ['DG','DG','DG','HALF_COND','HALF_COND','HALF','HALF','HALF','1','1','2'],
  // 12
  ['DG','HALF','HALF','HALF','HALF','1','1','1','1','2','3'],
];

// 밀집도별 컬럼 보정
const DENSITY_SHIFT = {
  le1: -1,  // 1 RE 이하: 1L
  le3:  0,  // 3 RE 이하: No Effect
  le4: +1,  // 4 RE 이하: 1R
  le5: +2,  // 5 RE 이하: 2R
  le6: +3,  // 6 RE 이하: 3R
  gt6: +4,  // 6 RE 초과: 4R
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

// 결과 상세 설명
function getBRTResultDesc(raw, barrageType, hasObserver, fortLevel) {
  if (raw === 'HALF_COND') {
    // [1/2] 조건 체크: 3~4레벨 진지, 항공/함선 포격, 관측 없음 → DG로 처리
    const isDegraded =
      fortLevel >= 3 ||
      barrageType === 'air' ||
      barrageType === 'naval' ||
      !hasObserver;
    if (isDegraded) return { display: 'DG', desc: '[1/2] → DG 적용', cls: 'brt-dg' };
    return { display: '1/2', desc: '[1/2] 일반 적용 — 주사위 4-6: 1스텝+DG / 1-3: DG', cls: 'brt-half' };
  }
  if (raw === 'HALF') {
    return { display: '1/2', desc: '주사위 4-6: 1스텝+DG / 1-3: DG', cls: 'brt-half' };
  }
  const label = BRT_RESULT_LABEL[raw];
  return { display: label.text, desc: '', cls: label.cls };
}

// 화력 컬럼 인덱스 계산 (절반 적용 후)
function getBarrageColIndex(str) {
  for (let i = 0; i < BRT_COLS.length; i++) {
    if (str <= BRT_COLS[i].max) return i;
  }
  return BRT_COLS.length - 1;
}

// ============================================================
// 상태 변수
// ============================================================
let barrageType    = 'artillery';
let barrageFort    = 0;
let barrageDensity = 'le3';

// 체크리스트 항목 정의: [shift, description]
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

// ============================================================
// 화력 컬럼 계산 및 표시
// ============================================================
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

  // 포병만 보급 소모량 표시
  const showCost = barrageType === 'artillery';

  document.getElementById('bBaseColLabel').textContent = baseCol.label;
  document.getElementById('bColLabel').textContent     = finalCol.label;
  document.getElementById('bColCost').textContent      = showCost ? baseCol.cost : '—';

  // 보급 소모량 행 표시/숨김
  const costEl = document.getElementById('bColCost').closest('.bcol-cost');
  if (costEl) costEl.style.display = showCost ? '' : 'none';

  // 브레이크다운
  const TYPE_LABEL = { artillery: '포병', air: '항공', naval: '함선' };
  const rows = [
    ['화력', raw, ''],
    ['포격 유형', TYPE_LABEL[barrageType], ''],
    ['밀집도', DENSITY_LABEL[barrageDensity], ''],
  ];
  if (densShift !== 0)
    rows.push(['밀집도 컬럼 보정', `${densShift > 0 ? '+' : ''}${densShift}`, '']);

  // 체크된 항목 보정 표시
  const checks = document.querySelectorAll('.bcl-item input[type=checkbox]');
  checks.forEach((cb, i) => {
    if (cb.checked) {
      const s = CHECKLIST[i].shift;
      rows.push([CHECKLIST[i].desc, `${s > 0 ? '+' : ''}${s}`, '']);
    }
  });

  if (totalShift !== 0)
    rows.push(['총 컬럼 보정', `${totalShift > 0 ? '+' : ''}${totalShift}`, '']);

  document.getElementById('barrageBreakdown').innerHTML = rows.map(([label, val, note]) =>
    `<div class="bd-row">
      <span class="bd-label">${label}${note ? ` <span class="bd-note">${note}</span>` : ''}</span>
      <span class="bd-val">${val}</span>
    </div>`
  ).join('');
}

// ============================================================
// 포격 굴림
// ============================================================
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

  // 관측 없음 여부: 체크리스트 마지막(인덱스 6)
  const obsCheck = document.querySelectorAll('.bcl-item input[type=checkbox]')[6];
  const hasNoObs = obsCheck && obsCheck.checked;

  const rowIdx    = Math.min(Math.max(diceVal - 2, 0), 10);
  const rawResult = BRT[rowIdx][finalColIdx];
  const { display, desc, cls } = getBRTResultDesc(rawResult, barrageType, !hasNoObs, barrageFort);

  // 주사위 렌더
  area.appendChild(makeDie(v1, 'ivory'));
  area.appendChild(makeDie(v2, 'ivory'));

  // 1/2 손실 굴림
  let lossRollVal = null;
  let lossResult  = null;
  const needsLossRoll = (rawResult === 'HALF' || rawResult === 'HALF_COND') && display === '1/2';
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

  const lossDesc = needsLossRoll ? ` ｜ 손실굴림 ${lossRollVal} → ${lossResult}` : '';
  const costDesc = barrageType === 'artillery' ? ` (${baseCol.cost})` : '';
  saveBarrageLog(
    display,
    `${TYPE_LABEL[barrageType]} ｜ ${colDesc} 컬럼${costDesc} ｜ 주사위 ${diceVal}${desc ? ' ｜ ' + desc : ''}${lossDesc}`,
    cls
  );
}

// ============================================================
// 포격 결과 기록
// ============================================================
function saveBarrageLog(mainText, detailText, cls) {
  const log = document.getElementById('barrageLog');
  log.querySelector('.log-empty')?.remove();
  log.innerHTML = `
    <div class="log-entry ${cls}">
      <div class="log-main">${mainText}</div>
      <div class="log-detail">${detailText}</div>
    </div>`;
}

function clearBarrageLog() {
  document.getElementById('barrageLog').innerHTML =
    '<div class="log-empty">포격 굴림 결과가 여기에 기록됩니다</div>';
}
