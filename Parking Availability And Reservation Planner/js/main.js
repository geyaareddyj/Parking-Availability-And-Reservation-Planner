/**
 * ============================================================
 * ParkSmart · js/main.js
 * APPLICATION ENTRY POINT
 *
 * Responsibilities:
 *   - Initialize DB (seed localStorage on first run)
 *   - Restore session on page refresh
 *   - Wire login / logout UI
 *   - Bind sidebar navigation
 *   - Dispatch renders to admin.js / user.js based on role
 *   - Global event listeners (modals, theme, filter)
 *
 * SCRIPT LOAD ORDER (index.html):
 *   data.js → auth.js → ui.js → admin.js → user.js → main.js
 * ============================================================
 */

'use strict';

/* ─────────────────────────────────────────────────────────────
   BOOTSTRAP
───────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {

  // 1. Init database (seed localStorage if first run)
  DB.init();

  // 2. Apply saved theme immediately (before any paint)
  UI_Theme.init();

  // 3. Try restoring session from localStorage
  const wasLoggedIn = Auth.init();
  if (wasLoggedIn) {
    // Re-enter the app without transition (page refresh scenario)
    _showApp();
    const savedPage = sessionStorage.getItem('ps_current_page') || _defaultPage();
    UI_Nav.navigate(savedPage);
  }

  // ── BIND LOGIN FORM ───────────────────────────────────────
  const loginBtn      = $('#loginBtn');
  const usernameInput = $('#loginUsername');
  const passwordInput = $('#loginPassword');

  loginBtn?.addEventListener('click', _handleLogin);
  usernameInput?.addEventListener('keydown', e => e.key === 'Enter' && _handleLogin());
  passwordInput?.addEventListener('keydown', e => e.key === 'Enter' && _handleLogin());

  // Update demo hint when role tab changes
  $$('.role-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      $$('.role-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      _updateDemoHint(tab.dataset.role);
    });
  });

  // ── THEME TOGGLE ──────────────────────────────────────────
  $$('.theme-toggle-btn').forEach(btn =>
    btn.addEventListener('click', UI_Theme.toggle.bind(UI_Theme)));

  // ── LOGOUT ───────────────────────────────────────────────
  $('#logoutBtn')?.addEventListener('click', _handleLogout);

  // ── MODAL CLOSE ON OVERLAY CLICK ─────────────────────────
  $$('.modal-overlay').forEach(ov =>
    ov.addEventListener('click', e => { if (e.target === ov) closeAllModals(); }));

  // ── NAVIGATION EVENT (dispatched by ui.js UI_Nav.navigate) ──
  document.addEventListener('ps:navigate', e => {
    _onNavigate(e.detail.pageId);
  });

  // ── USER DASHBOARD: location select ──────────────────────
  // (Re-bound after login since the element is always in DOM)
  $('#locationSelect')?.addEventListener('change', e => {
    if (Auth.isUser()) {
      User_onLocationChange(e.target.value);
    }
    // Admin has no location select (locked to their location)
  });

  // ── SLOT FILTER ───────────────────────────────────────────
  $('#slotFilter')?.addEventListener('change', () => {
    if (Auth.isAdmin()) Admin_applyFilter();
    else User_applyFilter();
  });

  // ── TRIP PLANNER init ─────────────────────────────────────
  User_initTripPlanner();

  // ── ADMIN SAVE PRICING ────────────────────────────────────
  $('#saveCostsBtn')?.addEventListener('click', Admin_savePricing);

  // ── DEFAULT DEMO HINT ─────────────────────────────────────
  _updateDemoHint('user');
});

/* ─────────────────────────────────────────────────────────────
   LOGIN HANDLER
───────────────────────────────────────────────────────────── */
function _handleLogin() {
  const username = $('#loginUsername').value.trim();
  const password = $('#loginPassword').value.trim();
  const role     = _getSelectedRole();      // 'user' or 'admin'
  const errEl    = $('#loginError');
  errEl.textContent = '';

  const result = Auth.login(username, password, role);
  if (!result.ok) {
    errEl.textContent = result.error;
    shakeEl('loginCard');
    return;
  }

  // Transition into app
  pageTransition(() => {
    $('#loginPage').classList.add('hidden');
    _showApp();
    UI_Nav.navigate(_defaultPage());
  });
}

/* ─────────────────────────────────────────────────────────────
   LOGOUT HANDLER
───────────────────────────────────────────────────────────── */
function _handleLogout() {
  pageTransition(() => {
    Auth.logout();
    sessionStorage.removeItem('ps_current_page');

    // Reset UI
    $('#appShell').classList.remove('visible');
    $('#appShell').classList.add('hidden');
    $('#loginPage').classList.remove('hidden');
    $('#loginUsername').value = '';
    $('#loginPassword').value = '';
    $('#loginError').textContent = '';

    // Reset role tabs to 'user'
    $$('.role-tab').forEach(t => t.classList.remove('active'));
    $$('.role-tab')[0]?.classList.add('active');
    _updateDemoHint('user');
  });
}

/* ─────────────────────────────────────────────────────────────
   SHOW APP after login / session restore
───────────────────────────────────────────────────────────── */
function _showApp() {
  $('#loginPage').classList.add('hidden');
  $('#appShell').classList.remove('hidden');
  $('#appShell').classList.add('visible');

  const user    = Auth.getUser();
  const isAdmin = Auth.isAdmin();

  // Update nav pill
  $('#navUserPill').innerHTML = `
    <span class="dot ${isAdmin ? 'dot-admin' : 'dot-user'}"></span>
    ${user.displayName} · ${isAdmin ? `Admin <span class="pill-loc">(${Auth.getAdminLocation()?.name || ''})</span>` : 'User'}`;

  // Apply role-based sidebar visibility
  UI_Nav.applyRoleVisibility(user.role);

  // Bind sidebar click handlers
  UI_Nav.bindSidebar();
}

/* ─────────────────────────────────────────────────────────────
   NAVIGATION DISPATCHER
   Called by the ps:navigate event. Routes render calls to
   the correct module (admin.js or user.js) based on role.
───────────────────────────────────────────────────────────── */
function _onNavigate(pageId) {
  const isAdmin = Auth.isAdmin();

  switch (pageId) {
    case 'dashboard':
      if (isAdmin) Admin_renderDashboard();
      else         User_renderDashboard();
      break;

    case 'trip-planner':
      // Only users see the trip planner (admin has no trip planner nav item)
      User_updateTripResult();
      break;

    case 'my-reservations':
      // GUARD: only users have this page
      if (Auth.isUser()) User_renderMyReservations();
      break;

    case 'admin-reservations':
      // GUARD: only admins, enforced by UI_Nav.navigate → canAccess
      if (isAdmin) Admin_renderReservations();
      break;

    case 'admin-analytics':
      if (isAdmin) Admin_renderAnalytics();
      break;

    case 'admin-settings':
      if (isAdmin) Admin_renderPricingSettings();
      break;

    default:
      console.warn(`[main] Unknown page: ${pageId}`);
  }
}

/* ─────────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────────── */

/** Get the currently selected role tab value */
function _getSelectedRole() {
  return $('.role-tab.active')?.dataset.role || 'user';
}

/** Default landing page after login */
function _defaultPage() {
  return Auth.isAdmin() ? 'dashboard' : 'dashboard';
}

/** Update demo credentials hint under login form */
function _updateDemoHint(role) {
  const hint = $('#loginDemoHint');
  if (!hint) return;
  if (role === 'admin') {
    hint.innerHTML = `
      Demo admins (each controls one location):<br>
      <code>admin_dmart</code> / <code>dmart123</code> &nbsp;·&nbsp;
      <code>admin_forum</code> / <code>forum123</code><br>
      <code>admin_reliance</code> / <code>reliance123</code> &nbsp;·&nbsp;
      <code>admin_mcd</code> / <code>mcd123</code><br>
      <code>admin_kfc</code> / <code>kfc123</code> &nbsp;·&nbsp;
      <code>admin_metro</code> / <code>metro123</code>`;
  } else {
    hint.innerHTML = `Demo users: <code>user1</code> / <code>user123</code> &nbsp;·&nbsp; <code>user2</code> / <code>user456</code>`;
  }
}
