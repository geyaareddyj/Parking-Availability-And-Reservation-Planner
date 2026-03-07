/**
 * ============================================================
 * ParkSmart · js/user.js
 * USER MODULE
 *
 * Responsibilities:
 *   - User parking grid (read-only slot availability, no private info)
 *   - Reservation flow (booking details → payment sim → confirm)
 *   - "My Reservations" view (user's own bookings only)
 *   - Trip Planner (real-time prediction on time change)
 *
 * PRIVACY PRINCIPLE:
 *   Users NEVER see: vehicle numbers of other people, entry times,
 *   reserved-person names, revenue figures, or pricing controls.
 *   Every slot card built here uses _buildUserSlotCard() which
 *   deliberately omits all private fields.
 *
 * REPLACE GUIDE:
 *   Replace DB.* calls with fetch('/api/user/...') calls.
 * ============================================================
 */

'use strict';

/* ─────────────────────────────────────────────────────────────
   STATE
───────────────────────────────────────────────────────────── */
const UserState = {
  currentLocId:  null,   // selected location in the grid
  currentFloor:  1,
  activeSlotKey: null,   // slot being reserved
  payMethod:     null,
  payStep:       1,      // 1=details, 2=payment, 3=success
  _pendingTotal: 0,
  _pendingBase:  0,
  _pendingVehicle: '',
};

/* ─────────────────────────────────────────────────────────────
   USER DASHBOARD — PARKING GRID
───────────────────────────────────────────────────────────── */

/**
 * Entry point: setup the user dashboard.
 * Called by main.js when navigating to 'page-dashboard' as a user.
 */
function User_renderDashboard() {
  if (!Auth.isUser()) { toast('Access denied.', 'error'); return; }

  // Populate location dropdown from all locations
  const locs = DB.getLocations();
  const sel  = $('#locationSelect');
  if (sel) {
    sel.innerHTML = locs.map(l =>
      `<option value="${l.id}" ${l.id === UserState.currentLocId ? 'selected' : ''}>${l.name}</option>`
    ).join('');
    // Default to first location
    if (!UserState.currentLocId) UserState.currentLocId = locs[0]?.id;
    sel.value = UserState.currentLocId;
  }

  // Rate badge is HIDDEN for users (no pricing info shown)
  const rateBadge = $('#rateBadge');
  if (rateBadge) rateBadge.style.display = 'none';

  // Update page heading (users see generic dashboard)
  setText('#dashPageTitle',    'Find a Parking Slot');
  setText('#dashPageSubtitle', 'Browse available slots and make a reservation.');

  // Show location selector wrapper
  const locSelWrap = $('#locationSelectWrap');
  if (locSelWrap) locSelWrap.style.display = '';

  User_renderFloorTabs();
  User_renderGrid();
  User_updateStats();
}

/** Floor tabs for the user's selected location */
function User_renderFloorTabs() {
  const loc       = DB.getLocation(UserState.currentLocId);
  const container = $('#floorTabs');
  if (!container || !loc) return;
  container.innerHTML = '';
  for (let f = 1; f <= loc.floors; f++) {
    const btn = document.createElement('button');
    btn.className = `floor-tab ${f === UserState.currentFloor ? 'active' : ''}`;
    btn.textContent = `Floor ${f}`;
    btn.addEventListener('click', () => {
      UserState.currentFloor = f;
      User_renderFloorTabs();
      User_renderGrid();
      User_updateStats();
    });
    container.appendChild(btn);
  }
}

/**
 * Render the parking grid for users.
 * PRIVACY: Only availability status is shown.
 * No vehicle numbers, no entry times, no reserved names.
 */
function User_renderGrid() {
  if (!Auth.isUser()) return;
  const container = $('#parkingGridContainer');
  if (!container) return;

  container.innerHTML = '';
  const vtypes = [
    { key: '2w', label: '2-Wheelers', icon: '🛵' },
    { key: '4w', label: '4-Wheelers', icon: '🚗' },
  ];

  vtypes.forEach(({ key, label, icon }) => {
    const slots = DB.getSlots(UserState.currentLocId, UserState.currentFloor, key);
    const avail = slots.filter(s => s.status === 'available').length;

    const section = document.createElement('div');
    section.className = 'vehicle-section';
    section.innerHTML = `
      <div class="section-header-row">
        <span class="section-icon">${icon}</span>
        <span class="section-title">${label}</span>
        <span class="section-count">${avail}/${slots.length} available</span>
      </div>
      <div class="parking-grid" id="user-grid-${key}"></div>`;
    container.appendChild(section);

    const grid = section.querySelector(`#user-grid-${key}`);
    slots.forEach(slot => grid.appendChild(_buildUserSlotCard(slot)));
  });

  User_applyFilter();
}

/**
 * Build a slot card for users.
 * DELIBERATELY omits: vehicle, entryTime, reservedName, revenue.
 * User can only see: slot ID, status, and a Reserve button if available.
 */
function _buildUserSlotCard(slot) {
  const el = document.createElement('div');
  el.className = `slot slot-${slot.status}`;

  const icon        = slot.vtype === '2w' ? '🛵' : '🚗';
  const statusLabel = cap(slot.status);

  // Popup — availability only, NO private data
  const popupDetails = `
    <div class="popup-row"><span class="popup-lbl">Status:</span>
      <span class="popup-val badge-${slot.status}">${statusLabel}</span>
    </div>
    <div class="popup-row"><span class="popup-lbl">Type:</span>
      <span class="popup-val">${slot.vtype === '2w' ? '2-Wheeler' : '4-Wheeler'}</span>
    </div>`;

  // Action — only available slots get a Reserve button
  const action = slot.status === 'available'
    ? `<button class="btn btn-primary btn-sm btn-full" onclick="User_openReserveModal('${slot.key}')">Reserve</button>`
    : `<div class="slot-unavail-note">${slot.status === 'occupied' ? 'Currently in use' : 'Already booked'}</div>`;

  el.innerHTML = `
    <div class="slot-icon">${icon}</div>
    <div class="slot-id">${slot.id}</div>
    <div class="slot-badge badge-${slot.status}">${statusLabel}</div>
    <div class="slot-popup">
      <div class="popup-title">Slot ${slot.id}</div>
      ${popupDetails}
      <div class="popup-actions">${action}</div>
    </div>`;
  return el;
}

/** Stats for user's current location+floor view */
function User_updateStats() {
  const slots = DB.getSlots(UserState.currentLocId, UserState.currentFloor);
  setText('#statTotal',     slots.length);
  setText('#statAvailable', slots.filter(s => s.status === 'available').length);
  setText('#statOccupied',  slots.filter(s => s.status === 'occupied').length);
  setText('#statReserved',  slots.filter(s => s.status === 'reserved').length);
}

/** Filter slot cards by status */
function User_applyFilter() {
  const val = $('#slotFilter')?.value || 'all';
  $$('.slot').forEach(el => {
    el.style.display = (val === 'all' || el.classList.contains(`slot-${val}`)) ? '' : 'none';
  });
}

/* ─────────────────────────────────────────────────────────────
   RESERVATION FLOW (User)
   3 steps: Details → Payment → Success
───────────────────────────────────────────────────────────── */

/**
 * Open the reservation modal for a slot.
 * GUARD: only users can reserve (not admins).
 */
window.User_openReserveModal = function(key) {
  if (!Auth.isUser()) { toast('Access denied.', 'error'); return; }

  const slot = DB.getSlot(key);
  if (!slot || slot.status !== 'available') {
    toast('⚠️ This slot is no longer available.', 'error');
    User_renderGrid();
    return;
  }

  UserState.activeSlotKey = key;
  UserState.payMethod     = null;

  const loc   = DB.getLocation(slot.locId);
  const label = `Slot ${slot.id} · ${loc.name} · Floor ${slot.floor} · ${slot.vtype === '2w' ? '2-Wheeler' : '4-Wheeler'}`;
  setText('#resSlotInfo', label);

  document.getElementById('resVehicle').value  = '';
  document.getElementById('resDuration').value = '1';
  document.getElementById('resDate').value     = todayISO();

  // Update price summary on duration change
  document.getElementById('resDuration').oninput = _updatePaySummary;

  _updatePaySummary();
  _setPayStep(1);
  openModal('reserveModal');
};

/** Recalculate and display price summary in Step 1 */
function _updatePaySummary() {
  const slot  = DB.getSlot(UserState.activeSlotKey);
  if (!slot) return;
  const hours = parseFloat(document.getElementById('resDuration')?.value) || 1;
  const { rate, base, tax, total } = DB.calcAmount(slot.locId, slot.vtype, hours);

  setText('#summaryRate',  `₹${rate}/hr`);
  setText('#summaryHours', `${hours} hr`);
  setText('#summaryBase',  `₹${base.toFixed(2)}`);
  setText('#summaryTax',   `₹${tax.toFixed(2)}`);
  setText('#summaryTotal', `₹${total.toFixed(2)}`);

  UserState._pendingTotal = total;
  UserState._pendingBase  = base;
}

/** Move from Step 1 (details) to Step 2 (payment) */
window.User_goToPayment = function() {
  const veh = document.getElementById('resVehicle').value.trim().toUpperCase();
  if (!veh) { shakeEl('resVehicle'); return; }
  UserState._pendingVehicle = veh;

  // Mirror total to payment step display
  setText('#payTotal', `₹${UserState._pendingTotal.toFixed(2)}`);

  _setPayStep(2);
};

/** Select payment method */
window.User_selectPayMethod = function(method) {
  UserState.payMethod = method;
  $$('.pay-option').forEach(o => o.classList.remove('selected'));
  $(`[data-pay="${method}"]`)?.classList.add('selected');
};

/** Confirm payment — simulate processing */
window.User_confirmPayment = function() {
  if (!UserState.payMethod) { toast('⚠️ Please select a payment method.', 'error'); return; }

  const payBtn = $('#payBtn');
  payBtn.textContent = '⏳ Processing…';
  payBtn.disabled    = true;

  // Simulate network delay
  setTimeout(() => {
    payBtn.textContent = 'Pay Now';
    payBtn.disabled    = false;
    _finalizeReservation();
  }, 1800);
};

/** Write the reservation to DB and free the slot as reserved */
function _finalizeReservation() {
  const slot  = DB.getSlot(UserState.activeSlotKey);
  if (!slot) { toast('Error: slot not found.', 'error'); return; }

  const user  = Auth.getUser();
  const resId = DB.generateResId();
  const fmt   = nowTime();

  // Mark slot as reserved
  DB.updateSlot(UserState.activeSlotKey, {
    status:          'reserved',
    vehicle:         UserState._pendingVehicle,
    entryTime:       fmt,
    reservedName:    user.displayName,
    reservedUserId:  user.id,
    reservationId:   resId,
  });

  // Save reservation record
  DB.addReservation({
    id:        resId,
    slotKey:   UserState.activeSlotKey,
    locId:     slot.locId,
    floor:     slot.floor,
    vtype:     slot.vtype,
    slotId:    slot.id,
    vehicle:   UserState._pendingVehicle,
    userName:  user.displayName,
    userId:    user.id,
    entryTime: fmt,
    amount:    UserState._pendingTotal,
    payMethod: UserState.payMethod,
    bookedAt:  new Date().toISOString(),
  });

  _setPayStep(3);  // show success screen
  User_renderGrid();
  User_updateStats();

  // Auto-close after 2s
  setTimeout(() => {
    closeAllModals();
    toast(`🎉 Booking confirmed! ID: ${resId}`, 'success');
  }, 2000);
}

/** Manage step UI (dots + active panels) */
function _setPayStep(step) {
  UserState.payStep = step;
  $$('.payment-step').forEach((el, i) => el.classList.toggle('active', i + 1 === step));
  $$('.step-dot').forEach((dot, i) => {
    dot.classList.toggle('active',   i + 1 === step);
    dot.classList.toggle('complete', i + 1 < step);
  });
}

/* ─────────────────────────────────────────────────────────────
   MY RESERVATIONS
   Shows ONLY the current user's own bookings.
   No other user's data is ever rendered here.
───────────────────────────────────────────────────────────── */

/** Render the user's own reservation list */
function User_renderMyReservations() {
  if (!Auth.isUser()) { toast('Access denied.', 'error'); return; }

  const userId = Auth.getUser().id;
  // USER FILTER: only fetch reservations belonging to this user
  const myRes  = DB.getReservationsByUser(userId);
  const list   = $('#myReservationsList');
  if (!list) return;

  if (!myRes.length) {
    list.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">🅿️</span>
        <p>No reservations yet.</p>
        <p style="font-size:0.82rem;margin-top:4px">Browse the parking grid to book a slot!</p>
      </div>`;
    return;
  }

  list.innerHTML = myRes.map(r => {
    const loc       = DB.getLocation(r.locId);
    const locName   = loc?.name || r.locId;
    const vtypeIcon = r.vtype === '2w' ? '🛵' : '🚗';
    const vtypeLbl  = r.vtype === '2w' ? '2-Wheeler' : '4-Wheeler';
    // NOTE: amount is shown to the user (it's their own payment info).
    // What is NOT shown: other users' vehicles, revenue analytics, pricing controls.
    return `
      <div class="reservation-card">
        <span class="res-icon">${vtypeIcon}</span>
        <div class="res-info">
          <div class="res-id">Slot ${r.slotId} <span class="res-badge">${r.id}</span></div>
          <div class="res-meta">${locName} · Floor ${r.floor} · ${vtypeLbl} · Booked at ${r.entryTime}</div>
          <div class="res-pay-method">Paid via ${_payLabel(r.payMethod)}</div>
        </div>
        <div class="res-right">
          <div class="res-price">₹${r.amount}</div>
          <button class="btn btn-danger btn-sm" onclick="User_cancelReservation('${r.id}')">Cancel</button>
        </div>
      </div>`;
  }).join('');
}

/** Cancel user's own reservation */
window.User_cancelReservation = function(resId) {
  if (!Auth.isUser()) { toast('Access denied.', 'error'); return; }

  // Verify reservation belongs to THIS user before cancelling
  const userId = Auth.getUser().id;
  const res    = DB.getReservations().find(r => r.id === resId);
  if (!res || res.userId !== userId) {
    toast('🚫 You cannot cancel someone else\'s reservation.', 'error');
    return;
  }

  DB.cancelReservation(resId);
  User_renderMyReservations();
  toast('🗑️ Reservation cancelled.');
};

function _payLabel(method) {
  const map = { upi: '📱 UPI', card: '💳 Card', netbanking: '🏦 Net Banking', cash: '💵 Cash', admin: 'Admin' };
  return map[method] || method;
}

/* ─────────────────────────────────────────────────────────────
   TRIP PLANNER
   Real-time prediction updates instantly when time changes.
   No backend call needed — purely client-side prediction logic.
───────────────────────────────────────────────────────────── */

const TRIP_DATA = {
  Morning:   { crowd: 'Low',    parking: 'High Availability',    tip: 'Great time to visit!',    crowdClass: 'crowd-low'    },
  Afternoon: { crowd: 'Medium', parking: 'Limited Availability', tip: 'Arrive before 3 PM',      crowdClass: 'crowd-medium' },
  Evening:   { crowd: 'High',   parking: 'Very Limited',         tip: 'Try morning instead',     crowdClass: 'crowd-high'   },
  Night:     { crowd: 'Low',    parking: 'Available',            tip: 'Comfortable visit time',  crowdClass: 'crowd-low'    },
};

/**
 * Update trip prediction panel.
 * Called automatically when the time <select> changes — no button needed.
 * Also called on page load when navigating to trip-planner.
 */
function User_updateTripResult() {
  const timeEl   = $('#tripTimeSelect');
  const resultEl = $('#tripResultCard');
  if (!timeEl || !resultEl) return;

  const time = timeEl.value;
  const data = TRIP_DATA[time];
  if (!data) return;

  setText('#tripCrowd',   data.crowd);
  setText('#tripParking', data.parking);
  setText('#tripTip',     data.tip);

  // Apply color class to crowd level
  const crowdEl  = $('#tripCrowd');
  if (crowdEl) crowdEl.className = `trip-metric-value ${data.crowdClass}`;

  resultEl.classList.add('visible');
}

/**
 * Initialize trip planner: bind real-time listener.
 * Called once by main.js on DOMContentLoaded.
 */
function User_initTripPlanner() {
  const timeEl = $('#tripTimeSelect');
  const locEl  = $('#tripLocationSelect');

  // Update immediately when time changes (real-time — no button click required)
  timeEl?.addEventListener('change', User_updateTripResult);
  locEl?.addEventListener('change',  User_updateTripResult);

  // Also update on first load of the planner page
  User_updateTripResult();
}

/* ─────────────────────────────────────────────────────────────
   LOCATION CHANGE HANDLER (user dashboard)
───────────────────────────────────────────────────────────── */

function User_onLocationChange(locId) {
  UserState.currentLocId = locId;
  UserState.currentFloor = 1;
  User_renderFloorTabs();
  User_renderGrid();
  User_updateStats();
}
