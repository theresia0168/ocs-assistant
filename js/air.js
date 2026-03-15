// ============================================================
// 항공 임무 (Air Mission)
// ============================================================
// 구조:
//   - airUI()     : 단일 렌더링 진입점. airAction에 따라 분기.
//   - Dogfight    : 독립 모듈. dfStart(opts)로 시작, 완료 시 opts.onDone() 호출.
//   - Interception: 독립 모듈. icStart(opts)로 시작, 완료 시 opts.onDone() 호출.
//   - AA Fire     : 독립 모듈. aaStart(opts)로 시작, 완료 시 opts.onDone() 호출.
//   - CAP         : capState 사용. 위 모듈 조합.
//   - Bombing     : bombState 사용. 위 모듈 조합.
// ============================================================

const AIR_ACTIONS = [
  { id: 'bombing',   label: '폭격 + 힙샷',  en: 'Bombing + Hip Shoot', icon: '💣', available: true  },
  { id: 'interdict', label: '항공 저지',     en: 'Interdiction',        icon: '🚫', available: true },
  { id: 'transfer',  label: '기지 이동',     en: 'Base Transfer',       icon: '✈',  available: true },
  { id: 'airdrop',   label: '공수 강하',     en: 'Airborne Drop',       icon: '🪂',  available: true },
  { id: 'airlift',   label: '항공 수송',     en: 'Air Transport',       icon: '📦', available: true },
  { id: 'cap',       label: '전투기 초계',   en: 'CAP',                 icon: '🛡',  available: true  },
];

// ── 전역 상태 ─────────────────────────────────────────────────
let airAction = null;

// ── 단일 렌더링 진입점 ─────────────────────────────────────────
function airUI() {
  const el = document.getElementById('airContent');
  if (!el) return;
  if      (!airAction)            el.innerHTML = renderActionSelect();
  else if (airAction === 'cap')   el.innerHTML = renderCAP();
  else if (airAction === 'bombing') el.innerHTML = renderBombing();
  else if (airAction === 'transfer')  el.innerHTML = renderTransfer();
  else if (airAction === 'interdict') el.innerHTML = renderInterdict();
  else if (airAction === 'airdrop')   el.innerHTML = renderAirdrop();
  else if (airAction === 'airlift')   el.innerHTML = renderAirlift();
}

// app.js에서 호출하는 초기화 별칭
function renderAirActionSelect() { airUI(); }

// ── 임무 선택 화면 ──────────────────────────────────────────────
function renderActionSelect() {
  return `
    <div class="card">
      <div class="card-title"><span class="icon">✈</span> 항공 임무 선택</div>
      <div class="air-action-grid">
        ${AIR_ACTIONS.map(a => `
          <button class="air-action-btn${a.available ? '' : ' unavailable'}"
                  ${a.available ? `onclick="selectAirAction('${a.id}')"` : ''}>
            <span class="air-action-icon">${a.icon}</span>
            <span class="air-action-label">${a.label}</span>
            <span class="air-action-en">${a.en}</span>
            ${!a.available ? '<span class="air-action-wip">준비 중</span>' : ''}
          </button>
        `).join('')}
      </div>
    </div>`;
}

function selectAirAction(id) {
  airAction = id;
  if (id === 'cap')     { capInit();  }
  else if (id === 'bombing')   bombInit();
  else if (id === 'transfer')  transferInit();
  else if (id === 'interdict') interdictInit();
  else if (id === 'airdrop')   airdropInit();
  else if (id === 'airlift')   airliftInit();
  airUI();
}

function backToAirSelect() {
  airAction = null;
  dfReset(); icReset(); aaReset();
  airUI();
}

// ─────────────────────────────────────────────────────────────
// ██  공중전 모듈 (Dogfight)
// ─────────────────────────────────────────────────────────────
// dfStart({
//   attackerUnits: [{id,name,str},...] | null,  // null이면 화면에서 입력
//   onDone: fn(dfState),
//   onBack: fn(),
// });

let dfState = null;

function dfReset() { dfState = null; }

function dfStart(opts) {
  // presetDefender: 방어자 유닛이 미리 주어지는 경우 (요격 등)
  const hasPresetDef = !!(opts.presetDefender?.length);
  dfState = {
    // 공격자가 없으면 setup, 공격자만 있으면 setup_def_only
    // 요격처럼 방어자만 preset인 경우도 setup (공격자 수 입력 필요)
    phase: (opts.attackerUnits && !hasPresetDef) ? 'setup_def_only'
         : (opts.attackerUnits &&  hasPresetDef && opts.presetAttacker) ? 'voluntary'
         : 'setup',
    round: 0,
    attackerUnits: opts.attackerUnits
      ? opts.attackerUnits.map(u => ({ ...u, aborted: false }))
      : null,
    // 방어자가 미리 주어지면 세팅, 아니면 setup에서 수 입력
    defenderUnits: hasPresetDef ? opts.presetDefender : [],
    defPreset: hasPresetDef,   // true면 방어자 수 입력 건너뜀
    attackerLabel: opts.attackerLabel || '공격자 (Attacker)',
    defenderLabel: opts.defenderLabel || '방어자 (Defender)',
    selectedAtk: null, selectedDef: null,
    atkHalfRange: false, defHalfRange: false,
    rollResult: null,
    winner: null, endReason: '',
    onDone: opts.onDone || (() => {}),
    onBack: opts.onBack || backToAirSelect,
  };
}

function renderDogfight() {
  if (!dfState) return '';
  switch (dfState.phase) {
    case 'setup':          return renderDfSetup(false);
    case 'setup_def_only': return renderDfSetup(true);
    case 'voluntary':      return renderDfVoluntary();
    case 'select':         return renderDfSelect();
    case 'roll':           return renderDfRoll();
    case 'end':            return renderDfEnd();
    default: return '';
  }
}

function renderDfSetup(defOnly) {
  const df = dfState;
  const atkLabel = df.attackerLabel || '공격자 (Attacker)';
  const defLabel = df.defenderLabel || '방어자 (Defender)';

  // 공격자 섹션: 미리 주어진 경우 표시만, 아니면 수 입력
  const atkSection = defOnly ? `
    <div class="df-side atk-side">
      <div class="df-side-label atk-label">${atkLabel}</div>
      ${df.attackerUnits.map(u => `
        <div class="df-unit-row">
          <span class="df-unit-name">${u.name}</span>
          <span class="df-unit-str-wrap" style="font-size:0.75rem;color:var(--ink-faded);">공대공 전력 ${u.str}</span>
        </div>`).join('')}
    </div>` : `
    <div class="df-side atk-side">
      <div class="df-side-label atk-label">${atkLabel}</div>
      <div class="field-group">
        <label class="field-label">항공 유닛 수</label>
        <input class="field-input" type="number" id="dfAtkCount" value="1" min="1" max="8" step="1">
      </div>
    </div>`;

  // 방어자 섹션: preset이면 목록 표시, 아니면 수 입력
  const defSection = df.defPreset ? `
    <div class="df-side def-side">
      <div class="df-side-label def-label">${defLabel}</div>
      ${df.defenderUnits.map(u => `
        <div class="df-unit-row">
          <span class="df-unit-name">${u.name}</span>
          <span class="df-unit-str-wrap" style="font-size:0.75rem;color:var(--ink-faded);">공대공 전력 ${u.str}</span>
        </div>`).join('')}
    </div>` : `
    <div class="df-side def-side">
      <div class="df-side-label def-label">${defLabel}</div>
      <div class="field-group">
        <label class="field-label">항공 유닛 수</label>
        <input class="field-input" type="number" id="dfDefCount" value="1" min="1" max="8" step="1">
      </div>
    </div>`;

  return `
    <div class="card">
      <div class="card-title"><span class="icon">⚔</span> 공중전 설정</div>
      <div class="dogfight-setup-grid">
        ${atkSection}
        <div class="df-vs">VS</div>
        ${defSection}
      </div>
      <div class="btn-row">
        <button class="btn btn-secondary" onclick="dfBack()">◀ 이전</button>
        <button class="btn btn-primary"   onclick="dfBegin()">공중전 시작 ▶</button>
      </div>
    </div>`;
}

function dfBack() {
  const fn = dfState?.onBack;
  dfReset();
  if (fn) fn(); else airUI();
}

function dfBegin() {
  const df = dfState;
  // 공격자 설정
  if (!df.attackerUnits) {
    const atkCount = parseInt(document.getElementById('dfAtkCount').value) || 1;
    df.attackerUnits = Array.from({length: atkCount}, (_, i) => ({
      id: i, name: `공격자 유닛 ${i+1}`, str: 1, aborted: false
    }));
  }
  // 방어자 설정 (preset이 아닌 경우만 입력값 사용)
  if (!df.defPreset) {
    const defCount = parseInt(document.getElementById('dfDefCount').value) || 1;
    df.defenderUnits = Array.from({length: defCount}, (_, i) => ({
      id: i, name: `방어자 유닛 ${i+1}`, str: 1, aborted: false
    }));
  }
  df.round = 0;
  const defCount = df.defenderUnits.length;
  df.phase = defCount > 1 ? 'voluntary' : 'select';
  if (df.phase === 'select') df.round = 1;
  airUI();
}

function renderDfVoluntary() {
  const df = dfState;
  const activeUnits = df.defenderUnits.filter(u => !u.aborted);
  const checkboxRows = activeUnits.map(u => `
    <label class="df-vol-check-row">
      <input type="checkbox" class="df-vol-checkbox" value="${u.id}">
      <span class="df-vol-unit-name">${u.name}</span>
      <span class="df-vol-unit-str">전력 ${u.str}</span>
    </label>`).join('');
  return `
    <div class="card">
      <div class="card-title"><span class="icon">⚠</span> 공중전 — 자발적 임무 중단</div>
      <div class="df-info-box">
        <p>방어자는 <strong>자발적 임무 중단</strong>을 선택할 수 있습니다. (규칙 14.3d)</p>
        <p style="margin-top:6px;font-size:0.8rem;color:var(--ink-faded);">중단할 유닛을 체크하세요. 아무것도 체크하지 않으면 전원 계속 임무를 수행합니다.</p>
      </div>
      <div class="df-vol-unit-list" style="margin-top:14px;">
        ${checkboxRows}
      </div>
      <div class="btn-row" style="margin-top:16px;">
        <button class="btn btn-secondary" onclick="dfVolSkip()">중단 없이 진행 ▶</button>
        <button class="btn btn-primary"   onclick="dfVolApply()">선택 적용 후 진행 ▶</button>
      </div>
    </div>`;
}

function dfVolSkip() { dfState.phase = 'select'; dfState.round = 1; airUI(); }

function dfVolApply() {
  const df = dfState;
  const checked = [...document.querySelectorAll('.df-vol-checkbox:checked')]
    .map(el => parseInt(el.value));
  checked.forEach(id => {
    const u = df.defenderUnits.find(u => u.id === id);
    if (u) u.aborted = true;
  });
  const defActive = df.defenderUnits.filter(u => !u.aborted).length;
  if (defActive === 0) { df.phase='end'; df.winner='attacker'; df.endReason='방어자 전원 자발적 임무 중단'; }
  else                 { df.phase='select'; df.round=1; }
  airUI();
}

function renderDfSelect() {
  const df = dfState;
  const atkActive = df.attackerUnits.filter(u => !u.aborted);
  const defActive = df.defenderUnits.filter(u => !u.aborted);

  const unitRows = (units, side) => units.map(u => `
    <div class="df-unit-row">
      <span class="df-unit-name">${u.name}</span>
      <div class="df-unit-str-wrap">
        <label class="field-label" style="margin:0;">공대공 전력</label>
        <input class="field-input df-str-input" type="number"
               id="dfStr_${side}_${u.id}" value="${u.str}" min="0" step="0.5" style="width:70px;">
      </div>
    </div>`).join('');

  return `
    <div class="card">
      <div class="card-title"><span class="icon">🎯</span> 공중전 라운드 ${df.round} — 유닛 선택</div>
      <div class="dogfight-setup-grid">
        <div class="df-side atk-side">
          <div class="df-side-label atk-label">${df.attackerLabel||'공격자'} — ()가 아닌 유닛</div>
          <div class="df-note">활성 유닛 <strong>${atkActive.length}기</strong></div>
          <div class="df-unit-list">${unitRows(atkActive,'atk')}</div>
          <div class="field-group" style="margin-top:8px;">
            <label class="field-label">선택 유닛</label>
            <select class="field-input" id="dfAtkSel">
              ${atkActive.map(u => `<option value="${u.id}">${u.name}</option>`).join('')}
            </select>
          </div>
          <label class="bcl-item" style="margin-top:6px;">
            <input type="checkbox" id="dfAtkHalfRange">
            <span class="bcl-shift bcl-L" style="min-width:28px;text-align:center;padding:1px 4px;border:1px solid;">−1</span>
            <span class="bcl-desc">항속 거리 절반 이상 이동 <span class="bcl-opt-tag">옵션</span></span>
          </label>
        </div>
        <div class="df-vs">⚔</div>
        <div class="df-side def-side">
          <div class="df-side-label def-label">${df.defenderLabel||'방어자'} — 아무 유닛</div>
          <div class="df-note">활성 유닛 <strong>${defActive.length}기</strong></div>
          <div class="df-unit-list">${unitRows(defActive,'def')}</div>
          <div class="field-group" style="margin-top:8px;">
            <label class="field-label">선택 유닛</label>
            <select class="field-input" id="dfDefSel">
              ${defActive.map(u => `<option value="${u.id}">${u.name}</option>`).join('')}
            </select>
          </div>
          <label class="bcl-item" style="margin-top:6px;">
            <input type="checkbox" id="dfDefHalfRange">
            <span class="bcl-shift bcl-L" style="min-width:28px;text-align:center;padding:1px 4px;border:1px solid;">−1</span>
            <span class="bcl-desc">항속 거리 절반 이상 이동 <span class="bcl-opt-tag">옵션</span></span>
          </label>
        </div>
      </div>
      <div class="btn-row">
        <button class="btn btn-primary" onclick="dfProceedToRoll()">공중전 굴림 ▶</button>
      </div>
    </div>
    ${renderDfStatus()}`;
}

function dfProceedToRoll() {
  const df = dfState;
  df.selectedAtk = parseInt(document.getElementById('dfAtkSel').value);
  df.selectedDef = parseInt(document.getElementById('dfDefSel').value);
  df.attackerUnits.forEach(u => { const el = document.getElementById(`dfStr_atk_${u.id}`); if (el) u.str = parseFloat(el.value)||0; });
  df.defenderUnits.forEach(u => { const el = document.getElementById(`dfStr_def_${u.id}`); if (el) u.str = parseFloat(el.value)||0; });
  df.atkHalfRange = document.getElementById('dfAtkHalfRange')?.checked || false;
  df.defHalfRange = document.getElementById('dfDefHalfRange')?.checked || false;
  df.phase = 'roll'; df.rollResult = null;
  airUI();
}

function renderDfRoll() {
  const df = dfState;
  const atkUnit = df.attackerUnits.find(u => u.id === df.selectedAtk);
  const defUnit = df.defenderUnits.find(u => u.id === df.selectedDef);
  const hasResult = !!df.rollResult;
  return `
    <div class="card">
      <div class="card-title"><span class="icon">🎲</span> 공중전 라운드 ${df.round} — 공중전 굴림</div>
      <div class="dogfight-matchup">
        <div class="df-matchup-unit atk-side">
          <div class="df-side-label atk-label">${df.attackerLabel||'공격자'}</div>
          <div class="df-unit-name-big">${atkUnit?.name||'—'}</div>
          <div class="df-unit-str-big">전력 <strong>${atkUnit?.str??'—'}</strong></div>
        </div>
        <div class="df-vs-big">VS</div>
        <div class="df-matchup-unit def-side">
          <div class="df-side-label def-label">${df.defenderLabel||'방어자'}</div>
          <div class="df-unit-name-big">${defUnit?.name||'—'}</div>
          <div class="df-unit-str-big">전력 <strong>${defUnit?.str??'—'}</strong></div>
        </div>
      </div>
      <div class="dice-result-area" style="min-height:90px;margin:12px 0;flex-wrap:wrap;align-items:flex-start;gap:8px;">
        ${hasResult ? renderDfDiceResult(df.rollResult, atkUnit, defUnit) : '<span class="dice-placeholder">버튼을 눌러 굴리세요</span>'}
      </div>
      <div class="btn-row">
        ${!hasResult
          ? `<button class="btn btn-primary" onclick="dfRollDice()">🎲 공중전 굴림</button>`
          : `<button class="btn btn-secondary" onclick="dfRollDice()">🎲 다시 굴리기</button>
             <button class="btn btn-primary"   onclick="dfApply()">결과 적용 ▶</button>`}
      </div>
    </div>
    ${renderDfStatus()}`;
}

function dfRollDice() {
  const df = dfState;
  const atkUnit = df.attackerUnits.find(u => u.id === df.selectedAtk);
  const defUnit = df.defenderUnits.find(u => u.id === df.selectedDef);
  const v1 = Math.floor(Math.random()*6)+1, v2 = Math.floor(Math.random()*6)+1;
  const atkStr = (atkUnit?.str||0) - (df.atkHalfRange?1:0);
  const defStr = (defUnit?.str||0) - (df.defHalfRange?1:0);
  const mod = Math.round(atkStr - defStr);
  const adjusted = v1 + v2 + mod;
  // 결과 테이블: 6이하=공격자 중단, 7=양측 중단, 8이상=방어자 중단
  const atkAbort = adjusted <= 7;
  const defAbort = adjusted >= 7;
  const dfRl = () => { const d=Math.floor(Math.random()*6)+1; return {die:d,loss:d>=5}; };
  df.rollResult = { v1, v2, mod, adjusted, atkAbort, defAbort,
    atkLoss: atkAbort ? dfRl() : null, defLoss: defAbort ? dfRl() : null,
    atkHalfRange: df.atkHalfRange, defHalfRange: df.defHalfRange };
  airUI();
}

function renderDfDiceResult(res, atkUnit, defUnit) {
  const { v1, v2, mod, adjusted, atkAbort, defAbort, atkLoss, defLoss, atkHalfRange, defHalfRange } = res;
  const outcomeLabel = (atkAbort&&defAbort)?'양측 임무 중단':atkAbort?'공격자 임무 중단':'방어자 임무 중단';
  const outcomeClass = (atkAbort&&defAbort)?'no-effect':atkAbort?'atk-loss':'def-loss';
  const notes = [...(atkHalfRange?['공격자 항속 −1']:[]), ...(defHalfRange?['방어자 항속 −1']:[])];
  const lossHtml = (label, lo, cls) => lo ? `
    <div class="df-loss-row">
      <span class="df-loss-label ${cls}">${label} 손실 굴림</span>
      <div class="die-wrap" style="transform:scale(0.8);transform-origin:center;">${makeDieFaceHTML(lo.die,'ivory')}<div class="die-val">${lo.die}</div></div>
      <span class="df-loss-result ${lo.loss?'brt-step':'brt-none'}">${lo.loss?'1 스텝 손실 (5~6)':'손실 없음 (1~4)'}</span>
    </div>` : '';
  const abortLines = [
    ...(atkAbort ? [`<div class="df-result-row atk-loss">→ ${atkUnit?.name} 임무 중단${atkLoss?.loss?' + 1 스텝 손실':''}</div>`] : []),
    ...(defAbort ? [`<div class="df-result-row def-loss">→ ${defUnit?.name} 임무 중단${defLoss?.loss?' + 1 스텝 손실':''}</div>`] : []),
  ];
  return `
    <div class="die-wrap">${makeDieFaceHTML(v1,'ivory')}<div class="die-val">${v1}</div></div>
    <div class="die-wrap">${makeDieFaceHTML(v2,'ivory')}<div class="die-val">${v2}</div></div>
    <div class="dice-modified-total">
      <div style="font-size:1.4rem;font-weight:900;">${adjusted}</div>
      <div class="drm-line">${v1+v2} ${mod>=0?'+':''}${mod} = ${adjusted}</div>
      ${notes.length?`<div class="drm-line">${notes.join(' / ')}</div>`:''}
      <div class="df-result-row ${outcomeClass}" style="margin-top:6px;">${outcomeLabel}</div>
    </div>
    ${(atkLoss||defLoss)?`<div class="df-loss-block">
      ${lossHtml('공격자',atkLoss,'atk-label')}
      ${lossHtml('방어자',defLoss,'def-label')}
    </div>`:''}
    ${abortLines.length?`<div class="df-result-summary" style="width:100%;margin-top:6px;">${abortLines.join('')}</div>`:''}`;
}

function dfApply() {
  const df = dfState; const r = df.rollResult; if (!r) return;
  if (r.atkAbort) { const u=df.attackerUnits.find(u=>u.id===df.selectedAtk); if(u) u.aborted=true; }
  if (r.defAbort) { const u=df.defenderUnits.find(u=>u.id===df.selectedDef); if(u) u.aborted=true; }
  df.rollResult = null;
  const atkA = df.attackerUnits.filter(u=>!u.aborted).length;
  const defA = df.defenderUnits.filter(u=>!u.aborted).length;
  if (atkA===0&&defA===0) { df.phase='end'; df.winner='draw';     df.endReason='양측 전원 임무 중단'; }
  else if (atkA===0)      { df.phase='end'; df.winner='defender'; df.endReason='공격자 전원 임무 중단'; }
  else if (defA===0)      { df.phase='end'; df.winner='attacker'; df.endReason='방어자 전원 임무 중단'; }
  else                    { df.round++; df.phase='select'; }
  airUI();
}

function renderDfEnd() {
  const df = dfState;
  const wMap = {attacker:'공격자 승리',defender:'방어자 승리',draw:'무승부'};
  const wCls = {attacker:'atk-winner',defender:'def-winner',draw:'draw-winner'};
  return `
    <div class="card">
      <div class="card-title"><span class="icon">🏁</span> 공중전 종료</div>
      <div class="df-winner ${wCls[df.winner]}">${wMap[df.winner]}</div>
      <div class="df-end-reason">${df.endReason} · ${df.round}라운드</div>
      ${renderDfStatus()}
      <div class="btn-row" style="margin-top:16px;">
        <button class="btn btn-primary" onclick="dfDone()">다음 단계 ▶</button>
      </div>
    </div>`;
}

function dfDone() {
  const cb = dfState?.onDone; const snap = dfState ? {...dfState} : null;
  dfReset(); if (cb) cb(snap); else airUI();
}

function renderDfStatus() {
  const df = dfState;
  if (!df?.attackerUnits?.length) return '';
  const side = (units, label, cls) => `
    <div class="df-status-side">
      <div class="df-status-label ${cls}">${label}</div>
      ${units.map(u=>`
        <div class="df-status-unit${u.aborted?' aborted':''}">
          <span>${u.name}</span>
          <span class="df-status-str">전력 ${u.str}</span>
          ${u.aborted?'<span class="df-aborted-tag">중단</span>':''}
        </div>`).join('')}
    </div>`;
  return `
    <div class="card df-status-panel">
      <div class="card-title" style="font-size:0.72rem;padding-bottom:6px;margin-bottom:10px;">공중전 현황 — 라운드 ${df.round||0}</div>
      <div class="df-status-grid">
        ${side(df.attackerUnits, df.attackerLabel||'공격자', 'atk-label')}
        ${side(df.defenderUnits, df.defenderLabel||'방어자', 'def-label')}
      </div>
    </div>`;
}

// ─────────────────────────────────────────────────────────────
// ██  요격 모듈 (Interception)
// ─────────────────────────────────────────────────────────────

let icState = null;

function icReset() { icState = null; }

function icStart(opts) {
  icState = {
    phase: 'ask',
    missionUnits: opts.missionUnits || [],
    onDone: opts.onDone || (()=>{}),
    onBack: opts.onBack || (()=>airUI()),
  };
}

function renderInterception() {
  if (!icState) return '';
  if (dfState) return renderDogfight();   // 공중전 모듈에 위임
  switch (icState.phase) {
    case 'ask':  return renderIcAsk();
    case 'done': return renderIcDone();
    default: return '';
  }
}

function renderIcAsk() {
  return `
    <div class="card">
      <div class="card-title"><span class="icon">🚨</span> 요격 절차</div>
      <div class="df-info-box">
        <p>방어자가 <strong>요격(Interception)</strong>을 수행합니까?</p>
        <p style="margin-top:6px;font-size:0.8rem;color:var(--ink-faded);">요격 시 방어자는 항공 유닛을 임무 목표 헥스로 이동하여 공중전을 수행합니다.</p>
      </div>
      <div class="btn-row" style="margin-top:16px;">
        <button class="btn btn-secondary" onclick="icDecline()">아니오 — 요격 없이 진행 ▶</button>
        <button class="btn btn-primary"   onclick="icAccept()">예 — 요격 공중전 수행 ▶</button>
      </div>
    </div>`;
}

function icDecline() { icState.phase='done'; airUI(); }

function icAccept() {
  // 요격: 요격기는 항상 1기로 고정, 임무 수행 중인 유닛이 "방어자"(preset)
  dfStart({
    attackerUnits: [{ id: 0, name: '요격기 1', str: 1, aborted: false }],
    presetAttacker: true,   // 공격자도 preset — setup 화면 건너뜀
    presetDefender: icState.missionUnits.map(u => ({
      id: u.id, name: u.name, str: u.airStr ?? u.str ?? 1, aborted: false
    })),
    attackerLabel: '요격기 (Interceptor) — 방어자 측',
    defenderLabel: '임무 유닛 (Mission) — 공격자 측',
    onDone: (snap) => {
      // 요격 공중전에서 임무 유닛(방어자 역할)이 중단된 경우 bombState에 반영
      if (snap?.defenderUnits && icState?.missionUnits) {
        snap.defenderUnits.forEach(du => {
          const u = icState.missionUnits.find(u => u.id === du.id);
          if (u && du.aborted) u.aborted = true;
        });
      }
      icState.phase = 'done';
      airUI();
    },
    onBack: () => { dfReset(); icState.phase = 'ask'; airUI(); },
  });
  airUI();
}

function renderIcDone() {
  return `
    <div class="card">
      <div class="card-title"><span class="icon">✅</span> 요격 완료</div>
      <div class="df-info-box"><p>요격 절차가 완료되었습니다.</p></div>
      <div class="btn-row" style="margin-top:16px;">
        <button class="btn btn-primary" onclick="icDone()">다음 단계 ▶</button>
      </div>
    </div>`;
}

function icDone() {
  const cb = icState?.onDone;
  const snap = icState ? { missionUnits: [...(icState.missionUnits || [])] } : null;
  icReset();
  if (cb) cb(snap); else airUI();
}

// ─────────────────────────────────────────────────────────────
// ██  대공 사격 모듈 (AA Fire)
// ─────────────────────────────────────────────────────────────

let aaState = null;

function aaReset() { aaState = null; }

function aaStart(opts) {
  aaState = {
    missionUnits:    opts.missionUnits || [],
    inEnemyAirspace: opts.inEnemyAirspace || false,
    result: null,
    lossPhase: null,   // null | 'confirm' | 'done'
    onDone: opts.onDone || (()=>{}),
  };
}

function renderAA() {
  if (!aaState) return '';
  // 손실 처리 단계
  if (aaState.lossPhase === 'confirm')  return renderAALossConfirm();
  if (aaState.lossPhase === 'reInput') return renderAAReInput();
  const st = aaState; const units = st.missionUnits; const n = units.length;
  const hasResult = !!st.result;

  const drmItems = [
    { id:'aa_multi', label:`3기 이상 항공 유닛 참가`, shift:+1, auto:n>=3, autoDesc:`현재 ${n}기` },
    { id:'aa_hq',    label:`임무 목표 헥스에 HQ 1개 이상 존재`, shift:+1 },
    { id:'aa_airbase',label:`항공 기지 레벨`, custom:true, cid:'aa_airbase_val' },
    { id:'aa_mapaa', label:`지도 대공 사격 수치`, custom:true, cid:'aa_mapaa_val' },
    { id:'aa_naval', label:`해군 대공 사격 총합`, custom:true, cid:'aa_naval_val' },
    ...(st.inEnemyAirspace ? [
      { id:'aa_ft_inc', label:`경계 영공 — 전투기 최소 1개 포함`, shift:+1 },
      { id:'aa_ft_exc', label:`경계 영공 — 전투기 미포함`, shift:+2 },
    ] : []),
  ];

  const drmRows = drmItems.map(d => {
    if (d.custom) return `
      <div class="aa-drm-row">
        <span class="aa-drm-desc">${d.label}</span>
        <input class="field-input aa-drm-input" type="number" id="${d.cid}" value="0" min="0" step="1" oninput="calcAADRM()">
      </div>`;
    const chk = d.auto ? 'checked disabled' : '';
    const scls = (d.shift||0)>0 ? 'bcl-R' : 'bcl-L';
    return `
      <div class="aa-drm-row">
        <label class="aa-drm-label">
          <input type="checkbox" id="${d.id}" ${chk} onchange="calcAADRM()">
          <span class="aa-drm-desc">${d.label}${d.auto?` <span class="bcl-opt-tag">${d.autoDesc}</span>`:''}</span>
        </label>
        <span class="aa-drm-shift ${scls}">${(d.shift||0)>0?'+':''}${d.shift}</span>
      </div>`;
  }).join('');

  const lossUnitHtml = hasResult && st.result.hasLoss && n > 1
    ? renderAALossUnitBox(st.result, units) : '';

  return `
    <div class="card">
      <div class="card-title"><span class="icon">🔫</span> 대공 사격 (Anti-Aircraft Fire)</div>
      <div class="aa-drm-section">
        <div class="field-label" style="margin-bottom:8px;">DRM 체크리스트</div>
        <div class="aa-drm-list">${drmRows}</div>
        <div class="aa-drm-total-row">
          <span class="field-label" style="margin:0;">총 DRM</span>
          <span class="aa-drm-total" id="aaDRMTotal">+0</span>
        </div>
      </div>
      <div class="divider"></div>
      <div class="dice-result-area" style="min-height:80px;margin-bottom:12px;">
        ${hasResult ? renderAADiceResult(st.result) : '<span class="dice-placeholder">버튼을 눌러 굴리세요</span>'}
      </div>
      ${lossUnitHtml}
      <div class="btn-row">
        ${!hasResult
          ? `<button class="btn btn-primary" onclick="aaRollDice()">🎲 대공 사격 굴림 (2d6)</button>`
          : `<button class="btn btn-secondary" onclick="aaReroll()">🎲 다시 굴리기</button>
             <button class="btn btn-primary"   onclick="${st.result.hasLoss ? 'aaConfirmLoss()' : 'aaDone()'}">
               ${st.result.hasLoss ? '손실 처리 ▶' : '다음 단계 ▶'}</button>`}
      </div>
    </div>`;
}

// 손실 확인 화면: 파괴 or 스텝만 손실
function renderAALossConfirm() {
  const st = aaState;
  const units = st.missionUnits;
  const res = st.result;
  const n = units.length;
  // 단일 유닛이면 바로 해당 유닛, 복수면 lossUnitIdx로 특정
  const lostIdx = n === 1 ? 0 : res.lossUnitIdx;
  const lostUnit = units[lostIdx];
  if (!lostUnit) { aaDone(); return ''; }

  return `
    <div class="card">
      <div class="card-title"><span class="icon">💥</span> 대공 사격 — 손실 처리</div>
      <div class="df-info-box" style="margin-bottom:14px;">
        <p><strong>${lostUnit.name}</strong>이(가) 1 스텝 손실을 입었습니다.</p>
        <p style="margin-top:6px;font-size:0.8rem;color:var(--ink-faded);">유닛이 파괴되었습니까, 아니면 손실만 입고 계속 임무를 수행합니까?</p>
      </div>
      <div class="btn-row" style="margin-top:4px;">
        <button class="btn btn-danger"    onclick="aaLossDestroyed(${lostIdx})">유닛 파괴 — 임무에서 제거</button>
        <button class="btn btn-secondary" onclick="aaLossDamaged(${lostIdx})">스텝 손실만 — 화력 재입력</button>
      </div>
    </div>`;
}

function aaConfirmLoss() {
  aaState.lossPhase = 'confirm';
  airUI();
}

function aaLossDestroyed(idx) {
  // 해당 유닛 aborted(파괴) 처리
  aaState.missionUnits[idx].aborted = true;
  aaState.missionUnits[idx].destroyed = true;
  aaState.lossPhase = 'done';
  aaDone();
}

function aaLossDamaged(idx) {
  // 화력 재입력 화면으로
  aaState.lossPhase = 'reInput';
  aaState.lossUnitIdx = idx;
  airUI();
}

function renderAAReInput() {
  const st = aaState;
  const u = st.missionUnits[st.lossUnitIdx];
  return `
    <div class="card">
      <div class="card-title"><span class="icon">✏</span> 대공 사격 — 손실 후 화력 재입력</div>
      <div class="df-info-box" style="margin-bottom:14px;">
        <p><strong>${u.name}</strong>이(가) 스텝 손실 후 임무를 계속합니다.</p>
        <p style="margin-top:6px;font-size:0.8rem;color:var(--ink-faded);">손실 후 현재 공대지 화력을 입력하세요.</p>
      </div>
      <div class="field-group">
        <label class="field-label">손실 후 공대지 화력 (현재 ${u.groundStr})</label>
        <input class="field-input" type="number" id="aaReInputStr" value="${Math.max(0, u.groundStr - 1)}" min="0" step="0.5" style="max-width:120px;">
      </div>
      <div class="btn-row" style="margin-top:16px;">
        <button class="btn btn-primary" onclick="aaReInputDone()">확인 ▶</button>
      </div>
    </div>`;
}

function aaReInputDone() {
  const st = aaState;
  const u = st.missionUnits[st.lossUnitIdx];
  const newStr = parseFloat(document.getElementById('aaReInputStr').value) || 0;
  u.groundStr = newStr;
  st.lossPhase = 'done';
  aaDone();
}

function calcAADRM() {
  let total = 0;
  const sm = {aa_multi:1,aa_hq:1,aa_ft_inc:1,aa_ft_exc:2};
  Object.keys(sm).forEach(id=>{ const el=document.getElementById(id); if(el?.checked) total+=sm[id]; });
  ['aa_airbase_val','aa_mapaa_val','aa_naval_val'].forEach(id=>{ const el=document.getElementById(id); if(el) total+=parseInt(el.value)||0; });
  const el=document.getElementById('aaDRMTotal'); if(el) el.textContent=(total>=0?'+':'')+total;
  return total;
}

function aaRollDice() {
  const st = aaState; const drm = calcAADRM();
  const v1=Math.floor(Math.random()*6)+1, v2=Math.floor(Math.random()*6)+1;
  const adjusted=v1+v2+drm; const hasLoss=adjusted>=11;
  const n=st.missionUnits.length; let lossUnitDie=null, lossUnitIdx=null;
  if (hasLoss && n>1) { lossUnitDie=Math.floor(Math.random()*6)+1; lossUnitIdx=aaResolveUnit(lossUnitDie,n,st.missionUnits); }
  st.result = {v1,v2,drm,adjusted,hasLoss,lossUnitDie,lossUnitIdx};
  airUI();
}

function aaReroll() { aaState.result=null; airUI(); }

function aaResolveUnit(die, n, units) {
  if (n===2) return die<=3?0:1;
  if (n===3) { if(die<=2) return 0; if(die<=4) return 1; return 2; }
  if (n===4) {
    if (die<=4) return die-1;
    if (die===5) { let m=Infinity,i=0; units.forEach((u,j)=>{if(u.groundStr<m){m=u.groundStr;i=j;}}); return i; }
    let m=-Infinity,i=0; units.forEach((u,j)=>{if(u.groundStr>m){m=u.groundStr;i=j;}}); return i;
  }
  return 0;
}

function renderAADiceResult(res) {
  const {v1,v2,drm,adjusted,hasLoss}=res;
  return `
    <div class="die-wrap">${makeDieFaceHTML(v1,'ivory')}<div class="die-val">${v1}</div></div>
    <div class="die-wrap">${makeDieFaceHTML(v2,'ivory')}<div class="die-val">${v2}</div></div>
    <div class="dice-modified-total">
      <div style="font-size:1.4rem;font-weight:900;">${adjusted}</div>
      <div class="drm-line">${v1+v2} ${drm>=0?'+':''}${drm} = ${adjusted}</div>
      <div class="drm-line">기준: 11 이상 = 1 스텝 손실</div>
      <div class="df-result-row ${hasLoss?'atk-loss':'brt-none'}" style="margin-top:6px;">${hasLoss?'1 스텝 손실!':'손실 없음'}</div>
    </div>`;
}

function renderAALossUnitBox(res, units) {
  const {lossUnitDie,lossUnitIdx}=res; const n=units.length;
  if (lossUnitIdx===null||lossUnitIdx===undefined) return '';
  const lost=units[lossUnitIdx];
  const td=n===2?'1~3=유닛1, 4~6=유닛2':n===3?'1~2=유닛1, 3~4=유닛2, 5~6=유닛3':'1~4=해당번호, 5=최저화력, 6=최고화력';
  return `
    <div class="aa-loss-unit-box">
      <div class="aa-loss-unit-title">손실 유닛 결정 (1d6)</div>
      <div class="aa-loss-unit-row">
        <div class="die-wrap">${makeDieFaceHTML(lossUnitDie,'red')}<div class="die-val">${lossUnitDie}</div></div>
        <div class="aa-loss-unit-result">
          <div class="df-result-row atk-loss" style="margin:0;">${lost.name} 1 스텝 손실</div>
          <div style="font-size:0.65rem;color:var(--ink-faded);margin-top:3px;">${td}</div>
        </div>
      </div>
    </div>`;
}

function aaDone() {
  const cb = aaState?.onDone;
  aaReset();
  if (cb) cb(); else airUI();
}

// ─────────────────────────────────────────────────────────────
// ██  전투기 초계 (CAP)
// ─────────────────────────────────────────────────────────────

const CAP_STEPS = [
  { id:'move',     label:'임무 목표 헥스로 이동', en:'Move to Target Hex' },
  { id:'dogfight', label:'공중전',               en:'Air Combat'         },
  { id:'return',   label:'복귀 / 비활성화',       en:'Return & Deactivate'},
];

let capState = { step: 0 };

function capInit() { capState = { step:0 }; dfReset(); }

function renderCAP() {
  const si = renderStepIndicator(CAP_STEPS, capState.step);
  const hdr = `<div class="card">
    <div class="card-title"><span class="icon">🛡</span> 전투기 초계 (CAP)
      <button class="air-back-btn" onclick="backToAirSelect()">◀ 임무 선택</button>
    </div>${si}</div>`;

  // 공중전 모듈 활성 → 공중전 화면
  if (dfState) return hdr + renderDogfight();

  const step = CAP_STEPS[capState.step];
  if (step.id === 'move') {
    return hdr + `
      <div class="card air-manual-step">
        <div class="air-step-header">
          <span class="air-step-num">STEP 1</span>
          <span class="air-step-title">${step.label}</span>
          <span class="air-step-en">${step.en}</span>
        </div>
        <div class="air-manual-desc"><p>전투기 초계 유닛을 <strong>임무 목표 헥스</strong>로 이동시키세요.</p></div>
        <div class="btn-row">
          <button class="btn btn-primary" onclick="capGoToDogfight()">다음 ▶</button>
        </div>
      </div>`;
  }
  if (step.id === 'dogfight') {
    // 공중전 시작 후 즉시 재렌더
    dfStart({
      onDone: () => { capState.step=2; dfReset(); airUI(); },
      onBack: () => { capState.step=0; dfReset(); airUI(); },
    });
    return renderCAP();
  }
  if (step.id === 'return') {
    return hdr + `
      <div class="card air-manual-step">
        <div class="air-step-header">
          <span class="air-step-num">STEP 3</span>
          <span class="air-step-title">${step.label}</span>
          <span class="air-step-en">${step.en}</span>
        </div>
        <div class="air-manual-desc"><p>임무를 완료한 항공 유닛을 <strong>아무 항공 기지로 복귀</strong>시키고 <strong>비활성화</strong>하세요.</p></div>
        <div class="btn-row">
          <button class="btn btn-secondary" onclick="capGoStep(-1)">◀ 이전</button>
          <button class="btn btn-primary"   onclick="backToAirSelect()">임무 완료 ✓</button>
        </div>
      </div>`;
  }
  return hdr;
}

function capGoToDogfight() { capState.step=1; airUI(); }
function capGoStep(d) { capState.step=Math.max(0,Math.min(CAP_STEPS.length-1,capState.step+d)); airUI(); }

// ─────────────────────────────────────────────────────────────
// ██  폭격 + 힙샷 (Bombing + Hip Shoot)
// ─────────────────────────────────────────────────────────────

const BOMB_STEPS = [
  { id:'setup',        label:'유닛 이동 / 편성', en:'Move & Setup'        },
  { id:'dogfight',     label:'공중전',           en:'Air Combat'          },
  { id:'interception', label:'요격',             en:'Interception'        },
  { id:'aa',           label:'대공 사격',         en:'AA Fire'             },
  { id:'bombing',      label:'폭격 굴림',         en:'Bombing Roll'        },
  { id:'return',       label:'복귀 / 비활성화',   en:'Return & Deactivate' },
];

let bombState = {};

function bombInit() {
  bombState = {
    step:'setup',
    units:[{id:0,name:'유닛 1',airStr:1,groundStr:2,isFighter:false,aborted:false,stepLost:false}],
    hasFighter:false, inEnemyAirspace:false, aaResult:null, finalGroundStr:0,
  };
  dfReset(); icReset(); aaReset();
}

function renderBombing() {
  const si = renderStepIndicator(BOMB_STEPS, BOMB_STEPS.findIndex(s=>s.id===bombState.step));
  const hdr = `<div class="card">
    <div class="card-title"><span class="icon">💣</span> 폭격 + 힙샷
      <button class="air-back-btn" onclick="backToAirSelect()">◀ 임무 선택</button>
    </div>${si}</div>`;

  // 하위 모듈 활성 → 해당 모듈 화면
  if (dfState)  return hdr + renderDogfight();
  if (icState)  return hdr + renderInterception();
  if (aaState)  return hdr + renderAA();

  let body = '';
  switch (bombState.step) {
    case 'setup':        body = renderBombSetup();        break;
    case 'dogfight':     body = renderBombDogfightCheck(); break;
    case 'interception': body = renderBombAirspaceCheck(); break;
    case 'aa':           bombStartAA(); return renderBombing();
    case 'bombing':      body = renderBombRoll();         break;
    case 'return':       body = renderBombReturn();       break;
    case 'aborted':      body = renderMissionAborted('공중전/요격'); break;  // ← 추가
  }
  return hdr + body;
}

// STEP 1
function renderBombSetup() {
  const units = bombState.units;
  const rows = units.map((u,i) => `
    <div class="bom-unit-row">
      <div class="bom-unit-idx">${i+1}</div>
      <div class="bom-unit-fields">
        <div class="field-group">
          <label class="field-label">공대공 전력</label>
          <input class="field-input" type="number" id="bAirStr_${i}" value="${u.airStr}" min="0" step="0.5" style="width:70px;">
        </div>
        <div class="field-group">
          <label class="field-label">공대지 화력</label>
          <input class="field-input" type="number" id="bGndStr_${i}" value="${u.groundStr}" min="0" step="0.5" style="width:70px;">
        </div>
        <label class="bom-fighter-check">
          <input type="checkbox" id="bFighter_${i}" ${u.isFighter?'checked':''}>
          <span class="field-label" style="margin:0;">전투기</span>
        </label>
      </div>
      ${units.length>1?`<button class="bom-del-btn" onclick="bombRemoveUnit(${i})">✕</button>`:''}
    </div>`).join('');
  return `
    <div class="card">
      <div class="card-title"><span class="icon">✈</span> STEP 1 — 유닛 이동 / 편성</div>
      <div class="air-manual-desc" style="margin-bottom:12px;">
        <p>임무 참가 항공 유닛을 <strong>임무 목표 헥스</strong>로 이동시킨 뒤, 각 유닛의 전력을 입력하세요.</p>
      </div>
      <div class="bom-unit-list">${rows}</div>
      <div class="btn-row" style="margin-top:8px;">
        <button class="btn btn-secondary" onclick="bombAddUnit()">+ 유닛 추가</button>
      </div>
      <div class="divider"></div>
      <div class="btn-row">
        <button class="btn btn-primary" onclick="bombSetupDone()">다음 ▶</button>
      </div>
    </div>`;
}

function bombSaveSetup() {
  bombState.units.forEach((u,i) => {
    const as=document.getElementById(`bAirStr_${i}`), gs=document.getElementById(`bGndStr_${i}`), ft=document.getElementById(`bFighter_${i}`);
    if(as) u.airStr=parseFloat(as.value)||0; if(gs) u.groundStr=parseFloat(gs.value)||0; if(ft) u.isFighter=ft.checked;
  });
}
function bombAddUnit() { bombSaveSetup(); const i=bombState.units.length; bombState.units.push({id:i,name:`유닛 ${i+1}`,airStr:1,groundStr:2,isFighter:false,aborted:false,stepLost:false}); airUI(); }
function bombRemoveUnit(idx) { bombSaveSetup(); bombState.units.splice(idx,1); bombState.units.forEach((u,i)=>{u.id=i;u.name=`유닛 ${i+1}`;}); airUI(); }
function bombSetupDone() { bombSaveSetup(); bombState.hasFighter=bombState.units.some(u=>u.isFighter); bombState.step='dogfight'; airUI(); }

// STEP 2
function renderBombDogfightCheck() {
  return `
    <div class="card">
      <div class="card-title"><span class="icon">✈</span> STEP 2 — 적 활성 항공 유닛 확인</div>
      <div class="df-info-box"><p>임무 목표 헥스 인근에 <strong>적 활성 항공 유닛</strong>이 존재합니까?</p></div>
      <div class="btn-row" style="margin-top:16px;">
        <button class="btn btn-secondary" onclick="bombNoEnemyAir()">아니오 — 공중전 없음 ▶</button>
        <button class="btn btn-primary"   onclick="bombYesEnemyAir()">예 — 공중전 수행 ▶</button>
      </div>
    </div>`;
}

function bombNoEnemyAir() { bombState.step='interception'; airUI(); }

function bombYesEnemyAir() {
  dfStart({
    attackerUnits: bombState.units.map(u => ({ id:u.id, name:u.name, str:u.airStr })),
    onDone: (snap) => {
      if (snap?.attackerUnits) snap.attackerUnits.forEach(du => {
        const u = bombState.units.find(u => u.id === du.id);
        if (u && du.aborted) u.aborted = true;
      });
      // 임무 유닛 전원 중단 체크
      if (missionAliveCount(bombState.units) === 0) {
        bombState.step = 'aborted';
      } else {
        bombState.step = 'interception';
      }
      airUI();
    },
    onBack: () => { dfReset(); bombState.step = 'dogfight'; airUI(); },
  });
  airUI();
}

// STEP 3
function renderBombAirspaceCheck() {
  return `
    <div class="card">
      <div class="card-title"><span class="icon">🚨</span> STEP 3 — 적 경계 영공 / 요격</div>
      <div class="df-info-box"><p>임무 목표가 <strong>적 경계 영공(Enemy Alert Airspace)</strong> 내에 있습니까?</p></div>
      <div class="btn-row" style="margin-top:16px;">
        <button class="btn btn-secondary" onclick="bombNoAirspace()">아니오 — 요격 없음 ▶</button>
        <button class="btn btn-primary"   onclick="bombYesAirspace()">예 — 요격 절차 진행 ▶</button>
      </div>
    </div>`;
}

function bombNoAirspace() { bombState.inEnemyAirspace = false; bombState.step = 'aa'; airUI(); }

function bombYesAirspace() {
  bombState.inEnemyAirspace = true;
  icStart({
    missionUnits: bombState.units.filter(u => !u.aborted),
    onDone: () => {
      // 임무 유닛 전원 중단 체크
      if (missionAliveCount(bombState.units) === 0) {
        bombState.step = 'aborted';
      } else {
        bombState.step = 'aa';
      }
      airUI();
    },
    onBack: () => { icReset(); bombState.step = 'interception'; airUI(); },
  });
  airUI();
}

// STEP 4 (AA 시작 — renderBombing에서 step==='aa'일 때 직접 호출)
function bombStartAA() {
  // bombState.units 객체를 직접 참조 (filter는 같은 객체 참조를 유지함)
  // aaLossDestroyed / aaLossDamaged에서 해당 객체를 직접 수정하므로
  // bombState.units에 자동 반영됨
  const aliveUnits = bombState.units.filter(u => !u.aborted);
  aaStart({
    missionUnits: aliveUnits,
    inEnemyAirspace: bombState.inEnemyAirspace,
    onDone: () => {
      // aliveUnits는 bombState.units 내 같은 객체를 참조하므로
      // destroyed, groundStr 변경이 이미 bombState.units에 반영됨
      bombState.finalGroundStr = bombState.units
        .filter(u => !u.aborted && !u.destroyed)
        .reduce((s, u) => s + u.groundStr, 0);
      bombState.step = 'bombing';
      airUI();
    },
  });
}

// STEP 5
function renderBombRoll() {
  const allUnits = bombState.units;
  const destroyed = allUnits.filter(u => u.destroyed);
  const damaged   = allUnits.filter(u => u.stepLost && !u.destroyed);
  const alive     = allUnits.filter(u => !u.aborted && !u.destroyed);
  const str = alive.reduce((s, u) => s + u.groundStr, 0);
  // finalGroundStr은 bombStartAA onDone에서 이미 계산됨, 여기서 재계산해서 동기화
  bombState.finalGroundStr = str;

  const statusRows = [];
  if (destroyed.length)
    statusRows.push(`<div class="df-result-row atk-loss" style="margin:0 0 4px;">💀 파괴: ${destroyed.map(u=>u.name).join(', ')}</div>`);
  if (damaged.length)
    statusRows.push(`<div class="df-result-row no-effect" style="margin:0 0 4px;">⚠ 손실 후 계속: ${damaged.map(u=>`${u.name} (화력 ${u.groundStr})`).join(', ')}</div>`);

  return `
    <div class="card">
      <div class="card-title"><span class="icon">💥</span> STEP 5 — 폭격 굴림</div>
      <div class="df-info-box" style="margin-bottom:14px;">
        <p>최종 공대지 화력이 산출되었습니다. <strong>포격/폭격 페이지</strong>에서 폭격 굴림을 수행한 뒤 돌아오세요.</p>
      </div>
      ${statusRows.length ? `<div class="df-result-summary" style="margin-bottom:12px;">${statusRows.join('')}</div>` : ''}
      <div class="bom-str-display">
        <div class="bom-str-label">최종 공대지 화력 (Barrage Strength)</div>
        <div class="bom-str-value">${str}</div>
        <div class="bom-str-breakdown">
          ${alive.map(u=>`<span>${u.name}: ${u.groundStr}</span>`).join(' + ')}
          ${alive.length === 0 ? '<span style="color:var(--border);">임무 유닛 없음</span>' : ''}
        </div>
      </div>
      <div class="btn-row" style="margin-top:16px;">
        <button class="btn btn-secondary" onclick="bombGoBarrage()">포격/폭격 페이지로 이동 ↗</button>
        <button class="btn btn-primary"   onclick="bombGoReturn()">폭격 완료 — 복귀 ▶</button>
      </div>
    </div>`;
}

function bombGoBarrage() {
  const str=bombState.finalGroundStr;
  showPage('barrage',null);
  document.querySelectorAll('nav button').forEach(b=>b.classList.remove('active'));
  document.querySelector('nav button[onclick*="barrage"]')?.classList.add('active');
  setTimeout(()=>{ const el=document.getElementById('barrageStr'); if(el){el.value=str;el.dispatchEvent(new Event('input'));} },50);
}
function bombGoReturn() { bombState.step='return'; airUI(); }

// STEP 6
function renderBombReturn() {
  return `
    <div class="card air-manual-step">
      <div class="air-step-header">
        <span class="air-step-num">STEP 6</span>
        <span class="air-step-title">복귀 / 비활성화</span>
        <span class="air-step-en">Return &amp; Deactivate</span>
      </div>
      <div class="air-manual-desc"><p>임무에 참가한 모든 항공 유닛을 <strong>아무 항공 기지로 복귀</strong>시키고 <strong>비활성화</strong>하세요.</p></div>
      <div class="btn-row" style="margin-top:16px;">
        <button class="btn btn-primary" onclick="backToAirSelect()">임무 완료 ✓</button>
      </div>
    </div>`;
}

// ─────────────────────────────────────────────────────────────
// ██  항공 저지 (Interdiction)
// ─────────────────────────────────────────────────────────────

const INTERDICT_STEPS = [
  { id:'move',         label:'임무 목표 헥스로 이동', en:'Move to Target Hex'  },
  { id:'dogfight',     label:'공중전',               en:'Air Combat'          },
  { id:'interception', label:'요격',                 en:'Interception'        },
  { id:'aa',           label:'대공 사격',             en:'AA Fire'             },
  { id:'bombing',      label:'대시설 폭격',           en:'Facility Bombing'    },
  { id:'return',       label:'복귀 / 비활성화',       en:'Return & Deactivate' },
];

let interdictState = {};

function interdictInit() {
  interdictState = {
    step: 'move',
    units: [{ id:0, name:'유닛 1', airStr:1, groundStr:2, isFighter:false, aborted:false, stepLost:false }],
    inEnemyAirspace: false,
    aaResult: null,
    finalGroundStr: 0,
  };
  dfReset(); icReset(); aaReset();
}

function renderInterdict() {
  const si = renderStepIndicator(INTERDICT_STEPS, INTERDICT_STEPS.findIndex(s => s.id === interdictState.step));
  const hdr = `<div class="card">
    <div class="card-title"><span class="icon">🚫</span> 항공 저지 (Interdiction)
      <button class="air-back-btn" onclick="backToAirSelect()">◀ 임무 선택</button>
    </div>${si}</div>`;

  // 하위 모듈 활성
  if (dfState)  return hdr + renderDogfight();
  if (icState)  return hdr + renderInterception();
  if (aaState)  return hdr + renderAA();

  let body = '';
  switch (interdictState.step) {
    case 'move':         body = renderInterdictMove();          break;
    case 'dogfight':     body = renderInterdictDogfightCheck(); break;
    case 'interception': body = renderInterdictAirspaceCheck(); break;
    case 'aa':           interdictStartAA(); return renderInterdict();
    case 'bombing':      body = renderInterdictBombing();       break;
    case 'return':       body = renderInterdictReturn();        break;
    case 'aborted':      body = renderMissionAborted('공중전/요격'); break;  // ← 추가
  }
  return hdr + body;
}

// STEP 1 — 이동 + 유닛 편성
function renderInterdictMove() {
  const units = interdictState.units;
  const rows = units.map((u, i) => `
    <div class="bom-unit-row">
      <div class="bom-unit-idx">${i+1}</div>
      <div class="bom-unit-fields">
        <div class="field-group">
          <label class="field-label">공대공 전력</label>
          <input class="field-input" type="number" id="iAirStr_${i}" value="${u.airStr}" min="0" step="0.5" style="width:70px;">
        </div>
        <div class="field-group">
          <label class="field-label">공대지 화력</label>
          <input class="field-input" type="number" id="iGndStr_${i}" value="${u.groundStr}" min="0" step="0.5" style="width:70px;">
        </div>
        <label class="bom-fighter-check">
          <input type="checkbox" id="iFighter_${i}" ${u.isFighter ? 'checked' : ''}>
          <span class="field-label" style="margin:0;">전투기</span>
        </label>
      </div>
      ${units.length > 1 ? `<button class="bom-del-btn" onclick="interdictRemoveUnit(${i})">✕</button>` : ''}
    </div>`).join('');

  return `
    <div class="card">
      <div class="card-title"><span class="icon">✈</span> STEP 1 — 임무 목표 헥스로 이동</div>
      <div class="air-manual-desc" style="margin-bottom:12px;">
        <p>항공 저지 유닛을 <strong>임무 목표 헥스</strong>로 이동시킨 뒤, 각 유닛의 전력을 입력하세요.</p>
      </div>
      <div class="bom-unit-list">${rows}</div>
      <div class="btn-row" style="margin-top:8px;">
        <button class="btn btn-secondary" onclick="interdictAddUnit()">+ 유닛 추가</button>
      </div>
      <div class="divider"></div>
      <div class="btn-row">
        <button class="btn btn-primary" onclick="interdictSaveSetup()">다음 ▶</button>
      </div>
    </div>`;
}

function interdictAddUnit() {
  interdictSaveUnits();
  const i = interdictState.units.length;
  interdictState.units.push({ id:i, name:`유닛 ${i+1}`, airStr:1, groundStr:2, isFighter:false, aborted:false, stepLost:false });
  airUI();
}

function interdictRemoveUnit(i) {
  interdictSaveUnits();
  interdictState.units.splice(i, 1);
  interdictState.units.forEach((u, idx) => { u.id = idx; u.name = `유닛 ${idx+1}`; });
  airUI();
}

function interdictSaveUnits() {
  interdictState.units.forEach((u, i) => {
    const as = document.getElementById(`iAirStr_${i}`);
    const gs = document.getElementById(`iGndStr_${i}`);
    const fn = document.getElementById(`iFighter_${i}`);
    if (as) u.airStr    = parseFloat(as.value) || 0;
    if (gs) u.groundStr = parseFloat(gs.value) || 0;
    if (fn) u.isFighter = fn.checked;
  });
}

function interdictSaveSetup() {
  interdictSaveUnits();
  interdictState.step = 'dogfight';
  airUI();
}

// STEP 2 — 적 활성 항공 유닛 확인
function renderInterdictDogfightCheck() {
  return `
    <div class="card">
      <div class="card-title"><span class="icon">✈</span> STEP 2 — 적 활성 항공 유닛 확인</div>
      <div class="df-info-box"><p>임무 목표 헥스 인근에 <strong>적 활성 항공 유닛</strong>이 존재합니까?</p></div>
      <div class="btn-row" style="margin-top:16px;">
        <button class="btn btn-secondary" onclick="interdictNoDogfight()">아니오 — 공중전 없음 ▶</button>
        <button class="btn btn-primary"   onclick="interdictYesDogfight()">예 — 공중전 수행 ▶</button>
      </div>
    </div>`;
}

function interdictNoDogfight() {
  interdictState.step = 'interception';
  airUI();
}

function interdictYesDogfight() {
  dfStart({
    attackerUnits: interdictState.units.map(u => ({ id:u.id, name:u.name, str:u.airStr })),
    onDone: (snap) => {
      if (snap?.attackerUnits) snap.attackerUnits.forEach(du => {
        const u = interdictState.units.find(u => u.id === du.id);
        if (u && du.aborted) u.aborted = true;
      });
      // 임무 유닛 전원 중단 체크
      if (missionAliveCount(interdictState.units) === 0) {
        interdictState.step = 'aborted';
      } else {
        interdictState.step = 'interception';
      }
      airUI();
    },
    onBack: () => { dfReset(); interdictState.step = 'dogfight'; airUI(); },
  });
  airUI();
}

// STEP 3 — 적 경계 영공 / 요격
function renderInterdictAirspaceCheck() {
  return `
    <div class="card">
      <div class="card-title"><span class="icon">🚨</span> STEP 3 — 적 경계 영공 / 요격</div>
      <div class="df-info-box"><p>임무 목표가 <strong>적 경계 영공(Enemy Alert Airspace)</strong> 내에 있습니까?</p></div>
      <div class="btn-row" style="margin-top:16px;">
        <button class="btn btn-secondary" onclick="interdictNoAirspace()">아니오 — 요격 없음 ▶</button>
        <button class="btn btn-primary"   onclick="interdictYesAirspace()">예 — 요격 절차 진행 ▶</button>
      </div>
    </div>`;
}

function interdictNoAirspace() {
  interdictState.inEnemyAirspace = false;
  interdictState.step = 'aa';
  airUI();
}

function interdictYesAirspace() {
  interdictState.inEnemyAirspace = true;
  icStart({
    missionUnits: interdictState.units.filter(u => !u.aborted),
    onDone: () => {
      // 임무 유닛 전원 중단 체크
      if (missionAliveCount(interdictState.units) === 0) {
        interdictState.step = 'aborted';
      } else {
        interdictState.step = 'aa';
      }
      airUI();
    },
    onBack: () => { icReset(); interdictState.step = 'interception'; airUI(); },
  });
  airUI();
}

// STEP 4 — 대공 사격
function interdictStartAA() {
  const aliveUnits = interdictState.units.filter(u => !u.aborted);
  aaStart({
    missionUnits: aliveUnits,
    inEnemyAirspace: interdictState.inEnemyAirspace,
    onDone: () => {
      interdictState.finalGroundStr = interdictState.units
        .filter(u => !u.aborted && !u.destroyed)
        .reduce((s, u) => s + u.groundStr, 0);
      interdictState.step = 'bombing';
      airUI();
    },
  });
}

// STEP 5 — 대시설 폭격
function renderInterdictBombing() {
  const allUnits   = interdictState.units;
  const destroyed  = allUnits.filter(u => u.destroyed);
  const damaged    = allUnits.filter(u => u.stepLost && !u.destroyed);
  const alive      = allUnits.filter(u => !u.aborted && !u.destroyed);
  const str = alive.reduce((s, u) => s + u.groundStr, 0);
  interdictState.finalGroundStr = str;

  const statusRows = [];
  if (destroyed.length)
    statusRows.push(`<div class="df-result-row atk-loss" style="margin:0 0 4px;">💀 파괴: ${destroyed.map(u=>u.name).join(', ')}</div>`);
  if (damaged.length)
    statusRows.push(`<div class="df-result-row no-effect" style="margin:0 0 4px;">⚠ 손실 후 계속: ${damaged.map(u=>`${u.name} (화력 ${u.groundStr})`).join(', ')}</div>`);

  return `
    <div class="card">
      <div class="card-title"><span class="icon">🏭</span> STEP 5 — 대시설 폭격</div>
      <div class="df-info-box" style="margin-bottom:14px;">
        <p>최종 공대지 화력이 산출되었습니다. <strong>대시설 폭격 테이블</strong>에서 결과를 처리한 뒤 돌아오세요.</p>
      </div>
      ${statusRows.length ? `<div class="df-result-summary" style="margin-bottom:12px;">${statusRows.join('')}</div>` : ''}
      <div class="bom-str-display">
        <div class="bom-str-label">최종 공대지 화력 (Ground Str)</div>
        <div class="bom-str-value">${str}</div>
        <div class="bom-str-breakdown">
          ${alive.map(u=>`<span>${u.name}: ${u.groundStr}</span>`).join(' + ')}
          ${alive.length === 0 ? '<span style="color:var(--border);">임무 유닛 없음</span>' : ''}
        </div>
      </div>
      <div class="btn-row" style="margin-top:16px;">
        <button class="btn btn-primary" onclick="interdictBombingDone()">폭격 완료 — 복귀 ▶</button>
      </div>
    </div>`;
}

function interdictBombingDone() {
  interdictState.step = 'return';
  airUI();
}

// STEP 6 — 복귀 / 비활성화
function renderInterdictReturn() {
  return `
    <div class="card air-manual-step">
      <div class="air-step-header">
        <span class="air-step-num">STEP 6</span>
        <span class="air-step-title">복귀 / 비활성화</span>
        <span class="air-step-en">Return &amp; Deactivate</span>
      </div>
      <div class="air-manual-desc"><p>임무에 참가한 모든 항공 유닛을 <strong>아무 항공 기지로 복귀</strong>시키고 <strong>비활성화</strong>하세요.</p></div>
      <div class="btn-row" style="margin-top:16px;">
        <button class="btn btn-primary" onclick="backToAirSelect()">임무 완료 ✓</button>
      </div>
    </div>`;
}


// ─────────────────────────────────────────────────────────────
// ██  공통 유틸
// ─────────────────────────────────────────────────────────────

function renderStepIndicator(steps, curIdx) {
  return `<div class="cap-step-indicator">
    ${steps.map((s,i)=>`
      <div class="cap-step-dot${i<curIdx?' done':''}${i===curIdx?' current':''}">
        <div class="cap-step-num">${i+1}</div>
        <div class="cap-step-lbl">${s.label}</div>
      </div>
      ${i<steps.length-1?`<div class="cap-step-line${i<curIdx?' done':''}"></div>`:''}
    `).join('')}
  </div>`;
}

function makeDieFaceHTML(value, color) {
  const P={1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]};
  let c=''; for(let i=0;i<9;i++) c+=`<div>${P[value]?.includes(i)?'<div class="pip"></div>':''}</div>`;
  return `<div class="die-face ${color}">${c}</div>`;
}

// 임무 유닛 배열에서 생존(비중단, 비파괴) 유닛 수를 반환
function missionAliveCount(units) {
  return units.filter(u => !u.aborted && !u.destroyed).length;
}

// label: 어느 단계에서 중단됐는지 표시용 텍스트
function renderMissionAborted(label) {
  return `
    <div class="card">
      <div class="card-title"><span class="icon">🚫</span> 임무 중단</div>
      <div class="df-info-box">
        <p><strong>${label}</strong> 단계에서 임무 수행 유닛이 전원 임무 중단되었습니다.</p>
        <p style="margin-top:6px;font-size:0.8rem;color:var(--ink-faded);">
          모든 항공 유닛을 아무 항공 기지로 복귀시키고 비활성화하세요.
        </p>
      </div>
      <div class="btn-row" style="margin-top:16px;">
        <button class="btn btn-primary" onclick="backToAirSelect()">임무 종료 ✓</button>
      </div>
    </div>`;
}

// ─────────────────────────────────────────────────────────────
// ██  공수 강하 (Airborne Drop)
// ─────────────────────────────────────────────────────────────
// 절차:
//   STEP 1. 항공 유닛 편성 및 임무 목표 헥스로 이동
//   STEP 2. 적 경계 영공 진입 여부 확인
//     2-1. 예 → 요격 처리 (icStart)
//     2-2. 아니오 → STEP 3
//   STEP 3. 대공 사격 처리 (aaStart)
//   STEP 4. 화물 투하 (수송기 생존 확인 후)
//   STEP 5. 공수 강하 손실 테이블 처리 (화물별 개별 처리)
//   STEP 6. 복귀 / 비활성화

const AIRDROP_STEPS = [
  { id:'setup',        label:'유닛 편성 / 이동',  en:'Setup & Move'         },
  { id:'interception', label:'경계 영공 / 요격',  en:'Alert Airspace Check' },
  { id:'aa',           label:'대공 사격',          en:'AA Fire'              },
  { id:'drop',         label:'화물 투하',          en:'Cargo Drop'           },
  { id:'landtable',    label:'강하 손실 테이블',   en:'Airborne Loss Table'  },
  { id:'return',       label:'복귀 / 비활성화',    en:'Return & Deactivate'  },
];

let airdropState = {};

function airdropInit() {
  airdropState = {
    step: 'setup',
    // 항공 유닛 목록: { id, name, airStr, unitType('fighter'|'transport'|'other'), capacity, aborted, destroyed }
    units: [{ id:0, name:'유닛 1', airStr:1, unitType:'transport', capacity:1, aborted:false, destroyed:false }],
    // 화물 목록: { id, name, type('unit'|'supply'), weight, transporterId, destroyed }
    cargo: [{ id:0, name:'화물 1', type:'unit', weight:1, transporterId:0, destroyed:false }],
    inEnemyAirspace: false,
    // 강하 손실 테이블 관련
    landOptions: {
      friendlyHex: true,    // 아군 지역 여부
      terrain: 'clear',     // 'clear' | 'closed'
      drm: {
        alliedEuro44: false,
        sovietAirtransport: false,
        glider: false,
        veryClose: false,
        extrClose: false,
      },
    },
    enemyOnHex: false,      // 목표 헥스에 적 유닛 존재 여부
    // 화물별 강하 결과: { cargoId, dice1, dice2, adjusted, success, destroyed }
    landResults: [],
    landCargoIdx: 0,        // 현재 처리 중인 화물 인덱스
  };
  icReset(); aaReset();
}

function renderAirdrop() {
  const si = renderStepIndicator(AIRDROP_STEPS, AIRDROP_STEPS.findIndex(s => s.id === airdropState.step));
  const hdr = `<div class="card">
    <div class="card-title"><span class="icon">🪂</span> 공수 강하 (Airborne Drop)
      <button class="air-back-btn" onclick="backToAirSelect()">◀ 임무 선택</button>
    </div>${si}</div>`;

  // 하위 모듈 활성
  if (icState) return hdr + renderInterception();
  if (aaState) return hdr + renderAA();

  let body = '';
  switch (airdropState.step) {
    case 'setup':        body = renderAirdropSetup();        break;
    case 'interception': body = renderAirdropAirspaceCheck(); break;
    case 'aa':           airdropStartAA(); return renderAirdrop();
    case 'drop':         body = renderAirdropDrop();         break;
    case 'landtable':    body = renderAirdropLandTable();    break;
    case 'return':       body = renderAirdropReturn();       break;
    case 'aborted':      body = renderMissionAborted('요격/대공 사격'); break;
  }
  return hdr + body;
}

// ── STEP 1: 유닛 편성 / 이동 ─────────────────────────────────

function renderAirdropSetup() {
  const units = airdropState.units;
  const cargo = airdropState.cargo;

  // 수송기만 화물 적재 대상
  const transporters = units.filter(u => u.unitType === 'transport');

  const unitRows = units.map((u, i) => `
    <div class="bom-unit-row">
      <div class="bom-unit-idx">${i + 1}</div>
      <div class="bom-unit-fields" style="flex-wrap:wrap;gap:6px;">
        <div class="field-group">
          <label class="field-label">유닛 이름</label>
          <input class="field-input" type="text" id="adName_${i}" value="${u.name}" style="width:100px;">
        </div>
        <div class="field-group">
          <label class="field-label">공대공 전력</label>
          <input class="field-input" type="number" id="adAirStr_${i}" value="${u.airStr}" min="0" step="0.5" style="width:65px;">
        </div>
        <div class="field-group">
          <label class="field-label">유형</label>
          <select class="field-input" id="adType_${i}" onchange="airdropSaveSetup();airUI();" style="width:90px;">
            <option value="fighter"   ${u.unitType==='fighter'   ?'selected':''}>전투기</option>
            <option value="transport" ${u.unitType==='transport' ?'selected':''}>수송기</option>
            <option value="other"     ${u.unitType==='other'     ?'selected':''}>기타</option>
          </select>
        </div>
        ${u.unitType === 'transport' ? `
        <div class="field-group">
          <label class="field-label">적재 용량(T)</label>
          <input class="field-input" type="number" id="adCap_${i}" value="${u.capacity}" min="0" step="1" style="width:65px;">
        </div>` : ''}
      </div>
      ${units.length > 1 ? `<button class="bom-del-btn" onclick="airdropRemoveUnit(${i})">✕</button>` : ''}
    </div>`).join('');

  const cargoRows = cargo.map((c, i) => `
    <div class="bom-unit-row">
      <div class="bom-unit-idx">${i + 1}</div>
      <div class="bom-unit-fields" style="flex-wrap:wrap;gap:6px;">
        <div class="field-group">
          <label class="field-label">화물 명칭</label>
          <input class="field-input" type="text" id="adCgName_${i}" value="${c.name}" style="width:100px;">
        </div>
        <div class="field-group">
          <label class="field-label">유형</label>
          <select class="field-input" id="adCgType_${i}" style="width:85px;">
            <option value="unit"   ${c.type==='unit'   ?'selected':''}>전투 유닛</option>
            <option value="supply" ${c.type==='supply' ?'selected':''}>보급품 1T</option>
          </select>
        </div>
        <div class="field-group">
          <label class="field-label">중량</label>
          <input class="field-input" type="number" id="adCgWt_${i}" value="${c.weight}" min="1" step="1" style="width:60px;">
        </div>
        ${transporters.length > 0 ? `
        <div class="field-group">
          <label class="field-label">적재 수송기</label>
          <select class="field-input" id="adCgTr_${i}" style="width:90px;">
            ${transporters.map(t => `<option value="${t.id}" ${c.transporterId===t.id?'selected':''}>${t.name}</option>`).join('')}
          </select>
        </div>` : ''}
      </div>
      ${cargo.length > 1 ? `<button class="bom-del-btn" onclick="airdropRemoveCargo(${i})">✕</button>` : ''}
    </div>`).join('');

  return `
    <div class="card">
      <div class="card-title"><span class="icon">✈</span> STEP 1 — 유닛 편성 / 이동</div>
      <div class="air-manual-desc" style="margin-bottom:10px;">
        <p>임무 참가 항공 유닛과 적재 화물을 입력하고, 유닛을 <strong>임무 목표 헥스</strong>로 이동시키세요.</p>
      </div>

      <div class="field-label" style="margin-bottom:6px;">▸ 항공 유닛</div>
      <div class="bom-unit-list">${unitRows}</div>
      <div class="btn-row" style="margin-top:6px;">
        <button class="btn btn-secondary" onclick="airdropAddUnit()">+ 유닛 추가</button>
      </div>

      <div class="divider"></div>

      <div class="field-label" style="margin-bottom:6px;">▸ 화물</div>
      <div class="bom-unit-list">${cargoRows}</div>
      <div class="btn-row" style="margin-top:6px;">
        <button class="btn btn-secondary" onclick="airdropAddCargo()">+ 화물 추가</button>
      </div>

      <div class="divider"></div>
      <div class="btn-row">
        <button class="btn btn-primary" onclick="airdropSetupDone()">다음 ▶</button>
      </div>
    </div>`;
}

function airdropSaveSetup() {
  airdropState.units.forEach((u, i) => {
    const nm = document.getElementById(`adName_${i}`);
    const as = document.getElementById(`adAirStr_${i}`);
    const tp = document.getElementById(`adType_${i}`);
    const cp = document.getElementById(`adCap_${i}`);
    if (nm) u.name      = nm.value || u.name;
    if (as) u.airStr    = parseFloat(as.value) || 0;
    if (tp) u.unitType  = tp.value;
    if (cp) u.capacity  = parseInt(cp.value) || 0;
  });
  airdropState.cargo.forEach((c, i) => {
    const nm = document.getElementById(`adCgName_${i}`);
    const tp = document.getElementById(`adCgType_${i}`);
    const wt = document.getElementById(`adCgWt_${i}`);
    const tr = document.getElementById(`adCgTr_${i}`);
    if (nm) c.name         = nm.value || c.name;
    if (tp) c.type         = tp.value;
    if (wt) c.weight       = parseInt(wt.value) || 1;
    if (tr) c.transporterId = parseInt(tr.value);
  });
}

function airdropAddUnit() {
  airdropSaveSetup();
  const i = airdropState.units.length;
  airdropState.units.push({ id:i, name:`유닛 ${i+1}`, airStr:1, unitType:'transport', capacity:1, aborted:false, destroyed:false });
  airUI();
}

function airdropRemoveUnit(idx) {
  airdropSaveSetup();
  airdropState.units.splice(idx, 1);
  airdropState.units.forEach((u, i) => { u.id = i; });
  airUI();
}

function airdropAddCargo() {
  airdropSaveSetup();
  const i = airdropState.cargo.length;
  const firstTransport = airdropState.units.find(u => u.unitType === 'transport');
  airdropState.cargo.push({ id:i, name:`화물 ${i+1}`, type:'unit', weight:1, transporterId: firstTransport?.id ?? 0, destroyed:false });
  airUI();
}

function airdropRemoveCargo(idx) {
  airdropSaveSetup();
  airdropState.cargo.splice(idx, 1);
  airdropState.cargo.forEach((c, i) => { c.id = i; });
  airUI();
}

function airdropSetupDone() {
  airdropSaveSetup();
  airdropState.step = 'interception';
  airUI();
}

// ── STEP 2: 경계 영공 / 요격 ─────────────────────────────────

function renderAirdropAirspaceCheck() {
  return `
    <div class="card">
      <div class="card-title"><span class="icon">🚨</span> STEP 2 — 경계 영공 / 요격</div>
      <div class="df-info-box"><p>임무 목표가 <strong>적 경계 영공(Enemy Alert Airspace)</strong> 내에 있습니까?</p></div>
      <div class="btn-row" style="margin-top:16px;">
        <button class="btn btn-secondary" onclick="airdropNoAirspace()">아니오 — 대공 사격으로 ▶</button>
        <button class="btn btn-primary"   onclick="airdropYesAirspace()">예 — 요격 절차 진행 ▶</button>
      </div>
    </div>`;
}

function airdropNoAirspace() {
  airdropState.inEnemyAirspace = false;
  airdropState.step = 'aa';
  airUI();
}

function airdropYesAirspace() {
  airdropState.inEnemyAirspace = true;
  icStart({
    missionUnits: airdropState.units.filter(u => !u.aborted && !u.destroyed).map(u => ({
      id: u.id, name: u.name, str: u.airStr, aborted: false,
    })),
    onDone: (snap) => {
      snap?.missionUnits?.forEach(mu => {
        const u = airdropState.units.find(u => u.id === mu.id);
        if (u && mu.aborted) u.aborted = true;
      });
      airdropRevalidateCargo('요격');
    },
    onBack: () => { icReset(); airdropState.step = 'interception'; airUI(); },
  });
  airUI();
}

// ── STEP 3: 대공 사격 ──────────────────────────────────────────

function airdropStartAA() {
  const alive = airdropState.units.filter(u => !u.aborted && !u.destroyed);
  aaStart({
    missionUnits: alive.map(u => ({
      id: u.id, name: u.name,
      airStr: u.airStr, groundStr: u.airStr, str: u.airStr,
      unitType: u.unitType, capacity: u.capacity,
      aborted: false, destroyed: false,
    })),
    inEnemyAirspace: airdropState.inEnemyAirspace,
    onDone: () => {
      // AA 결과를 airdropState.units에 반영
      aaState?.missionUnits?.forEach(mu => {
        const u = airdropState.units.find(u => u.id === mu.id);
        if (!u) return;
        if (mu.destroyed) { u.destroyed = true; u.aborted = true; }
        else if (mu.aborted) u.aborted = true;
        // 수송기인 경우 용량 재설정 (groundStr 감소분 반영)
        if (u.unitType === 'transport' && !u.destroyed) {
          u.capacity = mu.groundStr ?? u.capacity;
        }
      });
      airdropRevalidateCargo('대공 사격');
    },
  });
}

// 수송기 손실 후 화물 용량 재검토 → 초과분 파괴
function airdropRevalidateCargo(phase) {
  const messages = [];

  // ── 파괴된 수송기에 실린 화물 파괴 ──────────────────────────
  const destroyedTransports = airdropState.units.filter(u => u.unitType === 'transport' && u.destroyed);
  destroyedTransports.forEach(t => {
    airdropState.cargo.filter(c => !c.destroyed && c.transporterId === t.id).forEach(c => {
      c.destroyed = true;
      messages.push(`${c.name} — ${t.name} 파괴로 함께 파괴`);
    });
  });

  // ── 임무 중단된(aborted) 수송기의 용량 초과 화물 파괴 ────────
  // aborted지만 destroyed가 아닌 수송기: 화물을 운반할 수 없으므로 용량 = 0 처리
  const abortedTransports = airdropState.units.filter(u => u.unitType === 'transport' && u.aborted && !u.destroyed);
  abortedTransports.forEach(t => {
    airdropState.cargo.filter(c => !c.destroyed && c.transporterId === t.id).forEach(c => {
      c.destroyed = true;
      messages.push(`${c.name} — ${t.name} 임무 중단으로 수송 불가, 파괴`);
    });
  });

  // ── 활성 수송기의 용량 초과 화물 파괴 ────────────────────────
  const activeTransports = airdropState.units.filter(u => u.unitType === 'transport' && !u.aborted && !u.destroyed);
  activeTransports.forEach(t => {
    const loaded = airdropState.cargo.filter(c => !c.destroyed && c.transporterId === t.id);
    let totalWeight = loaded.reduce((s, c) => s + c.weight, 0);
    if (totalWeight > t.capacity) {
      for (let i = loaded.length - 1; i >= 0 && totalWeight > t.capacity; i--) {
        loaded[i].destroyed = true;
        messages.push(`${loaded[i].name} — ${t.name} 용량 초과로 파괴`);
        totalWeight -= loaded[i].weight;
      }
    }
  });

  // ── 임무 중단 판정 ────────────────────────────────────────────
  // 조건 1: 활성 수송기(파괴·중단 아닌)가 하나도 없음
  const anyActiveTransport = airdropState.units.some(u => u.unitType === 'transport' && !u.aborted && !u.destroyed);
  // 조건 2: 운반 가능한 화물(파괴되지 않은)이 하나도 없음
  const anyCargoAlive = airdropState.cargo.some(c => !c.destroyed);
  // 조건 3: 임무 수행 측 모든 항공 유닛이 중단됨 (파괴 포함)
  const anyUnitActive = airdropState.units.some(u => !u.aborted && !u.destroyed);

  if (!anyActiveTransport || !anyCargoAlive || !anyUnitActive) {
    airdropState.step = 'aborted';
    airdropState._abortPhase = phase;
  } else {
    airdropState.step = airdropState.step === 'interception' ? 'aa' : 'drop';
  }

  airdropState._revalidateMessages = messages;
  icReset();
  aaReset();
  airUI();
}

// ── STEP 4: 화물 투하 ─────────────────────────────────────────

function renderAirdropDrop() {
  const msgs = airdropState._revalidateMessages || [];
  const survivingCargo = airdropState.cargo.filter(c => !c.destroyed);
  const destroyedCargo = airdropState.cargo.filter(c => c.destroyed);

  const cargoRows = survivingCargo.map(c => {
    const t = airdropState.units.find(u => u.id === c.transporterId);
    return `<div class="df-result-row brt-none" style="margin:0 0 4px;">📦 ${c.name} (${c.type==='unit'?'전투 유닛':'보급품'}, ${c.weight}T) — ${t?.name ?? '?'} 탑재</div>`;
  }).join('');

  const destroyedRows = destroyedCargo.map(c =>
    `<div class="df-result-row atk-loss" style="margin:0 0 4px;">💀 ${c.name} — 파괴됨</div>`
  ).join('');

  const msgRows = msgs.length
    ? `<div class="df-info-box" style="margin-bottom:10px;">${msgs.map(m=>`<p>⚠ ${m}</p>`).join('')}</div>` : '';

  return `
    <div class="card air-manual-step">
      <div class="air-step-header">
        <span class="air-step-num">STEP 4</span>
        <span class="air-step-title">화물 투하</span>
        <span class="air-step-en">Cargo Drop</span>
      </div>
      ${msgRows}
      <div class="df-result-summary" style="margin-bottom:12px;">
        ${cargoRows}
        ${destroyedRows}
      </div>
      <div class="df-info-box">
        <p>생존한 수송기가 화물을 투하합니다. 아래에서 강하 손실 테이블 조건을 설정하고 진행하세요.</p>
      </div>

      <div class="divider"></div>
      <div class="field-label" style="margin-bottom:8px;">▸ 강하 조건 설정</div>

      <div class="aa-drm-list">
        <div class="aa-drm-row">
          <label class="aa-drm-label">
            <input type="checkbox" id="adFriendlyHex" ${airdropState.landOptions.friendlyHex?'checked':''}>
            <span class="aa-drm-desc">아군 지역 (현 페이즈 시작 시 아군이 점령 중인 헥스)</span>
          </label>
        </div>
        <div class="aa-drm-row">
          <span class="aa-drm-desc">지형 유형</span>
          <select class="field-input" id="adTerrain" style="width:120px;margin-left:auto;">
            <option value="clear"  ${airdropState.landOptions.terrain==='clear' ?'selected':''}>Clear (평지/마을/항공기지)</option>
            <option value="closed" ${airdropState.landOptions.terrain==='closed'?'selected':''}>Closed (기타 지형)</option>
          </select>
        </div>
        <div class="aa-drm-row" style="margin-top:6px;">
          <span class="aa-drm-desc" style="font-weight:700;">DRM 수정치</span>
        </div>
        <div class="aa-drm-row">
          <label class="aa-drm-label">
            <input type="checkbox" id="adDrmAllied" ${airdropState.landOptions.drm.alliedEuro44?'checked':''}>
            <span class="aa-drm-desc">44년 6월 이전 유럽 전구 연합군 공수</span>
          </label>
          <span class="aa-drm-shift bcl-L">−1</span>
        </div>
        <div class="aa-drm-row">
          <label class="aa-drm-label">
            <input type="checkbox" id="adDrmSoviet" ${airdropState.landOptions.drm.sovietAirtransport?'checked':''}>
            <span class="aa-drm-desc">소련 항공 수송 (상시)</span>
          </label>
          <span class="aa-drm-shift bcl-L">−1</span>
        </div>
        <div class="aa-drm-row">
          <label class="aa-drm-label">
            <input type="checkbox" id="adDrmGlider" ${airdropState.landOptions.drm.glider?'checked':''}>
            <span class="aa-drm-desc">글라이더 착륙</span>
          </label>
          <span class="aa-drm-shift bcl-R">+1</span>
        </div>
        <div class="aa-drm-row">
          <label class="aa-drm-label">
            <input type="checkbox" id="adDrmVeryClose" ${airdropState.landOptions.drm.veryClose?'checked':''}>
            <span class="aa-drm-desc">Very Close <span class="bcl-opt-tag">옵션</span></span>
          </label>
          <span class="aa-drm-shift bcl-L">−1</span>
        </div>
        <div class="aa-drm-row">
          <label class="aa-drm-label">
            <input type="checkbox" id="adDrmExtrClose" ${airdropState.landOptions.drm.extrClose?'checked':''}>
            <span class="aa-drm-desc">Extr Close <span class="bcl-opt-tag">옵션</span></span>
          </label>
          <span class="aa-drm-shift bcl-L">−2</span>
        </div>
        <div class="aa-drm-row">
          <label class="aa-drm-label">
            <input type="checkbox" id="adEnemyOnHex" ${airdropState.enemyOnHex?'checked':''}>
            <span class="aa-drm-desc">목표 헥스에 <strong>적 유닛 존재</strong> (강하 성공 시에도 파괴)</span>
          </label>
        </div>
      </div>

      <div class="divider"></div>
      <div class="btn-row">
        <button class="btn btn-primary" onclick="airdropDropDone()">강하 손실 테이블 처리 ▶</button>
      </div>
    </div>`;
}

function airdropDropDone() {
  // 옵션 저장
  const lo = airdropState.landOptions;
  lo.friendlyHex = document.getElementById('adFriendlyHex')?.checked ?? true;
  lo.terrain     = document.getElementById('adTerrain')?.value || 'clear';
  lo.drm.alliedEuro44        = document.getElementById('adDrmAllied')?.checked    ?? false;
  lo.drm.sovietAirtransport  = document.getElementById('adDrmSoviet')?.checked    ?? false;
  lo.drm.glider              = document.getElementById('adDrmGlider')?.checked    ?? false;
  lo.drm.veryClose           = document.getElementById('adDrmVeryClose')?.checked ?? false;
  lo.drm.extrClose           = document.getElementById('adDrmExtrClose')?.checked ?? false;
  airdropState.enemyOnHex    = document.getElementById('adEnemyOnHex')?.checked   ?? false;

  // DRM 계산
  const d = lo.drm;
  let drm = 0;
  if (d.alliedEuro44)       drm -= 1;
  if (d.sovietAirtransport) drm -= 1;
  if (d.glider)             drm += 1;
  if (d.veryClose)          drm -= 1;
  if (d.extrClose)          drm -= 2;
  airdropState.landDRM = drm;

  // 성공 최솟값 계산
  // friendly+clear: 5, friendly+closed: 6, enemy+clear: 6, enemy+closed: 7
  const base = lo.friendlyHex
    ? (lo.terrain === 'clear' ? 5 : 6)
    : (lo.terrain === 'clear' ? 6 : 7);
  airdropState.landSuccessMin = base;

  airdropState.landResults  = [];
  airdropState.landCargoIdx = 0;
  airdropState.step = 'landtable';
  airUI();
}

// ── STEP 5: 공수 강하 손실 테이블 ────────────────────────────

function renderAirdropLandTable() {
  const activeCargo = airdropState.cargo.filter(c => !c.destroyed);
  const idx = airdropState.landCargoIdx;

  if (idx >= activeCargo.length) {
    return renderAirdropLandSummary();
  }

  const c = activeCargo[idx];
  const lo = airdropState.landOptions;
  const drm = airdropState.landDRM;
  const successMin = airdropState.landSuccessMin;
  const existing = airdropState.landResults.find(r => r.cargoId === c.id);

  const condDesc = `${lo.friendlyHex ? '아군 지역' : '적지'} · ${lo.terrain === 'clear' ? 'Clear' : 'Closed'} · DRM ${drm >= 0 ? '+' : ''}${drm} · 성공 최솟값 ${successMin}`;

  let diceHtml = '<span class="dice-placeholder">버튼을 눌러 굴리세요</span>';
  let btnHtml = `<button class="btn btn-primary" onclick="airdropLandRoll(${c.id})">🎲 강하 굴림 (2d6)</button>`;

  if (existing) {
    const total = existing.dice1 + existing.dice2;
    const adj   = total + drm;
    const successBase = adj >= successMin;
    const success     = successBase && !airdropState.enemyOnHex;

    diceHtml = `
      <div class="die-wrap">${makeDieFaceHTML(existing.dice1, 'ivory')}<div class="die-val">${existing.dice1}</div></div>
      <div class="die-wrap">${makeDieFaceHTML(existing.dice2, 'ivory')}<div class="die-val">${existing.dice2}</div></div>
        <div class="dice-modified-total">
          ${existing.dice1} + ${existing.dice2}${drm !== 0 ? ` ${drm >= 0 ? '+' : ''}${drm}` : ''} = <strong>${adj}</strong>
          <div class="drm-line">기준: ${successMin} 이상 = 성공</div>
        </div>
      <div style="width:100%;display:flex;flex-direction:column;gap:4px;margin-top:4px;">
        <div class="df-result-row ${successBase ? 'brt-none' : 'atk-loss'}" style="margin:0;">
          ${successBase ? '✅ 강하 성공 (기준 충족)' : '❌ 강하 실패'}
        </div>
        ${successBase && airdropState.enemyOnHex
          ? `<div class="df-result-row atk-loss" style="margin:0;">⚔ 목표 헥스에 적 유닛 존재 → 파괴</div>` : ''}
        <div class="df-result-row ${success ? 'brt-none' : 'atk-loss'}" style="margin:0;font-weight:700;">
          ${success ? `✅ ${c.name} — 목표 헥스에 배치` : `💀 ${c.name} — 파괴`}
        </div>
      </div>`;

    btnHtml = `
      <button class="btn btn-secondary" onclick="airdropLandReroll(${c.id})">🎲 다시 굴리기</button>
      <button class="btn btn-primary"   onclick="airdropLandNext()">
        ${idx + 1 < activeCargo.length ? '다음 화물 ▶' : '결과 요약 ▶'}
      </button>`;
  }

  return `
    <div class="card">
      <div class="card-title"><span class="icon">🪂</span> STEP 5 — 강하 손실 테이블 (${idx + 1} / ${activeCargo.length})</div>
      <div class="df-info-box" style="margin-bottom:10px;">
        <p>현재 화물: <strong>${c.name}</strong> (${c.type === 'unit' ? '전투 유닛' : '보급품 1T'})</p>
        <p style="margin-top:4px;font-size:0.78rem;color:var(--ink-faded);">${condDesc}</p>
      </div>
      <div class="dice-result-area" style="min-height:60px;">
        ${diceHtml}
      </div>
      <div class="btn-row" style="margin-top:12px;">
        ${btnHtml}
      </div>
    </div>`;
}

function airdropLandRoll(cargoId) {
  const d1 = Math.ceil(Math.random() * 6);
  const d2 = Math.ceil(Math.random() * 6);
  // 기존 결과 제거 후 추가
  airdropState.landResults = airdropState.landResults.filter(r => r.cargoId !== cargoId);
  airdropState.landResults.push({ cargoId, dice1: d1, dice2: d2 });
  airUI();
}

function airdropLandReroll(cargoId) {
  airdropState.landResults = airdropState.landResults.filter(r => r.cargoId !== cargoId);
  airUI();
}

function airdropLandNext() {
  const activeCargo = airdropState.cargo.filter(c => !c.destroyed);
  const idx = airdropState.landCargoIdx;
  const c = activeCargo[idx];
  const res = airdropState.landResults.find(r => r.cargoId === c.id);

  if (res) {
    const adj = res.dice1 + res.dice2 + airdropState.landDRM;
    const successBase = adj >= airdropState.landSuccessMin;
    const success = successBase && !airdropState.enemyOnHex;
    if (!success) c.destroyed = true;
  }

  airdropState.landCargoIdx++;
  airUI();
}

// 모든 화물 처리 후 결과 요약
function renderAirdropLandSummary() {
  const allCargo = airdropState.cargo;
  const placed   = allCargo.filter(c => !c.destroyed);
  const destroyed = allCargo.filter(c => c.destroyed);

  const placedRows   = placed.map(c =>
    `<div class="df-result-row brt-none" style="margin:0 0 4px;">✅ ${c.name} — 목표 헥스에 배치</div>`
  ).join('');
  const destroyedRows = destroyed.map(c =>
    `<div class="df-result-row atk-loss" style="margin:0 0 4px;">💀 ${c.name} — 파괴</div>`
  ).join('');

  return `
    <div class="card">
      <div class="card-title"><span class="icon">📋</span> 강하 결과 요약</div>
      <div class="df-result-summary" style="margin-bottom:12px;">
        ${placedRows}
        ${destroyedRows}
        ${!placedRows && !destroyedRows ? '<div class="df-result-row" style="margin:0;">화물 없음</div>' : ''}
      </div>
      <div class="btn-row" style="margin-top:8px;">
        <button class="btn btn-primary" onclick="airdropGoReturn()">복귀 / 비활성화 ▶</button>
      </div>
    </div>`;
}

function airdropGoReturn() {
  airdropState.step = 'return';
  airUI();
}

// ── STEP 6: 복귀 / 비활성화 ─────────────────────────────────

function renderAirdropReturn() {
  const units = airdropState.units;
  const alive = units.filter(u => !u.destroyed);
  const dead  = units.filter(u => u.destroyed);

  const statusRows = [
    ...alive.map(u => `<div class="df-result-row brt-none" style="margin:0 0 4px;">${u.name} — 복귀 대기</div>`),
    ...dead .map(u => `<div class="df-result-row atk-loss" style="margin:0 0 4px;">💀 ${u.name} — 파괴됨</div>`),
  ];

  return `
    <div class="card air-manual-step">
      <div class="air-step-header">
        <span class="air-step-num">STEP 6</span>
        <span class="air-step-title">복귀 / 비활성화</span>
        <span class="air-step-en">Return &amp; Deactivate</span>
      </div>
      <div class="df-result-summary" style="margin-bottom:12px;">
        ${statusRows.join('')}
      </div>
      <div class="air-manual-desc">
        <p>임무에 참가한 모든 항공 유닛을 <strong>아무 항공 기지로 복귀</strong>시키고 <strong>비활성화</strong>하세요.</p>
      </div>
      <div class="btn-row" style="margin-top:16px;">
        <button class="btn btn-primary" onclick="backToAirSelect()">임무 완료 ✓</button>
      </div>
    </div>`;
}

// ─────────────────────────────────────────────────────────────
// ██  항공 수송 (Air Transport / Airlift)
// ─────────────────────────────────────────────────────────────
// 절차:
//   STEP 1. 항공 유닛 편성 및 임무 목표 항공 기지 헥스로 이동
//   STEP 2. 적 경계 영공 진입 여부 확인
//     2-1. 예 → 요격 처리 (icStart)
//     2-2. 아니오 → STEP 3
//   STEP 3. 대공 사격 처리 (aaStart)
//   STEP 4. 화물 하차 (사용자가 물리적으로 화물을 목표 기지에 하차)
//   STEP 5. 항속 거리 이내 수송 여부 확인
//     5-1. 예 → 항속 거리 이내 아무 항공 기지로 복귀, 비활성화
//     5-2. 아니오 → 목표 항공 기지에서 비활성화
// ─────────────────────────────────────────────────────────────

const AIRLIFT_STEPS = [
  { id:'setup',        label:'유닛 편성 / 이동',  en:'Setup & Move'         },
  { id:'interception', label:'경계 영공 / 요격',  en:'Alert Airspace Check' },
  { id:'aa',           label:'대공 사격',          en:'AA Fire'              },
  { id:'unload',       label:'화물 하차',          en:'Cargo Unload'         },
  { id:'return',       label:'복귀 / 비활성화',    en:'Return & Deactivate'  },
];

let airliftState = {};

function airliftInit() {
  airliftState = {
    step: 'setup',
    units: [{ id:0, name:'유닛 1', airStr:1, unitType:'transport', capacity:1, aborted:false, destroyed:false }],
    cargo: [{ id:0, name:'화물 1', type:'unit', weight:1, transporterId:0, destroyed:false }],
    inEnemyAirspace: false,
    withinRange: null,
  };
  icReset(); aaReset();
}

function renderAirlift() {
  const si = renderStepIndicator(AIRLIFT_STEPS, AIRLIFT_STEPS.findIndex(s => s.id === airliftState.step));
  const hdr = `<div class="card">
    <div class="card-title"><span class="icon">📦</span> 항공 수송 (Air Transport)
      <button class="air-back-btn" onclick="backToAirSelect()">◀ 임무 선택</button>
    </div>${si}</div>`;

  if (icState) return hdr + renderInterception();
  if (aaState) return hdr + renderAA();

  let body = '';
  switch (airliftState.step) {
    case 'setup':        body = renderAirliftSetup();        break;
    case 'interception': body = renderAirliftAirspaceCheck(); break;
    case 'aa':           airliftStartAA(); return renderAirlift();
    case 'unload':       body = renderAirliftUnload();       break;
    case 'return':       body = renderAirliftReturn();       break;
    case 'aborted':      body = renderMissionAborted('요격/대공 사격'); break;
  }
  return hdr + body;
}

// ── STEP 1: 유닛 편성 / 이동 ─────────────────────────────────

function renderAirliftSetup() {
  const units = airliftState.units;
  const cargo = airliftState.cargo;
  const transporters = units.filter(u => u.unitType === 'transport');

  const unitRows = units.map((u, i) => `
    <div class="bom-unit-row">
      <div class="bom-unit-idx">${i + 1}</div>
      <div class="bom-unit-fields" style="flex-wrap:wrap;gap:6px;">
        <div class="field-group">
          <label class="field-label">유닛 이름</label>
          <input class="field-input" type="text" id="alName_${i}" value="${u.name}" style="width:100px;">
        </div>
        <div class="field-group">
          <label class="field-label">공대공 전력</label>
          <input class="field-input" type="number" id="alAirStr_${i}" value="${u.airStr}" min="0" step="0.5" style="width:65px;">
        </div>
        <div class="field-group">
          <label class="field-label">유형</label>
          <select class="field-input" id="alType_${i}" onchange="airliftSaveSetup();airUI();" style="width:90px;">
            <option value="fighter"   ${u.unitType==='fighter'   ?'selected':''}>전투기</option>
            <option value="transport" ${u.unitType==='transport' ?'selected':''}>수송기</option>
            <option value="other"     ${u.unitType==='other'     ?'selected':''}>기타</option>
          </select>
        </div>
        ${u.unitType === 'transport' ? `
        <div class="field-group">
          <label class="field-label">적재 용량(T)</label>
          <input class="field-input" type="number" id="alCap_${i}" value="${u.capacity}" min="0" style="width:55px;">
        </div>` : ''}
      </div>
      ${units.length > 1 ? `<button class="bom-del-btn" onclick="airliftRemoveUnit(${i})">✕</button>` : ''}
    </div>`).join('');

  const cargoRows = cargo.map((c, i) => `
    <div class="bom-unit-row">
      <div class="bom-unit-idx">${i + 1}</div>
      <div class="bom-unit-fields" style="flex-wrap:wrap;gap:6px;">
        <div class="field-group">
          <label class="field-label">화물 이름</label>
          <input class="field-input" type="text" id="alCgName_${i}" value="${c.name}" style="width:100px;">
        </div>
        <div class="field-group">
          <label class="field-label">유형</label>
          <select class="field-input" id="alCgType_${i}" style="width:85px;">
            <option value="unit"   ${c.type==='unit'   ?'selected':''}>전투 유닛</option>
            <option value="supply" ${c.type==='supply' ?'selected':''}>보급품</option>
          </select>
        </div>
        <div class="field-group">
          <label class="field-label">중량(T)</label>
          <input class="field-input" type="number" id="alCgWt_${i}" value="${c.weight}" min="1" style="width:55px;">
        </div>
        ${transporters.length ? `
        <div class="field-group">
          <label class="field-label">적재 수송기</label>
          <select class="field-input" id="alCgTr_${i}" style="width:90px;">
            ${transporters.map(t => `<option value="${t.id}" ${c.transporterId===t.id?'selected':''}>${t.name}</option>`).join('')}
          </select>
        </div>` : ''}
      </div>
      ${cargo.length > 1 ? `<button class="bom-del-btn" onclick="airliftRemoveCargo(${i})">✕</button>` : ''}
    </div>`).join('');

  return `
    <div class="card">
      <div class="card-title"><span class="icon">📦</span> STEP 1 — 유닛 편성 / 이동</div>
      <div class="air-manual-desc" style="margin-bottom:10px;">
        <p>임무 참가 항공 유닛과 적재 화물을 입력하고, 유닛을 <strong>목표 항공 기지 헥스</strong>로 이동시키세요.</p>
      </div>
      <div class="field-label" style="margin-bottom:6px;">▸ 항공 유닛</div>
      <div class="bom-unit-list">${unitRows}</div>
      <div class="btn-row" style="margin-top:6px;">
        <button class="btn btn-secondary" onclick="airliftAddUnit()">+ 유닛 추가</button>
      </div>
      <div class="divider"></div>
      <div class="field-label" style="margin-bottom:6px;">▸ 화물</div>
      <div class="bom-unit-list">${cargoRows}</div>
      <div class="btn-row" style="margin-top:6px;">
        <button class="btn btn-secondary" onclick="airliftAddCargo()">+ 화물 추가</button>
      </div>
      <div class="divider"></div>
      <div class="btn-row">
        <button class="btn btn-primary" onclick="airliftSetupDone()">다음 ▶</button>
      </div>
    </div>`;
}

function airliftSaveSetup() {
  airliftState.units.forEach((u, i) => {
    const nm = document.getElementById(`alName_${i}`);
    const as = document.getElementById(`alAirStr_${i}`);
    const tp = document.getElementById(`alType_${i}`);
    const cp = document.getElementById(`alCap_${i}`);
    if (nm) u.name     = nm.value || u.name;
    if (as) u.airStr   = parseFloat(as.value) || 0;
    if (tp) u.unitType = tp.value;
    if (cp) u.capacity = parseInt(cp.value) || 0;
  });
  airliftState.cargo.forEach((c, i) => {
    const nm = document.getElementById(`alCgName_${i}`);
    const tp = document.getElementById(`alCgType_${i}`);
    const wt = document.getElementById(`alCgWt_${i}`);
    const tr = document.getElementById(`alCgTr_${i}`);
    if (nm) c.name          = nm.value || c.name;
    if (tp) c.type          = tp.value;
    if (wt) c.weight        = parseInt(wt.value) || 1;
    if (tr) c.transporterId = parseInt(tr.value);
  });
}

function airliftAddUnit() {
  airliftSaveSetup();
  const i = airliftState.units.length;
  airliftState.units.push({ id:i, name:`유닛 ${i+1}`, airStr:1, unitType:'transport', capacity:1, aborted:false, destroyed:false });
  airUI();
}

function airliftRemoveUnit(idx) {
  airliftSaveSetup();
  airliftState.units.splice(idx, 1);
  airliftState.units.forEach((u, i) => { u.id = i; });
  airUI();
}

function airliftAddCargo() {
  airliftSaveSetup();
  const i = airliftState.cargo.length;
  const firstTransport = airliftState.units.find(u => u.unitType === 'transport');
  airliftState.cargo.push({ id:i, name:`화물 ${i+1}`, type:'unit', weight:1, transporterId: firstTransport?.id ?? 0, destroyed:false });
  airUI();
}

function airliftRemoveCargo(idx) {
  airliftSaveSetup();
  airliftState.cargo.splice(idx, 1);
  airliftState.cargo.forEach((c, i) => { c.id = i; });
  airUI();
}

function airliftSetupDone() {
  airliftSaveSetup();
  airliftState.step = 'interception';
  airUI();
}

// ── STEP 2: 경계 영공 / 요격 ─────────────────────────────────

function renderAirliftAirspaceCheck() {
  return `
    <div class="card">
      <div class="card-title"><span class="icon">🚨</span> STEP 2 — 경계 영공 / 요격</div>
      <div class="df-info-box"><p>임무 목표가 <strong>적 경계 영공(Enemy Alert Airspace)</strong> 내에 있습니까?</p></div>
      <div class="btn-row" style="margin-top:16px;">
        <button class="btn btn-secondary" onclick="airliftNoAirspace()">아니오 — 대공 사격으로 ▶</button>
        <button class="btn btn-primary"   onclick="airliftYesAirspace()">예 — 요격 절차 진행 ▶</button>
      </div>
    </div>`;
}

function airliftNoAirspace() {
  airliftState.inEnemyAirspace = false;
  airliftState.step = 'aa';
  airUI();
}

function airliftYesAirspace() {
  airliftState.inEnemyAirspace = true;
  icStart({
    missionUnits: airliftState.units.filter(u => !u.aborted && !u.destroyed).map(u => ({
      id: u.id, name: u.name, str: u.airStr, aborted: false,
    })),
    onDone: (snap) => {
      snap?.missionUnits?.forEach(mu => {
        const u = airliftState.units.find(u => u.id === mu.id);
        if (u && mu.aborted) u.aborted = true;
      });
      airliftRevalidateCargo('요격');
    },
    onBack: () => { icReset(); airliftState.step = 'interception'; airUI(); },
  });
  airUI();
}

// ── STEP 3: 대공 사격 ──────────────────────────────────────────

function airliftStartAA() {
  const alive = airliftState.units.filter(u => !u.aborted && !u.destroyed);
  aaStart({
    missionUnits: alive.map(u => ({
      id: u.id, name: u.name,
      airStr: u.airStr, groundStr: u.airStr, str: u.airStr,
      unitType: u.unitType, capacity: u.capacity,
      aborted: false, destroyed: false,
    })),
    inEnemyAirspace: airliftState.inEnemyAirspace,
    onDone: () => {
      aaState?.missionUnits?.forEach(mu => {
        const u = airliftState.units.find(u => u.id === mu.id);
        if (!u) return;
        if (mu.destroyed) { u.destroyed = true; u.aborted = true; }
        else if (mu.aborted) u.aborted = true;
        if (u.unitType === 'transport' && !u.destroyed) {
          u.capacity = mu.groundStr ?? u.capacity;
        }
      });
      airliftRevalidateCargo('대공 사격');
    },
  });
}

function airliftRevalidateCargo(phase) {
  const messages = [];

  // ── 파괴된 수송기에 실린 화물 파괴 ──────────────────────────
  const destroyedTransports = airliftState.units.filter(u => u.unitType === 'transport' && u.destroyed);
  destroyedTransports.forEach(t => {
    airliftState.cargo.filter(c => !c.destroyed && c.transporterId === t.id).forEach(c => {
      c.destroyed = true;
      messages.push(`${c.name} — ${t.name} 파괴로 함께 파괴`);
    });
  });

  // ── 임무 중단된(aborted) 수송기의 화물 파괴 ─────────────────
  const abortedTransports = airliftState.units.filter(u => u.unitType === 'transport' && u.aborted && !u.destroyed);
  abortedTransports.forEach(t => {
    airliftState.cargo.filter(c => !c.destroyed && c.transporterId === t.id).forEach(c => {
      c.destroyed = true;
      messages.push(`${c.name} — ${t.name} 임무 중단으로 수송 불가, 파괴`);
    });
  });

  // ── 활성 수송기의 용량 초과 화물 파괴 ────────────────────────
  const activeTransports = airliftState.units.filter(u => u.unitType === 'transport' && !u.aborted && !u.destroyed);
  activeTransports.forEach(t => {
    const loaded = airliftState.cargo.filter(c => !c.destroyed && c.transporterId === t.id);
    let totalWeight = loaded.reduce((s, c) => s + c.weight, 0);
    if (totalWeight > t.capacity) {
      for (let i = loaded.length - 1; i >= 0 && totalWeight > t.capacity; i--) {
        loaded[i].destroyed = true;
        messages.push(`${loaded[i].name} — ${t.name} 용량 초과로 파괴`);
        totalWeight -= loaded[i].weight;
      }
    }
  });

  // ── 임무 중단 판정 ────────────────────────────────────────────
  // 조건 1: 활성 수송기(파괴·중단 아닌)가 하나도 없음
  const anyActiveTransport = airliftState.units.some(u => u.unitType === 'transport' && !u.aborted && !u.destroyed);
  // 조건 2: 운반 가능한 화물(파괴되지 않은)이 하나도 없음
  const anyCargoAlive = airliftState.cargo.some(c => !c.destroyed);
  // 조건 3: 임무 수행 측 모든 항공 유닛이 중단됨 (파괴 포함)
  const anyUnitActive = airliftState.units.some(u => !u.aborted && !u.destroyed);

  if (!anyActiveTransport || !anyCargoAlive || !anyUnitActive) {
    airliftState.step = 'aborted';
    airliftState._abortPhase = phase;
  } else {
    airliftState.step = airliftState.step === 'interception' ? 'aa' : 'unload';
  }

  airliftState._revalidateMessages = messages;
  icReset();
  aaReset();
  airUI();
}

// ── STEP 4: 화물 하차 ─────────────────────────────────────────

function renderAirliftUnload() {
  const msgs = airliftState._revalidateMessages || [];
  const survivingCargo = airliftState.cargo.filter(c => !c.destroyed);
  const destroyedCargo = airliftState.cargo.filter(c => c.destroyed);

  const msgRows = msgs.length
    ? `<div class="df-result-summary" style="margin-bottom:10px;">${msgs.map(m => `<div class="df-result-row atk-loss" style="margin:0 0 4px;">⚠ ${m}</div>`).join('')}</div>`
    : '';

  const survivingRows = survivingCargo.map(c => {
    const t = airliftState.units.find(u => u.id === c.transporterId);
    return `<div class="df-result-row brt-none" style="margin:0 0 4px;">📦 ${c.name} (${c.type==='unit'?'전투 유닛':'보급품'}, ${c.weight}T) — ${t?.name ?? '?'} 탑재</div>`;
  }).join('');

  const destroyedRows = destroyedCargo.map(c =>
    `<div class="df-result-row atk-loss" style="margin:0 0 4px;">💀 ${c.name} — 파괴됨</div>`
  ).join('');

  return `
    <div class="card air-manual-step">
      <div class="air-step-header">
        <span class="air-step-num">STEP 4</span>
        <span class="air-step-title">화물 하차</span>
        <span class="air-step-en">Cargo Unload</span>
      </div>
      ${msgRows}
      ${survivingRows || destroyedRows ? `<div class="df-result-summary" style="margin-bottom:10px;">${survivingRows}${destroyedRows}</div>` : ''}
      <div class="df-info-box">
        <p>생존한 화물을 <strong>목표 항공 기지 헥스에 물리적으로 하차</strong>하세요.</p>
        ${survivingCargo.length === 0 ? '<p style="margin-top:6px;color:var(--ink-faded);">하차할 화물이 없습니다.</p>' : ''}
      </div>
      <div class="btn-row" style="margin-top:16px;">
        <button class="btn btn-primary" onclick="airliftUnloadDone()">복귀 / 비활성화 ▶</button>
      </div>
    </div>`;
}

function airliftUnloadDone() {
  airliftState.step = 'return';
  airUI();
}

// ── STEP 5: 복귀 / 비활성화 ──────────────────────────────────

function renderAirliftReturn() {
  const alive = airliftState.units.filter(u => !u.destroyed);
  const dead  = airliftState.units.filter(u => u.destroyed);

  const statusRows = [
    ...alive.map(u => `<div class="df-result-row brt-none" style="margin:0 0 4px;">${u.name} — 복귀 대기</div>`),
    ...dead .map(u => `<div class="df-result-row atk-loss" style="margin:0 0 4px;">💀 ${u.name} — 파괴됨</div>`),
  ];

  const withinRange = airliftState.withinRange;

  return `
    <div class="card air-manual-step">
      <div class="air-step-header">
        <span class="air-step-num">STEP 5</span>
        <span class="air-step-title">복귀 / 비활성화</span>
        <span class="air-step-en">Return &amp; Deactivate</span>
      </div>
      <div class="df-result-summary" style="margin-bottom:12px;">
        ${statusRows.join('')}
      </div>
      ${withinRange === null ? `
      <div class="df-info-box">
        <p>이 임무는 <strong>항속 거리 이내</strong>에서 수행되었습니까?</p>
        <p style="margin-top:6px;font-size:0.8rem;color:var(--ink-faded);">
          항속 거리 이내: 아무 항공 기지로 복귀 후 비활성화<br>
          항속 거리 초과: 목표 항공 기지에서 비활성화
        </p>
      </div>
      <div class="btn-row" style="margin-top:12px;">
        <button class="btn btn-secondary" onclick="airliftReturnDone(true)">예 — 항속 거리 이내 → 아무 기지로 복귀</button>
        <button class="btn btn-danger"    onclick="airliftReturnDone(false)">아니오 — 항속 거리 초과 → 목표 기지에서 비활성화</button>
      </div>` : `
      <div class="df-info-box">
        ${withinRange
          ? '<p>✅ 항속 거리 이내 — 생존 유닛을 <strong>아무 항공 기지로 이동</strong>시키고 <strong>비활성화</strong>하세요.</p>'
          : '<p>⛔ 항속 거리 초과 — 생존 유닛을 <strong>목표 항공 기지에서 비활성화</strong>하세요.</p>'}
      </div>
      <div class="btn-row" style="margin-top:16px;">
        <button class="btn btn-primary" onclick="backToAirSelect()">임무 완료 ✓</button>
      </div>`}
    </div>`;
}

function airliftReturnDone(withinRange) {
  airliftState.withinRange = withinRange;
  airUI();
}

// ─────────────────────────────────────────────────────────────
// ██  기지 이동 (Base Transfer)
// ─────────────────────────────────────────────────────────────
// 절차:
//   STEP 1. 항공 유닛을 임무 목표 헥스(신규 기지)로 이동
//   STEP 2. 적 경계 영공 진입 여부 확인
//     2-1. 예 → 요격 실시 (icStart)
//     2-2. 아니오 → STEP 3
//   STEP 3. 대공 사격 실시 (aaStart)
//   STEP 4. 항속 거리 이상 이동 시 항공 유닛 비활성화

const TRANSFER_STEPS = [
  { id:'move',       label:'유닛 이동',     en:'Move Unit'            },
  { id:'airspace',   label:'경계 영공 확인', en:'Alert Airspace Check' },
  { id:'aa',         label:'대공 사격',      en:'AA Fire'              },
  { id:'deactivate', label:'비활성화',       en:'Deactivate'           },
];

let transferState = {};

function transferInit() {
  transferState = {
    step: 'move',
    units: [{ id: 0, name: '유닛 1', airStr: 1, aborted: false }],
    inEnemyAirspace: false,
    overRange: false,
  };
  icReset(); aaReset();
}

function renderTransfer() {
  const si = renderStepIndicator(TRANSFER_STEPS, TRANSFER_STEPS.findIndex(s => s.id === transferState.step));
  const hdr = `<div class="card">
    <div class="card-title"><span class="icon">✈</span> 기지 이동 (Base Transfer)
      <button class="air-back-btn" onclick="backToAirSelect()">◀ 임무 선택</button>
    </div>${si}</div>`;

  // 하위 모듈 활성
  if (icState) return hdr + renderInterception();
  if (aaState) return hdr + renderAA();

  let body = '';
  switch (transferState.step) {
    case 'move':       body = renderTransferMove();       break;
    case 'airspace':   body = renderTransferAirspace();   break;
    case 'aa':         transferStartAA(); return renderTransfer();
    case 'deactivate': body = renderTransferDeactivate(); break;
  }
  return hdr + body;
}

// STEP 1 — 유닛 이동 / 편성
function renderTransferMove() {
  const units = transferState.units;
  const rows = units.map((u, i) => `
    <div class="bom-unit-row">
      <div class="bom-unit-idx">${i + 1}</div>
      <div class="bom-unit-fields">
        <div class="field-group">
          <label class="field-label">유닛 이름</label>
          <input class="field-input" type="text" id="trName_${i}" value="${u.name}" style="width:110px;">
        </div>
        <div class="field-group">
          <label class="field-label">공대공 전력</label>
          <input class="field-input" type="number" id="trAirStr_${i}" value="${u.airStr}" min="0" step="0.5" style="width:70px;">
        </div>
      </div>
      ${units.length > 1 ? `<button class="bom-unit-remove" onclick="transferRemoveUnit(${i})">✕</button>` : ''}
    </div>`).join('');

  return `
    <div class="card air-manual-step">
      <div class="air-step-header">
        <span class="air-step-num">STEP 1</span>
        <span class="air-step-title">유닛 이동 / 편성</span>
        <span class="air-step-en">Move Unit to New Base</span>
      </div>
      <div class="air-manual-desc">
        <p>이동할 항공 유닛을 <strong>새 기지 헥스</strong>로 이동시키세요. 유닛 정보를 입력하세요.</p>
      </div>
      <div class="bom-unit-list" id="transferUnitList">${rows}</div>
      <div class="btn-row" style="margin-top:8px;">
        <button class="btn btn-secondary" onclick="transferAddUnit()">+ 유닛 추가</button>
      </div>
      <div class="btn-row" style="margin-top:16px;">
        <button class="btn btn-primary" onclick="transferSaveMove()">다음 ▶</button>
      </div>
    </div>`;
}

function transferAddUnit() {
  transferSaveUnits();
  const id = transferState.units.length;
  transferState.units.push({ id, name: `유닛 ${id + 1}`, airStr: 1, aborted: false });
  airUI();
}

function transferRemoveUnit(idx) {
  transferSaveUnits();
  transferState.units.splice(idx, 1);
  transferState.units.forEach((u, i) => { u.id = i; });
  airUI();
}

function transferSaveUnits() {
  transferState.units.forEach((u, i) => {
    const nameEl   = document.getElementById(`trName_${i}`);
    const airStrEl = document.getElementById(`trAirStr_${i}`);
    if (nameEl)   u.name   = nameEl.value || u.name;
    if (airStrEl) u.airStr = parseFloat(airStrEl.value) || 0;
  });
}

function transferSaveMove() {
  transferSaveUnits();
  transferState.step = 'airspace';
  airUI();
}

// STEP 2 — 경계 영공 확인
function renderTransferAirspace() {
  return `
    <div class="card">
      <div class="card-title"><span class="icon">🚨</span> STEP 2 — 적 경계 영공 확인</div>
      <div class="df-info-box">
        <p>이동 경로가 <strong>적 경계 영공(Enemy Alert Airspace)</strong>을 통과합니까?</p>
      </div>
      <div class="btn-row" style="margin-top:16px;">
        <button class="btn btn-secondary" onclick="transferNoAirspace()">아니오 — 대공 사격으로 ▶</button>
        <button class="btn btn-primary"   onclick="transferYesAirspace()">예 — 요격 절차 진행 ▶</button>
      </div>
    </div>`;
}

function transferNoAirspace() {
  transferState.inEnemyAirspace = false;
  transferState.step = 'deactivate'; // 대공 사격 없이 바로 비활성화
  airUI();
}

function transferYesAirspace() {
  transferState.inEnemyAirspace = true;
  icStart({
    missionUnits: transferState.units.filter(u => !u.aborted),
    onDone: () => { transferState.step = 'aa'; airUI(); }, // 요격 후 → 대공 사격
    onBack: () => { icReset(); transferState.step = 'airspace'; airUI(); },
  });
  airUI();
}

// STEP 3 — 대공 사격
function transferStartAA() {
  const alive = transferState.units.filter(u => !u.aborted);
  aaStart({
    missionUnits: alive.map(u => ({
      id: u.id,
      name: u.name,
      airStr: u.airStr,
      groundStr: u.airStr,
      str: u.airStr,
    })),
    inEnemyAirspace: transferState.inEnemyAirspace,
    onDone: () => {
      transferState.step = 'deactivate';
      airUI();
    },
  });
}

// STEP 4 — 비활성화
function renderTransferDeactivate() {
  const alive = transferState.units.filter(u => !u.aborted);
  const dead  = transferState.units.filter(u => u.aborted);

  const statusRows = [
    ...alive.map(u => `<div class="df-result-row brt-none">${u.name} — 이동 완료</div>`),
    ...dead .map(u => `<div class="df-result-row atk-loss">${u.name} — 임무 중 손실</div>`),
  ];

  return `
    <div class="card air-manual-step">
      <div class="air-step-header">
        <span class="air-step-num">STEP 4</span>
        <span class="air-step-title">비활성화</span>
        <span class="air-step-en">Deactivate</span>
      </div>
      ${statusRows.length ? `<div class="df-result-summary" style="margin-bottom:12px;">${statusRows.join('')}</div>` : ''}
      <div class="df-info-box">
        <p>항속 거리를 <strong>초과</strong>하여 이동했습니까?</p>
        <p style="margin-top:6px;font-size:0.8rem;color:var(--ink-faded);">초과 이동한 경우 해당 항공 유닛은 즉시 <strong>비활성화</strong>됩니다.</p>
      </div>
      <div class="btn-row" style="margin-top:12px;">
        <button class="btn btn-secondary" onclick="transferDone(false)">아니오 — 이동 완료 (활성 유지) ✓</button>
        <button class="btn btn-danger"    onclick="transferDone(true)">예 — 항속 거리 초과 → 비활성화</button>
      </div>
    </div>`;
}

function transferDone(overRange) {
  transferState.overRange = overRange;
  backToAirSelect();
}
