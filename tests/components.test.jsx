import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../src/App.jsx';
import { STORAGE_KEYS, createSampleExpenses } from '../src/data/sampleData.js';
import { toISODate } from '../src/utils/formatters.js';

function readStorage(key) {
  return JSON.parse(localStorage.getItem(key));
}

function getCategoryRow(name) {
  const table = screen.getByRole('region', { name: 'Category Budgets' });
  return within(table).getByRole('row', { name: new RegExp(name) });
}

function getExpenseTable() {
  return within(screen.getByRole('region', { name: 'Expenses' })).getByRole('table');
}

describe('App', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('localStorage initialization', () => {
    it('loads sample data and saves it on first launch', () => {
      render(<App />);

      expect(readStorage(STORAGE_KEYS.expenses)).toHaveLength(29);
      expect(readStorage(STORAGE_KEYS.categories)).toHaveLength(6);
      expect(screen.getByText('Lunch at the buka')).toBeInTheDocument();
    });

    it('uses existing saved data instead of overwriting it', () => {
      localStorage.setItem(
        STORAGE_KEYS.expenses,
        JSON.stringify([
          { id: 'x1', description: 'Saved expense', amount: 5, categoryId: 'food', date: '2026-01-01' },
        ])
      );

      render(<App />);

      const rows = within(getExpenseTable()).getAllByRole('row');
      expect(rows).toHaveLength(2); // header + 1 expense
      expect(screen.getByText('Saved expense')).toBeInTheDocument();
      expect(readStorage(STORAGE_KEYS.expenses)).toHaveLength(1);
    });
  });

  describe('dashboard', () => {
    it('shows the total allocated budget and a breakdown for every category', () => {
      render(<App />);
      const dashboard = screen.getByRole('region', { name: 'Dashboard' });

      expect(within(dashboard).getByText('₦270,000.00')).toBeInTheDocument();
      expect(within(dashboard).getByText('Food & Dining')).toBeInTheDocument();
      expect(within(dashboard).getByText('₦85,498.98')).toBeInTheDocument();
      expect(within(dashboard).getByText('Health & Wellness')).toBeInTheDocument();
    });
  });

  describe('adding an expense', () => {
    it('adds the expense to the list, updates the category and saves it', async () => {
      const user = userEvent.setup();
      render(<App />);

      await user.type(screen.getByLabelText('Description'), 'Team lunch');
      await user.type(screen.getByLabelText('Amount (₦)'), '2500.5');
      await user.selectOptions(screen.getByLabelText('Category'), 'Entertainment');
      await user.click(screen.getByRole('button', { name: /add expense/i }));

      // Newest first, so the new expense (dated today) is near the top.
      expect(within(getExpenseTable()).getByText('Team lunch')).toBeInTheDocument();

      // Entertainment: 15,262.50 + 2,500.50 = 17,763.00 spent, 20,000 - 17,763 = 2,237.00 remaining.
      const row = getCategoryRow('Entertainment');
      expect(within(row).getByText('₦17,763.00')).toBeInTheDocument();
      expect(within(row).getByText('₦2,237.00')).toBeInTheDocument();

      const saved = readStorage(STORAGE_KEYS.expenses);
      expect(saved).toHaveLength(30);
      expect(saved.at(-1)).toMatchObject({
        description: 'Team lunch',
        amount: 2500.5,
        categoryId: 'entertainment',
        date: toISODate(new Date()),
      });
      expect(saved.at(-1).id).toEqual(expect.any(String));
    });

    it('shows validation errors and does not add an invalid expense', async () => {
      const user = userEvent.setup();
      render(<App />);

      await user.clear(screen.getByLabelText('Date'));
      await user.type(screen.getByLabelText('Amount (₦)'), '0');
      await user.click(screen.getByRole('button', { name: /add expense/i }));

      expect(screen.getByText('Please enter a description.')).toBeInTheDocument();
      expect(screen.getByText('Amount must be greater than zero.')).toBeInTheDocument();
      expect(screen.getByText('Please select a category.')).toBeInTheDocument();
      expect(screen.getByText('Please enter a valid date.')).toBeInTheDocument();
      expect(screen.getByLabelText('Description')).toHaveAttribute('aria-invalid', 'true');
      expect(readStorage(STORAGE_KEYS.expenses)).toHaveLength(29);
    });
  });

  describe('viewing expenses', () => {
    it('lists expenses newest first and can switch to oldest first', async () => {
      const user = userEvent.setup();
      render(<App />);

      const firstExpense = () => within(getExpenseTable()).getAllByRole('row')[1];
      expect(firstExpense()).toHaveTextContent('Mosquito repellent');

      await user.selectOptions(screen.getByLabelText('Sort'), 'Oldest first');
      expect(firstExpense()).toHaveTextContent(/Electricity token|Gym membership/);
    });

    it('can sort expenses by category', async () => {
      const user = userEvent.setup();
      render(<App />);

      await user.selectOptions(screen.getByLabelText('Sort'), 'Category (A–Z)');

      const rows = within(getExpenseTable()).getAllByRole('row').slice(1);
      // Bills & Utilities comes first alphabetically; Transportation comes last.
      expect(rows[0]).toHaveTextContent('Airtime top-up');
      expect(rows[0]).toHaveTextContent('Bills & Utilities');
      expect(rows.at(-1)).toHaveTextContent('Ride-hailing trip to work');
      expect(rows.at(-1)).toHaveTextContent('Transportation');
    });
  });

  describe('deleting an expense', () => {
    it('removes the expense after confirmation and updates totals', async () => {
      const user = userEvent.setup();
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
      render(<App />);

      await user.click(screen.getByRole('button', { name: 'Delete Wireless earbuds' }));

      expect(confirmSpy).toHaveBeenCalledOnce();
      expect(screen.queryByText('Wireless earbuds')).not.toBeInTheDocument();
      // Shopping: 32,669.55 - 12,820.75 = 19,848.80 spent, 10,151.20 remaining.
      const row = getCategoryRow('Shopping');
      expect(within(row).getByText('₦19,848.80')).toBeInTheDocument();
      expect(within(row).getByText('₦10,151.20')).toBeInTheDocument();
      expect(readStorage(STORAGE_KEYS.expenses).map((e) => e.id)).not.toContain('exp-012');
    });

    it('keeps the expense when the user cancels', async () => {
      const user = userEvent.setup();
      vi.spyOn(window, 'confirm').mockReturnValue(false);
      render(<App />);

      await user.click(screen.getByRole('button', { name: 'Delete Wireless earbuds' }));

      expect(screen.getByText('Wireless earbuds')).toBeInTheDocument();
      expect(readStorage(STORAGE_KEYS.expenses)).toHaveLength(29);
    });
  });

  describe('category budgets', () => {
    it('shows budget alerts and progress bars', () => {
      render(<App />);

      expect(screen.getByText(/Over budget: Shopping/)).toBeInTheDocument();
      expect(screen.getByText(/Close to budget: Food & Dining/)).toBeInTheDocument();
      expect(screen.getAllByRole('progressbar')).toHaveLength(6);
      expect(screen.getByRole('progressbar', { name: 'Shopping budget usage' })).toHaveAttribute(
        'aria-valuenow',
        '100'
      );
    });

    it('uses accessible progress labels and threshold-based values', () => {
      render(<App />);

      expect(screen.getByRole('progressbar', { name: 'Food & Dining budget usage' })).toHaveAttribute(
        'aria-valuenow',
        '85'
      );
      expect(screen.getByRole('progressbar', { name: 'Transportation budget usage' })).toHaveAttribute(
        'aria-valuenow',
        '44'
      );
      expect(
        screen.getByRole('progressbar', { name: 'Health & Wellness budget usage' })
      ).toHaveAttribute('aria-valuenow', '77');
    });

    it('moves budget between categories and keeps the total unchanged', async () => {
      const user = userEvent.setup();
      render(<App />);

      await user.selectOptions(screen.getByLabelText('From'), 'food');
      await user.selectOptions(screen.getByLabelText('To'), 'transportation');
      await user.type(screen.getByLabelText('Transfer amount (₦)'), '10000');
      await user.click(screen.getByRole('button', { name: 'Move money' }));

      expect(within(getCategoryRow('Food & Dining')).getByText('₦90,000.00')).toBeInTheDocument();
      expect(within(getCategoryRow('Transportation')).getByText('₦60,000.00')).toBeInTheDocument();
      expect(screen.getByText('₦270,000.00')).toBeInTheDocument();
      expect(readStorage(STORAGE_KEYS.categories).find((c) => c.id === 'food').budget).toBe(90000);
    });

    it('rejects transfers larger than the source balance', async () => {
      const user = userEvent.setup();
      render(<App />);

      await user.selectOptions(screen.getByLabelText('From'), 'shopping');
      await user.selectOptions(screen.getByLabelText('To'), 'food');
      await user.type(screen.getByLabelText('Transfer amount (₦)'), '1');
      await user.click(screen.getByRole('button', { name: 'Move money' }));

      expect(screen.getByRole('alert')).toHaveTextContent('Only ₦0.00 is available to move.');
      expect(readStorage(STORAGE_KEYS.categories).find((c) => c.id === 'food').budget).toBe(100000);
    });

    it('updates a category budget and saves it', async () => {
      const user = userEvent.setup();
      render(<App />);

      await user.click(screen.getByRole('button', { name: 'Edit budget for Transportation' }));
      const input = screen.getByLabelText('Allocated budget for Transportation');
      await user.clear(input);
      await user.type(input, '60000');
      await user.click(screen.getByRole('button', { name: 'Save' }));

      // Transportation: 60,000 budget - 21,982.95 spent = 38,017.05 remaining.
      const row = getCategoryRow('Transportation');
      expect(within(row).getByText('₦60,000.00')).toBeInTheDocument();
      expect(within(row).getByText('₦38,017.05')).toBeInTheDocument();
      expect(screen.getByText('₦280,000.00')).toBeInTheDocument(); // total budget card

      const saved = readStorage(STORAGE_KEYS.categories);
      expect(saved.find((c) => c.id === 'transportation').budget).toBe(60000);
    });

    it('rejects a negative budget', async () => {
      const user = userEvent.setup();
      render(<App />);

      await user.click(screen.getByRole('button', { name: 'Edit budget for Shopping' }));
      const input = screen.getByLabelText('Allocated budget for Shopping');
      await user.clear(input);
      await user.type(input, '-5');
      await user.click(screen.getByRole('button', { name: 'Save' }));

      expect(screen.getByRole('alert')).toHaveTextContent('Budget must be a number of 0 or more.');
      expect(readStorage(STORAGE_KEYS.categories).find((c) => c.id === 'shopping').budget).toBe(30000);
    });

    it('shows a negative remaining balance when a category is over budget', () => {
      render(<App />);
      // Shopping: 30,000 - 32,669.55 = -2,669.55
      expect(within(getCategoryRow('Shopping')).getByText('-₦2,669.55')).toBeInTheDocument();
    });
  });

  describe('reset demo data', () => {
    it('restores the original sample data after confirmation', async () => {
      const user = userEvent.setup();
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      localStorage.setItem(STORAGE_KEYS.expenses, JSON.stringify([]));
      localStorage.setItem(
        STORAGE_KEYS.categories,
        JSON.stringify([{ id: 'food', name: 'Food & Dining', icon: '🍽️', budget: 1 }])
      );
      render(<App />);
      expect(screen.getByText(/No expenses yet/)).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /reset demo data/i }));

      expect(screen.queryByText(/No expenses yet/)).not.toBeInTheDocument();
      expect(readStorage(STORAGE_KEYS.expenses)).toEqual(createSampleExpenses());
      expect(readStorage(STORAGE_KEYS.categories)).toHaveLength(6);
      expect(screen.getByText('₦270,000.00')).toBeInTheDocument();
    });

    it('does nothing when the user cancels', async () => {
      const user = userEvent.setup();
      vi.spyOn(window, 'confirm').mockReturnValue(false);
      localStorage.setItem(STORAGE_KEYS.expenses, JSON.stringify([]));
      render(<App />);

      await user.click(screen.getByRole('button', { name: /reset demo data/i }));

      expect(readStorage(STORAGE_KEYS.expenses)).toEqual([]);
    });
  });
});
