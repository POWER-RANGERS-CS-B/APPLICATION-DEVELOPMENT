window.addEventListener("DOMContentLoaded", () => {
  const user = getUser();
  const role = String(user.role || localStorage.getItem("role") || "")
    .trim()
    .toLowerCase();

  if (!getToken() || !["admin", "staff"].includes(role)) {
    window.location.replace("./login.html");
    return;
  }

  const sidebar = document.querySelector(".staff-sidebar");
  const menuToggle = document.querySelector(".staff-mobile-menu-toggle");
  const drawerBackdrop = document.querySelector(".staff-drawer-backdrop");
  const setNavigationOpen = (isOpen) => {
    sidebar.classList.toggle("is-navigation-open", isOpen);
    document.body.classList.toggle("staff-navigation-open", isOpen);
    menuToggle.setAttribute("aria-expanded", String(isOpen));
    menuToggle.setAttribute("aria-label", isOpen ? "Close staff navigation" : "Open staff navigation");
  };
  const updateActiveNavigation = () => {
    const requestedSection = window.location.hash.slice(1);
    const activeSection = ["overview", "orders", "table-cleaning"].includes(requestedSection)
      ? requestedSection
      : "overview";

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

    setNavigationOpen(false);

    if (window.location.hash && requestedSection !== activeSection) {
      window.location.hash = activeSection;
    }
  };

  window.addEventListener("hashchange", updateActiveNavigation);
  window.addEventListener("pageshow", (event) => {
    if (event.persisted && window.location.hash === "#table-cleaning") {
      void loadTableCleaning();
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

  initializeTableCleaning();
  void loadKds();
  setInterval(loadKds, 5000);
  setInterval(() => {
    if (window.location.hash === "#table-cleaning") {
      void loadTableCleaning();
    }
  }, 15000);
});

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
              <article class="staff-order-card">
                <div class="staff-order-summary">
                  <div>
                    <span class="staff-order-label">ORDER</span>
                    <h3>#${escapeStaffHtml(order.order_code)}</h3>
                  </div>
                  <span class="status-badge status-${escapeStaffHtml(order.status)}">${escapeStaffHtml(String(order.status).toUpperCase())}</span>
                </div>
                <div class="staff-order-total">
                  <span class="muted">Order total</span>
                  <strong>₱${Number(order.total_amount).toFixed(2)}</strong>
                </div>
                <div class="staff-order-actions" aria-label="Update order status">
                  <button class="secondary" onclick="updateOrderStatus(${Number(order.id)}, 'preparing')"><i data-lucide="chef-hat" aria-hidden="true"></i> Preparing</button>
                  <button class="secondary" onclick="updateOrderStatus(${Number(order.id)}, 'ready')"><i data-lucide="badge-check" aria-hidden="true"></i> Ready</button>
                  <button onclick="updateOrderStatus(${Number(order.id)}, 'completed')"><i data-lucide="check-check" aria-hidden="true"></i> Completed</button>
                </div>
              </article>
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
}

async function updateOrderStatus(id, status) {
  try {
    await apiRequest(`/orders/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
  } catch (patchError) {
    await apiRequest(`/orders/${id}/status`, {
      method: "PUT",
      body: JSON.stringify({ status }),
    });
  }

  await loadKds();
}

let staffTables = [];
let selectedCleaningTableId = null;
let activeTableFilter = "all";
let tableCleaningLoadPromise = null;
let tableCleaningReloadQueued = false;
let tableCleaningActionInProgress = false;

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