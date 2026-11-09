<<<<<<< HEAD
window.addEventListener("load", () => {
  loadKds();
  loadReservations();
  setInterval(loadKds, 5000);
  setInterval(loadReservations, 15000);
=======
window.addEventListener("DOMContentLoaded", () => {
  const user = getUser() || {};
  const role = String(
    user.role ||
    user.user_role ||
    user.account_type ||
    user.type ||
    localStorage.getItem("role") ||
    ""
  )
    .trim()
    .toLowerCase();

  if (!getToken() || !["admin", "staff", "cashier"].includes(role)) {
    window.location.replace("./login.html");
    return;
  }

  const sidebar = document.querySelector(".staff-sidebar");
  const menuToggle = document.querySelector(".staff-mobile-menu-toggle");
  const drawerBackdrop = document.querySelector(".staff-drawer-backdrop");
  const isCashier = role === "cashier";
  const canAccessCashier = isCashier;
  const cashierNavigation = document.getElementById("cashierRefundNavigation");
  if (canAccessCashier) cashierNavigation.hidden = false;
  if (isCashier) {
    document.title = "Dine-Ari Staff Workspace";
    document.querySelector(".staff-brand-caption").textContent = "STAFF WORKSPACE";
  }
  const setNavigationOpen = (isOpen) => {
    sidebar.classList.toggle("is-navigation-open", isOpen);
    document.body.classList.toggle("staff-navigation-open", isOpen);
    menuToggle.setAttribute("aria-expanded", String(isOpen));
    menuToggle.setAttribute("aria-label", isOpen ? "Close staff navigation" : "Open staff navigation");
  };
  const updateActiveNavigation = () => {
    const requestedSection = window.location.hash.slice(1);
    const allowedSections = [
      "overview", "orders", "table-selection", "qr-scanner", "table-cleaning",
      ...(canAccessCashier ? ["late-arrival-refunds"] : []),
    ];
    const activeSection = allowedSections.includes(requestedSection)
      ? requestedSection
      : "overview";
    if (activeSection !== "qr-scanner" && typeof window.stopArrivalScanner === "function") {
      window.stopArrivalScanner();
    }
    const topbarTitle = document.querySelector(".staff-topbar h1");
    if (topbarTitle && activeSection === "qr-scanner") {
      topbarTitle.textContent = "Customer Arrival Scanner";
    } else if (topbarTitle) {
      topbarTitle.textContent = activeSection === "late-arrival-refunds"
        ? "Cashier / Refund Management"
        : "Kitchen operations";
    }

    document.querySelectorAll(".staff-nav-link").forEach((link) => {
      const isActive = link.getAttribute("href") === `#${activeSection}`;
      link.classList.toggle("is-active", isActive);

      if (isActive) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });

    document.querySelectorAll(".staff-page-section").forEach((section) => {
      section.hidden = section.id !== activeSection;
    });

    if (activeSection === "table-cleaning") {
      void loadTableCleaning();
    }
    if (activeSection === "table-selection") {
      void loadStaffTableSelection();
      queueStaffFloorPlanScaleUpdate();
    }
    if (activeSection === "late-arrival-refunds") {
      void loadCashierRefunds();
    }

    setNavigationOpen(false);

    if (window.location.hash && requestedSection !== activeSection) {
      window.location.hash = activeSection;
    }
  };

  window.addEventListener("hashchange", updateActiveNavigation);
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) {
      if (window.location.hash === "#table-cleaning") void loadTableCleaning();
      if (window.location.hash === "#table-selection") void loadStaffTableSelection();
    }
  });
  document.querySelector(".staff-nav").addEventListener("click", (event) => {
    const link = event.target.closest(".staff-nav-link");
    if (!link) return;

    event.preventDefault();
    const section = link.getAttribute("href").slice(1);
    if (window.location.hash === `#${section}`) {
      updateActiveNavigation();
    } else {
      setNavigationOpen(false);
      window.location.hash = section;
    }
  });
  document.querySelector(".staff-brand").addEventListener("click", (event) => {
    event.preventDefault();
    if (window.location.hash === "#overview") {
      updateActiveNavigation();
    } else {
      setNavigationOpen(false);
      window.location.hash = "overview";
    }
  });
  menuToggle.addEventListener("click", () => {
    const isOpen = !sidebar.classList.contains("is-navigation-open");
    setNavigationOpen(isOpen);
    if (isOpen) {
      document.querySelector(".staff-nav-link.is-active").focus();
    }
  });
  drawerBackdrop.addEventListener("click", () => {
    setNavigationOpen(false);
    menuToggle.focus();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && sidebar.classList.contains("is-navigation-open")) {
      setNavigationOpen(false);
      menuToggle.focus();
    }
  });
  updateActiveNavigation();

  if (canAccessCashier) {
    document.getElementById("cashierRefundsRefresh").addEventListener("click", loadCashierRefunds);
    document.getElementById("late-arrival-refunds").addEventListener("click", (event) => {
      const button = event.target.closest("[data-refund-action][data-refund-id]");
      if (!button) return;
      if (button.dataset.refundAction === "process") {
        void startLateArrivalRefundProcessing(button.dataset.refundId, button);
      } else if (button.dataset.refundAction === "complete") {
        void completeLateArrivalRefund(button.dataset.refundId, button);
      }
    });
    setInterval(() => {
      if (window.location.hash === "#late-arrival-refunds") void loadCashierRefunds();
    }, 15000);
  }

  initializeTableCleaning();
  initializeStaffFloorPlanScaling();
  void loadKds();
  setInterval(loadKds, 5000);
  setInterval(() => {
    if (window.location.hash === "#table-cleaning") {
      void loadTableCleaning();
    }
    if (window.location.hash === "#table-selection") {
      void loadStaffTableSelection();
    }
  }, 15000);
>>>>>>> dec813b30e6e693a0d780375b8a2669b5c157d50
});

async function loadCashierRefunds() {
  const lists = {
    pending: document.getElementById("cashierPendingRefunds"),
    processing: document.getElementById("cashierProcessingRefunds"),
    completed: document.getElementById("cashierCompletedRefunds"),
  };
  const message = document.getElementById("cashierRefundsMessage");
  if (!lists.pending || !lists.processing || !lists.completed) return;
  Object.values(lists).forEach((list) => list.setAttribute("aria-busy", "true"));
  try {
    const refunds = await apiRequest("/staff/refunds/late-arrivals");
    for (const [status, list] of Object.entries(lists)) {
      const groupedRefunds = refunds.filter((refund) => refund.refund_status === status);
      document.getElementById(`cashier${status[0].toUpperCase()}${status.slice(1)}Count`).textContent =
        String(groupedRefunds.length);
      list.innerHTML = groupedRefunds.length
        ? groupedRefunds.map(renderCashierRefundCard).join("")
        : `<p class="muted empty-state">No ${status} refunds.</p>`;
    }
    message.textContent = "";
    message.classList.remove("is-error");
    if (window.lucide) window.lucide.createIcons();
  } catch (error) {
    message.textContent = error.message || "Late-arrival refunds could not be loaded.";
    message.classList.add("is-error");
  } finally {
    Object.values(lists).forEach((list) => list.setAttribute("aria-busy", "false"));
  }
}

function renderCashierRefundCard(refund) {
  const statusLabel = {
    pending: "PENDING REFUND",
    processing: "PROCESSING REFUND",
    completed: "REFUND COMPLETED",
  }[refund.refund_status] || "REFUND STATUS UNAVAILABLE";
  const customerContact = refund.contact_number
    ? `<p><strong>Contact:</strong> ${escapeStaffHtml(refund.contact_number)}</p>`
    : "";
  const customerEmail = refund.customer_email
    ? `<p><strong>Email:</strong> ${escapeStaffHtml(refund.customer_email)}</p>`
    : "";
  const processingDetails = refund.refund_status === "processing"
    ? `<p><strong>Processing cashier:</strong> ${escapeStaffHtml(refund.processing_cashier_name || "Unavailable")}</p>
       <p><strong>Started:</strong> ${escapeStaffHtml(refund.refund_processing_started_at ? new Date(refund.refund_processing_started_at).toLocaleString() : "Not recorded")}</p>`
    : "";
  const completionDetails = refund.refund_status === "completed"
    ? `<p><strong>Completed:</strong> ${escapeStaffHtml(refund.refund_completed_at ? new Date(refund.refund_completed_at).toLocaleString() : "Not recorded")}</p>
       <p><strong>Cashier:</strong> ${escapeStaffHtml(refund.cashier_name || "Unavailable")}</p>`
    : "";
  const action = refund.refund_status === "pending"
    ? `<button class="primary" type="button" data-refund-action="process" data-refund-id="${Number(refund.id)}">Start Processing</button>`
    : refund.refund_status === "processing"
      ? `<button class="primary" type="button" data-refund-action="complete" data-refund-id="${Number(refund.id)}">Confirm Refund Completed</button>`
      : "";

  return `
    <article class="staff-order-card">
      <div class="staff-order-summary">
        <div>
          <span class="staff-order-label">CUSTOMER</span>
          <h3>${escapeStaffHtml(refund.customer_name || "Name unavailable")}</h3>
          <span class="staff-order-label">Order #${escapeStaffHtml(refund.order_code)}</span>
        </div>
        <span class="status-badge status-${escapeStaffHtml(refund.refund_status)}">${statusLabel}</span>
      </div>
      ${customerContact}
      ${customerEmail}
      <p><strong>Original payment:</strong> ₱${Number(refund.total_amount || 0).toFixed(2)}</p>
      <p><strong>50% refund amount:</strong> ₱${Number(refund.refund_amount || 0).toFixed(2)}</p>
      <p><strong>Arrival:</strong> ${escapeStaffHtml(new Date(refund.arrived_at).toLocaleString())}</p>
      ${processingDetails}
      ${completionDetails}
      ${action}
    </article>
  `;
}

async function startLateArrivalRefundProcessing(id, button) {
  if (button.disabled) return;
  const message = document.getElementById("cashierRefundsMessage");
  button.disabled = true;
  try {
    await apiRequest(`/staff/refunds/late-arrivals/${encodeURIComponent(id)}/process`, {
      method: "PATCH",
    });
    message.classList.remove("is-error");
    message.textContent = "Refund request moved to processing.";
    await loadCashierRefunds();
  } catch (error) {
    message.classList.add("is-error");
    message.textContent = error.message || "The refund request could not be moved to processing.";
    button.disabled = false;
  }
}

async function completeLateArrivalRefund(id, button) {
  if (button.disabled) return;
  const handedToCustomer = await window.DineAriNotifications.confirm({
    type: "warning",
    title: "Confirm Refund Completed?",
    message: "This records the refund as complete. Only proceed after you have physically handed the refund to the customer.",
    confirmLabel: "Confirm Refund Completed",
  });
  if (!handedToCustomer) return;

  const message = document.getElementById("cashierRefundsMessage");
  button.disabled = true;
  try {
    await apiRequest(`/staff/refunds/late-arrivals/${encodeURIComponent(id)}/complete`, {
      method: "PATCH",
    });
    message.classList.remove("is-error");
    message.textContent = "Refund completed and recorded.";
    await loadCashierRefunds();
  } catch (error) {
    message.classList.add("is-error");
    message.textContent = error.message || "The refund could not be marked complete.";
    button.disabled = false;
  }
}

async function loadKds() {
  const ordersContainer = document.getElementById("kdsOrders");

  try {
    const orders = await apiRequest("/staff/kds");
    const counts = orders.reduce(
      (totals, order) => {
        const status = String(order.status || "").toLowerCase();
        if (status === "pending") totals.pending += 1;
        if (status === "preparing") totals.preparing += 1;
        if (status === "ready") totals.ready += 1;
        return totals;
      },
      { pending: 0, preparing: 0, ready: 0 }
    );

    document.getElementById("staffPendingCount").textContent = counts.pending;
    document.getElementById("staffPreparingCount").textContent = counts.preparing;
    document.getElementById("staffReadyCount").textContent = counts.ready;
    document.getElementById("staffActiveOrderCount").textContent = orders.length;
    document.getElementById("staffSidebarOrderCount").textContent = counts.pending;
    document.getElementById("staffOverviewOrderCount").textContent = orders.length;
    document.getElementById("staffOverviewPendingCount").textContent = counts.pending;
    ordersContainer.setAttribute("aria-busy", "false");

    ordersContainer.innerHTML = orders.length
      ? orders
          .map(
            (order) => `
<<<<<<< HEAD
              <div class="panel kds-order-card">
                <h2>Order #${order.order_code}</h2>
                <p>Status: <span class="status-badge status-${order.status}">${String(order.status).toUpperCase()}</span></p>
                <p>Total: ₱${Number(order.total_amount).toFixed(2)}</p>
                <button onclick="updateOrderStatus(${order.id}, 'preparing')">Preparing</button>
                <button onclick="updateOrderStatus(${order.id}, 'ready')">Ready</button>
                <button onclick="updateOrderStatus(${order.id}, 'completed')">Completed</button>
              </div>
=======
              <article class="staff-order-card">
                <div class="staff-order-summary">
                  <div>
                    <span class="staff-order-label">ORDER</span>
                    <h3>#${escapeStaffHtml(order.order_code)}</h3>
                    <span class="staff-order-label">${order.type === "dine_in"
                      ? escapeStaffHtml(order.table_name || `Table ${order.table_id || "unassigned"}`)
                      : "Takeout"}</span>
                  </div>
                  <span class="status-badge status-${escapeStaffHtml(order.status)}">${escapeStaffHtml(String(order.status).toUpperCase())}</span>
                </div>
                <div class="staff-order-total">
                  <span class="muted">Order total</span>
                  <strong>₱${Number(order.total_amount).toFixed(2)}</strong>
                </div>
                <div class="staff-order-actions" aria-label="Update order status">
                  ${order.type === "dine_in" && order.dine_in_status === "arrived"
                    ? `<span class="status-badge status-completed">CUSTOMER ARRIVED</span>`
                    : ""}
                  <button class="secondary" onclick="updateOrderStatus(${Number(order.id)}, 'preparing')"><i data-lucide="chef-hat" aria-hidden="true"></i> Preparing</button>
                  <button class="secondary" onclick="updateOrderStatus(${Number(order.id)}, 'ready')"><i data-lucide="badge-check" aria-hidden="true"></i> Ready</button>
                  <button onclick="updateOrderStatus(${Number(order.id)}, 'completed')"><i data-lucide="check-check" aria-hidden="true"></i> Completed</button>
                </div>
              </article>
>>>>>>> dec813b30e6e693a0d780375b8a2669b5c157d50
            `
          )
          .join("")
      : `
        <div class="staff-empty-state">
          <span class="staff-empty-icon"><i data-lucide="clipboard-check" aria-hidden="true"></i></span>
          <strong>All caught up</strong>
          <span>No active orders to prepare right now.</span>
        </div>
      `;
    if (window.lucide) window.lucide.createIcons();
  } catch (error) {
    ordersContainer.setAttribute("aria-busy", "false");
    ordersContainer.innerHTML = `
      <div class="staff-empty-state is-error" role="alert">
        <span class="staff-empty-icon"><i data-lucide="triangle-alert" aria-hidden="true"></i></span>
        <strong>Orders could not be loaded</strong>
        <span>${escapeStaffHtml(error.message || "Please try again shortly.")}</span>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
  }
}

<<<<<<< HEAD
function escapeStaffText(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

async function loadReservations() {
  const reservationsBox = document.getElementById("staffReservations");
  const reservationsPanel = document.getElementById("staffReservationsPanel");
  if (!reservationsBox || !reservationsPanel) return;

  reservationsPanel.hidden = true;

  try {
    const reservations = await apiRequest("/reservations");
    const openReservations = reservations.filter((reservation) =>
      ["active", "confirmed", "checked_in"].includes(String(reservation.status).toLowerCase())
    );

    if (!openReservations.length) {
      reservationsBox.replaceChildren();
      return;
    }

    reservationsBox.innerHTML = openReservations.length
      ? openReservations.map((reservation) => {
          const id = Number(reservation.id);
          const status = String(reservation.status || "active").toLowerCase();
          const checkedIn = status === "checked_in";
          const statusLabel = checkedIn ? "Checked In" : "Confirmed";
          const statusClass = checkedIn ? "checked-in" : "confirmed";
          const tableName = escapeStaffText(reservation.table_name || `Table ${reservation.table_id}`);
          const customer = escapeStaffText(reservation.customer_name || reservation.full_name || "Customer");
          const contact = escapeStaffText(reservation.contact_number || "N/A");
          const guests = escapeStaffText(reservation.num_guests || "N/A");
          const date = escapeStaffText(String(reservation.reservation_date || "").slice(0, 10) || "N/A");
          const time = escapeStaffText(String(reservation.reservation_time || "").slice(0, 5) || "N/A");
          const actions = checkedIn
            ? `<button type="button" onclick="updateReservationStatus(${id}, 'completed')">Complete</button>`
            : `<button type="button" onclick="updateReservationStatus(${id}, 'checked_in')">Check In</button>
               <button type="button" class="secondary" onclick="updateReservationStatus(${id}, 'cancelled')">Cancel</button>`;

          return `
            <tr>
              <td>${tableName}</td>
              <td>${customer}</td>
              <td>${contact}</td>
              <td>${guests}</td>
              <td>${date} ${time}</td>
              <td><span class="staff-reservation-status staff-reservation-status--${statusClass}">${statusLabel}</span></td>
              <td><div class="staff-reservation-actions">${actions}</div></td>
            </tr>
          `;
        }).join("")
      : `<tr><td colspan="7" class="muted">No upcoming or active reservations.</td></tr>`;
    reservationsPanel.hidden = false;
  } catch (error) {
    reservationsBox.replaceChildren();
    console.warn("Unable to load staff reservations:", error.message);
  }
=======
function escapeStaffHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return entities[character];
  });
>>>>>>> dec813b30e6e693a0d780375b8a2669b5c157d50
}

async function updateOrderStatus(id, status) {
  try {
    await apiRequest(`/orders/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    await loadKds();
  } catch (patchError) {
    alert(`Could not update order status: ${patchError.message}`);
  }
}

<<<<<<< HEAD
async function updateReservationStatus(id, status) {
  const label = status === "checked_in" ? "check in this guest" : `${status} this reservation`;
  if (!window.confirm(`Are you sure you want to ${label}?`)) return;

  try {
    await apiRequest(`/reservations/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    await loadReservations();
  } catch (error) {
    alert(`Could not update reservation: ${error.message}`);
  }
}

=======
let staffTables = [];
let selectedCleaningTableId = null;
let activeTableFilter = "all";
let tableCleaningLoadPromise = null;
let tableCleaningReloadQueued = false;
let tableCleaningActionInProgress = false;
let staffSelectionTables = [];
let staffSelectionChairs = [];
let selectedWalkInTableId = null;
let activeWalkInFloor = 1;
let staffSelectionLoadPromise = null;
let staffSelectionReloadQueued = false;
let staffSelectionActionInProgress = false;
let staffFloorPlanResizeObserver = null;
let staffFloorPlanResizeFrame = 0;
const STAFF_FLOOR_PLAN_DESIGN_WIDTH = 760;
const staffFloorPlanBlueprint = {
  tables: [
    { id: 1, x: 14, y: 30, shape: "circle", floor: 1 },
    { id: 2, x: 50, y: 30, shape: "circle", floor: 1 },
    { id: 3, x: 86, y: 30, shape: "circle", floor: 1 },
    { id: 4, x: 24, y: 70, shape: "circle", floor: 1 },
    { id: 5, x: 58, y: 70, shape: "circle", floor: 1 },
    { id: 6, x: 86, y: 70, shape: "circle", floor: 1 },
    { id: 11, x: 14, y: 90, shape: "small", floor: 1 },
    { id: 12, x: 38, y: 90, shape: "small", floor: 1 },
    { id: 13, x: 62, y: 90, shape: "small", floor: 1 },
    { id: 14, x: 86, y: 90, shape: "small", floor: 1 },
    { id: 7, x: 22, y: 32, shape: "rect-medium", floor: 2 },
    { id: 8, x: 78, y: 32, shape: "rect-medium", floor: 2 },
    { id: 9, x: 22, y: 72, shape: "rect-large", floor: 2 },
    { id: 10, x: 78, y: 72, shape: "rect-large", floor: 2 },
  ],
};

const staffTableStatuses = {
  vacant: { label: "Clean / available", className: "is-clean", icon: "circle-check" },
  occupied: { label: "Occupied", className: "is-occupied", icon: "users-round" },
  needs_cleaning: { label: "Needs cleaning", className: "needs-cleaning", icon: "brush-cleaning" },
  cleaning: { label: "Cleaning in progress", className: "is-cleaning", icon: "loader-circle" },
  reserved: { label: "Reserved", className: "is-reserved", icon: "calendar-check" },
  locked: { label: "Held for reservation", className: "is-reserved", icon: "lock-keyhole" },
};

function getStaffTableStatus(status) {
  const key = String(status || "").trim().toLowerCase();
  return staffTableStatuses[key] || {
    label: key ? `Status: ${key}` : "Status unavailable",
    className: "is-unknown",
    icon: "circle-help",
  };
}

function isCleaningTableEligible(table) {
  return ["occupied", "needs_cleaning", "cleaning"].includes(
    String(table?.status || "").trim().toLowerCase()
  );
}

function setTableCleaningMessage(message = "", isError = false) {
  const messageElement = document.getElementById("staffCleaningMessage");
  if (!messageElement) return;
  messageElement.textContent = message;
  messageElement.classList.toggle("is-error", isError);
  messageElement.classList.toggle("is-success", Boolean(message) && !isError);
}

function initializeTableCleaning() {
  const filterContainer = document.getElementById("staffCleaningFilters");
  const tableGrid = document.getElementById("staffTableGrid");
  const selectedTable = document.getElementById("staffSelectedTable");
  const refreshButton = document.getElementById("staffTablesRefresh");

  filterContainer?.addEventListener("click", (event) => {
    const filterButton = event.target.closest("[data-table-filter]");
    if (!filterButton || !filterContainer.contains(filterButton)) return;
    activeTableFilter = filterButton.dataset.tableFilter;

    filterContainer.querySelectorAll("[data-table-filter]").forEach((button) => {
      const isActive = button === filterButton;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    });

    renderStaffTableCleaning();
  });

  tableGrid?.addEventListener("click", (event) => {
    const tableCard = event.target.closest("[data-table-id]");
    if (!tableCard || !tableGrid.contains(tableCard) || tableCard.disabled) return;
    selectedCleaningTableId = Number(tableCard.dataset.tableId);
    renderStaffTableCleaning();
  });

  selectedTable?.addEventListener("click", (event) => {
    const actionButton = event.target.closest("[data-cleaning-action]");
    if (!actionButton || !selectedTable.contains(actionButton)) return;
    void runTableCleaningAction(actionButton.dataset.cleaningAction);
  });

  refreshButton?.addEventListener("click", () => {
    setTableCleaningMessage();
    void loadTableCleaning();
  });

  initializeStaffTableSelection();
}

function initializeStaffTableSelection() {
  const floorPlan = document.getElementById("floorPlan");
  const selectedTable = document.getElementById("staffWalkInSelectedTable");
  const refreshButton = document.getElementById("staffTableSelectionRefresh");

  floorPlan?.addEventListener("click", (event) => {
    const tableCard = event.target.closest("[data-walk-in-table-id]");
    if (!tableCard || !floorPlan.contains(tableCard)) return;
    selectedWalkInTableId = Number(tableCard.dataset.walkInTableId);
    renderStaffTableSelection();
  });

  document.querySelectorAll("[data-staff-floor]").forEach((tab) => {
    tab.addEventListener("click", () => {
      activeWalkInFloor = Number(tab.dataset.staffFloor) === 2 ? 2 : 1;
      document.querySelectorAll("[data-staff-floor]").forEach((floorTab) => {
        const isActive = floorTab === tab;
        floorTab.classList.toggle("active", isActive);
        floorTab.setAttribute("aria-selected", String(isActive));
      });
      renderStaffTableSelection();
    });
  });

  selectedTable?.addEventListener("click", (event) => {
    if (!event.target.closest("[data-occupy-table]")) return;
    void occupyWalkInTable();
  });

  refreshButton?.addEventListener("click", () => {
    setWalkInTableMessage();
    void loadStaffTableSelection();
  });
}

function initializeStaffFloorPlanScaling() {
  const wrapper = document.querySelector("#table-selection .staff-occupancy-floor-scroll");
  if (!wrapper) return;

  if ("ResizeObserver" in window) {
    staffFloorPlanResizeObserver = new ResizeObserver(queueStaffFloorPlanScaleUpdate);
    staffFloorPlanResizeObserver.observe(wrapper);
  } else {
    window.addEventListener("resize", queueStaffFloorPlanScaleUpdate, { passive: true });
  }

  window.addEventListener("pagehide", () => {
    staffFloorPlanResizeObserver?.disconnect();
    staffFloorPlanResizeObserver = null;
    if (staffFloorPlanResizeFrame) {
      cancelAnimationFrame(staffFloorPlanResizeFrame);
      staffFloorPlanResizeFrame = 0;
    }
  }, { once: true });

  queueStaffFloorPlanScaleUpdate();
}

function updateStaffFloorPlanScale() {
  const wrapper = document.querySelector("#table-selection .staff-occupancy-floor-scroll");
  const scaleContent = document.querySelector("#table-selection .floor-plan-scale-content");
  const floorPlan = document.querySelector("#table-selection #floorPlan");
  if (!wrapper || !scaleContent || !floorPlan) return;

  if (window.innerWidth > 1024) {
    floorPlan.style.removeProperty("--staff-floor-plan-scale");
    floorPlan.style.removeProperty("margin-left");
    scaleContent.style.removeProperty("width");
    scaleContent.style.removeProperty("height");
    wrapper.style.removeProperty("height");
    wrapper.style.removeProperty("overflow-y");
    wrapper.style.removeProperty("overflow-x");
    return;
  }

  const availableWidth = Math.floor(wrapper.clientWidth);
  if (!availableWidth) return;

  const scale = Math.min(1, availableWidth / STAFF_FLOOR_PLAN_DESIGN_WIDTH);
  const styles = window.getComputedStyle(wrapper);
  const verticalPadding =
    (Number.parseFloat(styles.paddingTop) || 0) +
    (Number.parseFloat(styles.paddingBottom) || 0);
  const scaledWidth = STAFF_FLOOR_PLAN_DESIGN_WIDTH * scale;
  const scaledHeight = floorPlan.offsetHeight * scale;
  const maxVisibleHeight = Math.max(240, Math.min(560, window.innerHeight * 0.55));

  floorPlan.style.setProperty("--staff-floor-plan-scale", String(scale));
  floorPlan.style.removeProperty("margin-left");
  scaleContent.style.width = `${scaledWidth}px`;
  scaleContent.style.height = `${scaledHeight}px`;
  wrapper.style.height = `${Math.min(scaledHeight + verticalPadding, maxVisibleHeight)}px`;
  wrapper.style.setProperty("overflow-y", "auto", "important");
}

function queueStaffFloorPlanScaleUpdate() {
  if (staffFloorPlanResizeFrame) cancelAnimationFrame(staffFloorPlanResizeFrame);
  staffFloorPlanResizeFrame = requestAnimationFrame(() => {
    staffFloorPlanResizeFrame = 0;
    updateStaffFloorPlanScale();
  });
}

function setWalkInTableMessage(message = "", isError = false) {
  const messageElement = document.getElementById("staffTableSelectionMessage");
  if (!messageElement) return;
  messageElement.textContent = message;
  messageElement.classList.toggle("is-error", isError);
  messageElement.classList.toggle("is-success", Boolean(message) && !isError);
}

function isWalkInTableAvailable(table) {
  const chairs = getWalkInTableChairs(table);
  return String(table?.status || "").trim().toLowerCase() === "vacant" &&
    table?.has_active_reservation !== true &&
    chairs.length > 0 &&
    chairs.every((chair) => String(chair.status || "").trim().toLowerCase() === "vacant");
}

function getWalkInTableChairs(table) {
  return staffSelectionChairs.filter(
    (chair) => Number(chair.table_id ?? chair.tableId) === Number(table?.id)
  );
}

function getWalkInTableStatus(table) {
  const rawStatus = String(table?.status || "").trim().toLowerCase();
  const chairs = getWalkInTableChairs(table);
  if (
    table?.has_active_reservation === true ||
    ["reserved", "locked"].includes(rawStatus) ||
    chairs.some((chair) => ["reserved", "locked"].includes(String(chair.status || "").toLowerCase()))
  ) {
    return staffTableStatuses.reserved;
  }
  if (
    rawStatus === "vacant" &&
    chairs.some((chair) => String(chair.status || "").toLowerCase() !== "vacant")
  ) {
    return staffTableStatuses.occupied;
  }
  return getStaffTableStatus(rawStatus);
}

async function loadStaffTableSelection() {
  if (staffSelectionLoadPromise) {
    staffSelectionReloadQueued = true;
    return staffSelectionLoadPromise;
  }

  const floorPlan = document.getElementById("floorPlan");
  if (!floorPlan) return;

  floorPlan.setAttribute("aria-busy", "true");
  staffSelectionLoadPromise = (async () => {
    try {
      const chairs = await apiRequest("/chairs");
      const tables = await apiRequest("/tables");
      if (!Array.isArray(tables) || !Array.isArray(chairs)) {
        throw new Error("The tables response was not in the expected format.");
      }

      staffSelectionChairs = chairs.filter((chair) =>
        Number.isSafeInteger(Number(chair.id)) &&
        Number(chair.id) > 0 &&
        chair.deleted_at == null
      );
      staffSelectionTables = tables.filter((table) =>
        Number.isSafeInteger(Number(table.id)) &&
        Number(table.id) > 0 &&
        table.deleted_at == null
      );
      if (!staffSelectionTables.some((table) => Number(table.id) === selectedWalkInTableId)) {
        selectedWalkInTableId = null;
      }
      renderStaffTableSelection();
    } catch (error) {
      staffSelectionTables = [];
      staffSelectionChairs = [];
      selectedWalkInTableId = null;
      floorPlan.innerHTML = `<p class="floor-empty-message" role="alert">${escapeStaffHtml(error.message || "Tables could not be loaded.")}</p>`;
      renderSelectedWalkInTable();
      setWalkInTableMessage("Table data is unavailable. No occupancy action can be performed.", true);
      if (window.lucide) window.lucide.createIcons();
    } finally {
      floorPlan.setAttribute("aria-busy", "false");
    }
  })();

  try {
    await staffSelectionLoadPromise;
  } finally {
    staffSelectionLoadPromise = null;
    if (staffSelectionReloadQueued) {
      staffSelectionReloadQueued = false;
      void loadStaffTableSelection();
    }
  }
}

function renderStaffTableSelection() {
  const floorPlan = document.getElementById("floorPlan");
  if (!floorPlan) return;

  floorPlan.dataset.floor = String(activeWalkInFloor);
  floorPlan.innerHTML = "";
  const configuredTables = [...staffSelectionTables].sort(
    (first, second) => Number(first.id) - Number(second.id)
  );
  const tablesOnFloor = staffFloorPlanBlueprint.tables.filter(
    (table) => table.floor === activeWalkInFloor
  );
  const floorOffset = activeWalkInFloor === 1 ? 0 : 10;
  const floorTableSlots = configuredTables.slice(floorOffset, floorOffset + tablesOnFloor.length);
  const usedTableIds = new Set();
  let renderedTables = 0;

  tablesOnFloor.forEach((blueprintTable) => {
    const tableNameForSlot = `T${blueprintTable.id}`.toLowerCase();
    const realTable = configuredTables.find((table) =>
      !usedTableIds.has(Number(table.id)) &&
      String(table.table_name || table.name || "").trim().toLowerCase() === tableNameForSlot
    ) || configuredTables.find((table) =>
      !usedTableIds.has(Number(table.id)) &&
      Number(table.id) === blueprintTable.id
    ) || floorTableSlots.find((table) => !usedTableIds.has(Number(table.id)));
    if (!realTable) return;

    const tableId = Number(realTable.id);
    usedTableIds.add(tableId);
    renderedTables += 1;
    const tableName = realTable.table_name || realTable.name || `Table ${tableId}`;
    const chairs = getWalkInTableChairs(realTable);
    const status = getWalkInTableStatus(realTable);
    const isAvailable = isWalkInTableAvailable(realTable);
    const isSelected = selectedWalkInTableId === tableId;
    const tableGroup = document.createElement("div");
    tableGroup.className = "table-group";
    tableGroup.style.left = `${blueprintTable.x}%`;
    tableGroup.style.top = `${blueprintTable.y}%`;

    const tableBox = document.createElement("button");
    tableBox.type = "button";
    tableBox.className = `table-box ${blueprintTable.shape} table-select${isAvailable ? "" : " unavailable"}${isSelected ? " selected" : ""}`;
    tableBox.dataset.walkInTableId = String(tableId);
    tableBox.setAttribute("aria-pressed", String(isSelected));
    tableBox.title = `${tableName}: ${status.label}, ${chairs.length} seats`;
    tableBox.innerHTML = `
      <span>${escapeStaffHtml(tableName)}</span>
      <small>${chairs.length} seats</small>
      ${isAvailable ? "" : `<small class="table-status-label">${escapeStaffHtml(status.label)}</small>`}
    `;
    tableGroup.appendChild(tableBox);

    chairs.forEach((chair, index) => {
      const chairStatus = String(chair.status || "vacant").toLowerCase();
      const visualStatus = chairStatus === "vacant"
        ? "vacant"
        : ["reserved", "locked"].includes(chairStatus)
          ? "locked"
          : "occupied";
      const position = getStaffChairPosition(chairs.length, index, blueprintTable.shape);
      const chairMarker = document.createElement("span");
      chairMarker.className = `chair ${visualStatus}`;
      chairMarker.textContent = chair.chair_label || `C${index + 1}`;
      chairMarker.style.left = `calc(50% + ${position.x}px)`;
      chairMarker.style.top = `calc(50% + ${position.y}px)`;
      chairMarker.title = `${tableName} - Chair ${chair.chair_label || index + 1}: ${status.label}`;
      chairMarker.setAttribute("aria-label", `${tableName}, chair ${chair.chair_label || index + 1}, ${status.label}`);
      tableGroup.appendChild(chairMarker);
    });

    floorPlan.appendChild(tableGroup);
  });

  if (!renderedTables) {
    floorPlan.innerHTML = `<p class="floor-empty-message">${staffSelectionTables.length
      ? "No configured tables are available on this floor."
      : "No active table records were returned from the database."}</p>`;
  }

  queueStaffFloorPlanScaleUpdate();
  renderSelectedWalkInTable();
}

function getStaffChairPosition(chairCount, index, shape) {
  const radiusX = shape === "rect-large" ? 112 : shape === "rect-medium" ? 100 : shape === "circle" ? 78 : 68;
  const radiusY = shape === "rect-large" ? 70 : shape === "rect-medium" ? 64 : shape === "circle" ? 78 : 48;
  const angle = (-Math.PI / 2) + (2 * Math.PI * index) / Math.max(chairCount, 1);
  return {
    x: Math.round(Math.cos(angle) * radiusX),
    y: Math.round(Math.sin(angle) * radiusY),
  };
}

function renderSelectedWalkInTable() {
  const panel = document.getElementById("staffWalkInSelectedTable");
  if (!panel) return;

  const table = staffSelectionTables.find((item) => Number(item.id) === selectedWalkInTableId);
  if (!table) {
    panel.innerHTML = `
      <div class="staff-table-selection-prompt">
        <i data-lucide="mouse-pointer-2" aria-hidden="true"></i>
        <strong>Select a table</strong>
        <span>Its current availability and walk-in action will appear here.</span>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  const status = getWalkInTableStatus(table);
  const tableName = table.table_name || `Table ${table.id}`;
  const canOccupy = isWalkInTableAvailable(table);
  const chairCount = getWalkInTableChairs(table).length;
  const note = canOccupy
    ? "This table is available for walk-in guests."
    : table.has_active_reservation === true || ["reserved", "locked"].includes(String(table.status || "").toLowerCase())
      ? "An active reservation or hold protects this table. Staff cannot change its status manually."
      : String(table.status || "").toLowerCase() === "occupied"
        ? "This table is already occupied. Use the existing table-cleaning workflow after guests leave."
        : "This table is not available for walk-in occupancy.";

  panel.innerHTML = `
    <div class="staff-selected-table-heading">
      <span class="staff-selected-table-icon"><i data-lucide="${status.icon}" aria-hidden="true"></i></span>
      <div>
        <span class="section-kicker">SELECTED TABLE</span>
        <h3>${escapeStaffHtml(tableName)}</h3>
        <span class="staff-selected-table-id">Table ID ${Number(table.id)} · ${chairCount} seats</span>
      </div>
    </div>
    <div class="staff-selected-table-status ${status.className}">
      <span class="staff-status-indicator" aria-hidden="true"></span>
      <span>${escapeStaffHtml(status.label)}</span>
    </div>
    <p class="staff-selected-table-note">${escapeStaffHtml(note)}</p>
    ${canOccupy ? `
      <div class="staff-selected-table-action">
        <button class="staff-clean-button" type="button" data-occupy-table ${staffSelectionActionInProgress ? "disabled" : ""}>
          <i data-lucide="${staffSelectionActionInProgress ? "loader-circle" : "users-round"}" aria-hidden="true"></i>
          ${staffSelectionActionInProgress ? "Marking occupied…" : "Mark as Occupied"}
        </button>
      </div>
    ` : ""}
  `;
  if (window.lucide) window.lucide.createIcons();
}

async function occupyWalkInTable() {
  if (staffSelectionActionInProgress) return;
  const table = staffSelectionTables.find((item) => Number(item.id) === selectedWalkInTableId);
  if (!table || !isWalkInTableAvailable(table)) {
    setWalkInTableMessage("This table is no longer available. Refresh the table list before trying again.", true);
    void loadStaffTableSelection();
    return;
  }

  const tableName = table.table_name || `Table ${table.id}`;
  staffSelectionActionInProgress = true;
  renderStaffTableSelection();

  try {
    const confirmed = await window.DineAriNotifications.confirm({
      type: "warning",
      title: "Mark this table as occupied?",
      message: `Are you sure you want to mark Table ${Number(table.id)} as Occupied?`,
      confirmLabel: "Confirm",
    });
    if (!confirmed) return;

    const response = await apiRequest(`/tables/${Number(table.id)}/occupy`, {
      method: "PATCH",
    });
    staffSelectionTables = staffSelectionTables.map((item) =>
      Number(item.id) === Number(table.id)
        ? { ...item, status: "occupied", has_active_reservation: false }
        : item
    );
    renderStaffTableSelection();
    setWalkInTableMessage(response.message || `${tableName} marked as occupied.`);
    void loadStaffTableSelection();
  } catch (error) {
    setWalkInTableMessage(error.message || "The table could not be marked as occupied.", true);
    void loadStaffTableSelection();
  } finally {
    staffSelectionActionInProgress = false;
    renderStaffTableSelection();
  }
}

async function loadTableCleaning() {
  if (tableCleaningLoadPromise) {
    tableCleaningReloadQueued = true;
    return tableCleaningLoadPromise;
  }

  const tableGrid = document.getElementById("staffTableGrid");
  if (!tableGrid) return;

  tableGrid.setAttribute("aria-busy", "true");
  tableCleaningLoadPromise = (async () => {
    try {
      const tables = await apiRequest("/tables");
      if (!Array.isArray(tables)) {
        throw new Error("The tables response was not in the expected format.");
      }

      staffTables = tables.filter((table) =>
        Number.isSafeInteger(Number(table.id)) &&
        Number(table.id) > 0 &&
        table.deleted_at == null
      );

      const selectedTable = staffTables.find(
        (table) => Number(table.id) === selectedCleaningTableId
      );
      if (!selectedTable || !isCleaningTableEligible(selectedTable)) {
        selectedCleaningTableId = null;
      }

      tableGrid.setAttribute("aria-busy", "false");
      renderStaffTableCleaning();
    } catch (error) {
      staffTables = [];
      selectedCleaningTableId = null;
      [
        "staffTableCountAll",
        "staffTableCountNeedsCleaning",
        "staffTableCountCleaning",
        "staffTableCountVacant",
        "staffTableCountOccupied",
      ].forEach((id) => {
        const count = document.getElementById(id);
        if (count) count.textContent = "0";
      });
      tableGrid.setAttribute("aria-busy", "false");
      tableGrid.innerHTML = `
        <div class="staff-cleaning-empty is-error" role="alert">
          <i data-lucide="triangle-alert" aria-hidden="true"></i>
          <strong>Tables could not be loaded</strong>
          <span>${escapeStaffHtml(error.message || "Please try again shortly.")}</span>
        </div>
      `;
      renderSelectedCleaningTable();
      setTableCleaningMessage("Table data is unavailable. No cleaning action can be performed.", true);
      if (window.lucide) window.lucide.createIcons();
    } finally {
      tableGrid.setAttribute("aria-busy", "false");
    }
  })();

  try {
    await tableCleaningLoadPromise;
  } finally {
    tableCleaningLoadPromise = null;
    if (tableCleaningReloadQueued) {
      tableCleaningReloadQueued = false;
      void loadTableCleaning();
    }
  }
}

function renderStaffTableCleaning() {
  const tableGrid = document.getElementById("staffTableGrid");
  if (!tableGrid) return;

  const statusCounts = staffTables.reduce((counts, table) => {
    const status = String(table.status || "").toLowerCase();
    counts[status] = (counts[status] || 0) + 1;
    return counts;
  }, {});

  const countElements = {
    all: document.getElementById("staffTableCountAll"),
    needs_cleaning: document.getElementById("staffTableCountNeedsCleaning"),
    cleaning: document.getElementById("staffTableCountCleaning"),
    vacant: document.getElementById("staffTableCountVacant"),
    occupied: document.getElementById("staffTableCountOccupied"),
  };

  Object.entries(countElements).forEach(([status, element]) => {
    if (!element) return;
    element.textContent = status === "all"
      ? String(staffTables.length)
      : String(statusCounts[status] || 0);
  });

  const visibleTables = staffTables.filter((table) =>
    activeTableFilter === "all" ||
    String(table.status || "").toLowerCase() === activeTableFilter
  );

  tableGrid.innerHTML = visibleTables.length
    ? visibleTables.map((table) => {
      const status = getStaffTableStatus(table.status);
      const tableId = Number(table.id);
      const tableName = table.table_name || `Table ${tableId}`;
      const isSelected = tableId === selectedCleaningTableId;
      const isEligible = isCleaningTableEligible(table);
      return `
        <button class="staff-table-card ${status.className}${isSelected ? " is-selected" : ""}${isEligible ? "" : " is-ineligible"}"
                type="button" data-table-id="${tableId}" aria-pressed="${isSelected}" ${isEligible ? "" : "disabled"} title="${isEligible ? `Select ${escapeStaffHtml(tableName)}` : `${escapeStaffHtml(tableName)} is not eligible for a cleaning action`}">
          <span class="staff-table-card-top">
            <span class="staff-table-card-icon"><i data-lucide="${status.icon}" aria-hidden="true"></i></span>
            <span class="staff-table-status">${escapeStaffHtml(status.label)}</span>
          </span>
          <strong class="staff-table-name">${escapeStaffHtml(tableName)}</strong>
          <span class="staff-table-id">Table ID ${tableId}</span>
        </button>
      `;
    }).join("")
    : `
      <div class="staff-cleaning-empty">
        <i data-lucide="${staffTables.length ? "filter-x" : "table-properties"}" aria-hidden="true"></i>
        <strong>${staffTables.length ? "No matching tables" : "No restaurant tables found"}</strong>
        <span>${staffTables.length ? "Choose another status filter." : "No active table records were returned from the database."}</span>
      </div>
    `;

  renderSelectedCleaningTable();
  if (window.lucide) window.lucide.createIcons();
}

function renderSelectedCleaningTable() {
  const panel = document.getElementById("staffSelectedTable");
  if (!panel) return;

  const table = staffTables.find((item) => Number(item.id) === selectedCleaningTableId);
  if (!table) {
    panel.innerHTML = `
      <div class="staff-table-selection-prompt">
        <i data-lucide="mouse-pointer-2" aria-hidden="true"></i>
        <strong>Select a table</strong>
        <span>Its current status and next action will appear here.</span>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  const status = getStaffTableStatus(table.status);
  const tableName = table.table_name || `Table ${table.id}`;
  const actions = {
    occupied: {
      id: "mark-needs-cleaning",
      label: "Mark needs cleaning",
      icon: "brush-cleaning",
      hint: "Use this after guests have left the table.",
    },
    needs_cleaning: {
      id: "start-cleaning",
      label: "Start cleaning",
      icon: "play",
      hint: "Move this table into the active cleaning queue.",
    },
    cleaning: {
      id: "mark-clean",
      label: "Mark as clean",
      icon: "check",
      hint: "Confirm only after cleaning is complete.",
    },
  };
  const action = actions[String(table.status || "").toLowerCase()];
  const updatedAt = table.updated_at ? new Date(table.updated_at) : null;
  const updatedLabel = updatedAt && !Number.isNaN(updatedAt.valueOf())
    ? updatedAt.toLocaleString()
    : "";

  panel.innerHTML = `
    <div class="staff-selected-table-heading">
      <span class="staff-selected-table-icon"><i data-lucide="${status.icon}" aria-hidden="true"></i></span>
      <div>
        <span class="section-kicker">SELECTED TABLE</span>
        <h3>${escapeStaffHtml(tableName)}</h3>
        <span class="staff-selected-table-id">Table ID ${Number(table.id)}</span>
      </div>
    </div>
    <div class="staff-selected-table-status ${status.className}">
      <span class="staff-status-indicator" aria-hidden="true"></span>
      <span>${escapeStaffHtml(status.label)}</span>
    </div>
    ${updatedLabel ? `<p class="staff-table-updated">Last status update: ${escapeStaffHtml(updatedLabel)}</p>` : ""}
    ${action ? `
      <div class="staff-selected-table-action">
        <p>${escapeStaffHtml(action.hint)}</p>
        <button class="staff-clean-button" type="button" data-cleaning-action="${action.id}" ${tableCleaningActionInProgress ? "disabled" : ""}>
          <i data-lucide="${action.icon}" aria-hidden="true"></i>
          ${escapeStaffHtml(action.label)}
        </button>
      </div>
    ` : `
      <p class="staff-selected-table-note">
        ${String(table.status || "").toLowerCase() === "vacant"
          ? "This table is clean and ready for guests."
          : "No cleaning action is available for this table status."}
      </p>
    `}
  `;
  if (window.lucide) window.lucide.createIcons();
}

async function runTableCleaningAction(actionName) {
  if (tableCleaningActionInProgress) return;
  const table = staffTables.find((item) => Number(item.id) === selectedCleaningTableId);
  if (!table) {
    setTableCleaningMessage("Select a table before starting a cleaning action.", true);
    return;
  }

  const transitions = {
    "mark-needs-cleaning": {
      from: "occupied",
      path: "needs-cleaning",
      next: "Needs Cleaning",
      confirmation: `Confirm that guests have left and ${table.table_name || `Table ${table.id}`} should be marked as needing cleaning?`,
    },
    "start-cleaning": {
      from: "needs_cleaning",
      path: "start-cleaning",
      next: "Cleaning in Progress",
    },
    "mark-clean": {
      from: "cleaning",
      path: "clean",
      next: "Clean / Available",
      confirmation: `Confirm ${table.table_name || `Table ${table.id}`} has been cleaned and is ready for guests?`,
    },
  };
  const transition = transitions[actionName];
  if (!transition || String(table.status || "").toLowerCase() !== transition.from) {
    setTableCleaningMessage("This table's status changed. Refresh the table list before trying again.", true);
    void loadTableCleaning();
    return;
  }

  if (transition.confirmation) {
    tableCleaningActionInProgress = true;
    renderSelectedCleaningTable();
    const confirmed = await window.DineAriNotifications.confirm({
      type: "warning",
      title: actionName === "mark-clean" ? "Mark this table as clean?" : "Mark this table for cleaning?",
      message: transition.confirmation,
      confirmLabel: actionName === "mark-clean" ? "Mark as clean" : "Mark for cleaning",
    });
    if (!confirmed) {
      tableCleaningActionInProgress = false;
      renderSelectedCleaningTable();
      return;
    }
  }

  tableCleaningActionInProgress = true;
  renderSelectedCleaningTable();
  setTableCleaningMessage();

  try {
    const response = await apiRequest(`/tables/${Number(table.id)}/${transition.path}`, {
      method: "PATCH",
    });
    setTableCleaningMessage(
      response.message || `${table.table_name || `Table ${table.id}`} updated to ${transition.next}.`
    );
    await loadTableCleaning();
  } catch (error) {
    setTableCleaningMessage(error.message || "The table status could not be updated.", true);
    void loadTableCleaning();
  } finally {
    tableCleaningActionInProgress = false;
    renderStaffTableCleaning();
  }
}
>>>>>>> dec813b30e6e693a0d780375b8a2669b5c157d50
