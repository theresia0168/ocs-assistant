// ============================================================
// 주사위
// ============================================================

// pip 레이아웃: 9칸 그리드에서 어떤 칸에 pip을 찍을지 (1~6)
const PIP_MAP = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

function makeDieFace(value, color) {
  const face = document.createElement('div');
  face.className = `die-face ${color}`;
  for (let i = 0; i < 9; i++) {
    const cell = document.createElement('div');
    if (PIP_MAP[value].includes(i)) {
      const pip = document.createElement('div');
      pip.className = 'pip';
      cell.appendChild(pip);
    }
    face.appendChild(cell);
  }
  return face;
}

function makeDie(value, color) {
  const wrap = document.createElement('div');
  wrap.className = 'die-wrap';
  wrap.appendChild(makeDieFace(value, color));
  const val = document.createElement('div');
  val.className = 'die-val';
  val.textContent = value;
  wrap.appendChild(val);
  return wrap;
}

function rollDice(mode) {
  const area = document.getElementById('diceResult');
  area.innerHTML = '';

  const r = () => Math.floor(Math.random() * 6) + 1;

  if (mode === '1d6') {
    const v = r();
    area.appendChild(makeDie(v, 'ivory'));
    appendTotal(area, v, '합계');

  } else if (mode === '2d6') {
    const [v1, v2] = [r(), r()];
    area.appendChild(makeDie(v1, 'ivory'));
    area.appendChild(makeDie(v2, 'ivory'));
    appendTotal(area, v1 + v2, '합계');

  } else if (mode === '2d6+1d6') {
    const [v1, v2, v3] = [r(), r(), r()];
    area.appendChild(makeDie(v1, 'ivory'));
    area.appendChild(makeDie(v2, 'ivory'));
    const sep = document.createElement('div');
    sep.className = 'dice-sep';
    sep.textContent = '+';
    area.appendChild(sep);
    area.appendChild(makeDie(v3, 'red'));
    appendTotal(area, v1 + v2 + v3, '합계');
  }
}

function appendTotal(area, total, label) {
  const div = document.createElement('div');
  div.className = 'dice-total';
  div.innerHTML = `${total}<small>${label}</small>`;
  area.appendChild(div);
}

let combatType = 'normal'; // 'normal' | 'overrun'

// 기습 결과 state — 전투 굴림 시 컬럼 보정에 사용
let surpriseState = null; // null | { type: 'atk'|'def'|'none', shift: number }

function setCombatType(type, btn) {
  combatType = type;
  document.querySelectorAll('.ctype-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

function rollCombatDice(mode) {
  const area = document.getElementById('combatDiceResult');
  const tag  = document.getElementById('combatDiceTag');
  area.innerHTML = '';

  const r    = () => Math.floor(Math.random() * 6) + 1;
  const atkAR = parseInt(document.getElementById('atkAR').value) || 0;
  const defAR = parseInt(document.getElementById('defAR').value) || 0;
  const arDRM = atkAR - defAR;

  if (mode === 'surprise') {
    // 기습: 흰 2d6 (판정용) + 빨간 1d6 (별도)
    // 판정 = 흰 2d6 합 + AR DRM + (Hedgehog 있으면 -1)
    const [v1, v2, v3] = [r(), r(), r()];
    const whiteSum = v1 + v2;
    const fortMod  = fortLevel > 0 ? -1 : 0;
    const finalVal = whiteSum + arDRM + fortMod;

    // 기습 성공 여부 판정
    let surpriseResult = '';
    let surpriseClass  = '';
    if (combatType === 'overrun') {
      if      (finalVal >= 9) { surpriseResult = '공격자 기습 성공'; surpriseClass = 'atk-surprise'; }
      else if (finalVal <= 6) { surpriseResult = '방어자 기습 성공'; surpriseClass = 'def-surprise'; }
      else                    { surpriseResult = '기습 없음';        surpriseClass = 'no-surprise';  }
    } else {
      if      (finalVal >= 10) { surpriseResult = '공격자 기습 성공'; surpriseClass = 'atk-surprise'; }
      else if (finalVal <= 5)  { surpriseResult = '방어자 기습 성공'; surpriseClass = 'def-surprise'; }
      else                     { surpriseResult = '기습 없음';        surpriseClass = 'no-surprise';  }
    }

    // 빨간 주사위 적용 결과
    let redResult = '';
    let redClass  = '';
    if (surpriseClass === 'atk-surprise') {
      redResult = `${v3}R`;
      redClass  = 'red-result atk-red';
    } else if (surpriseClass === 'def-surprise') {
      redResult = `${v3}L`;
      redClass  = 'red-result def-red';
    }

    area.appendChild(makeDie(v1, 'ivory'));
    area.appendChild(makeDie(v2, 'ivory'));
    const sep = document.createElement('div');
    sep.className = 'dice-sep';
    sep.textContent = '+';
    area.appendChild(sep);
    area.appendChild(makeDie(v3, 'red'));

    // 수정 내역: 흰 합 + AR DRM + 진지 수정
    const modDiv = document.createElement('div');
    modDiv.className = 'dice-modified-total';
    let drmDesc = `${whiteSum}`;
    if (arDRM !== 0) drmDesc += ` ${arDRM >= 0 ? '+' : ''}${arDRM}`;
    if (fortMod !== 0) drmDesc += ` ${fortMod}`;
    drmDesc += ` = ${finalVal}`;
    modDiv.innerHTML = `
      <div class="surprise-verdict ${surpriseClass}">${surpriseResult}</div>
      ${redResult ? `<div class="${redClass}">${redResult}</div>` : ''}
      <div class="drm-line">${drmDesc}</div>`;
    area.appendChild(modDiv);

    tag.textContent = `기습 굴림 — ${combatType === 'overrun' ? '오버런 전투' : '정규 전투'}`;
    tag.className = 'dice-result-tag surprise';

    // 로그 저장
    const typeLabel = combatType === 'overrun' ? '오버런' : '정규';
    const mainLog = redResult
      ? `${surpriseResult}  ${redResult}`
      : surpriseResult;
    const detailLog = `${typeLabel} 전투 ｜ 주사위 ${drmDesc}`;
    saveToLog('surprise', mainLog, detailLog, surpriseClass === 'atk-surprise' ? 'atk-win' : surpriseClass === 'def-surprise' ? 'def-win' : 'no-surp');

    // 기습 state 저장
    if (surpriseClass === 'atk-surprise') {
      surpriseState = { type: 'atk', shift: v3 };
    } else if (surpriseClass === 'def-surprise') {
      surpriseState = { type: 'def', shift: v3 };
    } else {
      surpriseState = { type: 'none', shift: 0 };
    }
    updateSurpriseIndicator();

  } else if (mode === 'combat') {
    // 기습 결과 없으면 차단
    if (!surpriseState) {
      area.innerHTML = `<div class="dice-placeholder roll-blocked">⚠ 기습 굴림을 먼저 실시하세요</div>`;
      tag.textContent = '';
      return;
    }
    // 전투: 2d6, 결과 = 합계 + AR DRM - 진지 단계
    const [v1, v2] = [r(), r()];
    const rawSum = v1 + v2;
    const fortMod = -fortLevel;
    const finalVal = rawSum + arDRM + fortMod;

    area.appendChild(makeDie(v1, 'ivory'));
    area.appendChild(makeDie(v2, 'ivory'));

    const modDiv = document.createElement('div');
    modDiv.className = 'dice-modified-total';
    let drmDesc = `${rawSum}`;
    if (arDRM !== 0) drmDesc += ` ${arDRM >= 0 ? '+' : ''}${arDRM}`;
    if (fortLevel > 0) drmDesc += ` −${fortLevel}`;
    drmDesc += ` = ${finalVal}`;

    // CRT 조회 + 기습 컬럼 보정
    const atkRaw = parseFloat(document.getElementById('atkStr').value) || 0;
    const defRaw = parseFloat(document.getElementById('defStr').value) || 0;
    const noSupply = document.getElementById('defNoSupply').checked;
    const defEff = noSupply ? defRaw * 0.5 : defRaw;
    const ratioNum = calcRatioNum(atkRaw, defEff);
    const cols = CRT_COLS[terrainType];
    let baseColIdx = getCRTColIndex(ratioNum, terrainType);

    // 기습 보정: 공격자 기습 → 우측(+), 방어자 기습 → 좌측(-)
    let colShift = 0;
    if (surpriseState && surpriseState.type === 'atk') colShift = +surpriseState.shift;
    if (surpriseState && surpriseState.type === 'def') colShift = -surpriseState.shift;
    const shiftedColIdx = Math.max(0, Math.min(cols.length - 1, baseColIdx + colShift));

    const rowIdx = getCRTRowIndex(finalVal);
    const result   = CRT[terrainType][rowIdx][shiftedColIdx];
    const colLabel = CRT_COL_LABELS[terrainType][shiftedColIdx];
    const baseColLabel = CRT_COL_LABELS[terrainType][baseColIdx];

    const shiftDesc = colShift !== 0
      ? ` <span class="col-shift-note">(${baseColLabel} ${colShift > 0 ? '+' : ''}${colShift}컬럼)</span>`
      : '';

    modDiv.innerHTML = `
      <div class="crt-result">${result}</div>
      <div class="drm-line">${drmDesc}</div>
      <div class="crt-col-label">${TERRAIN_LABEL[terrainType]} / ${colLabel} 컬럼${shiftDesc}</div>`;
    area.appendChild(modDiv);

    tag.textContent = `전투 굴림 — ${combatType === 'overrun' ? '오버런 전투' : '정규 전투'}`;
    tag.className = 'dice-result-tag combat';

    // 로그 저장
    const typeLabel = combatType === 'overrun' ? '오버런' : '정규';
    const detailLog = `${typeLabel} 전투 ｜ ${TERRAIN_LABEL[terrainType]} ${colLabel}${colShift !== 0 ? ` (기습 ${colShift > 0 ? '+' : ''}${colShift})` : ''} ｜ 주사위 ${drmDesc}`;
    saveToLog('combat', result, detailLog, 'combat-entry');
  }
}

function updateSurpriseIndicator() {
  const indicator = document.getElementById('surpriseIndicator');
  if (!indicator) return;
  if (!surpriseState || surpriseState.type === 'none') {
    indicator.textContent = '';
    indicator.className = 'surprise-indicator';
    return;
  }
  if (surpriseState.type === 'atk') {
    indicator.textContent = `공격자 기습 +${surpriseState.shift} 컬럼 적용 중`;
    indicator.className = 'surprise-indicator active-atk';
  } else {
    indicator.textContent = `방어자 기습 −${surpriseState.shift} 컬럼 적용 중`;
    indicator.className = 'surprise-indicator active-def';
  }
}
