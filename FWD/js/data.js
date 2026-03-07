/**
 * ============================================================
 * ParkSmart · js/data.js
 * DATA LAYER — canonical data structures, LocalStorage I/O,
 * seed helpers. All other modules import from here.
 *
 * REPLACE GUIDE:
 *   - Replace SEED_* constants with your real API endpoints.
 *   - Replace localStorage calls with fetch() to your backend.
 * ============================================================
 */

'use strict';

/* ─────────────────────────────────────────────────────────────
   STORAGE KEYS  (all localStorage entries live under these)
───────────────────────────────────────────────────────────── */
const SK = {
  USERS:        'ps_users',
  ADMINS:       'ps_admins',
  LOCATIONS:    'ps_locations',
  RESERVATIONS: 'ps_reservations',
  THEME:        'ps_theme',
  SESSION:      'ps_session',    // currently logged-in user
};

/* ─────────────────────────────────────────────────────────────
   SEED DATA
   These seed the localStorage on first run.
   TO REPLACE: swap these objects with API-fetched data.
───────────────────────────────────────────────────────────── */

/**
 * USERS — regular customers
 * Structure: { id, username, password, displayName, role:'user' }
 */
const SEED_USERS = [
  { id: 'U001', username: 'user1', password: 'user123', displayName: 'Ravi Kumar',    role: 'user' },
  { id: 'U002', username: 'user2', password: 'user456', displayName: 'Priya Singh',   role: 'user' },
  { id: 'U003', username: 'user3', password: 'user789', displayName: 'Arjun Mehta',   role: 'user' },
];

/**
 * ADMINS — one per location, strictly scoped
 * Structure: { id, username, password, displayName, role:'admin', locationId }
 *
 * IMPORTANT: Each admin's `locationId` determines which location
 * they can edit. This is validated on EVERY admin action (see auth.js).
 */
const SEED_ADMINS = [
  { id: 'A001', username: 'admin_dmart',     password: 'dmart123',     displayName: 'D-Mart Admin',      role: 'admin', locationId: 'dmart'     },
  { id: 'A002', username: 'admin_reliance',  password: 'reliance123',  displayName: 'Reliance Admin',    role: 'admin', locationId: 'reliance'  },
  { id: 'A003', username: 'admin_forum',     password: 'forum123',     displayName: 'Forum Mall Admin',  role: 'admin', locationId: 'forum'     },
  { id: 'A004', username: 'admin_mcd',       password: 'mcd123',       displayName: 'McDonalds Admin',   role: 'admin', locationId: 'mcdonalds' },
  { id: 'A005', username: 'admin_kfc',       password: 'kfc123',       displayName: 'KFC Admin',         role: 'admin', locationId: 'kfc'       },
  { id: 'A006', username: 'admin_metro',     password: 'metro123',     displayName: 'Metro Admin',       role: 'admin', locationId: 'metro'     },
];

/**
 * LOCATIONS — master list with pricing and floor count
 * Structure: { id, name, floors, pricing: {rate2w, rate4w, taxPct}, adminId }
 *
 * pricing is mutable by the location's own admin only (see admin.js).
 */
const SEED_LOCATIONS = [
  { id: 'dmart',     name: 'D-Mart',        floors: 2, adminId: 'A001', pricing: { rate2w: 20, rate4w: 40,  taxPct: 18 } },
  { id: 'reliance',  name: 'Reliance',      floors: 2, adminId: 'A002', pricing: { rate2w: 25, rate4w: 50,  taxPct: 18 } },
  { id: 'forum',     name: 'Forum Mall',    floors: 3, adminId: 'A003', pricing: { rate2w: 30, rate4w: 60,  taxPct: 18 } },
  { id: 'mcdonalds', name: 'McDonalds',     floors: 1, adminId: 'A004', pricing: { rate2w: 15, rate4w: 30,  taxPct: 18 } },
  { id: 'kfc',       name: 'KFC',           floors: 1, adminId: 'A005', pricing: { rate2w: 15, rate4w: 30,  taxPct: 18 } },
  { id: 'metro',     name: 'Metro Station', floors: 3, adminId: 'A006', pricing: { rate2w: 10, rate4w: 25,  taxPct: 18 } },
];

/* ─────────────────────────────────────────────────────────────
   SLOT GENERATION
   Deterministic seed so the same slots appear on every fresh
   load before any changes are made.
───────────────────────────────────────────────────────────── */

/**
 * Generate a flat array of slot objects for a location+floor.
 * @param {string} locId  - e.g. 'dmart'
 * @param {number} floor  - 1-based
 * @returns {object[]}
 */
function _generateSlots(locId, floor) {
  const rows     = ['A','B','C','D'];
  const cols     = [1,2,3,4,5,6];
  const vtypes   = ['2w','4w'];
  // Weighted statuses: more available than occupied/reserved
  const statuses = ['available','available','available','occupied','reserved'];
  const slots    = [];

  vtypes.forEach(vtype => {
    rows.forEach(row => {
      cols.forEach(col => {
        const id   = `${row}-0${col}`;
        const key  = `${locId}_${floor}_${vtype}_${id}`;
        // Stable hash so same slot always gets the same seeded status
        const seed = key.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
        const status = statuses[seed % statuses.length];
        const h = 8 + (seed % 10), m = (seed * 7) % 60;
        const timeStr = `${h % 12 || 12}:${String(m).padStart(2,'0')} ${h >= 12 ? 'PM' : 'AM'}`;

        slots.push({
          key,           // unique composite key
          id,            // display ID e.g. "A-01"
          locId,         // which location
          floor,         // which floor number
          vtype,         // '2w' | '4w'
          status,        // 'available' | 'occupied' | 'reserved'
          vehicle:       status !== 'available' ? `VH-${(seed * 137) % 9999}`.slice(-6) : '',
          entryTime:     status !== 'available' ? timeStr : '',
          reservedName:  status === 'reserved'  ? SEED_USERS[seed % SEED_USERS.length].displayName : '',
          reservedUserId:status === 'reserved'  ? SEED_USERS[seed % SEED_USERS.length].id : '',
          reservationId: status === 'reserved'  ? `RES-${(seed * 73) % 9000 + 1000}` : '',
        });
      });
    });
  });
  return slots;
}

/* ─────────────────────────────────────────────────────────────
   PUBLIC DATA API
   All reads/writes go through these functions.
   Swap the body of each function to call your backend API.
───────────────────────────────────────────────────────────── */

/* ─────────────────────────────────────────────────────────────
   DATA VERSION
   Bump this string whenever SEED_* data changes (new location,
   new admin, etc.). DB.init() will wipe and re-seed automatically.
───────────────────────────────────────────────────────────── */
const DATA_VERSION = 'v1.3-metro';

const DB = {

  /* ── INIT ── */
  /**
   * Seed localStorage on first run (or after a version bump).
   * Called once from main.js on DOMContentLoaded.
   */
  init() {
    // If stored version doesn't match, wipe everything and re-seed.
    // This ensures new locations/admins appear without manual localStorage clear.
    if (localStorage.getItem('ps_data_version') !== DATA_VERSION) {
      localStorage.removeItem(SK.USERS);
      localStorage.removeItem(SK.ADMINS);
      localStorage.removeItem(SK.LOCATIONS);
      localStorage.removeItem(SK.RESERVATIONS);
      localStorage.removeItem(SK.SESSION);
      localStorage.setItem('ps_data_version', DATA_VERSION);
    }

    // Seed users if not already stored
    if (!localStorage.getItem(SK.USERS)) {
      localStorage.setItem(SK.USERS, JSON.stringify(SEED_USERS));
    }
    if (!localStorage.getItem(SK.ADMINS)) {
      localStorage.setItem(SK.ADMINS, JSON.stringify(SEED_ADMINS));
    }

    // Seed locations with generated slots
    if (!localStorage.getItem(SK.LOCATIONS)) {
      const locations = SEED_LOCATIONS.map(loc => {
        const slots = [];
        for (let f = 1; f <= loc.floors; f++) {
          slots.push(..._generateSlots(loc.id, f));
        }
        return { ...loc, slots };
      });
      localStorage.setItem(SK.LOCATIONS, JSON.stringify(locations));
    }

    if (!localStorage.getItem(SK.RESERVATIONS)) {
      // Seed demo reservations from pre-reserved slots
      const allSlots = DB.getAllSlots();
      const reserved = allSlots
        .filter(s => s.status === 'reserved' && s.reservationId)
        .slice(0, 8);

      const reservations = reserved.map(s => ({
        id:          s.reservationId,
        slotKey:     s.key,
        locId:       s.locId,
        floor:       s.floor,
        vtype:       s.vtype,
        slotId:      s.id,
        vehicle:     s.vehicle,
        userName:    s.reservedName,
        userId:      s.reservedUserId,
        entryTime:   s.entryTime,
        amount:      DB.calcAmount(s.locId, s.vtype, 2),  // 2 hrs default
        payMethod:   'upi',
        bookedAt:    new Date(Date.now() - Math.random() * 86400000 * 3).toISOString(),
      }));
      localStorage.setItem(SK.RESERVATIONS, JSON.stringify(reservations));
    }
  },

  /* ── LOCATIONS ── */

  /** Return all locations array */
  getLocations() {
    return JSON.parse(localStorage.getItem(SK.LOCATIONS)) || [];
  },

  /** Return a single location object by id */
  getLocation(locId) {
    return DB.getLocations().find(l => l.id === locId) || null;
  },

  /**
   * Persist a single location's updates.
   * @param {object} updatedLoc - full location object
   */
  saveLocation(updatedLoc) {
    const locs = DB.getLocations().map(l => l.id === updatedLoc.id ? updatedLoc : l);
    localStorage.setItem(SK.LOCATIONS, JSON.stringify(locs));
  },

  /**
   * Update pricing for a location.
   * SECURITY: caller (admin.js) must verify admin.locationId === locId first.
   * @param {string} locId
   * @param {{ rate2w, rate4w, taxPct }} pricing
   */
  savePricing(locId, pricing) {
    const loc = DB.getLocation(locId);
    if (!loc) return;
    loc.pricing = { ...loc.pricing, ...pricing };
    DB.saveLocation(loc);
  },

  /* ── SLOTS ── */

  /** Return all slots across all locations (flat array) */
  getAllSlots() {
    return DB.getLocations().flatMap(l => l.slots || []);
  },

  /**
   * Return slots for a specific location + floor + vtype.
   * Used by the parking grid renderer.
   * @param {string} locId
   * @param {number} floor
   * @param {string} vtype - '2w' | '4w' | 'all'
   */
  getSlots(locId, floor, vtype = 'all') {
    const loc = DB.getLocation(locId);
    if (!loc) return [];
    return (loc.slots || []).filter(s =>
      s.floor === floor && (vtype === 'all' || s.vtype === vtype)
    );
  },

  /**
   * Find a single slot by its composite key.
   * @param {string} key - e.g. "dmart_1_2w_A-01"
   */
  getSlot(key) {
    return DB.getAllSlots().find(s => s.key === key) || null;
  },

  /**
   * Update a single slot and persist.
   * SECURITY: admin.js must verify slot.locId === admin.locationId before calling.
   * @param {string} key
   * @param {object} patch - fields to merge
   */
  updateSlot(key, patch) {
    const locs = DB.getLocations();
    locs.forEach(loc => {
      const idx = loc.slots.findIndex(s => s.key === key);
      if (idx !== -1) {
        loc.slots[idx] = { ...loc.slots[idx], ...patch };
      }
    });
    localStorage.setItem(SK.LOCATIONS, JSON.stringify(locs));
  },

  /* ── RESERVATIONS ── */

  /** Return all reservations */
  getReservations() {
    return JSON.parse(localStorage.getItem(SK.RESERVATIONS)) || [];
  },

  /**
   * Return reservations filtered by location.
   * Used by admins — they only see their own location's reservations.
   * @param {string} locId
   */
  getReservationsByLocation(locId) {
    return DB.getReservations().filter(r => r.locId === locId);
  },

  /**
   * Return reservations for a specific user.
   * Users only see their own bookings — never others'.
   * @param {string} userId
   */
  getReservationsByUser(userId) {
    return DB.getReservations().filter(r => r.userId === userId);
  },

  /**
   * Add a new reservation record.
   * @param {object} reservation
   */
  addReservation(reservation) {
    const all = DB.getReservations();
    all.push(reservation);
    localStorage.setItem(SK.RESERVATIONS, JSON.stringify(all));
  },

  /**
   * Remove a reservation by ID and free its slot.
   * @param {string} resId
   */
  cancelReservation(resId) {
    const all  = DB.getReservations();
    const res  = all.find(r => r.id === resId);
    if (!res) return false;

    // Free the associated slot
    DB.updateSlot(res.slotKey, {
      status: 'available', vehicle: '', entryTime: '',
      reservedName: '', reservedUserId: '', reservationId: '',
    });

    // Remove from reservations list
    const updated = all.filter(r => r.id !== resId);
    localStorage.setItem(SK.RESERVATIONS, JSON.stringify(updated));
    return true;
  },

  /* ── USERS / AUTH ── */

  /** Return all user accounts */
  getUsers() {
    return JSON.parse(localStorage.getItem(SK.USERS)) || [];
  },

  /** Return all admin accounts */
  getAdmins() {
    return JSON.parse(localStorage.getItem(SK.ADMINS)) || [];
  },

  /**
   * Look up a user credential. Returns user object or null.
   * @param {string} username
   * @param {string} password
   * @param {'user'|'admin'} role
   */
  authenticate(username, password, role) {
    const list = role === 'admin' ? DB.getAdmins() : DB.getUsers();
    const account = list.find(u => u.username === username && u.password === password && u.role === role);
    return account || null;
  },

  /* ── SESSION ── */

  /**
   * Persist session so page refresh keeps user logged in.
   * NOTE: For production, use HttpOnly cookies or JWT; not localStorage.
   */
  saveSession(user) {
    // Store only safe fields — never store raw password in session
    const safe = { id: user.id, username: user.username, displayName: user.displayName,
                   role: user.role, locationId: user.locationId || null };
    localStorage.setItem(SK.SESSION, JSON.stringify(safe));
  },

  clearSession() {
    localStorage.removeItem(SK.SESSION);
  },

  getSession() {
    try { return JSON.parse(localStorage.getItem(SK.SESSION)); } catch { return null; }
  },

  /* ── HELPERS ── */

  /**
   * Calculate the total reservation amount.
   * REVENUE LOGIC:
   *   base = rate * hours
   *   tax  = base * (taxPct / 100)
   *   total = base + tax
   *
   * @param {string} locId
   * @param {string} vtype - '2w' | '4w'
   * @param {number} hours
   * @returns {{ rate, base, tax, total }}
   */
  calcAmount(locId, vtype, hours = 1) {
    const loc  = DB.getLocation(locId);
    if (!loc) return { rate: 0, base: 0, tax: 0, total: 0 };
    const rate = vtype === '2w' ? loc.pricing.rate2w : loc.pricing.rate4w;
    const base = +(rate * hours).toFixed(2);
    const tax  = +(base * (loc.pricing.taxPct / 100)).toFixed(2);
    return { rate, base, tax, total: +(base + tax).toFixed(2) };
  },

  /**
   * Compute total revenue and booking count for a location.
   * Only used by admins for their own location's analytics.
   * @param {string} locId
   * @returns {{ total, count, byHour }}
   */
  getRevenueSummary(locId) {
    const reservations = DB.getReservationsByLocation(locId);
    const total  = reservations.reduce((sum, r) => sum + (r.amount || 0), 0);
    const count  = reservations.length;

    // Peak hour detection: count bookings per hour-of-day
    const byHour = Array(24).fill(0);
    reservations.forEach(r => {
      const h = new Date(r.bookedAt).getHours();
      byHour[h]++;
    });

    return { total: +total.toFixed(2), count, byHour };
  },

  /** Generate a unique reservation ID */
  generateResId() {
    return `RES-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random()*1000)}`;
  },
};
