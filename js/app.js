// ============================================================
// 전투 결과 기록
// ============================================================

function saveToLog(type, mainText, detailText, entryClass) {
  const logId = type === 'surprise' ? 'surpriseLog' : 'combatLog';
  const log = document.getElementById(logId);
  log.innerHTML = `
    <div class="log-entry ${entryClass}">
      <div class="log-main">${mainText}</div>
      <div class="log-detail">${detailText}</div>
    </div>`;
}

function clearLog(type) {
  const logId = type === 'surprise' ? 'surpriseLog' : 'combatLog';
  const label = type === 'surprise' ? '기습 굴림 결과가 여기에 기록됩니다' : '전투 굴림 결과가 여기에 기록됩니다';
  document.getElementById(logId).innerHTML = `<div class="log-empty">${label}</div>`;
  if (type === 'surprise') {
    surpriseState = null;
    updateSurpriseIndicator();
  }
}

function updateClock() {
  const now = new Date();
  document.getElementById('clock').textContent =
    now.toLocaleTimeString('ko-KR', {hour:'2-digit', minute:'2-digit', second:'2-digit'});
}

function showPage(id, btn) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  if (btn) btn.classList.add('active');
  else document.querySelector(`nav button[onclick*="${id}"]`).classList.add('active');
}

// 초기화
updateStartDayOptions();  // 날짜 드롭다운 채우기
updateTurnUI();           // 기본 UI 렌더링 (날짜 미설정 상태)
calcOdds();
calcBarrage();
renderAirActionSelect();  // 항공 임무 초기 화면
setInterval(updateClock, 1000);
updateClock();
