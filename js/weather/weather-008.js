// ============================================================
// weather-008.js
// Guderian's Blitzkrieg II (OCS #008) 전용 WeatherHandler
// Ground 1d6 / Flight 1d6 — 날짜 구간별로 각각 독립 굴림 (특수 규칙 없음)
// ============================================================

class WeatherHandler008 extends WeatherHandlerBase {

  constructor(weatherData, state) {
    super(weatherData, state);
    this._pending = null;
  }

  canRoll() { return !!this.weatherData; }

  // ── 유틸 ──────────────────────────────────────────────────

  // section(groundCondition 또는 flightCondition)의 table에서
  // 현재 날짜(month/day)에 해당하는 행을 찾는다.
  _findRow(section) {
    const m = this.state.month, d = this.state.day;
    return section.table.find(row => {
      const fromOk = (m > row.monthFrom) || (m === row.monthFrom && d >= row.dayFrom);
      const toOk   = (m < row.monthTo)   || (m === row.monthTo   && d <= row.dayTo);
      return fromOk && toOk;
    }) || null;
  }

  _resolveResult(results, dieValue) {
    for (const [id, val] of Object.entries(results)) {
      if (val === 'auto') return { id, auto: true };
    }
    for (const [id, val] of Object.entries(results)) {
      if (Array.isArray(val) && val.includes(dieValue)) return { id, auto: false };
    }
    return null;
  }

  _roll1d6() { return Math.floor(Math.random() * 6) + 1; }

  // ── 굴림 ──────────────────────────────────────────────────

  roll() {
    const tbl = this.weatherData;

    const groundRow = this._findRow(tbl.groundCondition);
    const flightRow = this._findRow(tbl.flightCondition);

    if (!groundRow) return { rolls: [], warnings: ['현재 날짜에 해당하는 Ground 테이블 행이 없습니다.'] };
    if (!flightRow) return { rolls: [], warnings: ['현재 날짜에 해당하는 Flight 테이블 행이 없습니다.'] };

    // Ground 굴림
    let groundDie = null, groundAuto = false, groundId;
    const groundAutoEntry = Object.entries(groundRow.results).find(([, v]) => v === 'auto');
    if (groundAutoEntry) {
      groundId = groundAutoEntry[0]; groundAuto = true;
    } else {
      groundDie = this._roll1d6();
      const resolved = this._resolveResult(groundRow.results, groundDie);
      if (!resolved) return { rolls: [], warnings: ['Ground 굴림 결과를 찾을 수 없습니다.'] };
      groundId = resolved.id;
    }

    // Flight 굴림 — Ground와 무관하게 독립 시행
    let flightDie = null, flightAuto = false, flightId;
    const flightAutoEntry = Object.entries(flightRow.results).find(([, v]) => v === 'auto');
    if (flightAutoEntry) {
      flightId = flightAutoEntry[0]; flightAuto = true;
    } else {
      flightDie = this._roll1d6();
      const resolved = this._resolveResult(flightRow.results, flightDie);
      if (!resolved) return { rolls: [], warnings: ['Flight 굴림 결과를 찾을 수 없습니다.'] };
      flightId = resolved.id;
    }

    this._pending = { groundId, groundDie, groundAuto, flightId, flightDie, flightAuto };
    return { rolls: [this._pending], warnings: [] };
  }

  // ── 적용 ──────────────────────────────────────────────────

  apply() {
    if (!this._pending) return;
    const { groundId, flightId } = this._pending;

    this.state.weatherSlots = this.state.weatherSlots.map(slot => {
      if (slot.key === 'groundCondition') return { ...slot, stateId: groundId };
      if (slot.key === 'flightCondition') return { ...slot, stateId: flightId };
      return slot;
    });

    if (!this.state.weatherHistory) this.state.weatherHistory = [];
    this.state.weatherHistory.push({
      year: this.state.year, month: this.state.month, day: this.state.day,
      groundCondition: groundId,
      flightCondition: flightId,
    });

    this._pending = null;
    updateWeatherUI();
    this.renderUI(document.getElementById('phaseActionContent'));
  }

  // ── 막대 테이블 렌더 헬퍼 (weather-022.js와 동일 패턴) ──────

  _buildDieMap(results, minDie, maxDie) {
    const map = {};
    const autoEntry = Object.entries(results).find(([, v]) => v === 'auto');
    if (autoEntry) {
      for (let i = minDie; i <= maxDie; i++) map[i] = autoEntry[0];
      return map;
    }
    for (const [id, val] of Object.entries(results)) {
      if (!Array.isArray(val)) continue;
      for (const n of val) map[n] = id;
    }
    return map;
  }

  _renderDieBar(dieMap, resultIds, labels, minDie, maxDie) {
    const COLORS = [
      { bg: '#4a6741', text: '#e8dfc0' },
      { bg: '#7a5c2a', text: '#e8dfc0' },
      { bg: '#3a5a7a', text: '#e8dfc0' },
      { bg: '#6a3030', text: '#e8dfc0' },
    ];
    const colorMap = {};
    resultIds.forEach((id, i) => { colorMap[id] = COLORS[i % COLORS.length]; });

    const cells = [];
    for (let i = minDie; i <= maxDie; i++) {
      const id = dieMap[i];
      const color = id ? colorMap[id] : { bg: 'rgba(0,0,0,0.08)', text: 'var(--ink-faded)' };
      cells.push(`<div class="wbar-cell" style="background:${color.bg};color:${color.text};">${i}</div>`);
    }

    const labelSpans = [];
    let prev = null, spanCount = 0;
    for (let i = minDie; i <= maxDie; i++) {
      const id = dieMap[i];
      if (id !== prev) {
        if (prev !== null) labelSpans.push({ id: prev, count: spanCount });
        prev = id; spanCount = 1;
      } else { spanCount++; }
    }
    if (prev !== null) labelSpans.push({ id: prev, count: spanCount });

    const labelCells = labelSpans.map(({ id, count }) => {
      const color = id ? colorMap[id] : { bg: 'transparent', text: 'var(--ink-faded)' };
      const label = id ? (labels[id] || id) : '';
      return `<div class="wbar-label-cell" style="flex:${count};border-top:2px solid ${color.bg};color:${color.bg === 'transparent' ? color.text : color.bg};">${label}</div>`;
    });

    return `<div class="wbar-wrap"><div class="wbar-cells">${cells.join('')}</div><div class="wbar-labels">${labelCells.join('')}</div></div>`;
  }

  _renderBar(results, labels) {
    const resultIds = Object.keys(results).filter(id => results[id] !== null);
    return this._renderDieBar(this._buildDieMap(results, 1, 6), resultIds, labels, 1, 6);
  }

  // ── UI 렌더 ───────────────────────────────────────────────

  _renderRollUI(el) {
    const tbl = this.weatherData;
    const pending = this._pending;
    const groundLabels = this.state.weatherLabels['groundCondition'] || {};
    const flightLabels = this.state.weatherLabels['flightCondition'] || {};

    const curGround      = this.state.weatherSlots.find(s => s.key === 'groundCondition')?.stateId;
    const curFlight       = this.state.weatherSlots.find(s => s.key === 'flightCondition')?.stateId;
    const curGroundLabel = groundLabels[curGround] || curGround || '—';
    const curFlightLabel = flightLabels[curFlight] || curFlight || '—';

    const groundRow   = this._findRow(tbl.groundCondition);
    const flightRow   = this._findRow(tbl.flightCondition);
    const groundRowEn = groundRow?.en || groundRow?.label || '—';
    const flightRowEn = flightRow?.en || flightRow?.label || '—';

    let groundResultHtml, flightResultHtml;
    if (!pending) {
      groundResultHtml = `<span class="dice-placeholder" style="grid-column:1/-1;">굴림 대기</span>`;
      flightResultHtml = `<span class="dice-placeholder" style="grid-column:1/-1;">굴림 대기</span>`;
    } else {
      const nextGroundLabel = groundLabels[pending.groundId] || pending.groundId || '—';
      const nextFlightLabel = flightLabels[pending.flightId] || pending.flightId || '—';

      groundResultHtml = pending.groundAuto
        ? `<div class="weather-dice-half"><span class="weather-auto-badge">AUTO</span></div>
           <div class="weather-name-half"><span class="weather-result-next">${nextGroundLabel}</span></div>`
        : `<div class="weather-dice-half">
             <div class="die-wrap">${makeDieFaceHTML(pending.groundDie, 'ivory')}<div class="die-val">${pending.groundDie}</div></div>
           </div>
           <div class="weather-name-half"><span class="weather-result-next">${nextGroundLabel}</span></div>`;

      flightResultHtml = pending.flightAuto
        ? `<div class="weather-dice-half"><span class="weather-auto-badge">AUTO</span></div>
           <div class="weather-name-half"><span class="weather-result-next">${nextFlightLabel}</span></div>`
        : `<div class="weather-dice-half">
             <div class="die-wrap">${makeDieFaceHTML(pending.flightDie, 'ivory')}<div class="die-val">${pending.flightDie}</div></div>
           </div>
           <div class="weather-name-half"><span class="weather-result-next">${nextFlightLabel}</span></div>`;
    }

    el.innerHTML = `
      <div class="weather-ui">
        <div class="weather-top-bar">
          <div class="weather-top-current">
            <span class="weather-top-label">현재 날씨</span>
            <span class="weather-top-value">${curGroundLabel} — ${curFlightLabel}</span>
          </div>
          <div class="weather-top-btns">
            <button class="btn btn-secondary weather-reroll-btn" onclick="weatherHandlerRoll()">
              🎲 ${pending ? '다시 굴리기' : '굴림'}
            </button>
            ${pending ? `<button class="btn btn-primary weather-apply-btn2" onclick="weatherHandlerApply()">적용 ▶</button>` : ''}
          </div>
        </div>

        <div class="weather-result-cols">
          <div class="weather-result-col">
            <div class="weather-result-col-label">지면 상황 (1D6)</div>
            <div class="weather-result-col-area">${groundResultHtml}</div>
          </div>
          <div class="weather-result-col-divider"></div>
          <div class="weather-result-col">
            <div class="weather-result-col-label">비행 상황 (1D6)</div>
            <div class="weather-result-col-area">${flightResultHtml}</div>
          </div>
        </div>

        <div class="weather-tbl-section">
          <div class="weather-tbl-header">
            <span class="weather-tbl-label">지면 (1D6)</span>
            <span class="weather-tbl-period">${groundRowEn}</span>
          </div>
          ${groundRow ? this._renderBar(groundRow.results, groundLabels) : '<span style="color:var(--ink-faded);font-size:0.75rem;">—</span>'}
        </div>
        <div class="weather-tbl-section" style="margin-top:6px;">
          <div class="weather-tbl-header">
            <span class="weather-tbl-label">비행 (1D6)</span>
            <span class="weather-tbl-period">${flightRowEn}</span>
          </div>
          ${flightRow ? this._renderBar(flightRow.results, flightLabels) : '<span style="color:var(--ink-faded);font-size:0.75rem;">—</span>'}
        </div>
      </div>`;
  }
}

// 등록
registerWeatherHandler('008', WeatherHandler008);