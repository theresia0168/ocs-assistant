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



// ============================================================
// CRT 결과 파싱 & 해설 렌더링
// ============================================================

/**
 * CRT 결과 문자열을 파싱해 구조체로 반환
 * 예) "Ao1 e4 DL1o2 DG"
 *   → { atk: { loss:0, option:1, eliteMin:4, dg:false },
 *        def: { loss:1, option:2, eliteMin:null, dg:true } }
 *
 * 토큰 규칙:
 *   A / D   : 이하 토큰이 공격자/방어자 영역
 *   L#      : # 손실
 *   o#      : # 옵션
 *   e#      : 돌파 (부대 등급 # 이상)  ← A 영역에만 나타남
 *   DG      : 방어 유닛 전체 DG  ← D 접두가 있으면 def.dg, 단독이면 def.dg
 *
 * 주의: "AL2" → A + L2 (공격자 2손실),  "DL1o2" → D + L1 + o2
 */
function parseCRTResult(str) {
  const atk = { loss: 0, option: 0, eliteMin: null, dg: false };
  const def = { loss: 0, option: 0, eliteMin: null, dg: false };

  // 먼저 단독 DG (접두 없이 뒤에 오는 경우 포함) 를 처리하기 위해
  // 전체 문자열에서 D-접두 없이 나오는 DG를 def.dg로 간주.
  // 파싱은 문자 단위로 진행.

  let i = 0;
  let side = null; // 'A' | 'D'

  while (i < str.length) {
    // 공백 스킵
    if (str[i] === ' ') { i++; continue; }

    // 'A' : 공격자 사이드 전환
    if (str[i] === 'A') {
      side = 'A'; i++; continue;
    }

    // 'D' 처리 — 뒤에 'G'가 오면 DG, 아니면 방어자 사이드 전환
    if (str[i] === 'D') {
      if (str[i+1] === 'G') {
        def.dg = true; i += 2; continue;
      } else {
        side = 'D'; i++; continue;
      }
    }

    // 'L' — 손실
    if (str[i] === 'L') {
      i++;
      const m = str.slice(i).match(/^(\d+)/);
      const n = m ? parseInt(m[1]) : 1;
      if (m) i += m[1].length;
      if (side === 'A') atk.loss = n;
      else              def.loss = n;
      continue;
    }

    // 'o' — 옵션
    if (str[i] === 'o') {
      i++;
      const m = str.slice(i).match(/^(\d+)/);
      const n = m ? parseInt(m[1]) : 1;
      if (m) i += m[1].length;
      if (side === 'A') atk.option = n;
      else              def.option = n;
      continue;
    }

    // 'e' — 돌파
    if (str[i] === 'e') {
      i++;
      const m = str.slice(i).match(/^(\d+)/);
      const n = m ? parseInt(m[1]) : null;
      if (m) i += m[1].length;
      if (side === 'A') atk.eliteMin = n;
      continue;
    }

    i++; // 알 수 없는 문자 건너뜀
  }

  return { atk, def };
}

/**
 * 파싱된 결과를 해설 HTML 줄들로 변환
 * 반환: HTML string (해설 라인들)
 */
function renderCRTExplain(raw, combatType) {
  const { atk, def } = parseCRTResult(raw);
  const isOverrun = combatType === 'overrun';
  const canExploit = !isOverrun; // 전투 페이즈 전투 단계에서만 돌파 가능

  const lines = [];

  // ── 공격자 ──────────────────────────────────────────────
  const atkParts = [];
  if (atk.loss > 0)  atkParts.push(`<strong>${atk.loss} 손실</strong> 적용`);
  if (atk.option > 0) atkParts.push(`<strong>${atk.option} 옵션</strong> 적용 <span class="crt-explain-opt">(손실+후퇴=${atk.option})</span>`);
  if (atk.eliteMin !== null) {
    if (canExploit) {
      atkParts.push(`AR <strong>${atk.eliteMin}+</strong> 유닛 <span class="crt-explain-exploit">돌파 획득</span>`);
    } else {
      atkParts.push(`<span class="crt-explain-muted">AR ${atk.eliteMin}+ 돌파 — 오버런 시 무효</span>`);
    }
  }

  if (atkParts.length > 0) {
    lines.push(`<div class="crt-explain-row crt-atk-row">
      <span class="crt-explain-side crt-side-atk">공격</span>
      <span class="crt-explain-text">${atkParts.join(' · ')}</span>
    </div>`);
  } else {
    lines.push(`<div class="crt-explain-row crt-atk-row">
      <span class="crt-explain-side crt-side-atk">공격</span>
      <span class="crt-explain-text crt-explain-muted">효과 없음</span>
    </div>`);
  }

  // ── 방어자 ──────────────────────────────────────────────
  const defParts = [];
  if (def.loss > 0)   defParts.push(`<strong>${def.loss} 손실</strong> 적용`);
  if (def.option > 0) defParts.push(`<strong>${def.option} 옵션</strong> 적용 <span class="crt-explain-opt">(손실+후퇴=${def.option})</span>`);
  if (def.dg)         defParts.push(`모든 방어 유닛 <span class="crt-explain-dg">DG</span>`);

  if (defParts.length > 0) {
    lines.push(`<div class="crt-explain-row crt-def-row">
      <span class="crt-explain-side crt-side-def">방어</span>
      <span class="crt-explain-text">${defParts.join(' · ')}</span>
    </div>`);
  } else {
    lines.push(`<div class="crt-explain-row crt-def-row">
      <span class="crt-explain-side crt-side-def">방어</span>
      <span class="crt-explain-text crt-explain-muted">효과 없음</span>
    </div>`);
  }

  return lines.join('');
}
