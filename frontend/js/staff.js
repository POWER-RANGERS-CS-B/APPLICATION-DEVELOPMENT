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

    setNavigationOpen(false);

    if (window.location.hash && requestedSection !== activeSection) {
      window.location.hash = activeSection;
    }
  };

  window.addEventListener("hashchange", updateActiveNavigation);
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

  void loadKds();
  setInterval(loadKds, 5000);
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

async function markCleaned() {
  const tableIdInput = document.getElementById("tableId");
  const tableId = tableIdInput ? tableIdInput.value.trim() : "";

  if (!tableId) {
    alert("Please enter a Table ID.");
    return;
  }

  try {
    console.log(`Sending clean request for Table ID: ${tableId}`);
    
    // Explicitly send PATCH request to clean the table
    const response = await apiRequest(`/tables/${tableId}/clean`, { 
      method: "PATCH" 
    });

    alert(response.message || `Table #${tableId} cleaned and reset successfully.`);
    tableIdInput.value = ""; // Clear input field
  } catch (error) {
    console.error("Table cleaning failed:", error);
    alert("Failed to clean table: " + error.message);
  }
}