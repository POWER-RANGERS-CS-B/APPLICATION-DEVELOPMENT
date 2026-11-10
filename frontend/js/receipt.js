const API_BASE = `${window.location.origin}/api`;

function formatCurrency(value) {
    const amount = Number(value);
    if (!Number.isFinite(amount)) {
        throw new Error("Receipt contains an invalid amount.");
    }

    return `₱${amount.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })}`;
}

function appendReceiptInfo(container, label, value) {
    if (value == null || value === "") return;

    const row = document.createElement("p");
    const heading = document.createElement("strong");
    heading.textContent = `${label}: `;
    row.append(heading, document.createTextNode(String(value)));
    container.append(row);
}

function showReceiptMessage(container, message, isError = false) {
    const paragraph = document.createElement("p");
    paragraph.className = isError ? "muted receipt-error" : "muted";
    paragraph.setAttribute("role", isError ? "alert" : "status");
    paragraph.textContent = message;
    container.replaceChildren(paragraph);
}

function renderReceipt(receipt, container) {
    if (
        !receipt ||
        !receipt.order_code ||
        !Array.isArray(receipt.items) ||
        receipt.items.length === 0
    ) {
        throw new Error("Receipt information is incomplete.");
    }

    const receiptElement = document.createElement("article");
    receiptElement.className = "official-receipt";

    const title = document.createElement("h2");
    title.textContent = "Dine-Ari Official Receipt";
    receiptElement.append(title);

    const info = document.createElement("div");
    info.className = "receipt-info-grid";
    appendReceiptInfo(info, "Restaurant", "Dine-Ari Chef’s Table");
    appendReceiptInfo(info, "Receipt Number", receipt.order_code);
    appendReceiptInfo(info, "Customer", receipt.customer_name || "Guest");
    appendReceiptInfo(info, "Order Type", receipt.type
        ? String(receipt.type).replace(/_/g, " ").toUpperCase()
        : null);
    appendReceiptInfo(info, "Payment Method", receipt.payment_method);
    appendReceiptInfo(info, "Payment Status", receipt.payment_status
        ? String(receipt.payment_status).toUpperCase()
        : null);

    if (receipt.created_at) {
        const date = new Date(receipt.created_at);
        appendReceiptInfo(
            info,
            "Date",
            Number.isNaN(date.getTime()) ? null : date.toLocaleString()
        );
    }
    receiptElement.append(info);

    const breakdownHeading = document.createElement("h3");
    breakdownHeading.textContent = "Order Breakdown";
    receiptElement.append(breakdownHeading);

    const table = document.createElement("table");
    table.className = "receipt-table";
    const caption = document.createElement("caption");
    caption.textContent = "Purchased items";
    table.append(caption);

    const tableHead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    ["Item", "Qty", "Price", "Subtotal"].forEach((label) => {
        const cell = document.createElement("th");
        cell.scope = "col";
        cell.textContent = label;
        headerRow.append(cell);
    });
    tableHead.append(headerRow);
    table.append(tableHead);

    const tableBody = document.createElement("tbody");
    let subtotal = 0;
    receipt.items.forEach((item) => {
        const quantity = Number(item.quantity);
        const unitPrice = Number(item.unit_price);
        const lineSubtotal = Number(item.subtotal);
        if (
            !Number.isFinite(quantity) ||
            !Number.isFinite(unitPrice) ||
            !Number.isFinite(lineSubtotal)
        ) {
            throw new Error("Receipt contains an invalid item.");
        }

        subtotal += lineSubtotal;
        const row = document.createElement("tr");
        [
            item.item_name || "",
            String(quantity),
            formatCurrency(unitPrice),
            formatCurrency(lineSubtotal)
        ].forEach((value) => {
            const cell = document.createElement("td");
            cell.textContent = value;
            row.append(cell);
        });
        tableBody.append(row);
    });
    table.append(tableBody);
    receiptElement.append(table);

    const subtotalRow = document.createElement("p");
    subtotalRow.className = "receipt-subtotal";
    const subtotalLabel = document.createElement("strong");
    subtotalLabel.textContent = "Subtotal:";
    subtotalRow.append(subtotalLabel, ` ${formatCurrency(subtotal)}`);
    receiptElement.append(subtotalRow);

    const total = document.createElement("p");
    total.className = "receipt-total";
    total.textContent = `Total: ${formatCurrency(receipt.total_amount)}`;
    receiptElement.append(total);

    container.replaceChildren(receiptElement);
}

async function loadReceipt() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const token = params.get("token");
    const receiptContent = document.getElementById("receiptContent");
    const printButton = document.getElementById("printReceiptButton");

    if (!receiptContent) return;
    receiptContent.setAttribute("aria-busy", "true");

    if (!code || !token) {
        showReceiptMessage(receiptContent, "This receipt link is invalid.", true);
        receiptContent.setAttribute("aria-busy", "false");
        if (printButton) printButton.disabled = true;
        return;
    }

    showReceiptMessage(receiptContent, "Loading receipt…");

    try {
        const response = await fetch(
            `${API_BASE}/orders/receipt?code=${encodeURIComponent(code)}&token=${encodeURIComponent(token)}`,
            { cache: "no-store" }
        );
        const receipt = await response.json().catch(() => null);

        if (response.status === 400) {
            throw new Error("This receipt link is invalid.");
        }
        if (response.status === 404) {
            throw new Error("Receipt not found. Check the link or contact the restaurant.");
        }
        if (!response.ok || !receipt) {
            throw new Error("Receipt information could not be retrieved. Please try again later.");
        }

        renderReceipt(receipt, receiptContent);
        if (printButton) printButton.disabled = false;
    } catch (error) {
        console.error("Receipt loading failed:", error);
        const message = error instanceof TypeError
            ? "Receipt could not be loaded because of a network connection problem. Please try again."
            : error.message;
        showReceiptMessage(receiptContent, message, true);
        if (printButton) printButton.disabled = true;
    } finally {
        receiptContent.setAttribute("aria-busy", "false");
    }
}

document.addEventListener("DOMContentLoaded", loadReceipt);
