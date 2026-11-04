const API_BASE = `${window.location.origin}/api`;

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}

async function loadReceipt() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const token = params.get("token");

    const receiptContent = document.getElementById("receiptContent");

    if (!code || !token) {
        receiptContent.innerHTML = `<p class="muted">Invalid receipt link.</p>`;
        return;
    }

    try {
        const response = await fetch(
            `${API_BASE}/orders/receipt?code=${encodeURIComponent(code)}&token=${encodeURIComponent(token)}`
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "Receipt not found.");
        }

        receiptContent.innerHTML = `
      <div class="official-receipt">
        <h2>Dine-Ari Official Receipt</h2>

        <div class="receipt-info-grid">
          <p><strong>Order Number:</strong> ${escapeHtml(data.order_code)}</p>
          <p><strong>Customer:</strong> ${escapeHtml(data.customer_name || "Guest")}</p>
          ${data.contact_number ? `<p><strong>Contact:</strong> ${escapeHtml(data.contact_number)}</p>` : ""}
          <p><strong>Order Type:</strong> ${escapeHtml(String(data.type).replace("_", " ").toUpperCase())}</p>
          <p><strong>Payment Method:</strong> ${escapeHtml(data.payment_method || "GCash")}</p>
          <p><strong>Payment Status:</strong> ${escapeHtml(String(data.payment_status || "unpaid").toUpperCase())}</p>
          <p><strong>Date:</strong> ${escapeHtml(new Date(data.created_at).toLocaleString())}</p>
        </div>

        <hr>

        <h3>Order Breakdown</h3>

        <table class="receipt-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Qty</th>
              <th>Price</th>
              <th>Subtotal</th>
            </tr>
          </thead>

          <tbody>
            ${data.items.map(item => `
              <tr>
                <td>${escapeHtml(item.item_name)}</td>
                <td>${escapeHtml(item.quantity)}</td>
                <td>₱${escapeHtml(Number(item.unit_price).toFixed(2))}</td>
                <td>₱${escapeHtml(Number(item.subtotal).toFixed(2))}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>

        <h2 class="receipt-total">
          Total: ₱${escapeHtml(Number(data.total_amount).toFixed(2))}
        </h2>
      </div>
    `;
    } catch (error) {
        receiptContent.innerHTML = `<p class="muted">${error.message}</p>`;
    }
}

document.addEventListener("DOMContentLoaded", loadReceipt);