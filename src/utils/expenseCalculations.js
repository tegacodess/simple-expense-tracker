/**
 * Pure helper functions for expense and budget math.
 * Components should use these instead of calculating totals inline.
 */

export const BUDGET_WARNING_THRESHOLD = 80;
export const BUDGET_ALERT_THRESHOLD = 100;

/** Rounds a number to 2 decimal places to avoid floating point noise. */
export function roundToCents(value) {
  return Math.round(value * 100) / 100;
}

/** Percentage of budget used, handling zero budgets safely. */
export function calculateBudgetPercentageUsed(spent, budget) {
  const numericSpent = Number(spent);
  const numericBudget = Number(budget);

  if (numericBudget <= 0) {
    return numericSpent > 0 ? 100 : 0;
  }

  return (numericSpent / numericBudget) * 100;
}

/** Budget status derived from usage percentage thresholds. */
export function getBudgetStatus(spent, budget) {
  const percentageUsed = calculateBudgetPercentageUsed(spent, budget);

  if (percentageUsed >= BUDGET_ALERT_THRESHOLD) {
    return 'alert';
  }
  if (percentageUsed >= BUDGET_WARNING_THRESHOLD) {
    return 'warning';
  }
  return 'normal';
}

/** Sum of all category budgets. */
export function calculateTotalBudget(categories) {
  return roundToCents(categories.reduce((total, category) => total + Number(category.budget), 0));
}

/** Sum of all recorded expenses. Each expense is only counted once. */
export function calculateTotalExpenses(expenses) {
  return roundToCents(
    expenses.reduce((total, expense) => total + Number(expense.amount), 0)
  );
}

/** Total budget minus total expenses. May be negative. */
export function calculateRemainingBalance(categories, expenses) {
  return roundToCents(calculateTotalBudget(categories) - calculateTotalExpenses(expenses));
}

/** Sum of the expenses that belong to one category. */
export function calculateCategorySpent(expenses, categoryId) {
  return roundToCents(
    expenses
      .filter((expense) => expense.categoryId === categoryId)
      .reduce((total, expense) => total + Number(expense.amount), 0)
  );
}

/** Category budget minus what has been spent in it. May be negative. */
export function calculateCategoryRemaining(category, expenses) {
  return roundToCents(Number(category.budget) - calculateCategorySpent(expenses, category.id));
}

/**
 * Returns each category with its calculated `spent`, `remaining`
 * and `expenseCount` values. Does not modify the input.
 */
export function getCategorySummaries(categories, expenses) {
  return categories.map((category) => ({
    ...category,
    spent: calculateCategorySpent(expenses, category.id),
    remaining: calculateCategoryRemaining(category, expenses),
    expenseCount: expenses.filter((expense) => expense.categoryId === category.id).length,
  }));
}

/** Returns a new array sorted by date, newest first (or oldest first). */
export function sortExpensesByDate(expenses, order = 'newest') {
  const direction = order === 'oldest' ? 1 : -1;
  return [...expenses].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -direction : direction;
    if (a.id === b.id) return 0;
    return a.id < b.id ? -direction : direction;
  });
}

/**
 * Returns a new array grouped by category name (A–Z), newest first within
 * each category. Expenses with an unknown category go last.
 */
export function sortExpensesByCategory(expenses, categories) {
  const namesById = Object.fromEntries(categories.map((category) => [category.id, category.name]));
  return sortExpensesByDate(expenses).sort((a, b) => {
    const nameA = namesById[a.categoryId];
    const nameB = namesById[b.categoryId];
    if (nameA === nameB) return 0;
    if (nameA === undefined) return 1;
    if (nameB === undefined) return -1;
    return nameA.localeCompare(nameB);
  });
}
