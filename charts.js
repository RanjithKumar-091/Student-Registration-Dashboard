'use strict';
/**
 * Student Registration Dashboard — charts.js
 * Builds and updates 4 Chart.js charts:
 *  1. Gender Distribution (Pie)
 *  2. Degree-wise Count   (Bar – vertical)
 *  3. City-wise Count     (Bar – horizontal, sorted)
 *  4. Age Category        (Doughnut)
 *
 * Called by script.js via renderAllCharts(filteredArr).
 * Reads CSS custom properties so charts automatically adapt to dark/light theme.
 */

/* ──────────────────── Chart instances (destroy-and-recreate pattern) ──────────────────── */
let chartGender, chartDegree, chartCity, chartAge;

/* ──────────────────── Helpers ──────────────────── */

/**
 * Reads a CSS variable from :root, trimmed.
 * @param {string} name  e.g. '--ink'
 * @returns {string}
 */
function css(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/**
 * Returns a shared Chart.js plugin-defaults object for this app.
 * @param {string} [position='bottom']  Legend position
 * @returns {Object}
 */
function pluginDefaults(position = 'bottom') {
  return {
    legend: {
      position,
      labels: {
        color:     css('--ink'),
        font:      { family: 'Inter', size: 12 },
        boxWidth:  12,
        padding:   14,
        usePointStyle: true,
      },
    },
    tooltip: {
      backgroundColor: css('--surface'),
      titleColor:      css('--ink'),
      bodyColor:       css('--ink-soft'),
      borderColor:     css('--line'),
      borderWidth:     1,
      padding:         10,
      cornerRadius:    10,
    },
  };
}

/**
 * Safely destroys a Chart instance and replaces it.
 * @param {Chart|undefined} instance  Existing chart
 * @param {string}          canvasId  DOM canvas id
 * @param {Object}          config    Full Chart.js config
 * @returns {Chart}  New chart instance
 */
function buildChart(instance, canvasId, config) {
  if (instance) instance.destroy();
  const ctx = document.getElementById(canvasId);
  if (!ctx) return null;
  return new Chart(ctx, config);
}

/* ──────────────────── 1. Gender Pie Chart ──────────────────── */
/**
 * @param {Array<Object>} arr  Filtered student array
 */
function renderGenderChart(arr) {
  const male   = arr.filter((s) => s.sex === 'Male').length;
  const female = arr.filter((s) => s.sex === 'Female').length;

  chartGender = buildChart(chartGender, 'genderChart', {
    type: 'pie',
    data: {
      labels:   ['Male', 'Female'],
      datasets: [{
        data:            [male, female],
        backgroundColor: ['#4361EE', '#EC4899'],
        borderWidth:     0,
        hoverOffset:     6,
      }],
    },
    options: {
      responsive:          true,
      maintainAspectRatio: false,
      plugins:             pluginDefaults('bottom'),
    },
  });
}

/* ──────────────────── 2. Degree-wise Bar Chart ──────────────────── */
/**
 * @param {Array<Object>} arr  Filtered student array
 */
function renderDegreeChart(arr) {
  // Use reduce() to count students per degree
  const countMap = DEGREES.reduce((acc, d) => {
    acc[d] = arr.filter((s) => s.degree === d).length;
    return acc;
  }, {});

  const labels = DEGREES;
  const data   = labels.map((d) => countMap[d]);

  chartDegree = buildChart(chartDegree, 'degreeChart', {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label:           'Students',
        data,
        backgroundColor: '#4361EE',
        borderRadius:    6,
        borderSkipped:   false,
        maxBarThickness: 40,
      }],
    },
    options: {
      responsive:          true,
      maintainAspectRatio: false,
      plugins: {
        ...pluginDefaults(),
        legend: { display: false },
      },
      scales: {
        x: {
          ticks:    { color: css('--ink-soft'), font: { size: 11 } },
          grid:     { display: false },
          border:   { display: false },
        },
        y: {
          beginAtZero: true,
          ticks:       { color: css('--ink-soft'), precision: 0 },
          grid:        { color: css('--line') },
          border:      { display: false },
        },
      },
    },
  });
}

/* ──────────────────── 3. City-wise Bar Chart (horizontal, sorted desc) ──────────────────── */
/**
 * @param {Array<Object>} arr  Filtered student array
 */
function renderCityChart(arr) {
  // Build count pairs then sort by count descending
  const pairs = CITIES
    .map((c) => ({ city: c, count: arr.filter((s) => s.city === c).length }))
    .sort((a, b) => b.count - a.count);

  chartCity = buildChart(chartCity, 'cityChart', {
    type: 'bar',
    data: {
      labels:   pairs.map((p) => p.city),
      datasets: [{
        label:           'Students',
        data:            pairs.map((p) => p.count),
        backgroundColor: PALETTE,
        borderRadius:    6,
        borderSkipped:   false,
        maxBarThickness: 30,
      }],
    },
    options: {
      indexAxis:           'y',   // ← horizontal bars
      responsive:          true,
      maintainAspectRatio: false,
      plugins: {
        ...pluginDefaults(),
        legend: { display: false },
      },
      scales: {
        x: {
          beginAtZero: true,
          ticks:       { color: css('--ink-soft'), precision: 0 },
          grid:        { color: css('--line') },
          border:      { display: false },
        },
        y: {
          ticks:  { color: css('--ink-soft'), font: { size: 11 } },
          grid:   { display: false },
          border: { display: false },
        },
      },
    },
  });
}

/* ──────────────────── 4. Age Category Doughnut Chart ──────────────────── */
/**
 * @param {Array<Object>} arr  Filtered student array
 */
function renderAgeChart(arr) {
  const buckets = ['20–25', '25–30', 'Above 30'];

  // Use reduce() to bucket ages
  const counts = arr.reduce((acc, s) => {
    const b = ageBucket(s.age);
    acc[b]  = (acc[b] || 0) + 1;
    return acc;
  }, {});

  chartAge = buildChart(chartAge, 'ageChart', {
    type: 'doughnut',
    data: {
      labels:   buckets,
      datasets: [{
        data:            buckets.map((b) => counts[b] || 0),
        backgroundColor: ['#4361EE', '#F59E0B', '#20B981'],
        borderWidth:     0,
        hoverOffset:     6,
        cutout:          '62%',
      }],
    },
    options: {
      responsive:          true,
      maintainAspectRatio: false,
      plugins:             pluginDefaults('bottom'),
    },
  });
}

/* ──────────────────── Master render function ──────────────────── */
/**
 * Renders all 4 charts. If arr is not passed, reads filters from the DOM.
 * Exposed globally so script.js and the theme toggle can call it.
 * @param {Array<Object>} [arr]
 */
function renderAllCharts(arr) {
  const data = arr !== undefined ? arr : window.getFilteredStudents();
  renderGenderChart(data);
  renderDegreeChart(data);
  renderCityChart(data);
  renderAgeChart(data);
}

/* Expose globally */
window.renderAllCharts = renderAllCharts;

/* ──────────────────── Initial render on page load ──────────────────── */
window.updateDashboard();
