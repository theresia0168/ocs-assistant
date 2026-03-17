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

  // 페이즈 행동 패널 렌더
  renderUI(el) {
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