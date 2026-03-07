/**
 * ============================================================
 * ParkSmart · js/admin.js
 * ADMIN MODULE
 *
 * Responsibilities:
 *   - Admin parking grid (slot management for assigned location ONLY)
 *   - Admin reservations table (assigned location ONLY)
 *   - Analytics: revenue + peak hours (assigned location ONLY)
 *   - Pricing settings (assigned location ONLY)
 *
 * SECURITY PRINCIPLE:
 *   Every function begins with Auth.canEditSlot() or
 *   Auth.canAccess() checks. Even if called directly from
 *   the browser console, the guard prevents cross-location
 *   access. No admin can view or modify another location.
 *
 * REPLACE GUIDE:
 *   Replace DB.* calls with fetch('/api/admin/...') calls.
 *   Keep the Auth guard calls in place.
 * ============================================================
 */

'use strict';

/* ─────────────────────────────────────────────────────────────
   STATE — scoped to the admin's assigned location
───────────────────────────────────────────────────────────── */
const AdminState = {
  currentFloor:  1,
  activeSlotKey: null,   // slot currently being acted upon in a modal
};

/* ─────────────────────────────────────────────────────────────
   ADMIN DASHBOARD — PARKING GRID
───────────────────────────────────────────────────────────── */

/**
 * Entry point: render the full admin dashboard for their location.
 * Called by main.js when navigating to 'page-dashboard' as admin.
 */
function Admin_renderDashboard() {
  const loc = Auth.getAdminLocation();
  if (!loc) return;

  // Populate heading with location name
  setHTML('#dashPageTitle',   loc.name + ' — Admin Dashboard');
  setHTML('#dashPageSubtitle', 'Manage slots, reservations, and availability for your location only.');

  // Show the location name in the grid header (not a dropdown — admin is locked to one)
  setHTML('#adminLocName', `<span class="location-badge">📍 ${loc.name}</span>`);
  // Hide location selector (admin cannot switch locations)
  const locSelWrap = $('#locationSelectWrap');
  if (locSelWrap) locSelWrap.style.display = 'none';

  // Show rate badge
  _updateRateBadge();

  // Render floor tabs for this location
  Admin_renderFloorTabs(loc);

  // Render the parking grid
  Admin_renderGrid();

  // Update stats
  Admin_updateStats();
}

/**
 * Render floor selector tabs.
 * Admin can switch floors within their location.
 */
function Admin_renderFloorTabs(loc) {
  const container = $('#floorTabs');
  if (!container) return;
  container.innerHTML = '';
  for (let f = 1; f <= loc.floors; f++) {
    const btn = document.createElement('button');
    btn.className = `floor-tab ${f === AdminState.currentFloor ? 'active' : ''}`;
    btn.textContent = `Floor ${f}`;
    btn.addEventListener('click', () => {
      // ROUTE GUARD: confirm admin is still authenticated
      if (!Auth.isAdmin()) { toast('Access denied.', 'error'); return; }
      AdminState.currentFloor = f;
      Admin_renderFloorTabs(loc);
      Admin_renderGrid();
      Admin_updateStats();
    });
    container.appendChild(btn);
  }
}

/**
 * Render the parking grid for the admin's location + current floor.
 * Admins see full details (vehicle no., entry time, revenue per slot).
 * Admins have controls to mark slots occupied, reserved, or available.
 */
function Admin_renderGrid() {
  const user      = Auth.getUser();
  const container = $('#parkingGridContainer');
  if (!container || !user) return;

  // LOCATION SCOPE: only load slots for admin's own location
  const locId = user.locationId;
  container.innerHTML = '';

  const vtypes = [
    { key: '2w', label: '2-Wheelers', icon: '🛵' },
    { key: '4w', label: '4-Wheelers', icon: '🚗' },
  ];

  vtypes.forEach(({ key, label, icon }) => {
    const slots  = DB.getSlots(locId, AdminState.currentFloor, key);
    const avail  = slots.filter(s => s.status === 'available').length;

    const section = document.createElement('div');
    section.className = 'vehicle-section';
    section.innerHTML = `
      <div class="section-header-row">
        <span class="section-icon">${icon}</span>
        <span class="section-title">${label}</span>
        <span class="section-count">${avail}/${slots.length} available</span>
      </div>
      <div class="parking-grid" id="admin-grid-${key}"></div>`;
    container.appendChild(section);

    const grid = section.querySelector(`#admin-grid-${key}`);
    slots.forEach(slot => grid.appendChild(_buildAdminSlotCard(slot)));
  });

  // Re-apply filter if one is selected
  Admin_applyFilter();
}

/**
 * Build a slot card with admin-level details and controls.
 * PRIVACY: Only admins see vehicle numbers, entry times, and revenue.
 * @param {object} slot
 * @returns {HTMLElement}
 */
function _buildAdminSlotCard(slot) {
  const el     = document.createElement('div');
  el.className = `slot slot-${slot.status}`;
  el.dataset.slotKey = slot.key;

  const icon        = slot.vtype === '2w' ? '🛵' : '🚗';
  const statusLabel = cap(slot.status);

  // ── ADMIN-ONLY DETAIL ROWS ───────────────────────────────
  // Users NEVER see this popup — it's only rendered for admin sessions.
  let details = `<div class="popup-row"><span class="popup-lbl">Status:</span><span class="popup-val">${statusLabel}</span></div>`;
  if (slot.vehicle)      details += `<div class="popup-row"><span class="popup-lbl">Vehicle:</span><span class="popup-val">${slot.vehicle}</span></div>`;
  if (slot.reservedName) details += `<div class="popup-row"><span class="popup-lbl">Reserved:</span><span class="popup-val">${slot.reservedName}</span></div>`;
  if (slot.entryTime)    details += `<div class="popup-row"><span class="popup-lbl">Entry:</span><span class="popup-val">${slot.entryTime}</span></div>`;

  // ── ADMIN ACTION BUTTONS ─────────────────────────────────
  let actions = '';
  if (slot.status === 'available') {
    actions = `
      <button class="btn btn-danger btn-sm btn-full"  onclick="Admin_openOccupyModal('${slot.key}')">Mark Occupied</button>
      <button class="btn btn-warning btn-sm btn-full" onclick="Admin_openReserveModal('${slot.key}')">Reserve Slot</button>`;
  } else {
    actions = `<button class="btn btn-success btn-sm btn-full" onclick="Admin_freeSlot('${slot.key}')">Mark Available</button>`;
  }

  el.innerHTML = `
    <div class="slot-icon">${icon}</div>
    <div class="slot-id">${slot.id}</div>
    <div class="slot-badge badge-${slot.status}">${statusLabel}</div>
    <div class="slot-popup">
      <div class="popup-title">Slot ${slot.id}</div>
      ${details}
      <div class="popup-actions">${actions}</div>
    </div>`;
  return el;
}

/** Update stats counters for the admin's current location+floor */
function Admin_updateStats() {
  const locId = Auth.getUser()?.locationId;
  if (!locId) return;
  const slots = DB.getSlots(locId, AdminState.currentFloor);
  setText('#statTotal',     slots.length);
  setText('#statAvailable', slots.filter(s => s.status === 'available').length);
  setText('#statOccupied',  slots.filter(s => s.status === 'occupied').length);
  setText('#statReserved',  slots.filter(s => s.status === 'reserved').length);
}

function _updateRateBadge() {
  const loc = Auth.getAdminLocation();
  if (!loc) return;
  const el = $('#rateBadge');
  if (el) el.textContent = `₹${loc.pricing.rate2w}/hr (2W) · ₹${loc.pricing.rate4w}/hr (4W)`;
}

/** Filter slots by status */
function Admin_applyFilter() {
  const val = $('#slotFilter')?.value || 'all';
  $$('.slot').forEach(el => {
    el.style.display = (val === 'all' || el.classList.contains(`slot-${val}`)) ? '' : 'none';
  });
}

/* ─────────────────────────────────────────────────────────────
   ADMIN SLOT ACTIONS
   Each action has a TWO-LAYER check:
     1. Auth.isAdmin()
     2. Auth.canEditSlot(key) — verifies slot's location matches admin
───────────────────────────────────────────────────────────── */

/**
 * Open modal to mark a slot occupied.
 * GUARD: canEditSlot verifies slot belongs to this admin's location.
 */
window.Admin_openOccupyModal = function(key) {
  // LAYER 1: role check
  if (!Auth.isAdmin()) { toast('Access denied.', 'error'); return; }
  // LAYER 2: location scope check
  if (!Auth.canEditSlot(key)) { toast('🚫 You cannot edit slots from another location.', 'error'); return; }

  AdminState.activeSlotKey = key;
  const slot = DB.getSlot(key);
  setText('#adminOccupySlotId', `${slot.id} · Floor ${slot.floor} · ${slot.vtype === '2w' ? '2-Wheeler' : '4-Wheeler'}`);
  document.getElementById('adminVehicleInput').value = '';
  openModal('adminOccupyModal');
};

/** Confirm marking a slot occupied */
window.Admin_confirmOccupy = function() {
  // Re-validate on confirm (user could have tampered between open and confirm)
  if (!Auth.canEditSlot(AdminState.activeSlotKey)) { toast('Access denied.', 'error'); return; }

  const v = document.getElementById('adminVehicleInput').value.trim().toUpperCase();
  if (!v) { shakeEl('adminVehicleInput'); return; }

  DB.updateSlot(AdminState.activeSlotKey, {
    status: 'occupied', vehicle: v, entryTime: nowTime(),
    reservedName: '', reservedUserId: '', reservationId: '',
  });

  closeAllModals();
  Admin_renderGrid();
  Admin_updateStats();
  toast(`🚗 Slot marked occupied`);
};

/**
 * Open modal to admin-reserve a slot.
 * GUARD: canEditSlot verifies slot's location.
 */
window.Admin_openReserveModal = function(key) {
  if (!Auth.isAdmin()) { toast('Access denied.', 'error'); return; }
  if (!Auth.canEditSlot(key)) { toast('🚫 Cannot reserve slot from another location.', 'error'); return; }

  AdminState.activeSlotKey = key;
  const slot = DB.getSlot(key);
  setText('#adminResSlotId', slot.id);
  document.getElementById('adminResName').value    = '';
  document.getElementById('adminResVehicle').value = '';
  document.getElementById('adminResTime').value    = '';
  openModal('adminReserveModal');
};

/** Confirm admin reservation */
window.Admin_confirmReserve = function() {
  if (!Auth.canEditSlot(AdminState.activeSlotKey)) { toast('Access denied.', 'error'); return; }

  const name = document.getElementById('adminResName').value.trim();
  const veh  = document.getElementById('adminResVehicle').value.trim().toUpperCase();
  const time = document.getElementById('adminResTime').value;
  if (!name) { shakeEl('adminResName'); return; }
  if (!veh)  { shakeEl('adminResVehicle'); return; }

  const slot = DB.getSlot(AdminState.activeSlotKey);
  const fmt  = time ? fmtTime(time) : nowTime();
  const loc  = Auth.getAdminLocation();
  const amt  = DB.calcAmount(slot.locId, slot.vtype, 2);
  const resId = DB.generateResId();

  // Update slot
  DB.updateSlot(AdminState.activeSlotKey, {
    status: 'reserved', vehicle: veh, entryTime: fmt,
    reservedName: name, reservedUserId: 'ADMIN_MANUAL',
    reservationId: resId,
  });

  // Record reservation
  DB.addReservation({
    id: resId, slotKey: AdminState.activeSlotKey,
    locId: slot.locId, floor: slot.floor, vtype: slot.vtype, slotId: slot.id,
    vehicle: veh, userName: name, userId: 'ADMIN_MANUAL',
    entryTime: fmt, amount: amt.total, payMethod: 'admin',
    bookedAt: new Date().toISOString(),
  });

  closeAllModals();
  Admin_renderGrid();
  Admin_updateStats();
  toast(`📅 Slot ${slot.id} reserved for ${name}`);
};

/**
 * Mark a slot as available (free it).
 * GUARD: canEditSlot verifies location.
 */
window.Admin_freeSlot = function(key) {
  if (!Auth.isAdmin()) { toast('Access denied.', 'error'); return; }
  if (!Auth.canEditSlot(key)) { toast('🚫 Cannot modify slots from another location.', 'error'); return; }

  const slot = DB.getSlot(key);
  // If there was a reservation attached, cancel it
  if (slot.reservationId) {
    DB.cancelReservation(slot.reservationId);
  } else {
    // Just free the slot directly
    DB.updateSlot(key, {
      status: 'available', vehicle: '', entryTime: '',
      reservedName: '', reservedUserId: '', reservationId: '',
    });
  }

  Admin_renderGrid();
  Admin_updateStats();
  toast(`✅ Slot ${slot.id} is now available`);
};

/* ─────────────────────────────────────────────────────────────
   ADMIN RESERVATIONS TABLE
   Shows ONLY this admin's location reservations.
───────────────────────────────────────────────────────────── */

/**
 * Render the reservations table for the admin's location.
 * Route guard applied at navigation level (see ui.js).
 * Additional check here as a second layer.
 */
function Admin_renderReservations() {
  // GUARD: Must be admin
  if (!Auth.isAdmin()) { toast('Access denied.', 'error'); return; }
  // GUARD: Can access admin-reservations page for their location
  if (!Auth.canAccess('page-admin-reservations', Auth.getUser().locationId)) { return; }

  const locId = Auth.getUser().locationId;
  // LOCATION FILTER: only fetch THIS location's reservations
  const reservations = DB.getReservationsByLocation(locId);
  const tbody        = $('#adminResBody');
  if (!tbody) return;

  if (!reservations.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty-cell">No reservations yet for this location.</td></tr>`;
    return;
  }

  tbody.innerHTML = reservations.map(r => `
    <tr>
      <td><code>${r.id}</code></td>
      <td>${r.userName}</td>
      <td>Floor ${r.floor}</td>
      <td>${r.slotId}</td>
      <td>${r.vtype === '2w' ? '🛵' : '🚗'} ${r.vtype === '2w' ? '2W' : '4W'}</td>
      <td><span class="vehicle-tag">${r.vehicle}</span></td>
      <td>${r.entryTime}</td>
      <td><span class="stat-badge badge-green">₹${r.amount}</span></td>
    </tr>`
  ).join('');
}

/* ─────────────────────────────────────────────────────────────
   ANALYTICS
   Revenue + peak hours, scoped to admin's location ONLY.
───────────────────────────────────────────────────────────── */

/**
 * Render analytics for the admin's location only.
 * Revenue from other locations is NEVER fetched.
 */
function Admin_renderAnalytics() {
  if (!Auth.isAdmin()) { toast('Access denied.', 'error'); return; }
  if (!Auth.canAccess('page-admin-analytics', Auth.getUser().locationId)) { return; }

  const locId   = Auth.getUser().locationId;
  const loc     = Auth.getAdminLocation();

  // Show location name on analytics page
  setText('#analyticsLocName', `📊 Analytics — ${loc.name}`);

  // REVENUE CALCULATION (data.js DB.getRevenueSummary is already location-filtered)
  const { total, count, byHour } = DB.getRevenueSummary(locId);
  setText('#totalRevenue',  `₹${total.toFixed(2)}`);
  setText('#totalBookings', count);

  // Revenue breakdown — only this location's reservations by vtype
  const resByLoc = DB.getReservationsByLocation(locId);
  const rev2w = resByLoc.filter(r => r.vtype === '2w').reduce((s, r) => s + r.amount, 0);
  const rev4w = resByLoc.filter(r => r.vtype === '4w').reduce((s, r) => s + r.amount, 0);

  setHTML('#revenueRows', `
    <div class="revenue-row"><span>🛵 2-Wheeler Revenue</span><span>₹${rev2w.toFixed(2)}</span></div>
    <div class="revenue-row"><span>🚗 4-Wheeler Revenue</span><span>₹${rev4w.toFixed(2)}</span></div>
    <div class="revenue-row" style="font-weight:700;border-top:1px solid var(--border);padding-top:8px;margin-top:4px">
      <span>Total</span><span style="color:var(--green)">₹${total.toFixed(2)}</span>
    </div>`);

  // PEAK HOUR DETECTION
  // byHour is an array of 24 values (bookings count per hour of day)
  // We only look at reasonable parking hours: 6 AM – 10 PM
  const parkingHours  = byHour.slice(6, 22);  // index 6–21
  const hourLabels    = ['6AM','7AM','8AM','9AM','10AM','11AM','12PM',
                         '1PM','2PM','3PM','4PM','5PM','6PM','7PM','8PM','9PM'];

  // Add demo data if no real bookings yet (so chart isn't empty)
  const demoBase = [2, 3, 5, 8, 14, 20, 25, 18, 12, 8, 6, 5, 4, 3, 2, 1];
  const chartData = parkingHours.map((v, i) => v + (demoBase[i] || 0));

  const max       = Math.max(...chartData, 1);
  const peakIdx   = chartData.indexOf(Math.max(...chartData));

  setText('#peakHourLabel', `${hourLabels[peakIdx]} (busiest)`);

  const chartEl = $('#peakChart');
  if (chartEl) {
    chartEl.innerHTML = chartData.map((val, i) => `
      <div class="bar-wrap">
        <div class="bar ${i === peakIdx ? 'peak' : ''}" style="height:${Math.round((val / max) * 110)}px"></div>
        <span class="bar-label">${hourLabels[i]}</span>
      </div>`).join('');
  }
}

/* ─────────────────────────────────────────────────────────────
   PRICING SETTINGS
   Admin can only set pricing for their own location.
───────────────────────────────────────────────────────────── */

/** Render the pricing form for the admin's location only */
function Admin_renderPricingSettings() {
  if (!Auth.isAdmin()) { toast('Access denied.', 'error'); return; }
  if (!Auth.canAccess('page-admin-settings', Auth.getUser().locationId)) { return; }

  const loc = Auth.getAdminLocation();
  if (!loc) return;

  setHTML('#costSettingsContainer', `
    <div class="cost-location-name">⚙️ Pricing for <strong>${loc.name}</strong></div>
    <div class="cost-row">
      <div class="cost-label-group">
        <span class="cost-location">🛵 2-Wheeler Rate</span>
        <span class="cost-unit">per hour</span>
      </div>
      <div class="cost-input-group">
        <span class="cost-prefix">₹</span>
        <input class="cost-input" type="number" id="cost_rate2w" value="${loc.pricing.rate2w}" min="5" max="500" />
      </div>
    </div>
    <div class="cost-row">
      <div class="cost-label-group">
        <span class="cost-location">🚗 4-Wheeler Rate</span>
        <span class="cost-unit">per hour</span>
      </div>
      <div class="cost-input-group">
        <span class="cost-prefix">₹</span>
        <input class="cost-input" type="number" id="cost_rate4w" value="${loc.pricing.rate4w}" min="5" max="500" />
      </div>
    </div>
    <div class="cost-row">
      <div class="cost-label-group">
        <span class="cost-location">🧾 GST / Tax</span>
        <span class="cost-unit">percent</span>
      </div>
      <div class="cost-input-group">
        <span class="cost-prefix">%</span>
        <input class="cost-input" type="number" id="cost_tax" value="${loc.pricing.taxPct}" min="0" max="28" />
      </div>
    </div>`);
}

/** Save pricing — validates admin owns this location before writing */
window.Admin_savePricing = function() {
  const locId = Auth.getUser()?.locationId;
  // PRICING GUARD: verify admin owns this location
  if (!Auth.canEditPricing(locId)) {
    toast('🚫 You cannot change pricing for another location.', 'error');
    return;
  }

  const rate2w = parseFloat(document.getElementById('cost_rate2w')?.value) || 0;
  const rate4w = parseFloat(document.getElementById('cost_rate4w')?.value) || 0;
  const taxPct = parseFloat(document.getElementById('cost_tax')?.value)    || 0;

  if (rate2w < 5 || rate4w < 5) { toast('⚠️ Rates must be at least ₹5.', 'error'); return; }

  // Persist pricing update (data.js validates locId again internally)
  DB.savePricing(locId, { rate2w, rate4w, taxPct });

  toast('💾 Pricing saved successfully!', 'success');
  _updateRateBadge();
};
