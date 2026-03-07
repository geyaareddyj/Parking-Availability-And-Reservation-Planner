/**
 * ============================================================
 * ParkSmart · js/auth.js
 * AUTHENTICATION & ROUTE GUARDS
 *
 * Responsibilities:
 *   - Login / logout flow
 *   - Session persistence (localStorage)
 *   - Route guard: block any page access that doesn't match
 *     the logged-in user's role AND location scope
 *   - Location-scope guard: admin cannot access other locations
 *
 * REPLACE GUIDE:
 *   - Replace DB.authenticate() calls with fetch() to /api/login
 *   - Replace session storage with server-side sessions / JWT
 * ============================================================
 */

'use strict';

/* ─────────────────────────────────────────────────────────────
   ROUTE PERMISSION MAP
   Defines which roles can access which page IDs.
   'admin' pages require role==='admin' AND correct locationId.
   'user'  pages require role==='user'.
   'both'  pages are accessible to any authenticated user.
───────────────────────────────────────────────────────────── */
const ROUTE_PERMISSIONS = {
  // User pages
  'page-dashboard':        ['user', 'admin'],   // shared parking grid (role-filtered content)
  'page-trip-planner':     ['user'],
  'page-my-reservations':  ['user'],
  // Admin pages — also require location scope check
  'page-admin-reservations': ['admin'],
  'page-admin-analytics':    ['admin'],
  'page-admin-settings':     ['admin'],
};

const Auth = {

  /* ── current session reference (populated after login) ── */
  currentUser: null,

  /* ─────────────────────────────────────────
     INIT — restore session on page load
  ───────────────────────────────────────── */
  init() {
    const saved = DB.getSession();
    if (saved) {
      Auth.currentUser = saved;
      return true;   // was logged in
    }
    return false;
  },

  /* ─────────────────────────────────────────
     LOGIN
     1. Validate credentials against DB
     2. Persist safe session
     3. Redirect to correct dashboard
  ───────────────────────────────────────── */
  /**
   * @param {string} username
   * @param {string} password
   * @param {'user'|'admin'} role  - selected by the role tab on login screen
   * @returns {{ ok: boolean, error?: string }}
   */
  login(username, password, role) {
    if (!username || !password) {
      return { ok: false, error: 'Please enter both username and password.' };
    }

    // Authenticate against stored credentials
    const account = DB.authenticate(username, password, role);
    if (!account) {
      return { ok: false, error: '❌ Invalid username or password.' };
    }

    // Persist session (no password stored)
    Auth.currentUser = {
      id:          account.id,
      username:    account.username,
      displayName: account.displayName,
      role:        account.role,
      locationId:  account.locationId || null,   // null for regular users
    };
    DB.saveSession(Auth.currentUser);

    return { ok: true };
  },

  /* ─────────────────────────────────────────
     LOGOUT
  ───────────────────────────────────────── */
  logout() {
    Auth.currentUser = null;
    DB.clearSession();
  },

  /* ─────────────────────────────────────────
     ROUTE GUARD
     Call this before rendering ANY page section.
     Returns true if allowed, false if blocked.

     HOW IT WORKS:
       1. Must be authenticated at all.
       2. Role must be in the page's allowed roles list.
       3. If page is admin-only, admin's locationId must match
          the currently viewed location (prevents cross-location access).
  ───────────────────────────────────────── */
  /**
   * @param {string} pageId - e.g. 'page-admin-analytics'
   * @param {string} [locId] - current location being viewed (for admin scope check)
   * @returns {boolean}
   */
  canAccess(pageId, locId = null) {
    const user = Auth.currentUser;

    // 1. Must be logged in
    if (!user) return false;

    // 2. Check role permission
    const allowed = ROUTE_PERMISSIONS[pageId];
    if (!allowed) return false;               // unknown page — deny by default
    if (!allowed.includes(user.role)) return false;

    // 3. Location scope check for admin pages
    //    Admin can ONLY see their assigned location's data
    if (user.role === 'admin' && locId) {
      if (user.locationId !== locId) {
        console.warn(`[Auth] Admin ${user.id} tried to access location "${locId}" but is scoped to "${user.locationId}"`);
        return false;
      }
    }

    return true;
  },

  /* ─────────────────────────────────────────
     SLOT GUARD
     Before any admin slot mutation, verify:
       - User is admin
       - Slot belongs to admin's location
  ───────────────────────────────────────── */
  /**
   * @param {string} slotKey - composite key e.g. "dmart_1_2w_A-01"
   * @returns {boolean}
   */
  canEditSlot(slotKey) {
    const user = Auth.currentUser;
    if (!user || user.role !== 'admin') return false;

    // Extract locId from the slot key  (format: "locId_floor_vtype_id")
    const locId = slotKey.split('_')[0];
    if (locId !== user.locationId) {
      console.warn(`[Auth] Blocked: Admin "${user.id}" tried to edit slot in "${locId}"`);
      return false;
    }
    return true;
  },

  /* ─────────────────────────────────────────
     PRICING GUARD
     Only the admin assigned to a location can change its pricing.
  ───────────────────────────────────────── */
  /**
   * @param {string} locId
   * @returns {boolean}
   */
  canEditPricing(locId) {
    const user = Auth.currentUser;
    if (!user || user.role !== 'admin') return false;
    if (user.locationId !== locId) {
      console.warn(`[Auth] Blocked: Admin "${user.id}" tried to edit pricing for "${locId}"`);
      return false;
    }
    return true;
  },

  /* ─────────────────────────────────────────
     HELPERS
  ───────────────────────────────────────── */
  isLoggedIn()  { return !!Auth.currentUser; },
  isAdmin()     { return Auth.currentUser?.role === 'admin'; },
  isUser()      { return Auth.currentUser?.role === 'user';  },
  getUser()     { return Auth.currentUser; },

  /**
   * For admin: return the location they're assigned to manage.
   * For user: returns null.
   */
  getAdminLocation() {
    if (!Auth.isAdmin()) return null;
    return DB.getLocation(Auth.currentUser.locationId);
  },
};
