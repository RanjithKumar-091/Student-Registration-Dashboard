'use strict';
/**
 * Student Registration Dashboard — script.js
 * Handles: Local Storage, validation, CRUD, table rendering,
 * search, sort, pagination, CSV export, theme toggle, tab nav.
 */

/* ================================================================
   0. CONSTANTS
   ================================================================ */
const LS_KEY        = 'srd_students';
const PER_PAGE      = 8;
const DEGREES       = ['B.E','B.Tech','B.Sc','B.Com','BCA','MCA','MBA','M.Tech','M.Sc'];
const CITIES        = ['Chennai','Coimbatore','Madurai','Trichy','Salem','Tirunelveli','Erode','Vellore','Other'];
const PALETTE       = ['#4361EE','#F59E0B','#20B981','#EF4444','#8B5CF6','#14B8A6','#EC4899','#F97316','#6366F1'];

/* ================================================================
   1. LOCAL STORAGE LAYER
   ================================================================ */
const Store = {
  /**
   * Returns the full student array from Local Storage.
   * @returns {Array<Object>}
   */
  load() {
    try {
      return JSON.parse(localStorage.getItem(LS_KEY) || '[]');
    } catch {
      return [];
    }
  },

  /**
   * Persists the full student array to Local Storage.
   * @param {Array<Object>} arr
   */
  save(arr) {
    localStorage.setItem(LS_KEY, JSON.stringify(arr));
  },
};

/* ================================================================
   2. STATE
   ================================================================ */
let students    = Store.load();   // master data array
let currentPage = 1;              // pagination cursor
let editingId   = null;           // null = "add" mode, string = "edit" mode

/* ================================================================
   3. UTILITY FUNCTIONS
   ================================================================ */

/**
 * Calculates age from a date-of-birth string (YYYY-MM-DD).
 * @param {string} dobStr
 * @returns {number}
 */
function calcAge(dobStr) {
  if (!dobStr) return 0;
  const dob   = new Date(dobStr);
  const today = new Date();
  let   age   = today.getFullYear() - dob.getFullYear();
  const m     = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}

/**
 * Maps an age number to an age-bucket string label.
 * @param {number} age
 * @returns {string}
 */
function ageBucket(age) {
  if (age >= 20 && age <= 25) return '20–25';
  if (age > 25  && age <= 30) return '25–30';
  return 'Above 30';
}

/**
 * Returns true if string contains only alphabets and spaces.
 * @param {string} s
 * @returns {boolean}
 */
const onlyAlpha = (s) => /^[A-Za-z\s]+$/.test(s.trim());

/**
 * Generates the next sequential student ID: SRD-0001, SRD-0002 …
 * @returns {string}
 */
function nextId() {
  const max = students.reduce((m, s) => Math.max(m, s._seq || 0), 0);
  const seq = max + 1;
  return { _seq: seq, id: `SRD-${String(seq).padStart(4, '0')}` };
}

/**
 * Formats a date string as "15 Jan 2024" for display.
 * @param {string} iso   ISO date/datetime string
 * @returns {string}
 */
function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

/* ================================================================
   4. TOAST NOTIFICATIONS
   ================================================================ */
const toast = document.getElementById('toast');
let toastTimer;

/**
 * Shows a toast message for ~2.5 s.
 * @param {string} msg    Message text
 * @param {'ok'|'err'|'info'} type
 */
function showToast(msg, type = 'ok') {
  clearTimeout(toastTimer);
  toast.textContent = msg;
  toast.className   = `toast toast--${type} show`;
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
}

/* ================================================================
   5. THEME TOGGLE
   ================================================================ */
(function initTheme() {
  const root = document.documentElement;
  const btn  = document.getElementById('themeBtn');
  const saved = localStorage.getItem('srd_theme') ||
    (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  root.setAttribute('data-theme', saved);

  btn.addEventListener('click', () => {
    const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    localStorage.setItem('srd_theme', next);
    // Redraw charts with refreshed CSS variables
    if (typeof renderAllCharts === 'function') renderAllCharts();
  });
})();

/* ================================================================
   6. TAB NAVIGATION
   ================================================================ */
(function initTabs() {
  const btns     = document.querySelectorAll('.tab-btn');
  const sections = document.querySelectorAll('.tab-section');

  btns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;

      // Activate button
      btns.forEach((b) => b.classList.remove('tab-btn--active'));
      btn.classList.add('tab-btn--active');

      // Show matching section
      sections.forEach((s) => {
        const active = s.id === `tab-${target}`;
        s.classList.toggle('tab-section--active', active);
      });

      // If switching to dashboard, re-render charts (theme variables may differ)
      if (target === 'dashboard' && typeof renderAllCharts === 'function') {
        renderAllCharts();
      }
    });
  });
})();

/* ================================================================
   7. FORM: AUTO-CALCULATE AGE FROM DOB
   ================================================================ */
document.getElementById('dob').addEventListener('input', function () {
  const age = calcAge(this.value);
  document.getElementById('ageDisplay').value = age > 0 ? `${age} years` : '';
});

/* ================================================================
   8. FORM VALIDATION
   ================================================================ */

/**
 * Sets or clears a validation error for a single field.
 * @param {string} key   Field name key matching err-{key} element
 * @param {string} msg   Error message ('' = clear)
 */
function setError(key, msg) {
  const errEl = document.getElementById(`err-${key}`);
  if (errEl) errEl.textContent = msg;

  // Highlight / unhighlight the input
  const fieldMap = { fName: 'fName', lName: 'lName', dob: 'dob', degree: 'degree', city: 'city' };
  const inputEl  = document.getElementById(fieldMap[key]);
  if (inputEl) inputEl.classList.toggle('invalid', Boolean(msg));
}

/** Clears all validation errors */
function clearErrors() {
  ['fName','lName','dob','age','sex','degree','city'].forEach((k) => setError(k, ''));
}

/**
 * Validates the registration form.
 * @returns {{ ok: boolean, data: Object|null }}
 */
function validateForm() {
  clearErrors();
  let ok = true;

  const fName  = document.getElementById('fName').value.trim();
  const lName  = document.getElementById('lName').value.trim();
  const dob    = document.getElementById('dob').value;
  const degree = document.getElementById('degree').value;
  const city   = document.getElementById('city').value;
  const sexEl  = document.querySelector('input[name="sex"]:checked');
  const sex    = sexEl ? sexEl.value : '';

  // First name
  if (!fName) {
    setError('fName', 'First name is required.'); ok = false;
  } else if (!onlyAlpha(fName)) {
    setError('fName', 'Only alphabets allowed.'); ok = false;
  }

  // Last name
  if (!lName) {
    setError('lName', 'Last name is required.'); ok = false;
  } else if (!onlyAlpha(lName)) {
    setError('lName', 'Only alphabets allowed.'); ok = false;
  }

  // Date of Birth
  if (!dob) {
    setError('dob', 'Date of birth is required.'); ok = false;
  } else if (new Date(dob) > new Date()) {
    setError('dob', 'Date of birth cannot be in the future.'); ok = false;
  }

  // Sex
  if (!sex) { setError('sex', 'Please select sex.'); ok = false; }

  // Degree
  if (!degree) { setError('degree', 'Please select a degree.'); ok = false; }

  // City
  if (!city) { setError('city', 'Please select a city.'); ok = false; }

  if (!ok) return { ok: false, data: null };

  const age = calcAge(dob);

  // Duplicate check (same full name + dob), skip the record currently being edited
  const dup = students.find(
    (s) =>
      s.fName.toLowerCase() === fName.toLowerCase() &&
      s.lName.toLowerCase() === lName.toLowerCase() &&
      s.dob === dob &&
      s.id !== editingId
  );
  if (dup) {
    setError('fName', 'A student with the same name & DOB already exists.');
    return { ok: false, data: null };
  }

  return { ok: true, data: { fName, lName, dob, age, sex, degree, city } };
}

/* ================================================================
   9. FORM SUBMIT — ADD / EDIT
   ================================================================ */
document.getElementById('regForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const { ok, data } = validateForm();
  if (!ok) return;

  if (editingId) {
    // --- EDIT ---
    students = students.map((s) =>
      s.id === editingId ? { ...s, ...data } : s
    );
    showToast('Student record updated ✔');
    cancelEdit();
  } else {
    // --- ADD ---
    const { _seq, id } = nextId();
    students.push({
      id, _seq,
      ...data,
      dateRegistered: new Date().toISOString(),
    });
    showToast('Student registered ✔');
    resetForm();
  }

  Store.save(students);
  renderTable();
  updateDashboard();
});

/* ================================================================
   10. RESET / CANCEL EDIT
   ================================================================ */

/** Hard-resets the form (no edit mode). */
function resetForm() {
  document.getElementById('regForm').reset();
  document.getElementById('ageDisplay').value = '';
  clearErrors();
  editingId = null;
  document.getElementById('formHeading').textContent = 'Register Student';
  document.getElementById('editBadge').hidden = true;
  document.getElementById('submitBtn').textContent = 'Register Student';
}

function cancelEdit() { resetForm(); }

document.getElementById('cancelBtn').addEventListener('click', cancelEdit);

/* ================================================================
   11. FILL FORM FOR EDITING
   ================================================================ */
/**
 * Populates the form with an existing student's data for editing.
 * @param {string} id   Student ID
 */
function startEdit(id) {
  const s = students.find((st) => st.id === id);
  if (!s) return;

  editingId = id;
  document.getElementById('fName').value   = s.fName;
  document.getElementById('lName').value   = s.lName;
  document.getElementById('dob').value     = s.dob;
  document.getElementById('ageDisplay').value = `${s.age} years`;
  document.getElementById('degree').value  = s.degree;
  document.getElementById('city').value    = s.city;

  const sexRadio = document.querySelector(`input[name="sex"][value="${s.sex}"]`);
  if (sexRadio) sexRadio.checked = true;

  document.getElementById('formHeading').textContent = 'Edit Student';
  document.getElementById('editBadge').hidden = false;
  document.getElementById('submitBtn').textContent = 'Save Changes';

  // Switch to register tab and scroll to form
  document.querySelector('.tab-btn[data-tab="form"]').click();
  setTimeout(() => document.getElementById('regForm').scrollIntoView({ behavior: 'smooth' }), 80);
}

/* ================================================================
   12. DELETE STUDENT
   ================================================================ */
/**
 * Prompts for confirmation then removes a student record.
 * @param {string} id
 */
function deleteStudent(id) {
  const s = students.find((st) => st.id === id);
  if (!s) return;
  if (!confirm(`Delete ${s.fName} ${s.lName} (${s.id})?\n\nThis cannot be undone.`)) return;

  students = students.filter((st) => st.id !== id);
  Store.save(students);

  // If we were editing this record, reset
  if (editingId === id) cancelEdit();

  renderTable();
  updateDashboard();
  showToast('Student deleted.', 'err');
}

/* ================================================================
   13. TABLE RENDERING (with search, sort, pagination)
   ================================================================ */

/**
 * Applies search, sort, and pagination then injects rows into #tableBody.
 */
function renderTable() {
  const query    = document.getElementById('searchBox').value.trim().toLowerCase();
  const sortKey  = document.getElementById('sortField').value;
  const sortDir  = document.getElementById('sortDir').value;

  // 1. Filter
  let list = students.filter((s) => {
    if (!query) return true;
    return (
      s.fName.toLowerCase().includes(query)  ||
      s.lName.toLowerCase().includes(query)  ||
      s.degree.toLowerCase().includes(query) ||
      s.city.toLowerCase().includes(query)
    );
  });

  // 2. Sort using .sort() with localeCompare / numeric comparison
  if (sortKey) {
    list = [...list].sort((a, b) => {
      const av = sortKey === 'age' ? a.age : String(a[sortKey]).toLowerCase();
      const bv = sortKey === 'age' ? b.age : String(b[sortKey]).toLowerCase();
      if (sortKey === 'age') return sortDir === 'asc' ? av - bv : bv - av;
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    });
  }

  // 3. Record count label
  document.getElementById('recCount').textContent =
    `${list.length} / ${students.length} record${students.length !== 1 ? 's' : ''}`;

  // 4. Pagination
  const totalPages = Math.max(1, Math.ceil(list.length / PER_PAGE));
  if (currentPage > totalPages) currentPage = totalPages;
  const pageSlice = list.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);

  // 5. Build rows using template literals + map()
  const tbody = document.getElementById('tableBody');

  if (!pageSlice.length) {
    tbody.innerHTML = '';
    document.getElementById('emptyMsg').style.display = 'block';
    document.getElementById('pagination').innerHTML   = '';
    return;
  }
  document.getElementById('emptyMsg').style.display = 'none';

  tbody.innerHTML = pageSlice.map((s) => `
    <tr>
      <td><span class="tid">${s.id}</span></td>
      <td>${s.fName}</td>
      <td>${s.lName}</td>
      <td>${s.age}</td>
      <td><span class="pill pill--${s.sex.toLowerCase()}">${s.sex}</span></td>
      <td>${s.degree}</td>
      <td>${s.city}</td>
      <td>${fmtDate(s.dateRegistered)}</td>
      <td style="display:flex;gap:6px;padding:12px 14px;">
        <button class="act-btn act-btn--edit" onclick="startEdit('${s.id}')" title="Edit">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M11 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>
        </button>
        <button class="act-btn act-btn--del" onclick="deleteStudent('${s.id}')" title="Delete">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </td>
    </tr>`).join('');

  // 6. Render pagination controls
  renderPagination(totalPages);
}

/**
 * Renders page buttons for the table.
 * @param {number} total  Total page count
 */
function renderPagination(total) {
  const pag = document.getElementById('pagination');
  if (total <= 1) { pag.innerHTML = ''; return; }

  let html = `<button class="pg-btn" ${currentPage===1?'disabled':''} onclick="goPage(${currentPage-1})">&#8592;</button>`;

  for (let i = 1; i <= total; i++) {
    html += `<button class="pg-btn ${i===currentPage?'pg-btn--active':''}" onclick="goPage(${i})">${i}</button>`;
  }

  html += `<button class="pg-btn" ${currentPage===total?'disabled':''} onclick="goPage(${currentPage+1})">&#8594;</button>`;
  pag.innerHTML = html;
}

/** Navigates to a pagination page. */
function goPage(n) {
  currentPage = n;
  renderTable();
}

// Bind toolbar controls
document.getElementById('searchBox').addEventListener('input',  () => { currentPage = 1; renderTable(); });
document.getElementById('sortField').addEventListener('change', () => { currentPage = 1; renderTable(); });
document.getElementById('sortDir').addEventListener('change',   () => { currentPage = 1; renderTable(); });

/* ================================================================
   14. CSV EXPORT
   ================================================================ */
document.getElementById('exportBtn').addEventListener('click', () => {
  if (!students.length) { showToast('No records to export.', 'err'); return; }

  const header = ['ID','First Name','Last Name','Age','Sex','Degree','City','Date Registered'];
  const rows   = students.map((s) => [
    s.id, s.fName, s.lName, s.age, s.sex, s.degree, s.city, fmtDate(s.dateRegistered),
  ]);

  const csv  = [header, ...rows].map((r) => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `students_${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('CSV exported ✔');
});

/* ================================================================
   15. DASHBOARD SUMMARY CARDS
   ================================================================ */

/**
 * Populates the 4 summary stat cards using the filtered student set.
 * @param {Array<Object>} arr  (filtered array)
 */
function renderCards(arr) {
  const total  = arr.length;
  const male   = arr.filter((s) => s.sex === 'Male').length;
  const female = arr.filter((s) => s.sex === 'Female').length;
  const avgAge = total
    ? (arr.reduce((sum, s) => sum + s.age, 0) / total).toFixed(1)
    : '—';

  document.getElementById('s-total').textContent  = total;
  document.getElementById('s-male').textContent   = male;
  document.getElementById('s-female').textContent = female;
  document.getElementById('s-avg').textContent    = total ? `${avgAge} y` : '—';
}

/* ================================================================
   16. DASHBOARD FILTER DROPDOWNS (populate dynamically)
   ================================================================ */
function populateFilterDropdowns() {
  // Degree filter
  const dSel = document.getElementById('flt-degree');
  const curD = dSel.value;
  dSel.innerHTML = '<option value="">All Degrees</option>' +
    DEGREES.map((d) => `<option ${d===curD?'selected':''}>${d}</option>`).join('');

  // City filter
  const cSel = document.getElementById('flt-city');
  const curC = cSel.value;
  cSel.innerHTML = '<option value="">All Cities</option>' +
    CITIES.map((c) => `<option ${c===curC?'selected':''}>${c}</option>`).join('');
}

/* ================================================================
   17. DASHBOARD FILTER APPLY
   ================================================================ */

/**
 * Returns the filtered student array based on dashboard filter controls.
 * @returns {Array<Object>}
 */
function getFilteredStudents() {
  const deg = document.getElementById('flt-degree').value;
  const cit = document.getElementById('flt-city').value;
  const gen = document.getElementById('flt-gender').value;
  const agC = document.getElementById('flt-age').value;

  return students.filter((s) => {
    const bucket = ageBucket(s.age);
    const bucketKey = bucket === '20–25' ? '20-25' : bucket === '25–30' ? '25-30' : '30+';
    return (
      (!deg || s.degree === deg) &&
      (!cit || s.city   === cit) &&
      (!gen || s.sex    === gen) &&
      (!agC || bucketKey === agC)
    );
  });
}

// Clear filter button
document.getElementById('clearFiltersBtn').addEventListener('click', () => {
  ['flt-degree','flt-city','flt-gender','flt-age'].forEach((id) => {
    document.getElementById(id).value = '';
  });
  updateDashboard();
});

// Bind filter controls
['flt-degree','flt-city','flt-gender','flt-age'].forEach((id) => {
  document.getElementById(id).addEventListener('change', updateDashboard);
});

/* ================================================================
   18. UPDATE DASHBOARD (called after every CRUD)
   ================================================================ */

/**
 * Re-renders summary cards + charts with current data + active filters.
 */
function updateDashboard() {
  populateFilterDropdowns();
  const filtered = getFilteredStudents();
  renderCards(filtered);
  if (typeof renderAllCharts === 'function') renderAllCharts(filtered);
}

/* ================================================================
   19. BOOT
   ================================================================ */
(function boot() {
  populateFilterDropdowns();
  renderTable();
  // charts.js will call updateDashboard() once it is loaded
})();

/* Expose globals needed by charts.js and inline event handlers */
window.startEdit      = startEdit;
window.deleteStudent  = deleteStudent;
window.goPage         = goPage;
window.getFilteredStudents = getFilteredStudents;
window.updateDashboard     = updateDashboard;
window.ageBucket           = ageBucket;
window.DEGREES             = DEGREES;
window.CITIES              = CITIES;
window.PALETTE             = PALETTE;
