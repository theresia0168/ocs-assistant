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
  { id: 'interdict', label: '항공 저지',     en: 'Interdiction',        icon: '🚫', available: false },
  { id: 'transfer',  label: '기지 이동',     en: 'Base Transfer',       icon: '✈',  available: true },
  { id: 'airdrop',   label: '공수 강하',     en: 'Airborne Drop',       icon: '🪂',  available: false },
  { id: 'airlift',   label: '항공 수송',     en: 'Air Transport',       icon: '📦', available: false },
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
  if (id === 'bombing') { bombInit(); }
  if (id === 'transfer') { transferInit(); }
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
    phase: (opts.attackerUnits && !hasPresetDef) ? 'setup_def_only' : 'setup',
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
  const activeDefCount = df.defenderUnits.filter(u => !u.aborted).length;
  return `
    <div class="card">
      <div class="card-title"><span class="icon">⚠</span> 공중전 — 자발적 임무 중단</div>
      <div class="df-info-box">
        <p>방어자의 항공 유닛이 <strong>${df.defenderUnits.length}기</strong>입니다.</p>
        <p>방어자는 <strong>자발적 임무 중단</strong>을 선택할 수 있습니다. (규칙 14.3d)</p>
      </div>
      <div class="field-group" style="margin-top:14px;">
        <label class="field-label">방어자 임무 중단 유닛 수</label>
        <input class="field-input" type="number" id="dfVolAbortCount" value="0" min="0" max="${activeDefCount}" step="1">
        <div style="font-size:0.7rem;color:var(--ink-faded);margin-top:4px;">0이면 중단 없이 진행</div>
      </div>
      <div class="btn-row">
        <button class="btn btn-secondary" onclick="dfVolSkip()">중단 없이 진행 ▶</button>
        <button class="btn btn-primary"   onclick="dfVolApply()">임무 중단 적용 후 진행 ▶</button>
      </div>
    </div>`;
}

function dfVolSkip() { dfState.phase = 'select'; dfState.round = 1; airUI(); }

function dfVolApply() {
  const cnt = parseInt(document.getElementById('dfVolAbortCount').value) || 0;
  const df = dfState;
  let aborted = 0;
  for (let i = df.defenderUnits.length-1; i >= 0 && aborted < cnt; i--) {
    if (!df.defenderUnits[i].aborted) { df.defenderUnits[i].aborted = true; aborted++; }
  }
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
      <span class="df-loss-result ${lo.loss?'brt-step':'brt-none'}">${lo.loss?'1 스텝 손실':'손실 없음'} (5~6)</span>
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
  // 요격: 요격기가 "공격자"(수 입력), 임무 수행 중인 유닛이 "방어자"(preset)
  dfStart({
    attackerUnits: null,   // 요격기 수는 setup 화면에서 입력
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

function icDone() { const cb=icState?.onDone; icReset(); if(cb) cb(); else airUI(); }

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
    case 'aa':           /* aaStart가 airUI() 전에 호출되므로 이 분기는 즉시 처리 */ bombStartAA(); return renderBombing();
    case 'bombing':      body = renderBombRoll();         break;
    case 'return':       body = renderBombReturn();       break;
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
    attackerUnits: bombState.units.map(u=>({id:u.id,name:u.name,str:u.airStr})),
    onDone: (snap) => {
      if (snap?.attackerUnits) snap.attackerUnits.forEach(du=>{const u=bombState.units.find(u=>u.id===du.id);if(u&&du.aborted)u.aborted=true;});
      bombState.step='interception'; airUI();
    },
    onBack: () => { dfReset(); bombState.step='dogfight'; airUI(); },
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
  // filter로 새 배열을 만들면 참조가 끊기므로 bombState.units의 객체를 직접 참조
  icStart({
    missionUnits: bombState.units.filter(u => !u.aborted),
    onDone: () => { bombState.step = 'aa'; airUI(); },
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
