// ============================================================
// initiative.js
// 선 플레이어 결정 페이즈 UI & 로직
// ============================================================
//
// phase 흐름:
//   'roll'   → 양측 2d6 굴림
//   'choose' → 우선권 진영이 선/후 선택
//   'result' → 최종 결과 확인 + "다음 페이즈" 버튼
// ============================================================

// ── 내부 상태 ────────────────────────────────────────────────
let _initiativeState = {
  phase:       'roll',   // 'roll' | 'choose' | 'result'
  rolls:       {},       // { [sideKey]: { dice:[d1,d2], total:number } }
  winner:      null,     // 우선권 보유 진영 key
  wasTie:      false,    // 직전 굴림이 동점이었는지
  firstPlayer: null,     // 선 플레이어로 결정된 진영 key
};

// ── 진영 정보 헬퍼 ──────────────────────────────────────────
function _getInitiativeSides() {
  if (!currentScenario?.sides) return [];
  return Object.entries(currentScenario.sides).map(([key, val]) => ({
    key,
    label: val.label || val.en || key,
  }));
}

// ── 공개 API ─────────────────────────────────────────────────

/** initiative 페이즈 진입 시 상태 초기화 */
function initiativeReset() {
  _initiativeState = {
    phase: 'roll', rolls: {}, winner: null,
    wasTie: false, firstPlayer: null,
  };
}

/** 특정 진영의 2d6 굴림 실행 */
function initiativeRoll(sideKey) {
  // choose/result 단계에서는 굴림 무시
  if (_initiativeState.phase !== 'roll') return;

  const d1 = Math.floor(Math.random() * 6) + 1;
  const d2 = Math.floor(Math.random() * 6) + 1;
  _initiativeState.rolls[sideKey] = { dice: [d1, d2], total: d1 + d2 };

  const sides     = _getInitiativeSides();
  const allRolled = sides.length >= 2 && sides.every(s => _initiativeState.rolls[s.key] != null);

  if (allRolled) {
    const sorted = sides.slice().sort(
      (a, b) => _initiativeState.rolls[b.key].total - _initiativeState.rolls[a.key].total
    );
    const top    = sorted[0];
    const second = sorted[1];

    if (_initiativeState.rolls[top.key].total === _initiativeState.rolls[second.key].total) {
      // 동점 → 재굴림 (잠깐 결과를 보여준 뒤 자동 초기화하지 않고
      //         wasTie=true 상태로 유지 — 사용자가 상황을 확인하고 재굴림)
      _initiativeState.winner = null;
      _initiativeState.wasTie = true;
      // phase는 'roll'로 유지, rolls는 보여주되 버튼 텍스트로 유도
    } else {
      _initiativeState.winner = top.key;
      _initiativeState.wasTie = false;
      // phase는 아직 'roll' — "선후 결정하기" 버튼이 나타남
    }
  }

  _renderInitiativeUI(document.getElementById('phaseActionContent'));
}

/** 동점 후 재굴림: 기존 rolls 초기화 */
function initiativeReroll() {
  _initiativeState.rolls  = {};
  _initiativeState.winner = null;
  _initiativeState.wasTie = false;
  _renderInitiativeUI(document.getElementById('phaseActionContent'));
}

/** "선후 결정하기" 버튼 → choose 단계로 전환 */
function initiativeGoChoose() {
  if (!_initiativeState.winner) return;
  _initiativeState.phase = 'choose';
  _renderInitiativeUI(document.getElementById('phaseActionContent'));
}

/** 우선권 보유 진영이 선/후를 선택 → result 단계로 전환 */
function initiativeChoose(choice) {
  const sides  = _getInitiativeSides();
  const winner = _initiativeState.winner;
  if (!winner) return;

  const loserSide = sides.find(s => s.key !== winner);
  const firstKey  = choice === 'first' ? winner : (loserSide?.key ?? null);

  _initiativeState.firstPlayer = firstKey;
  _initiativeState.phase       = 'result';

  _renderInitiativeUI(document.getElementById('phaseActionContent'));
}

/** "다음 페이즈" 버튼 → state에 반영 후 페이즈 전진 */
function initiativeConfirm() {
  state.firstPlayer = _initiativeState.firstPlayer;
  nextPhase();
}

// ── 외부 진입점 (turn.js PHASE_ACTIONS에서 호출) ─────────────
function renderInitiativeUI(el) {
  _renderInitiativeUI(el);
}

// ── 내부 렌더링 디스패처 ─────────────────────────────────────
function _renderInitiativeUI(el) {
  if (!el) return;
  switch (_initiativeState.phase) {
    case 'roll':   el.innerHTML = _buildRollPhaseHTML();   break;
    case 'choose': el.innerHTML = _buildChoosePhaseHTML(); break;
    case 'result': el.innerHTML = _buildResultPhaseHTML(); break;
  }
}

// ============================================================
// 단계별 HTML 빌더
// ============================================================

// ── 1단계: 굴림 ──────────────────────────────────────────────
function _buildRollPhaseHTML() {
  const sides = _getInitiativeSides();
  if (sides.length < 2) {
    return `<p class="phase-action-desc">시나리오 진영 정보가 없습니다.</p>`;
  }

  const [sideA, sideB] = sides;
  const rollA  = _initiativeState.rolls[sideA.key];
  const rollB  = _initiativeState.rolls[sideB.key];
  const isTie  = _initiativeState.wasTie;
  const winner = _initiativeState.winner;

  // 양측 모두 굴렸고 동점이 아닌 경우 → "선후 결정하기" 버튼 표시
  const bothRolled   = rollA != null && rollB != null;
  const showProceed  = bothRolled && !isTie && winner != null;
  const winnerLabel  = winner ? sides.find(s => s.key === winner)?.label : null;

  // 동점 알림 / 승자 알림
  let noticeHtml = '';
  if (isTie && bothRolled) {
    noticeHtml = `
      <div class="initiative-notice initiative-notice-tie">
        ⚖ 동점! 양측 모두 다시 굴리세요.
        <button class="btn btn-secondary initiative-reroll-all-btn"
                onclick="initiativeReroll()">🎲 전체 재굴림</button>
      </div>`;
  } else if (showProceed) {
    noticeHtml = `
      <div class="initiative-notice initiative-notice-winner">
        🏆 <strong>${winnerLabel}</strong>이(가) 우선권을 획득했습니다!
      </div>`;
  }

  return `
    <div class="initiative-ui">

      <div class="initiative-roll-cols">

        <!-- 진영 A -->
        <div class="initiative-roll-col">
          <div class="initiative-col-label">${sideA.label}</div>
          <div class="initiative-dice-area">
            ${rollA
              ? _buildDiceResultHTML(rollA, sideA.key === winner && showProceed)
              : `<span class="dice-placeholder">굴림 대기</span>`}
          </div>
          ${_buildRollButton(sideA.key, rollA, showProceed)}
        </div>

        <div class="initiative-col-divider"></div>

        <!-- 진영 B -->
        <div class="initiative-roll-col">
          <div class="initiative-col-label">${sideB.label}</div>
          <div class="initiative-dice-area">
            ${rollB
              ? _buildDiceResultHTML(rollB, sideB.key === winner && showProceed)
              : `<span class="dice-placeholder">굴림 대기</span>`}
          </div>
          ${_buildRollButton(sideB.key, rollB, showProceed)}
        </div>

      </div>

      ${noticeHtml}

      ${showProceed ? `
        <div class="initiative-proceed-row">
          <button class="btn btn-primary initiative-proceed-btn"
                  onclick="initiativeGoChoose()">
            선후 결정하기 ▶
          </button>
        </div>` : ''}

    </div>`;
}

function _buildRollButton(sideKey, roll, showProceed) {
  // 결과가 확정(showProceed)되면 개별 굴림 버튼 비활성화
  if (showProceed) {
    return `<button class="btn btn-secondary initiative-roll-btn" disabled>✓ 완료</button>`;
  }
  return `
    <button class="btn ${roll ? 'btn-secondary' : 'btn-primary'} initiative-roll-btn"
            onclick="initiativeRoll('${sideKey}')">
      🎲 ${roll ? '다시 굴리기' : '굴림 (2d6)'}
    </button>`;
}

// ── 2단계: 선후 선택 ─────────────────────────────────────────
function _buildChoosePhaseHTML() {
  const sides      = _getInitiativeSides();
  const winner     = _initiativeState.winner;
  const winnerSide = sides.find(s => s.key === winner);
  const loserSide  = sides.find(s => s.key !== winner);
  if (!winnerSide) return `<p class="phase-action-desc">오류: 우선권 진영을 찾을 수 없습니다.</p>`;

  const rollA = _initiativeState.rolls[sides[0]?.key];
  const rollB = _initiativeState.rolls[sides[1]?.key];

  return `
    <div class="initiative-ui">

      <!-- 굴림 결과 요약 -->
      <div class="initiative-result-summary">
        <div class="initiative-summary-col">
          <span class="initiative-summary-label">${sides[0]?.label}</span>
          <span class="initiative-summary-total ${sides[0]?.key === winner ? 'initiative-winner-total' : ''}">
            ${rollA?.total ?? '—'}
          </span>
        </div>
        <div class="initiative-summary-vs">VS</div>
        <div class="initiative-summary-col">
          <span class="initiative-summary-label">${sides[1]?.label}</span>
          <span class="initiative-summary-total ${sides[1]?.key === winner ? 'initiative-winner-total' : ''}">
            ${rollB?.total ?? '—'}
          </span>
        </div>
      </div>

      <!-- 선택 패널 -->
      <div class="initiative-choose-panel">
        <div class="initiative-choose-title">
          🏆 <span class="initiative-choose-winner">${winnerSide.label}</span>의 순서를 정하세요
        </div>
        <div class="initiative-choose-subtitle">
          선택하지 않은 진영(${loserSide?.label ?? '?'})은 반대 순서가 됩니다.
        </div>
        <div class="initiative-choose-btns">
          <button class="btn btn-primary initiative-choose-btn"
                  onclick="initiativeChoose('first')">
            ① 선 플레이어
          </button>
          <button class="btn btn-secondary initiative-choose-btn"
                  onclick="initiativeChoose('second')">
            ② 후 플레이어
          </button>
        </div>
      </div>

    </div>`;
}

// ── 3단계: 결과 확인 ─────────────────────────────────────────
function _buildResultPhaseHTML() {
  const sides        = _getInitiativeSides();
  const firstKey     = _initiativeState.firstPlayer;
  const secondKey    = sides.find(s => s.key !== firstKey)?.key ?? null;
  const firstLabel   = sides.find(s => s.key === firstKey)?.label  ?? '?';
  const secondLabel  = sides.find(s => s.key === secondKey)?.label ?? '?';

  return `
    <div class="initiative-ui">

      <div class="initiative-final-result">
        <div class="initiative-final-title">이번 턴 순서 결정</div>

        <div class="initiative-final-row">
          <span class="initiative-final-badge initiative-badge-first">① 선</span>
          <span class="initiative-final-side-label">${firstLabel}</span>
        </div>
        <div class="initiative-final-row">
          <span class="initiative-final-badge initiative-badge-second">② 후</span>
          <span class="initiative-final-side-label">${secondLabel}</span>
        </div>
      </div>

      <div class="initiative-proceed-row">
        <button class="btn btn-primary initiative-proceed-btn"
                onclick="initiativeConfirm()">
          다음 페이즈 ▶
        </button>
      </div>

    </div>`;
}

// ── 주사위 결과 HTML 헬퍼 ────────────────────────────────────
function _buildDiceResultHTML(rollData, isWinner) {
  const { dice, total } = rollData;
  const [d1, d2] = dice;
  return `
    <div class="initiative-dice-result ${isWinner ? 'initiative-dice-winner' : ''}">
      <div class="die-wrap">${makeDieFaceHTML(d1, 'ivory')}<div class="die-val">${d1}</div></div>
      <div class="die-wrap">${makeDieFaceHTML(d2, 'ivory')}<div class="die-val">${d2}</div></div>
      <div class="dice-total">${total}<small>합계</small></div>
    </div>`;
}