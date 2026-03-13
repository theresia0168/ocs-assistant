// ============================================================
// 전투 계산기
// ============================================================

let fortLevel  = 0;
let terrainType = 'open';

const TERRAIN_LABEL = {
  extr_close: 'Extr Close',
  very_close: 'Very Close',
  close:      'Close',
  open:       'Open',
};

function setTerrain(val, btn) {
  terrainType = val;
  document.querySelectorAll('.terrain-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  calcOdds();
}

function setFort(val, btn) {
  if (fortLevel === val && val !== 0) {
    fortLevel = 0;
    document.querySelectorAll('#combat .fort-btn:not(.barrage-fort-btn)').forEach(b => b.classList.remove('active'));
  } else {
    fortLevel = val;
    document.querySelectorAll('#combat .fort-btn:not(.barrage-fort-btn)').forEach(b => b.classList.remove('active'));
    if (val !== 0) btn.classList.add('active');
  }
  calcOdds();
}

function calcOdds() {
  const atkRaw   = parseFloat(document.getElementById('atkStr').value) || 0;
  const defRaw   = parseFloat(document.getElementById('defStr').value) || 0;
  const atkAR    = parseInt(document.getElementById('atkAR').value) || 0;
  const defAR    = parseInt(document.getElementById('defAR').value) || 0;
  const noSupply = document.getElementById('defNoSupply').checked;
  const defEff = noSupply ? defRaw * 0.5 : defRaw;
  const ratio   = defEff > 0 ? atkRaw / defEff : 0;
  const oddsStr = defEff > 0
    ? (ratio >= 1 ? `${Math.floor(ratio)} : 1` : `1 : ${Math.ceil(1 / ratio)}`)
    : '— : —';
  const arDRM = atkAR - defAR;
  const arDRMStr = arDRM > 0 ? `+${arDRM}` : `${arDRM}`;
  document.getElementById('oddsAtk').textContent   = atkRaw;
  document.getElementById('oddsDef').textContent   = defEff % 1 === 0 ? defEff : defEff.toFixed(1);
  document.getElementById('oddsFinal').textContent = oddsStr;
  const rows = [
    ['공격자 전투력', atkRaw, ''],
    ['방어자 전투력', defRaw, ''],
  ];
  if (noSupply) rows.push(['보급 소모 없음 → 방어력', defEff % 1 === 0 ? defEff : defEff.toFixed(1), '×½']);
  if (fortLevel > 0) rows.push(['Hedgehog', fortLevel, `Lv.${fortLevel}`]);
  rows.push(['최종 전력비', oddsStr, '']);
  rows.push([`지형`, TERRAIN_LABEL[terrainType], '']);
  rows.push(['AR DRM (공격 AR - 방어 AR)', arDRMStr, `${atkAR} − ${defAR}`]);
  document.getElementById('oddsBreakdown').innerHTML = rows.map(([label, val, note]) =>
    `<div class="bd-row"><span class="bd-label">${label}${note ? ` <span class="bd-note">${note}</span>` : ''}</span><span class="bd-val">${val}</span></div>`
  ).join('');
}

const CRT_COLS = {
  extr_close: [-1,1,2,3,4,8,12,16,20,28,36,44,52],
  very_close: [-2,-1,1,2,3,4,6,9,12,15,18,21,24],
  close:      [-3,-2,-1,1,2,3,4,6,8,10,12,15,18],
  open:       [-4,-3,-2,-1,1,2,3,4,5,7,9,11,13],
};
const CRT_COL_LABELS = {
  extr_close: ['1:2','1:1','2:1','3:1','4:1','8:1','12:1','16:1','20:1','28:1','36:1','44:1','52:1'],
  very_close: ['1:3','1:2','1:1','2:1','3:1','4:1','6:1','9:1','12:1','15:1','18:1','21:1','24:1'],
  close:      ['1:4','1:3','1:2','1:1','2:1','3:1','4:1','6:1','8:1','10:1','12:1','15:1','18:1'],
  open:       ['1:5','1:4','1:3','1:2','1:1','2:1','3:1','4:1','5:1','7:1','9:1','11:1','13:1'],
};

const CRT_ROW = (t) => [
  ['AL2','AL2','AL2','AL2','AL2','AL2','AL2','AL1o1','AL1o1 Do1','AL1o1 Do1','AL1 Do1','AL1 Do1','AL1 DL1o1'],
  ['AL2','AL2','AL2','AL2','AL2','AL2','AL1o1','AL1o1 Do1','AL1o1 Do1','AL1 Do1','AL1 Do1','Ao1 DL1o1','Ao1 DL1o1'],
  ['AL2','AL2','AL2','AL2','AL2','AL1o1','AL1o1 Do1','AL1o1 Do1','AL1 Do1','AL1 Do1','Ao1 DL1o1','Ao1 DL1o1','Ao1 DL1o1'],
  ['AL2','AL2','AL2','AL2','AL1o1','AL1o1 Do1','AL1o1 Do1','AL1 Do1','AL1 Do1','Ao1 Do1','Ao1 DL1o1','Ao1 DL1o1','Ao1 e4 DL1o2'],
  ['AL2','AL2','AL2','AL1o1','AL1o1 Do1','AL1o1 Do1','AL1 Do1','AL1 Do1','Ao1 Do1','Ao1 DL1o1','Ao1 DL1o1','Ao1 e4 DL1o2','Ae4 DL1o2'],
  ['AL2','AL2','AL1o1','AL1o1 Do1','AL1o1 Do1','AL1 Do1','AL1 Do1','Ao1 Do1','Ao1 DL1o1','Ao1 DL1o1','Ao1 DL1o1','Ae4 DL1o2','Ae4 DL1o2'],
  ['AL1o1','AL1o1','AL1o1 Do1','AL1o1 Do1','AL1o1 Do1','AL1 Do1','Ao1 Do1','Ao1 DL1o1','Ao1 DL1o1','Ao1 DL1o1','Ao1 e4 DL1o2','Ae4 DL1o2','Ae3 DL2o2 DG'],
  ['AL1o1','AL1o1 Do1','AL1o1 Do1','AL1o1 Do1','AL1 Do1','Ao1 Do1','Ao1 DL1o1','Ao1 DL1o1','Ao1 DL1o1','Ao1 e4 DL1o2','Ae4 DL1o2','Ae4 DL1o2','Ae3 DL2o2 DG'],
  ['AL1o1 Do1','AL1o1 Do1','AL1o1 Do1','AL1 Do1','Ao1 Do1','Ao1 Do1','Ao1 DL1o1','Ao1 DL1o1','Ao1 e4 DL1o2','Ae4 DL1o2','Ae4 DL1o2','Ae3 DL2o2 DG','Ae3 DL2o2 DG'],
  ['AL1o1 Do1','AL1o1 Do1','AL1 Do1','Ao1 Do1','Ao1 Do1','Ao1 DL1o1','Ao1 DL1o1','Ao1 e4 DL1o2','Ae4 DL1o2','Ae4 DL1o2','Ae3 DL2o2 DG','Ae3 DL2o2 DG','Ae2 DL2o3 DG'],
  ['AL1o1 Do1','AL1 Do1','Ao1 Do1','Ao1 Do1','Ao1 DL1o1','Ao1 DL1o1','Ao1 DL1o1','Ae4 DL1o2','Ae4 DL1o2','Ae3 DL2o2 DG','Ae3 DL2o2 DG','Ae3 DL2o2 DG','Ae2 DL2o3 DG'],
  ['AL1o1 Do1','Ao1 Do1','Ao1 Do1','Ao1 DL1o1','Ao1 DL1o1','Ao1 DL1o1','Ao1 e4 DL1o2','Ae4 DL1o2','Ae3 DL2o2 DG','Ae3 DL2o2 DG','Ae3 DL2o2 DG','Ae2 DL2o3 DG','Ae2 DL2o3 DG'],
  ['Ao1 Do1','Ao1 Do1','Ao1 DL1o1','Ao1 DL1o1','Ao1 DL1o2','Ao1 e4 DL1o2','Ae4 DL1o2','Ae3 DL2o2 DG','Ae3 DL2o2 DG','Ae3 DL2o2 DG','Ae2 DL2o3 DG','Ae2 DL2o3 DG','Ae2 DL2o3 DG'],
  ['Ao1 Do1','Ao1 DL1o1','Ao1 DL1o1','Ao1 e4 DL1o2','Ao1 e4 DL1o2','Ae4 DL1o2','Ae3 DL2o2 DG','Ae3 DL2o2 DG','Ae3 DL2o2 DG','Ae2 DL2o3 DG','Ae2 DL2o3 DG','Ae2 DL2o3 DG','Ae2 DL2o3 DG'],
  ['Ao1 DL1o1','Ao1 DL1o1','Ao1 e4 DL1o2','Ae4 DL1o2','Ae4 DL1o2','Ae3 DL2o2 DG','Ae3 DL2o2 DG','Ae2 DL2o3 DG','Ae2 DL2o3 DG','Ae2 DL2o3 DG','Ae2 DL2o3 DG','Ae2 DL2o3 DG','Ae2 DL2o3 DG'],
];

const CRT = {
  extr_close: CRT_ROW('extr_close'),
  very_close: CRT_ROW('very_close'),
  close:      CRT_ROW('close'),
  open:       CRT_ROW('open'),
};

function getCRTColIndex(ratioNum, terrain) {
  const cols = CRT_COLS[terrain];
  for (let i = 0; i < cols.length; i++) {
    if (ratioNum === cols[i]) return i;
    if (ratioNum < cols[i])   return Math.max(0, i - 1);
  }
  return cols.length - 1;
}

function calcRatioNum(atkRaw, defEff) {
  if (defEff <= 0) return 99;
  const r = atkRaw / defEff;
  if (r >= 1) return Math.floor(r);
  else        return -Math.ceil(1/r);
}

function getCRTRowIndex(diceVal) {
  if (diceVal <= 1)  return 0;
  if (diceVal >= 15) return 14;
  return diceVal - 1;
}

function lookupCRT(diceVal, terrain, ratioNum) {
  const rowIdx = getCRTRowIndex(diceVal);
  const colIdx = getCRTColIndex(ratioNum, terrain);
  const colLabel = CRT_COL_LABELS[terrain][colIdx];
  const result   = CRT[terrain][rowIdx][colIdx];
  return { result, colLabel, rowIdx, colIdx };
}
