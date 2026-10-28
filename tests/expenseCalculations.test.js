import { describe, expect, it } from 'vitest';
import {
  BUDGET_ALERT_THRESHOLD,
  BUDGET_WARNING_THRESHOLD,
  calculateBudgetPercentageUsed,
  calculateCategoryRemaining,
  calculateCategorySpent,
  calculateTotalBudget,
  getBudgetStatus,
  getCategorySummaries,
  roundToCents,
  sortExpensesByCategory,
  sortExpensesByDate,
} from '../src/utils/expenseCalculations.js';
import {
  DEFAULT_CATEGORIES,
  createSampleCategories,
  createSampleExpenses,
} from '../src/data/sampleData.js';
import { formatCurrency, formatDate, parseISODate, toISODate } from '../src/utils/formatters.js';

const categories = [
  { id: 'food', name: 'Food', budget: 100 },
  { id: 'fun', name: 'Fun', budget: 50 },
];

const expenses = [
  { id: 'e1', description: 'Lunch', amount: 12.5, categoryId: 'food', date: '2026-01-03' },
  { id: 'e2', description: 'Dinner', amount: 30.25, categoryId: 'food', date: '2026-01-05' },
  { id: 'e3', description: 'Movie', amount: 60, categoryId: 'fun', date: '2026-01-04' },
];

describe('calculateTotalBudget', () => {
  it('adds up all category budgets', () => {
    expect(calculateTotalBudget(categories)).toBe(150);
  });

  it('returns 0 when there are no categories', () => {
    expect(calculateTotalBudget([])).toBe(0);
  });
});

describe('calculateBudgetPercentageUsed', () => {
  it('calculates the percentage used for a positive budget', () => {
    expect(calculateBudgetPercentageUsed(40, 100)).toBe(40);
    expect(calculateBudgetPercentageUsed(85.5, 100)).toBe(85.5);
  });

  it('handles zero budgets safely', () => {
    expect(calculateBudgetPercentageUsed(0, 0)).toBe(0);
    expect(calculateBudgetPercentageUsed(25, 0)).toBe(100);
  });
});

describe('getBudgetStatus', () => {
  it('returns normal below warning threshold', () => {
    expect(getBudgetStatus(79.99, 100)).toBe('normal');
  });

  it('returns warning at 80% and below 100%', () => {
    expect(BUDGET_WARNING_THRESHOLD).toBe(80);
    expect(getBudgetStatus(80, 100)).toBe('warning');
    expect(getBudgetStatus(99.99, 100)).toBe('warning');
  });

  it('returns alert at or above 100%', () => {
    expect(BUDGET_ALERT_THRESHOLD).toBe(100);
    expect(getBudgetStatus(100, 100)).toBe('alert');
    expect(getBudgetStatus(120, 100)).toBe('alert');
  });

  it('returns alert for zero budget with positive spending', () => {
    expect(getBudgetStatus(10, 0)).toBe('alert');
  });
});

describe('calculateCategorySpent', () => {
  it('adds up only the expenses in the given category', () => {
    expect(calculateCategorySpent(expenses, 'food')).toBe(42.75);
    expect(calculateCategorySpent(expenses, 'fun')).toBe(60);
  });

  it('returns 0 for a category with no expenses', () => {
    expect(calculateCategorySpent(expenses, 'travel')).toBe(0);
  });

  it('avoids floating point rounding errors', () => {
    const small = [
      { id: 'a', amount: 0.1, categoryId: 'food' },
      { id: 'b', amount: 0.2, categoryId: 'food' },
    ];
    expect(calculateCategorySpent(small, 'food')).toBe(0.3);
  });
});

describe('calculateCategoryRemaining', () => {
  it('subtracts spending from the category budget', () => {
    expect(calculateCategoryRemaining(categories[0], expenses)).toBe(57.25);
  });

  it('allows a negative remaining balance when over budget', () => {
    expect(calculateCategoryRemaining(categories[1], expenses)).toBe(-10);
  });
});

describe('getCategorySummaries', () => {
  it('adds spent, remaining and expenseCount to each category', () => {
    expect(getCategorySummaries(categories, expenses)).toEqual([
      { id: 'food', name: 'Food', budget: 100, spent: 42.75, remaining: 57.25, expenseCount: 2 },
      { id: 'fun', name: 'Fun', budget: 50, spent: 60, remaining: -10, expenseCount: 1 },
    ]);
  });

  it('does not modify the original categories', () => {
    const copy = structuredClone(categories);
    getCategorySummaries(categories, expenses);
    expect(categories).toEqual(copy);
  });
});

describe('sortExpensesByDate', () => {
  it('sorts newest first by default', () => {
    expect(sortExpensesByDate(expenses).map((e) => e.id)).toEqual(['e2', 'e3', 'e1']);
  });

  it('can sort oldest first', () => {
    expect(sortExpensesByDate(expenses, 'oldest').map((e) => e.id)).toEqual(['e1', 'e3', 'e2']);
  });

  it('does not modify the original array', () => {
    const ids = expenses.map((e) => e.id);
    sortExpensesByDate(expenses);
    expect(expenses.map((e) => e.id)).toEqual(ids);
  });
});

describe('sortExpensesByCategory', () => {
  it('groups by category name A–Z, newest first within each category', () => {
    expect(sortExpensesByCategory(expenses, categories).map((e) => e.id)).toEqual([
      'e2',
      'e1',
      'e3',
    ]);
  });

  it('puts expenses with an unknown category last', () => {
    const withUnknown = [
      { id: 'u1', amount: 5, categoryId: 'deleted', date: '2026-01-09' },
      ...expenses,
    ];
    expect(sortExpensesByCategory(withUnknown, categories).map((e) => e.id)).toEqual([
      'e2',
      'e1',
      'e3',
      'u1',
    ]);
  });

  it('does not modify the original array', () => {
    const ids = expenses.map((e) => e.id);
    sortExpensesByCategory(expenses, categories);
    expect(expenses.map((e) => e.id)).toEqual(ids);
  });
});

describe('roundToCents', () => {
  it('rounds to two decimal places', () => {
    expect(roundToCents(1.005 + 2.001)).toBe(3.01);
    expect(roundToCents(0.1 + 0.2)).toBe(0.3);
  });
});

describe('formatters', () => {
  it('formats currency as Naira', () => {
    expect(formatCurrency(1234.5)).toBe('₦1,234.50');
    expect(formatCurrency(-2669.55)).toBe('-₦2,669.55');
  });

  it('converts dates to and from YYYY-MM-DD', () => {
    expect(toISODate(new Date(2026, 0, 9))).toBe('2026-01-09');
    expect(parseISODate('2026-01-09')).toEqual(new Date(2026, 0, 9));
  });

  it('rejects invalid dates', () => {
    expect(parseISODate('')).toBeNull();
    expect(parseISODate('2026-02-30')).toBeNull();
    expect(parseISODate('not-a-date')).toBeNull();
  });

  it('formats dates for display', () => {
    expect(formatDate('2026-10-11')).toBe('11 Oct 2026');
  });
});

describe('sample data', () => {
  const sampleCategories = createSampleCategories();
  const sampleExpenses = createSampleExpenses(new Date(2026, 9, 11));
  const summaries = getCategorySummaries(sampleCategories, sampleExpenses);
  const percentUsed = (category) => (category.spent / category.budget) * 100;

  it('has six categories totalling a ₦270,000 budget', () => {
    expect(sampleCategories).toHaveLength(6);
    expect(calculateTotalBudget(sampleCategories)).toBe(270000);
  });

  it('has 25-30 expenses with unique IDs in known categories', () => {
    expect(sampleExpenses.length).toBeGreaterThanOrEqual(25);
    expect(sampleExpenses.length).toBeLessThanOrEqual(30);
    expect(new Set(sampleExpenses.map((e) => e.id)).size).toBe(sampleExpenses.length);
    const categoryIds = sampleCategories.map((c) => c.id);
    sampleExpenses.forEach((e) => expect(categoryIds).toContain(e.categoryId));
  });

  it('includes categories below 50%, between 80-99%, and at or above 100% of budget', () => {
    expect(summaries.some((c) => percentUsed(c) < 50)).toBe(true);
    expect(summaries.some((c) => percentUsed(c) >= 80 && percentUsed(c) < 100)).toBe(true);
    expect(summaries.some((c) => percentUsed(c) >= 100)).toBe(true);
  });

  it('has the expected spending per category', () => {
    const spentById = Object.fromEntries(summaries.map((c) => [c.id, c.spent]));
    expect(spentById).toEqual({
      food: 85498.98,
      transportation: 21982.95,
      shopping: 32669.55,
      entertainment: 15262.5,
      bills: 29968.75,
      health: 15315.05,
    });
  });

  it('generates dates relative to today, all within the last 28 days', () => {
    const dates = sampleExpenses.map((e) => e.date).sort();
    expect(dates[dates.length - 1]).toBe('2026-10-11');
    expect(dates[0]).toBe('2026-09-14');
  });

  it('returns fresh copies so callers cannot modify the defaults', () => {
    const copy = createSampleCategories();
    copy[0].budget = 1;
    expect(DEFAULT_CATEGORIES[0].budget).toBe(100000);
  });
});
