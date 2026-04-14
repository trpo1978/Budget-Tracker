/**
 * Budget Tracker - a YNAB-style budgeting app.
 *
 * Data model (persisted in localStorage under key "budget-tracker/v1"):
 *   {
 *     bankBalance: number,
 *     categories: [{ id, name, target, assigned }],
 *     transactions: [{ id, date, categoryId, payee, amount }]
 *   }
 *
 * "Ready to Assign" = bankBalance - sum(category.assigned)
 * "Spent" per category = sum of transaction amounts against that category
 * "Available" per category = assigned - spent
 */

const STORAGE_KEY = "budget-tracker/v1";

const defaultState = () => ({
  bankBalance: 0,
  categories: [],
  transactions: [],
});

let state = loadState();

// ---------- Persistence ----------

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return {
      bankBalance: Number(parsed.bankBalance) || 0,
      categories: Array.isArray(parsed.categories) ? parsed.categories : [],
      transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
    };
  } catch (err) {
    console.warn("Failed to load saved state, starting fresh.", err);
    return defaultState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// ---------- Helpers ----------

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function fmtMoney(n) {
  const v = Number(n) || 0;
  const sign = v < 0 ? "-" : "";
  return sign + "$" + Math.abs(v).toFixed(2);
}

function spentForCategory(categoryId) {
  return state.transactions
    .filter((t) => t.categoryId === categoryId)
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);
}

function totalAssigned() {
  return state.categories.reduce((s, c) => s + Number(c.assigned || 0), 0);
}

function totalSpent() {
  return state.transactions.reduce((s, t) => s + Number(t.amount || 0), 0);
}

function totalTarget() {
  return state.categories.reduce((s, c) => s + Number(c.target || 0), 0);
}

function readyToAssign() {
  return state.bankBalance - totalAssigned();
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

// ---------- Rendering ----------

function renderSummary() {
  document.getElementById("summary-balance").textContent = fmtMoney(state.bankBalance);
  document.getElementById("summary-assigned").textContent = fmtMoney(totalAssigned());

  const ready = readyToAssign();
  const readyEl = document.getElementById("summary-ready");
  readyEl.textContent = fmtMoney(ready);
  readyEl.classList.remove("negative", "warn", "positive");
  if (ready < 0) readyEl.classList.add("negative");
  else if (ready > 0) readyEl.classList.add("positive");
}

function renderCategories() {
  const body = document.getElementById("categories-body");
  body.innerHTML = "";

  if (state.categories.length === 0) {
    body.innerHTML =
      '<tr class="empty-row"><td colspan="7">No categories yet. Add one to start budgeting.</td></tr>';
  } else {
    for (const cat of state.categories) {
      const spent = spentForCategory(cat.id);
      const available = Number(cat.assigned || 0) - spent;
      const target = Number(cat.target || 0);
      const assigned = Number(cat.assigned || 0);

      const pct = target > 0 ? Math.min(100, (assigned / target) * 100) : 0;
      let barClass = "";
      if (target > 0 && assigned >= target) barClass = "met";
      if (assigned > target && target > 0) barClass = "";
      if (spent > assigned) barClass = "over";

      const availClass = available < 0 ? "negative" : available > 0 ? "positive" : "";

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>
          <input type="text" class="cat-name" data-id="${cat.id}" value="${escapeAttr(cat.name)}" />
        </td>
        <td class="num">
          <input type="number" step="0.01" class="amount-input cat-target" data-id="${cat.id}" value="${target.toFixed(2)}" />
        </td>
        <td class="num">
          <input type="number" step="0.01" class="amount-input cat-assigned" data-id="${cat.id}" value="${assigned.toFixed(2)}" />
        </td>
        <td class="num">${fmtMoney(spent)}</td>
        <td class="num ${availClass}">${fmtMoney(available)}</td>
        <td>
          <div class="progress" title="${pct.toFixed(0)}% of target assigned">
            <div class="progress-bar ${barClass}" style="width:${pct}%"></div>
          </div>
        </td>
        <td><button class="btn icon danger delete-cat" data-id="${cat.id}" title="Delete category">Delete</button></td>
      `;
      body.appendChild(tr);
    }
  }

  document.getElementById("total-target").textContent = fmtMoney(totalTarget());
  document.getElementById("total-assigned").textContent = fmtMoney(totalAssigned());
  document.getElementById("total-spent").textContent = fmtMoney(totalSpent());
  document.getElementById("total-available").textContent = fmtMoney(
    totalAssigned() - totalSpent()
  );
}

function renderTransactions() {
  const body = document.getElementById("transactions-body");
  body.innerHTML = "";

  if (state.transactions.length === 0) {
    body.innerHTML =
      '<tr class="empty-row"><td colspan="5">No transactions yet.</td></tr>';
    return;
  }

  const sorted = [...state.transactions].sort((a, b) => (a.date < b.date ? 1 : -1));
  for (const tx of sorted) {
    const cat = state.categories.find((c) => c.id === tx.categoryId);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(tx.date)}</td>
      <td>${cat ? escapeHtml(cat.name) : '<em>(deleted)</em>'}</td>
      <td>${escapeHtml(tx.payee || "")}</td>
      <td class="num">${fmtMoney(tx.amount)}</td>
      <td><button class="btn icon danger delete-tx" data-id="${tx.id}">Delete</button></td>
    `;
    body.appendChild(tr);
  }
}

function renderCategoryOptions() {
  const select = document.getElementById("new-tx-category");
  const prev = select.value;
  select.innerHTML = "";
  if (state.categories.length === 0) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "Add a category first";
    opt.disabled = true;
    opt.selected = true;
    select.appendChild(opt);
    return;
  }
  for (const cat of state.categories) {
    const opt = document.createElement("option");
    opt.value = cat.id;
    opt.textContent = cat.name;
    select.appendChild(opt);
  }
  if (prev && state.categories.some((c) => c.id === prev)) select.value = prev;
}

function renderAll() {
  renderSummary();
  renderCategories();
  renderTransactions();
  renderCategoryOptions();
  // keep bank balance input reflecting saved value if empty
  const input = document.getElementById("bank-balance");
  if (document.activeElement !== input) {
    input.value = state.bankBalance ? Number(state.bankBalance).toFixed(2) : "";
  }
}

// ---------- Escaping ----------

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[ch]));
}
function escapeAttr(s) {
  return escapeHtml(s);
}

// ---------- Event handlers ----------

function setupEventListeners() {
  // Bank balance
  document.getElementById("save-balance").addEventListener("click", () => {
    const input = document.getElementById("bank-balance");
    const val = parseFloat(input.value);
    state.bankBalance = isFinite(val) ? val : 0;
    saveState();
    renderAll();
  });
  document.getElementById("bank-balance").addEventListener("keydown", (e) => {
    if (e.key === "Enter") document.getElementById("save-balance").click();
  });

  // Add category toggle
  const addCatBtn = document.getElementById("add-category-btn");
  const addCatForm = document.getElementById("add-category-form");
  addCatBtn.addEventListener("click", () => {
    addCatForm.classList.toggle("hidden");
    if (!addCatForm.classList.contains("hidden")) {
      document.getElementById("new-category-name").focus();
    }
  });
  document.getElementById("cancel-add-category").addEventListener("click", () => {
    addCatForm.classList.add("hidden");
    addCatForm.reset();
  });
  addCatForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = document.getElementById("new-category-name").value.trim();
    const targetVal = parseFloat(document.getElementById("new-category-target").value);
    if (!name) return;
    state.categories.push({
      id: uid(),
      name,
      target: isFinite(targetVal) ? targetVal : 0,
      assigned: 0,
    });
    saveState();
    addCatForm.reset();
    addCatForm.classList.add("hidden");
    renderAll();
  });

  // Category table: edit name / target / assigned / delete
  const body = document.getElementById("categories-body");
  body.addEventListener("change", (e) => {
    const id = e.target.dataset.id;
    if (!id) return;
    const cat = state.categories.find((c) => c.id === id);
    if (!cat) return;
    if (e.target.classList.contains("cat-name")) {
      const v = e.target.value.trim();
      if (v) cat.name = v;
    } else if (e.target.classList.contains("cat-target")) {
      const v = parseFloat(e.target.value);
      cat.target = isFinite(v) ? v : 0;
    } else if (e.target.classList.contains("cat-assigned")) {
      const v = parseFloat(e.target.value);
      cat.assigned = isFinite(v) ? v : 0;
    }
    saveState();
    renderAll();
  });
  body.addEventListener("click", (e) => {
    if (e.target.classList.contains("delete-cat")) {
      const id = e.target.dataset.id;
      const cat = state.categories.find((c) => c.id === id);
      if (!cat) return;
      const txCount = state.transactions.filter((t) => t.categoryId === id).length;
      const msg = txCount
        ? `Delete category "${cat.name}"? This will also delete ${txCount} transaction(s) in it.`
        : `Delete category "${cat.name}"?`;
      if (!confirm(msg)) return;
      state.categories = state.categories.filter((c) => c.id !== id);
      state.transactions = state.transactions.filter((t) => t.categoryId !== id);
      saveState();
      renderAll();
    }
  });

  // Add transaction toggle
  const addTxBtn = document.getElementById("add-transaction-btn");
  const addTxForm = document.getElementById("add-transaction-form");
  addTxBtn.addEventListener("click", () => {
    if (state.categories.length === 0) {
      alert("Add at least one category before logging a transaction.");
      return;
    }
    addTxForm.classList.toggle("hidden");
    if (!addTxForm.classList.contains("hidden")) {
      document.getElementById("new-tx-date").value = todayIso();
      document.getElementById("new-tx-payee").focus();
    }
  });
  document.getElementById("cancel-add-tx").addEventListener("click", () => {
    addTxForm.classList.add("hidden");
    addTxForm.reset();
  });
  addTxForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const date = document.getElementById("new-tx-date").value || todayIso();
    const categoryId = document.getElementById("new-tx-category").value;
    const payee = document.getElementById("new-tx-payee").value.trim();
    const amount = parseFloat(document.getElementById("new-tx-amount").value);
    if (!categoryId || !isFinite(amount) || amount <= 0) return;
    state.transactions.push({
      id: uid(),
      date,
      categoryId,
      payee,
      amount,
    });
    saveState();
    addTxForm.reset();
    addTxForm.classList.add("hidden");
    renderAll();
  });

  // Transaction delete
  document.getElementById("transactions-body").addEventListener("click", (e) => {
    if (e.target.classList.contains("delete-tx")) {
      const id = e.target.dataset.id;
      state.transactions = state.transactions.filter((t) => t.id !== id);
      saveState();
      renderAll();
    }
  });

  // Export / Import / Reset
  document.getElementById("export-data").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `budget-tracker-${todayIso()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  const importFile = document.getElementById("import-file");
  document.getElementById("import-data").addEventListener("click", () => {
    importFile.click();
  });
  importFile.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (typeof parsed !== "object" || parsed === null) throw new Error("Invalid");
        state = {
          bankBalance: Number(parsed.bankBalance) || 0,
          categories: Array.isArray(parsed.categories) ? parsed.categories : [],
          transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
        };
        saveState();
        renderAll();
        alert("Data imported successfully.");
      } catch (err) {
        alert("Could not import file: " + err.message);
      }
    };
    reader.readAsText(file);
    importFile.value = "";
  });

  document.getElementById("reset-data").addEventListener("click", () => {
    if (!confirm("Reset ALL budget data? This cannot be undone.")) return;
    state = defaultState();
    saveState();
    renderAll();
  });
}

// ---------- Boot ----------

document.addEventListener("DOMContentLoaded", () => {
  setupEventListeners();
  renderAll();
});
