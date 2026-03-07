/**
 * ============================================================
 * ParkSmart · js/ui.js
 * SHARED UI UTILITIES
 *
 * Responsibilities:
 *   - Dark/light theme toggle (CSS variables, persisted)
 *   - Toast notifications
 *   - Modal open/close helpers
 *   - Page transition animation
 *   - Sidebar navigation with active state
 *   - Utility DOM helpers ($, setText, shakeEl)
 *
 * NOTHING in this file reads or writes business data.
 * It only touches DOM and localStorage for theme preference.
 * ============================================================
 */

'use strict';

/* ─────────────────────────────────────────────────────────────
   DOM HELPERS
───────────────────────────────────────────────────────────── */

/** Shorthand querySelector */
const $ = sel => document.querySelector(sel);
const $$ = sel => document.querySelectorAll(sel);

/** Set textContent safely */
const setText = (sel, val) => {
  const el = typeof sel === 'string' ? $(sel) : sel;
  if (el) el.textContent = val;
};

/** Set innerHTML safely */
const setHTML = (sel, html) => {
  const el = typeof sel === 'string' ? $(sel) : sel;
  if (el) el.innerHTML = html;
};

/**
 * Shake an element to signal a validation error.
 * @param {string|HTMLElement} target - ID string or element
 */
function shakeEl(target) {
  const el = typeof target === 'string' ? document.getElementById(target) : target;
  if (!el) return;
  el.style.borderColor = 'var(--red)';
  el.style.animation   = 'none';
  el.offsetHeight; // force reflow
  el.style.animation   = 'shake 0.35s ease';
  setTimeout(() => { el.style.borderColor = ''; el.style.animation = ''; }, 600);
}

/* ─────────────────────────────────────────────────────────────
   THEME
───────────────────────────────────────────────────────────── */
const UI_Theme = {
  current: localStorage.getItem('ps_theme') || 'light',

  init() {
    UI_Theme.apply(UI_Theme.current);
  },

  toggle() {
    UI_Theme.current = UI_Theme.current === 'light' ? 'dark' : 'light';
    UI_Theme.apply(UI_Theme.current);
    localStorage.setItem('ps_theme', UI_Theme.current);
  },

  apply(theme) {
    document.documentElement.dataset.theme = theme;
    $$('.theme-toggle-btn').forEach(btn => {
      btn.textContent = theme === 'dark' ? '☀️' : '🌙';
      btn.title       = theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode';
    });
  },
};

/* ─────────────────────────────────────────────────────────────
   TOAST NOTIFICATIONS
───────────────────────────────────────────────────────────── */
let _toastTimer = null;

/**
 * Show a brief toast message.
 * @param {string} msg
 * @param {'default'|'success'|'error'|'warning'} type
 */
function toast(msg, type = 'default') {
  const el = $('#toast');
  if (!el) return;
  el.textContent = msg;
  el.className   = '';          // reset classes
  if (type !== 'default') el.classList.add(type);
  el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), 3500);
}

/* ─────────────────────────────────────────────────────────────
   MODALS
───────────────────────────────────────────────────────────── */

function openModal(id) {
  $(`#${id}`)?.classList.add('open');
}

function closeModal(id) {
  $(`#${id}`)?.classList.remove('open');
}

function closeAllModals() {
  $$('.modal-overlay').forEach(m => m.classList.remove('open'));
}

/* ─────────────────────────────────────────────────────────────
   PAGE TRANSITION
───────────────────────────────────────────────────────────── */

/**
 * Animate a wipe transition and call cb() at the midpoint.
 * @param {Function} cb - runs while screen is covered
 */
function pageTransition(cb) {
  const ov = $('#pageTransition');
  if (!ov) { cb(); return; }
  ov.style.transform = 'translateY(0)';
  setTimeout(() => {
    cb();
    ov.classList.add('slide-up');
    ov.addEventListener('animationend', () => {
      ov.style.transform = 'translateY(100%)';
      ov.classList.remove('slide-up');
    }, { once: true });
  }, 280);
}

/* ─────────────────────────────────────────────────────────────
   SIDEBAR NAVIGATION
   Manages the active state of sidebar nav-items and
   switches page sections. Enforces route guards.
───────────────────────────────────────────────────────────── */
const UI_Nav = {

  /**
   * Navigate to a page section.
   * Route guard is checked BEFORE showing the section.
   * @param {string} pageId - matches data-page attribute and section #page-<id>
   * @param {string} [locId] - current location for scope-checking admin pages
   */
  navigate(pageId, locId) {
    // ── ROUTE GUARD ──────────────────────────────────────────
    // Even if a user manually calls navigateTo() or edits HTML,
    // canAccess() checks their role and location scope.
    if (!Auth.canAccess(`page-${pageId}`, locId)) {
      toast('🚫 Access denied.', 'error');
      console.warn(`[Nav] Access denied to page "${pageId}" for user role "${Auth.getUser()?.role}"`);
      return;
    }

    // Hide all sections
    $$('.page-section').forEach(p => {
      p.classList.add('hidden');
      p.classList.remove('visible');
    });

    // Show target section
    const section = $(`#page-${pageId}`);
    if (section) {
      section.classList.remove('hidden');
      section.classList.add('visible');
    }

    // Update sidebar active state
    $$('.nav-item').forEach(n => n.classList.remove('active'));
    $(`[data-page="${pageId}"]`)?.classList.add('active');

    // Persist current page in sessionStorage for refresh persistence
    sessionStorage.setItem('ps_current_page', pageId);

    // Trigger page-specific render (delegated to main.js via event)
    document.dispatchEvent(new CustomEvent('ps:navigate', { detail: { pageId, locId } }));
  },

  /**
   * Setup sidebar click handlers.
   * Called once after login.
   */
  bindSidebar() {
    $$('.nav-item').forEach(item => {
      item.addEventListener('click', () => {
        const pageId = item.dataset.page;
        if (pageId) UI_Nav.navigate(pageId);
      });
    });
  },

  /**
   * Show / hide sidebar groups based on role.
   * @param {'user'|'admin'} role
   */
  applyRoleVisibility(role) {
    $$('[data-admin-only]').forEach(el => el.classList.toggle('hidden', role !== 'admin'));
    $$('[data-user-only]').forEach(el  => el.classList.toggle('hidden', role !== 'user'));
  },
};

/* ─────────────────────────────────────────────────────────────
   TIME UTILITIES
───────────────────────────────────────────────────────────── */

/** Current time as "H:MM AM/PM" */
function nowTime() {
  const d = new Date(), h = d.getHours(), m = d.getMinutes();
  return `${h % 12 || 12}:${String(m).padStart(2,'0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

/** Convert "HH:MM" time input string to "H:MM AM/PM" */
function fmtTime(t) {
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2,'0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

/** Today's date as YYYY-MM-DD */
function todayISO() {
  return new Date().toISOString().split('T')[0];
}

/** Capitalize first letter */
const cap = str => str.charAt(0).toUpperCase() + str.slice(1);

/* ─────────────────────────────────────────────────────────────
   EXPOSE GLOBALS
   (Inline onclick="" handlers in HTML reach these)
───────────────────────────────────────────────────────────── */
window.closeModal    = closeModal;
window.closeAllModals = closeAllModals;
