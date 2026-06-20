// ============================================================
// 세이브 / 로드 / 자동 저장
// ============================================================
// 직렬화 대상: currentScenario, turn.js의 state, 선 플레이어 결정 상태,
// 전투/포격 계산기 입력값, 작전 메모, 현재 탭.
// 항공 임무 진행(콜백을 포함하는 dfState/bombState 등)은 직렬화할 수 없어
// 대상에서 제외하고, 복원 시 임무 선택 화면으로 초기화한다.
// ============================================================

const AUTOSAVE_KEY   = 'ocsa_autosave_v1';
const SAVE_SLOTS_KEY = 'ocsa_save_slots_v1';

// ── 스냅샷 생성 ────────────────────────────────────────────────

function buildSnapshot() {
  const checklist = Array.from(document.querySelectorAll('#barrageChecklist input[type=checkbox]')).map(cb => cb.checked);

  return {
    currentScenario,
    state,
    initiative: _initiativeState,
    activePage: document.querySelector('.page.active')?.id || 'turn',
    memo: document.getElementById('memoText')?.value || '',
    combat: {
      atkStr:      document.getElementById('atkStr')?.value,
      atkAR:       document.getElementById('atkAR')?.value,
      defStr:      document.getElementById('defStr')?.value,
      defAR:       document.getElementById('defAR')?.value,
      defNoSupply: document.getElementById('defNoSupply')?.checked,
      terrainType,
      fortLevel,
      combatType,
    },
    barrage: {
      barrageStr: document.getElementById('barrageStr')?.value,
      barrageType,
      barrageFort,
      barrageDensity,
      checklist,
    },
  };
}

// ── 스냅샷 적용 ────────────────────────────────────────────────

function applySnapshot(snap) {
  if (!snap || !snap.currentScenario) return;

  currentScenario   = snap.currentScenario;
  state             = snap.state;
  _initiativeState  = snap.initiative || _initiativeState;

  setWeatherHandler(createWeatherHandler(currentScenario.gameId, currentScenario.weather?.tableData || null, state));
  if (typeof loadAircraftDataForGame === 'function') loadAircraftDataForGame(currentScenario.gameId);

  hideLobby();

  const titleEl  = document.getElementById('scenarioTitle');
  const seriesEl = document.getElementById('scenarioSeries');
  if (titleEl)  titleEl.textContent  = currentScenario.title  || '—';
  if (seriesEl) seriesEl.textContent = currentScenario.series || '—';
  const progressBlock = document.getElementById('turnProgressBlock');
  if (progressBlock) progressBlock.style.display = '';

  updateTurnUI();

  // 전투 계산기 복원
  const c = snap.combat || {};
  if (c.atkStr  !== undefined) document.getElementById('atkStr').value  = c.atkStr;
  if (c.atkAR   !== undefined) document.getElementById('atkAR').value   = c.atkAR;
  if (c.defStr  !== undefined) document.getElementById('defStr').value  = c.defStr;
  if (c.defAR   !== undefined) document.getElementById('defAR').value   = c.defAR;
  if (c.defNoSupply !== undefined) document.getElementById('defNoSupply').checked = c.defNoSupply;
  if (c.terrainType) {
    const btn = document.querySelector(`.terrain-btn[data-val="${c.terrainType}"]`);
    if (btn) setTerrain(c.terrainType, btn);
  }
  document.querySelectorAll('#combat .fort-btn:not(.barrage-fort-btn)').forEach(b => b.classList.remove('active'));
  fortLevel = c.fortLevel || 0;
  if (fortLevel > 0) {
    const btn = document.querySelector(`#combat .fort-btn[data-val="${fortLevel}"]`);
    if (btn) btn.classList.add('active');
  }
  if (c.combatType) {
    const btn = document.getElementById(c.combatType === 'overrun' ? 'ctypeOverrun' : 'ctypeNormal');
    if (btn) setCombatType(c.combatType, btn);
  }
  calcOdds();

  // 포격 계산기 복원
  const b = snap.barrage || {};
  if (b.barrageStr !== undefined) document.getElementById('barrageStr').value = b.barrageStr;
  if (b.barrageType) {
    const btn = document.querySelector(`.btype-btn[onclick*="'${b.barrageType}'"]`);
    if (btn) setBarrageType(b.barrageType, btn);
  }
  if (b.barrageDensity) {
    const btn = document.querySelector(`#densityBtns .density-btn[onclick*="'${b.barrageDensity}'"]`);
    if (btn) setDensity(b.barrageDensity, btn);
  }
  if (b.barrageFort !== undefined) {
    const btn = document.querySelector(`#barrFortBtns .barrage-fort-btn[onclick*="(${b.barrageFort},"]`);
    if (btn) setBarrageFort(b.barrageFort, btn);
  }
  if (Array.isArray(b.checklist)) {
    const checks = document.querySelectorAll('#barrageChecklist input[type=checkbox]');
    checks.forEach((cb, i) => { cb.checked = !!b.checklist[i]; });
  }
  calcBarrage();

  // 작전 메모 복원
  const memoEl = document.getElementById('memoText');
  if (memoEl) memoEl.value = snap.memo || '';

  // 항공 임무 — 진행 중 마법사 상태는 직렬화하지 않으므로 선택 화면으로 초기화
  airAction = null;
  renderAirActionSelect();

  showPage(snap.activePage || 'turn');
}

// ── 자동 저장 ────────────────────────────────────────────────

function autoSave() {
  if (!currentScenario) return;
  try {
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(buildSnapshot()));
  } catch (e) { /* 저장 공간 부족 등은 무시 */ }
}

function restoreAutoSave() {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    if (!raw) return false;
    const snap = JSON.parse(raw);
    if (!snap?.currentScenario) return false;
    applySnapshot(snap);
    return true;
  } catch (e) {
    return false;
  }
}

setInterval(autoSave, 3000);
window.addEventListener('pagehide', autoSave);

// ── 수동 저장 슬롯 ────────────────────────────────────────────

function listSaveSlots() {
  try {
    return JSON.parse(localStorage.getItem(SAVE_SLOTS_KEY)) || [];
  } catch (e) {
    return [];
  }
}

function saveToSlot(name) {
  if (!currentScenario) return;
  const slots = listSaveSlots();
  slots.unshift({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name: name || (currentScenario.title || '저장됨'),
    savedAt: Date.now(),
    snapshot: buildSnapshot(),
  });
  if (slots.length > 10) slots.length = 10;
  localStorage.setItem(SAVE_SLOTS_KEY, JSON.stringify(slots));
  renderSaveModal();
}

function loadSlot(id) {
  const slot = listSaveSlots().find(s => s.id === id);
  if (!slot) return;
  applySnapshot(slot.snapshot);
  closeSaveModal();
}

function deleteSlot(id) {
  const slots = listSaveSlots().filter(s => s.id !== id);
  localStorage.setItem(SAVE_SLOTS_KEY, JSON.stringify(slots));
  renderSaveModal();
}

// ── 파일로 내보내기 / 가져오기 (다른 기기로 옮길 때) ──────────────

function downloadSlot(id) {
  const slot = listSaveSlots().find(s => s.id === id);
  if (!slot) return;

  const payload = {
    type: 'ocs-assistant-save',
    version: 1,
    name: slot.name,
    savedAt: slot.savedAt,
    snapshot: slot.snapshot,
  };

  const safeName = (slot.name || 'ocs-save').replace(/[\\/:*?"<>|]/g, '_');
  const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `${safeName}.ocsasave.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function triggerImportFile() {
  document.getElementById('saveFileInput')?.click();
}

function handleImportFile(event) {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const payload = JSON.parse(reader.result);
      if (!payload?.snapshot?.currentScenario) {
        alert('올바른 저장 파일이 아닙니다.');
        return;
      }
      const slots = listSaveSlots();
      slots.unshift({
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        name: payload.name || file.name.replace(/\.json$/i, ''),
        savedAt: payload.savedAt || Date.now(),
        snapshot: payload.snapshot,
      });
      if (slots.length > 10) slots.length = 10;
      localStorage.setItem(SAVE_SLOTS_KEY, JSON.stringify(slots));
      renderSaveModal();
    } catch (e) {
      alert('파일을 읽는 중 오류가 발생했습니다: 올바른 저장 파일인지 확인해주세요.');
    }
  };
  reader.readAsText(file);
}

// ── 모달 ────────────────────────────────────────────────────

function openSaveModal() {
  const modal = document.getElementById('saveModal');
  if (!modal) return;
  modal.style.display = 'flex';
  renderSaveModal();
}

function closeSaveModal() {
  const modal = document.getElementById('saveModal');
  if (modal) modal.style.display = 'none';
}

function handleSaveSlotSubmit() {
  const input = document.getElementById('saveSlotNameInput');
  const name = input?.value.trim() || '';
  saveToSlot(name);
  if (input) input.value = '';
}

function renderSaveModal() {
  const list = document.getElementById('saveSlotList');
  if (!list) return;
  const slots = listSaveSlots();

  const noScenarioWarn = !currentScenario
    ? '<div class="save-modal-warn">시나리오를 선택해야 저장할 수 있습니다.</div>'
    : '';
  const saveBtnEl = document.getElementById('saveSlotSaveBtn');
  if (saveBtnEl) saveBtnEl.disabled = !currentScenario;
  const warnEl = document.getElementById('saveModalWarn');
  if (warnEl) warnEl.innerHTML = noScenarioWarn;

  if (slots.length === 0) {
    list.innerHTML = '<div class="save-modal-empty">저장된 슬롯이 없습니다.</div>';
    return;
  }

  list.innerHTML = slots.map(s => {
    const sc = s.snapshot?.currentScenario;
    const st = s.snapshot?.state;
    const turnLabel = st?.year ? `${st.year}년 ${st.month}월 ${st.day}일` : '—';
    const date = new Date(s.savedAt);
    const dateLabel = date.toLocaleString('ko-KR', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' });
    return `
      <div class="save-slot-row">
        <div class="save-slot-info">
          <div class="save-slot-name">${s.name}</div>
          <div class="save-slot-meta">${sc?.title || '—'} · ${turnLabel} · ${dateLabel}</div>
        </div>
        <div class="save-slot-actions">
          <button class="btn btn-primary save-slot-btn" onclick="loadSlot('${s.id}')">불러오기</button>
          <button class="btn btn-secondary save-slot-btn" onclick="downloadSlot('${s.id}')">다운로드</button>
          <button class="btn btn-danger save-slot-btn" onclick="deleteSlot('${s.id}')">삭제</button>
        </div>
      </div>`;
  }).join('');
}
