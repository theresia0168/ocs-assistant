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
// 일정 주기가 아니라, 사용자가 화면과 상호작용(클릭/입력/변경)할 때만 저장한다.
// 연속 상호작용 중 매번 직렬화하지 않도록 짧게 디바운스한다.

const AUTOSAVE_DEBOUNCE_MS = 1000;
let _autoSaveTimer = null;

function autoSave() {
  if (!currentScenario) return;
  try {
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({ savedAt: Date.now(), snapshot: buildSnapshot() }));
  } catch (e) { /* 저장 공간 부족 등은 무시 */ }
}

function scheduleAutoSave() {
  if (!currentScenario) return;
  clearTimeout(_autoSaveTimer);
  _autoSaveTimer = setTimeout(autoSave, AUTOSAVE_DEBOUNCE_MS);
}

['click', 'input', 'change'].forEach(evt => {
  document.addEventListener(evt, scheduleAutoSave, { passive: true });
});
// 탭을 닫거나 백그라운드로 전환할 때는 디바운스 없이 즉시 저장(유실 방지)
window.addEventListener('pagehide', autoSave);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') autoSave();
});

// 자동저장 슬롯 조회 — 구버전(스냅샷을 직접 저장) 포맷도 함께 지원
function getAutoSaveEntry() {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const snapshot = parsed?.snapshot || parsed;
    if (!snapshot?.currentScenario) return null;
    return { savedAt: parsed?.savedAt || Date.now(), snapshot };
  } catch (e) {
    return null;
  }
}

function restoreAutoSave() {
  const entry = getAutoSaveEntry();
  if (!entry) return false;
  applySnapshot(entry.snapshot);
  return true;
}

function loadAutoSave() {
  const entry = getAutoSaveEntry();
  if (!entry) return;
  applySnapshot(entry.snapshot);
  closeSaveModal();
}

function clearAutoSave() {
  localStorage.removeItem(AUTOSAVE_KEY);
  renderSaveModal();
}

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

function overwriteSlot(id) {
  if (!currentScenario) return;
  const slots = listSaveSlots();
  const slot = slots.find(s => s.id === id);
  if (!slot) return;
  if (!confirm(`'${slot.name}' 저장을 현재 상태로 덮어쓸까요?`)) return;
  slot.savedAt = Date.now();
  slot.snapshot = buildSnapshot();
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

function formatSlotMeta(snapshot, savedAt) {
  const sc = snapshot?.currentScenario;
  const st = snapshot?.state;
  const turnLabel = st?.year ? `${st.year}년 ${st.month}월 ${st.day}일` : '—';
  const dateLabel = new Date(savedAt).toLocaleString('ko-KR', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' });
  return `${sc?.title || '—'} · ${turnLabel} · ${dateLabel}`;
}

function renderSaveModal() {
  const list = document.getElementById('saveSlotList');
  if (!list) return;
  const slots = listSaveSlots();
  const autoEntry = getAutoSaveEntry();

  const noScenarioWarn = !currentScenario
    ? '<div class="save-modal-warn">시나리오를 선택해야 저장할 수 있습니다.</div>'
    : '';
  const saveBtnEl = document.getElementById('saveSlotSaveBtn');
  if (saveBtnEl) saveBtnEl.disabled = !currentScenario;
  const warnEl = document.getElementById('saveModalWarn');
  if (warnEl) warnEl.innerHTML = noScenarioWarn;

  if (slots.length === 0 && !autoEntry) {
    list.innerHTML = '<div class="save-modal-empty">저장된 슬롯이 없습니다.</div>';
    return;
  }

  const autoRow = autoEntry ? `
    <div class="save-slot-row save-slot-row-auto">
      <div class="save-slot-info">
        <div class="save-slot-name">⏱ 자동저장</div>
        <div class="save-slot-meta">${formatSlotMeta(autoEntry.snapshot, autoEntry.savedAt)}</div>
      </div>
      <div class="save-slot-actions">
        <button class="btn btn-primary save-slot-btn" onclick="loadAutoSave()">불러오기</button>
        <button class="btn btn-danger save-slot-btn" onclick="clearAutoSave()">삭제</button>
      </div>
    </div>` : '';

  const slotRows = slots.map(s => `
      <div class="save-slot-row">
        <div class="save-slot-info">
          <div class="save-slot-name">${s.name}</div>
          <div class="save-slot-meta">${formatSlotMeta(s.snapshot, s.savedAt)}</div>
        </div>
        <div class="save-slot-actions">
          <button class="btn btn-primary save-slot-btn" onclick="loadSlot('${s.id}')">불러오기</button>
          <button class="btn btn-secondary save-slot-btn" onclick="overwriteSlot('${s.id}')" ${!currentScenario ? 'disabled' : ''}>덮어쓰기</button>
          <button class="btn btn-secondary save-slot-btn" onclick="downloadSlot('${s.id}')">다운로드</button>
          <button class="btn btn-danger save-slot-btn" onclick="deleteSlot('${s.id}')">삭제</button>
        </div>
      </div>`).join('');

  list.innerHTML = autoRow + slotRows;
}
