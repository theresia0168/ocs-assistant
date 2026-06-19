// ============================================================
// weather-core.js
// 공통 인터페이스 정의 + Handler 레지스트리
// ============================================================

// ── 공통 인터페이스 ──────────────────────────────────────────

class WeatherHandlerBase {
  constructor(weatherData, state) {
    this.weatherData = weatherData;  // scenario.weather.tableData
    this.state       = state;
  }

  // 현재 날짜/상황에서 굴림 가능 여부
  canRoll() { return false; }

  // 굴림 실행 — state에 즉시 적용하지 않고 결과만 반환
  // 반환: { rolls: [...], warnings: [] }
  roll() { return { rolls: [], warnings: [] }; }

  // 결과를 state에 반영 + 히스토리 기록
  apply(rollResult) {}

  // 시나리오 지정 초기 날씨 HTML (첫 턴 굴림 생략용)
  _buildPresetWeatherHTML() {
    const dateStr = (this.state.year && this.state.month && this.state.day)
      ? formatTurnDate(this.state.year, this.state.month, this.state.day)
      : '';

    const parts = this.state.weatherSlots.map(slot => {
      const labelMap = this.state.weatherLabels[slot.key] || {};
      return labelMap[slot.stateId] || slot.stateId || '—';
    });

    const note = currentScenario?.weather?.note || '';

    return `
      <div class="initiative-ui">
        <div class="initiative-preset-notice">
          ${dateStr} 턴의 날씨는 시나리오에 의해 <strong>${parts.join(' — ')}</strong>로 지정됩니다.
          ${note ? `<div style="margin-top:6px;font-size:0.82rem;color:var(--ink-faded);">${note}</div>` : ''}
        </div>
        <div class="initiative-proceed-row">
          <button class="btn btn-primary initiative-proceed-btn" onclick="weatherConfirmPreset()">
            다음 페이즈 ▶
          </button>
        </div>
      </div>`;
  }

  // 페이즈 행동 패널 렌더 — 공통 템플릿 (서브클래스는 _renderRollUI를 오버라이드)
  renderUI(el) {
    if (!el) return;
    // 첫 턴이고 시나리오에 초기 날씨가 지정된 경우 → 굴림 생략
    if (this.state.currentTurnN === 1 && currentScenario?.weather?.initial) {
      el.innerHTML = this._buildPresetWeatherHTML();
      return;
    }
    this._renderRollUI(el);
  }

  // 서브클래스가 오버라이드할 실제 굴림 UI
  _renderRollUI(el) {
    el.innerHTML = `<p class="phase-action-desc">이 시나리오는 날씨 테이블이 없습니다.</p>`;
  }
}

// ── 레지스트리 ───────────────────────────────────────────────

const _weatherHandlerRegistry = {};
let   _currentWeatherHandler  = null;

function registerWeatherHandler(gameId, HandlerClass) {
  _weatherHandlerRegistry[gameId] = HandlerClass;
}

function createWeatherHandler(gameId, weatherData, state) {
  const HandlerClass = _weatherHandlerRegistry[gameId] || WeatherHandlerBase;
  return new HandlerClass(weatherData, state);
}

function setWeatherHandler(handler) {
  _currentWeatherHandler = handler;
}

function getWeatherHandler() {
  return _currentWeatherHandler;
}