// ============================================================
// 전투 계산기
// ============================================================

let fortLevel  = 0;
let terrainType = 'open'; // 'extr_close' | 'very_close' | 'close' | 'open'

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
  // 이미 선택된 버튼 누르면 해제
  if (fortLevel === val && val !== 0) {
    fortLevel = 0;
    document.querySelectorAll('.fort-btn').forEach(b => b.classList.remove('active'));
  } else {
    fortLevel = val;
    document.querySelectorAll('.fort-btn').forEach(b => b.classList.remove('active'));
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

  // 방어자 보급 소모 → 전투력 절반
  const defEff = noSupply ? defRaw * 0.5 : defRaw;

  // 비율 계산 → 방어자 유리 방향 버림 → n:1 형식
  const ratio   = defEff > 0 ? atkRaw / defEff : 0;
  const floored = ratio >= 1 ? Math.floor(ratio) : Math.ceil(ratio);
  const oddsStr = defEff > 0
    ? (ratio >= 1 ? `${Math.floor(ratio)} : 1` : `1 : ${Math.ceil(1 / ratio)}`)
    : '— : —';

  // AR DRM
  const arDRM = atkAR - defAR;
  const arDRMStr = arDRM > 0 ? `+${arDRM}` : `${arDRM}`;

  document.getElementById('oddsAtk').textContent   = atkRaw;
  document.getElementById('oddsDef').textContent   = defEff % 1 === 0 ? defEff : defEff.toFixed(1);
  document.getElementById('oddsFinal').textContent = oddsStr;

  // 브레이크다운 행 구성
  const rows = [
    ['공격자 전투력',  atkRaw,  ''],
    ['방어자 전투력',  defRaw,  ''],
  ];
  if (noSupply)
    rows.push(['보급 소모 없음 → 방어력', defEff % 1 === 0 ? defEff : defEff.toFixed(1), '×½']);
  if (fortLevel > 0)
    rows.push(['Hedgehog', fortLevel, `Lv.${fortLevel}`]);
  rows.push(['최종 전력비', oddsStr, '']);
  rows.push([`지형`, TERRAIN_LABEL[terrainType], '']);
  rows.push(['AR DRM (공격 AR - 방어 AR)', arDRMStr, `${atkAR} − ${defAR}`]);

  document.getElementById('oddsBreakdown').innerHTML = rows.map(([label, val, note]) =>
    `<div class="bd-row">
      <span class="bd-label">${label}${note ? ` <span class="bd-note">${note}</span>` : ''}</span>
      <span class="bd-val">${val}</span>
    </div>`
  ).join('');
}

// ============================================================
// CRT 테이블
// ============================================================

// 각 지형별 컬럼 헤더 (비율 상한값 기준, 마지막은 Infinity)
// 비율 n:1 → n 값으로 컬럼 인덱스를 찾음
// 1:n 방어자 유리 → -n 으로 표현
const CRT_COLS = {
  //            1:2  1:1  2:1  3:1  4:1  8:1 12:1 16:1 20:1 28:1 36:1 44:1 52:1
  extr_close: [ -1,   1,   2,   3,   4,   8,  12,  16,  20,  28,  36,  44,  52],
  //            1:3  1:2  1:1  2:1  3:1  4:1  6:1  9:1 12:1 15:1 18:1 21:1 24:1
  very_close: [ -2,  -1,   1,   2,   3,   4,   6,   9,  12,  15,  18,  21,  24],
  //            1:4  1:3  1:2  1:1  2:1  3:1  4:1  6:1  8:1 10:1 12:1 15:1 18:1
  close:      [ -3,  -2,  -1,   1,   2,   3,   4,   6,   8,  10,  12,  15,  18],
  //            1:5  1:4  1:3  1:2  1:1  2:1  3:1  4:1  5:1  7:1  9:1 11:1 13:1
  open:       [ -4,  -3,  -2,  -1,   1,   2,   3,   4,   5,   7,   9,  11,  13],
};
// 컬럼 헤더 표시 문자열
const CRT_COL_LABELS = {
  extr_close: ['1:2','1:1','2:1','3:1','4:1','8:1','12:1','16:1','20:1','28:1','36:1','44:1','52:1'],
  very_close: ['1:3','1:2','1:1','2:1','3:1','4:1','6:1','9:1','12:1','15:1','18:1','21:1','24:1'],
  close:      ['1:4','1:3','1:2','1:1','2:1','3:1','4:1','6:1','8:1','10:1','12:1','15:1','18:1'],
  open:       ['1:5','1:4','1:3','1:2','1:1','2:1','3:1','4:1','5:1','7:1','9:1','11:1','13:1'],
};

// 행: 주사위 결과 1이하(0)~15이상(14), 인덱스 = diceVal - 1 (단, 1이하=0, 15이상=14)
// 열: 지형별 컬럼 순서대로 13개
const CRT = {
  extr_close: [
    // 1이하
    ['AL2','AL2','AL2','AL2','AL2','AL2','AL2','AL1o1','AL1o1 Do1','AL1o1 Do1','AL1 Do1','AL1 Do1','AL1 DL1o1'],
    // 2
    ['AL2','AL2','AL2','AL2','AL2','AL2','AL1o1','AL1o1 Do1','AL1o1 Do1','AL1 Do1','AL1 Do1','Ao1 DL1o1','Ao1 DL1o1'],
    // 3
    ['AL2','AL2','AL2','AL2','AL2','AL1o1','AL1o1 Do1','AL1o1 Do1','AL1 Do1','AL1 Do1','Ao1 DL1o1','Ao1 DL1o1','Ao1 DL1o1'],
    // 4
    ['AL2','AL2','AL2','AL2','AL1o1','AL1o1 Do1','AL1o1 Do1','AL1 Do1','AL1 Do1','Ao1 Do1','Ao1 DL1o1','Ao1 DL1o1','Ao1 e4 DL1o2'],
    // 5
    ['AL2','AL2','AL2','AL1o1','AL1o1 Do1','AL1o1 Do1','AL1 Do1','AL1 Do1','Ao1 Do1','Ao1 DL1o1','Ao1 DL1o1','Ao1 e4 DL1o2','Ae4 DL1o2'],
    // 6
    ['AL2','AL2','AL1o1','AL1o1 Do1','AL1o1 Do1','AL1 Do1','AL1 Do1','Ao1 Do1','Ao1 DL1o1','Ao1 DL1o1','Ao1 DL1o1','Ae4 DL1o2','Ae4 DL1o2'],
    // 7
    ['AL1o1','AL1o1','AL1o1 Do1','AL1o1 Do1','AL1o1 Do1','AL1 Do1','Ao1 Do1','Ao1 DL1o1','Ao1 DL1o1','Ao1 DL1o1','Ao1 e4 DL1o2','Ae4 DL1o2','Ae3 DL2o2 DG'],
    // 8
    ['AL1o1','AL1o1 Do1','AL1o1 Do1','AL1o1 Do1','AL1 Do1','Ao1 Do1','Ao1 DL1o1','Ao1 DL1o1','Ao1 DL1o1','Ao1 e4 DL1o2','Ae4 DL1o2','Ae4 DL1o2','Ae3 DL2o2 DG'],
    // 9
    ['AL1o1 Do1','AL1o1 Do1','AL1o1 Do1','AL1 Do1','Ao1 Do1','Ao1 Do1','Ao1 DL1o1','Ao1 DL1o1','Ao1 e4 DL1o2','Ae4 DL1o2','Ae4 DL1o2','Ae3 DL2o2 DG','Ae3 DL2o2 DG'],
    // 10
    ['AL1o1 Do1','AL1o1 Do1','AL1 Do1','Ao1 Do1','Ao1 Do1','Ao1 DL1o1','Ao1 DL1o1','Ao1 e4 DL1o2','Ae4 DL1o2','Ae4 DL1o2','Ae3 DL2o2 DG','Ae3 DL2o2 DG','Ae2 DL2o3 DG'],
    // 11
    ['AL1o1 Do1','AL1 Do1','Ao1 Do1','Ao1 Do1','Ao1 DL1o1','Ao1 DL1o1','Ao1 DL1o1','Ae4 DL1o2','Ae4 DL1o2','Ae3 DL2o2 DG','Ae3 DL2o2 DG','Ae3 DL2o2 DG','Ae2 DL2o3 DG'],
    // 12
    ['AL1o1 Do1','Ao1 Do1','Ao1 Do1','Ao1 DL1o1','Ao1 DL1o1','Ao1 DL1o1','Ao1 e4 DL1o2','Ae4 DL1o2','Ae3 DL2o2 DG','Ae3 DL2o2 DG','Ae3 DL2o2 DG','Ae2 DL2o3 DG','Ae2 DL2o3 DG'],
    // 13
    ['Ao1 Do1','Ao1 Do1','Ao1 DL1o1','Ao1 DL1o1','Ao1 DL1o2','Ao1 e4 DL1o2','Ae4 DL1o2','Ae3 DL2o2 DG','Ae3 DL2o2 DG','Ae3 DL2o2 DG','Ae2 DL2o3 DG','Ae2 DL2o3 DG','Ae2 DL2o3 DG'],
    // 14
    ['Ao1 Do1','Ao1 DL1o1','Ao1 DL1o1','Ao1 e4 DL1o2','Ao1 e4 DL1o2','Ae4 DL1o2','Ae3 DL2o2 DG','Ae3 DL2o2 DG','Ae3 DL2o2 DG','Ae2 DL2o3 DG','Ae2 DL2o3 DG','Ae2 DL2o3 DG','Ae2 DL2o3 DG'],
    // 15이상
    ['Ao1 DL1o1','Ao1 DL1o1','Ao1 e4 DL1o2','Ae4 DL1o2','Ae4 DL1o2','Ae3 DL2o2 DG','Ae3 DL2o2 DG','Ae2 DL2o3 DG','Ae2 DL2o3 DG','Ae2 DL2o3 DG','Ae2 DL2o3 DG','Ae2 DL2o3 DG','Ae2 DL2o3 DG'],
  ],
  very_close: [
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
  ],
  close: [
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
  ],
  open: [
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
  ],
};

// 전력비 → 컬럼 인덱스 반환
// CRT 컬럼에 정확히 있는 비율만 유효 — 없으면 방어자 유리 방향(아래 컬럼)으로 내림
function getCRTColIndex(ratioNum, terrain) {
  const cols = CRT_COLS[terrain];
  // cols[i]가 ratioNum 이상인 첫 번째 인덱스 = 해당 컬럼 or 그 위
  // 그런데 ratioNum이 정확히 cols[i]와 일치하면 그 컬럼, 아니면 한 칸 아래
  for (let i = 0; i < cols.length; i++) {
    if (ratioNum === cols[i]) return i;          // 정확히 일치
    if (ratioNum < cols[i])   return Math.max(0, i - 1); // 컬럼 사이면 아래 컬럼
  }
  return cols.length - 1; // 최대 컬럼 초과
}

// 전력비 숫자 계산 — 반올림 없이 그대로 넘김
// 공격자 유리 → 양수(8:1 → 8), 방어자 유리 → 음수(1:3 → -3)
function calcRatioNum(atkRaw, defEff) {
  if (defEff <= 0) return 99;
  const r = atkRaw / defEff;
  if (r >= 1) return Math.floor(r);   // 8.9:1 → 8 (방어자 유리)
  else        return -Math.ceil(1/r); // 1:2.1 → -3 (방어자 유리)
}

// 주사위값 → 행 인덱스 (1이하=0, 2~14=1~13, 15이상=14)
function getCRTRowIndex(diceVal) {
  if (diceVal <= 1)  return 0;
  if (diceVal >= 15) return 14;
  return diceVal - 1;
}

// CRT 조회
function lookupCRT(diceVal, terrain, ratioNum) {
  const rowIdx = getCRTRowIndex(diceVal);
  const colIdx = getCRTColIndex(ratioNum, terrain);
  const colLabel = CRT_COL_LABELS[terrain][colIdx];
  const result   = CRT[terrain][rowIdx][colIdx];
  return { result, colLabel, rowIdx, colIdx };
