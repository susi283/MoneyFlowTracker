// Generate a unique ID
export function generateId() {
  return `txn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Format currency
export function formatCurrency(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) return '₹0';
  return `₹${Number(amount).toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

// Format date to display
export function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

// Get today's date as YYYY-MM-DD string
export function getTodayStr() {
  return new Date().toISOString().split('T')[0];
}

// Get YYYY-MM from a date string
export function getYearMonth(dateStr) {
  if (!dateStr) return '';
  return dateStr.substring(0, 7);
}

// Get month name from YYYY-MM
export function getMonthName(ym) {
  if (!ym) return '';
  const [year, month] = ym.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1, 1);
  return date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

// Get all unique year-month values from transactions sorted descending
export function getAvailableMonths(transactions) {
  const set = new Set();
  transactions.forEach((t) => {
    if (t.date) set.add(getYearMonth(t.date));
  });
  return Array.from(set).sort((a, b) => b.localeCompare(a));
}

// Get current YYYY-MM
export function getCurrentMonth() {
  return getTodayStr().substring(0, 7);
}

// Validate amount
export function isValidAmount(val) {
  const n = parseFloat(val);
  return !isNaN(n) && n > 0;
}

// Capitalize first letter
export function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Get transaction type label
export function getTypeLabel(type) {
  const labels = {
    income: 'Income',
    expense: 'Expense',
    lent: 'Lent',
    borrowed: 'Borrowed',
    lent_returned: 'Lent Returned',
    borrowed_repaid: 'Borrowed Repaid',
  };
  return labels[type] || type;
}

// Get type color classes
export function getTypeColor(type) {
  const colors = {
    income: 'text-green-600',
    expense: 'text-red-500',
    lent: 'text-orange-500',
    borrowed: 'text-blue-500',
    lent_returned: 'text-green-500',
    borrowed_repaid: 'text-purple-500',
  };
  return colors[type] || 'text-gray-600';
}

// Get type badge bg color
export function getTypeBadgeClass(type) {
  const colors = {
    income: 'bg-green-100 text-green-700',
    expense: 'bg-red-100 text-red-700',
    lent: 'bg-orange-100 text-orange-700',
    borrowed: 'bg-blue-100 text-blue-700',
    lent_returned: 'bg-emerald-100 text-emerald-700',
    borrowed_repaid: 'bg-purple-100 text-purple-700',
  };
  return colors[type] || 'bg-gray-100 text-gray-700';
}

// Check if amount sign should be positive or negative for balance
export function getAmountSign(type) {
  const positives = ['income', 'borrowed', 'lent_returned'];
  return positives.includes(type) ? 1 : -1;
}

export function getTransactionCashImpactCents(transaction) {
  const sign = {
    income: 1,
    borrowed: 1,
    lent_returned: 1,
    expense: -1,
    lent: -1,
    borrowed_repaid: -1,
  }[transaction.type] || 0;

  return sign * Math.round((Number(transaction.amount) || 0) * 100);
}
