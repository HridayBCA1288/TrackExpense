
const STORAGE_KEY = "mymoney_transactions_v1";
const THEME_KEY = "mymoney_theme_v1";
const BUDGET_PREFIX = "mymoney_budget_";

const $ = id => document.getElementById(id);

const form = $("transaction-form");
const descriptionInput = $("description");
const amountInput = $("amount");
const categoryInput = $("category");
const dateInput = $("transaction-date");
const transactionList = $("transaction-list");
const filterInput = $("filter");
const searchInput = $("search");
const emptyState = $("empty-state");
const formMessage = $("form-message");
const toast = $("toast");

const categoryIcons = {
  Food: "🍔",
  Transport: "🚗",
  Shopping: "🛍️",
  Bills: "📄",
  Health: "💊",
  Education: "📚",
  Entertainment: "🎬",
  Salary: "💼",
  Freelance: "💻",
  Other: "📦"
};

let categoryChart = null;
let monthlyChart = null;
let toastTimer = null;

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function currentMonthKey() {
  return localDateString().slice(0, 7);
}

function currentMonth(dateString) {
  return dateString.slice(0, 7) === currentMonthKey();
}

function formatMoney(amount) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
  }).format(amount);
}

function formatDate(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

function loadTransactions() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : [];

    if (!Array.isArray(parsed)) return [];

    return parsed.filter(item =>
      item &&
      typeof item.id === "string" &&
      typeof item.description === "string" &&
      Number.isFinite(item.amount) &&
      item.amount > 0 &&
      ["income", "expense"].includes(item.type) &&
      typeof item.category === "string" &&
      typeof item.date === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(item.date) &&
      !Number.isNaN(Date.parse(item.date)) &&
      localDateString(new Date(item.date + "T12:00:00")) === item.date
    );
  } catch {
    showToast("Could not read saved transactions.");
    return [];
  }
}

let transactions = loadTransactions();

function saveTransactions() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
    return true;
  } catch {
    showToast("Could not save data. Check browser storage.");
    return false;
  }
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}

function getMonthTransactions() {
  return transactions.filter(item => currentMonth(item.date));
}

function getTotals(items) {
  return items.reduce((totals, item) => {
    totals[item.type] += item.amount;
    return totals;
  }, { income: 0, expense: 0 });
}

// ---------------- DASHBOARD ----------------

function updateDashboard() {
  const allTotals = getTotals(transactions);
  const monthlyTotals = getTotals(getMonthTransactions());

  $("balance").textContent = formatMoney(
    allTotals.income - allTotals.expense
  );

  $("income").textContent = formatMoney(monthlyTotals.income);
  $("expenses").textContent = formatMoney(monthlyTotals.expense);

  $("monthly-net").textContent = formatMoney(
    monthlyTotals.income - monthlyTotals.expense
  );

  $("transaction-count").textContent =
    `${transactions.length} ${transactions.length === 1 ? "item" : "items"}`;
}

// ---------------- MONTHLY BUDGET ----------------

function budgetStorageKey() {
  return BUDGET_PREFIX + currentMonthKey();
}

function getBudget() {
  try {
    const value = localStorage.getItem(budgetStorageKey());

    if (value === null) return null;

    const amount = Number(value);
    return Number.isFinite(amount) && amount > 0 ? amount : null;
  } catch {
    return null;
  }
}

function saveBudget(amount) {
  try {
    localStorage.setItem(budgetStorageKey(), String(amount));
    return true;
  } catch {
    showToast("Could not save budget in browser storage.");
    return false;
  }
}

function updateBudget() {
  const budget = getBudget();
  const spent = getMonthTransactions()
    .filter(item => item.type === "expense")
    .reduce((sum, item) => sum + item.amount, 0);

  $("budget-spent").textContent = formatMoney(spent);
  $("budget-total").textContent = budget ? formatMoney(budget) : "Not set";
  $("budget-remaining").textContent = budget
    ? formatMoney(budget - spent)
    : "Not set";

  const progress = $("budget-progress");
  const status = $("budget-status");

  progress.className = "progress-fill";
  status.className = "budget-status";

  if (!budget) {
    progress.style.width = "0%";
    status.textContent = "Set a monthly budget to start tracking your spending.";
    return;
  }

  const percentage = (spent / budget) * 100;
  progress.style.width = `${Math.min(percentage, 100)}%`;

  if (percentage >= 100) {
    progress.classList.add("danger");
    status.classList.add("danger");
    status.textContent =
      `Budget exceeded by ${formatMoney(spent - budget)}. Review your spending!`;
  } else if (percentage >= 80) {
    progress.classList.add("warning");
    status.classList.add("warning");
    status.textContent =
      `Warning: ${percentage.toFixed(0)}% of your budget used. ` +
      `${formatMoney(budget - spent)} remaining.`;
  } else {
    status.textContent =
      `${percentage.toFixed(0)}% of your budget used. ` +
      `${formatMoney(budget - spent)} remaining this month.`;
  }

  $("budget-amount").value = budget;
}

$("budget-form").addEventListener("submit", event => {
  event.preventDefault();

  const amount = Number($("budget-amount").value);

  if (!Number.isFinite(amount) || amount <= 0) {
    showToast("Enter a budget greater than zero.");
    return;
  }

  if (!saveBudget(Math.round(amount * 100) / 100)) return;

  updateBudget();
  showToast("Monthly budget saved!");
});

// ---------------- CHARTS ----------------

function chartColors() {
  const dark = document.body.classList.contains("dark");

  return {
    text: dark ? "#d5ddeb" : "#586174",
    grid: dark ? "#303b4d" : "#e9ebf0",
    green: dark ? "#56d6a0" : "#168b65",
    red: dark ? "#ff8189" : "#df5c63"
  };
}

function updateCharts() {
  if (typeof Chart === "undefined") {
    showToast("Charts unavailable. Check your internet connection.");
    return;
  }

  const colors = chartColors();
  const monthlyExpenses = getMonthTransactions()
    .filter(item => item.type === "expense");

  const categoryTotals = {};

  monthlyExpenses.forEach(item => {
    categoryTotals[item.category] =
      (categoryTotals[item.category] || 0) + item.amount;
  });

  const categoryNames = Object.keys(categoryTotals);
  const categoryValues = categoryNames.map(name => categoryTotals[name]);

  if (categoryChart) categoryChart.destroy();

  categoryChart = new Chart($("category-chart"), {
    type: "doughnut",
    data: {
      labels: categoryNames.length ? categoryNames : ["No expenses yet"],
      datasets: [{
        data: categoryValues.length ? categoryValues : [1],
        backgroundColor: categoryNames.length
          ? [
              "#168b65", "#5296d5", "#e7a23b", "#df5c63",
              "#9370db", "#45a9ad", "#ed8a45", "#718096",
              "#cc79a7", "#91a86b"
            ]
          : [colors.grid],
        borderColor: document.body.classList.contains("dark")
          ? "#1a2230" : "#ffffff",
        borderWidth: 3,
        hoverOffset: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "66%",
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            color: colors.text,
            padding: 15,
            usePointStyle: true,
            pointStyle: "circle",
            boxWidth: 8
          }
        },
        tooltip: {
          callbacks: {
            label(context) {
              if (!categoryNames.length) return "No expenses recorded";
              return `${context.label}: ${formatMoney(context.raw)}`;
            }
          }
        }
      },
      onClick(event, elements) {
        if (!elements.length || !categoryNames.length) return;

        const index = elements[0].index;
        searchInput.value = categoryNames[index];
        filterInput.value = "expense";
        renderTransactions();
        $("transaction-list").scrollIntoView({
          behavior: "smooth",
          block: "center"
        });
      }
    }
  });

  // Last six calendar months, including months with no transactions.
  const monthDates = [];

  for (let i = 5; i >= 0; i--) {
    const date = new Date();
    date.setDate(1);
    date.setMonth(date.getMonth() - i);
    monthDates.push(date);
  }

  const monthLabels = monthDates.map(date =>
    date.toLocaleDateString("en-IN", { month: "short", year: "2-digit" })
  );

  const incomeData = monthDates.map(date => {
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    return transactions
      .filter(item => item.date.startsWith(key) && item.type === "income")
      .reduce((sum, item) => sum + item.amount, 0);
  });

  const expenseData = monthDates.map(date => {
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    return transactions
      .filter(item => item.date.startsWith(key) && item.type === "expense")
      .reduce((sum, item) => sum + item.amount, 0);
  });

  if (monthlyChart) monthlyChart.destroy();

  monthlyChart = new Chart($("monthly-chart"), {
    type: "bar",
    data: {
      labels: monthLabels,
      datasets: [
        {
          label: "Income",
          data: incomeData,
          backgroundColor: colors.green,
          borderRadius: 5,
          maxBarThickness: 25
        },
        {
          label: "Expenses",
          data: expenseData,
          backgroundColor: colors.red,
          borderRadius: 5,
          maxBarThickness: 25
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: {
          position: "bottom",
          labels: { color: colors.text, usePointStyle: true, padding: 16 }
        },
        tooltip: {
          callbacks: {
            label(context) {
              return `${context.dataset.label}: ${formatMoney(context.raw)}`;
            }
          }
        }
      },
      scales: {
        x: {
          ticks: { color: colors.text },
          grid: { display: false }
        },
        y: {
          beginAtZero: true,
          ticks: {
            color: colors.text,
            callback(value) {
              return "₹" + Number(value).toLocaleString("en-IN");
            }
          },
          grid: { color: colors.grid }
        }
      }
    }
  });
}

// ---------------- TRANSACTION LIST ----------------

function createTransactionElement(item) {
  const row = document.createElement("div");
  row.className = "transaction";

  const icon = document.createElement("div");
  icon.className = "category-icon";
  icon.textContent = categoryIcons[item.category] || "📦";

  const info = document.createElement("div");
  info.className = "transaction-info";

  const title = document.createElement("strong");
  title.textContent = item.description;

  const details = document.createElement("small");
  details.textContent = `${item.category} · ${formatDate(item.date)}`;

  info.append(title, details);

  const right = document.createElement("div");
  right.className = "transaction-right";

  const amount = document.createElement("span");
  amount.className = `transaction-amount ${item.type}`;
  amount.textContent =
    `${item.type === "income" ? "+" : "−"}${formatMoney(item.amount)}`;

  const deleteButton = document.createElement("button");
  deleteButton.className = "delete-btn";
  deleteButton.type = "button";
  deleteButton.textContent = "Delete";
  deleteButton.setAttribute("aria-label", `Delete ${item.description}`);

  deleteButton.addEventListener("click", () => {
    if (!confirm(`Delete "${item.description}"?`)) return;

    const previous = transactions;
    transactions = transactions.filter(transaction =>
      transaction.id !== item.id
    );

    if (!saveTransactions()) {
      transactions = previous;
      return;
    }

    refreshDashboard();
    showToast("Transaction deleted.");
  });

  right.append(amount, deleteButton);
  row.append(icon, info, right);

  return row;
}

function renderTransactions() {
  const filter = filterInput.value;
  const search = searchInput.value.trim().toLowerCase();

  const filtered = transactions
    .filter(item => filter === "all" || item.type === filter)
    .filter(item =>
      item.description.toLowerCase().includes(search) ||
      item.category.toLowerCase().includes(search)
    )
    .sort((a, b) =>
      b.date.localeCompare(a.date) || b.id.localeCompare(a.id)
    );

  transactionList.replaceChildren();

  filtered.forEach(item => {
    transactionList.appendChild(createTransactionElement(item));
  });

  emptyState.style.display = filtered.length === 0 ? "flex" : "none";

  if (transactions.length > 0 && filtered.length === 0) {
    emptyState.querySelector("strong").textContent = "No matching transactions";
    emptyState.querySelector("small").textContent =
      "Try changing your search or filter.";
  } else {
    emptyState.querySelector("strong").textContent = "No transactions yet";
    emptyState.querySelector("small").textContent =
      "Add your first transaction to get started.";
  }
}

function refreshDashboard() {
  updateDashboard();
  updateBudget();
  renderTransactions();
  updateCharts();
}

// ---------------- ADD TRANSACTION ----------------

form.addEventListener("submit", event => {
  event.preventDefault();

  const description = descriptionInput.value.trim();
  const amount = Number(amountInput.value);
  const category = categoryInput.value;
  const date = dateInput.value;
  const type = document.querySelector('input[name="type"]:checked').value;

  if (!description || description.length > 80) {
    formMessage.textContent = "Enter a description of up to 80 characters.";
    return;
  }

  if (!Number.isFinite(amount) || amount <= 0 ||
      Math.round(amount * 100) / 100 <= 0) {
    formMessage.textContent = "Enter an amount greater than zero.";
    return;
  }

  if (!date || date > localDateString() ||
      localDateString(new Date(date + "T12:00:00")) !== date) {
    formMessage.textContent = "Choose a valid date that is not in the future.";
    return;
  }

  const transaction = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    description,
    amount: Math.round(amount * 100) / 100,
    category,
    date,
    type
  };

  transactions.push(transaction);

  if (!saveTransactions()) {
    transactions.pop();
    return;
  }

  form.reset();
  dateInput.value = localDateString();
  document.querySelector('input[name="type"][value="expense"]').checked = true;
  formMessage.textContent = "";

  filterInput.value = "all";
  searchInput.value = "";

  refreshDashboard();

  const budget = getBudget();
  const spent = getMonthTransactions()
    .filter(item => item.type === "expense")
    .reduce((sum, item) => sum + item.amount, 0);

  if (transaction.type === "expense" && currentMonth(transaction.date) && budget) {
    if (spent >= budget) {
      showToast(`Budget exceeded! ${formatMoney(spent - budget)} over limit.`);
    } else if (spent >= budget * 0.8) {
      showToast(`Budget alert: ${Math.round(spent / budget * 100)}% used.`);
    } else {
      showToast("Transaction added successfully!");
    }
  } else {
    showToast("Transaction added successfully!");
  }
});

filterInput.addEventListener("change", renderTransactions);
searchInput.addEventListener("input", renderTransactions);

// ---------------- CSV AND EXCEL EXPORT ----------------

function exportRows() {
  return transactions.map(item => ({
    Date: item.date,
    Description: item.description,
    Type: item.type,
    Category: item.category,
    Amount_INR: item.amount
  }));
}

// Protect spreadsheet exports from formula injection.
function safeSpreadsheetText(value) {
  const text = String(value ?? "");
  return /^[\s\u0000-\u001f]*[=+\-@]/.test(text)
    ? "'" + text
    : text;
}

function downloadBlob(content, type, filename) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

$("export-csv").addEventListener("click", () => {
  if (!transactions.length) {
    showToast("Add transactions before exporting.");
    return;
  }

  const headers = ["Date", "Description", "Type", "Category", "Amount_INR"];

  const rows = exportRows().map(row => [
    row.Date,
    safeSpreadsheetText(row.Description),
    row.Type,
    safeSpreadsheetText(row.Category),
    row.Amount_INR
  ]);

  const csv = [headers, ...rows]
    .map(row => row.map(value =>
      `"${String(value).replace(/"/g, '""')}"`
    ).join(","))
    .join("\r\n");

  // BOM helps spreadsheet programs identify UTF-8.
  downloadBlob(
    "\uFEFF" + csv,
    "text/csv;charset=utf-8;",
    `mymoney-${currentMonthKey()}.csv`
  );

  showToast("CSV export downloaded.");
});

$("export-excel").addEventListener("click", () => {
  if (!transactions.length) {
    showToast("Add transactions before exporting.");
    return;
  }

  if (typeof XLSX === "undefined") {
    showToast("Excel export unavailable. Check your internet connection.");
    return;
  }

  const rows = exportRows().map(row => ({
    ...row,
    Description: safeSpreadsheetText(row.Description),
    Category: safeSpreadsheetText(row.Category)
  }));

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows);

  worksheet["!cols"] = [
    { wch: 14 },
    { wch: 32 },
    { wch: 12 },
    { wch: 18 },
    { wch: 16 }
  ];

  XLSX.utils.book_append_sheet(workbook, worksheet, "Transactions");

  XLSX.writeFile(workbook, `mymoney-${currentMonthKey()}.xlsx`);
  showToast("Excel export downloaded.");
});

// ---------------- DARK MODE ----------------

function applyTheme(theme) {
  const isDark = theme === "dark";
  document.body.classList.toggle("dark", isDark);

  $("theme-toggle").textContent = isDark ? "☀️ Light" : "🌙 Dark";
  $("theme-toggle").setAttribute(
    "aria-label",
    isDark ? "Switch to light mode" : "Switch to dark mode"
  );

  updateCharts();
}

let savedTheme = "light";

try {
  savedTheme = localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light";
} catch {
  // Keep the default light theme if browser storage is unavailable.
}

applyTheme(savedTheme);

$("theme-toggle").addEventListener("click", () => {
  const nextTheme = document.body.classList.contains("dark") ? "light" : "dark";

  try {
    localStorage.setItem(THEME_KEY, nextTheme);
  } catch {
    showToast("Theme changed, but could not save the preference.");
  }

  applyTheme(nextTheme);
});

// ---------------- CLEAR ALL ----------------

$("clear-all").addEventListener("click", () => {
  if (!transactions.length) {
    showToast("There is no transaction data to clear.");
    return;
  }

  if (!confirm("Delete ALL transactions? This action cannot be undone.")) {
    return;
  }

  const previous = transactions;
  transactions = [];

  if (!saveTransactions()) {
    transactions = previous;
    return;
  }

  refreshDashboard();
  showToast("All transactions cleared.");
});

// ---------------- INITIALIZATION ----------------

$("today").textContent = new Date().toLocaleDateString("en-IN", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric"
});

dateInput.max = localDateString();
dateInput.value = localDateString();

refreshDashboard();
