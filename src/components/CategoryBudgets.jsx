import { useState } from 'react';
import {
  calculateBudgetPercentageUsed,
  getBudgetStatus,
  getCategorySummaries,
} from '../utils/expenseCalculations.js';
import { formatCurrency } from '../utils/formatters.js';

function CategoryBudgets({ categories, expenses, onUpdateBudget, onTransferBudget }) {
  const [editingId, setEditingId] = useState(null);
  const [draftBudget, setDraftBudget] = useState('');
  const [error, setError] = useState('');
  const [transferSource, setTransferSource] = useState(categories[0]?.id ?? '');
  const [transferTarget, setTransferTarget] = useState(categories[1]?.id ?? '');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferError, setTransferError] = useState('');

  const categorySummaries = getCategorySummaries(categories, expenses);
  const statusClassByStatus = {
    normal: 'on-track',
    warning: 'near',
    alert: 'over',
  };

  function startEditing(category) {
    setEditingId(category.id);
    setDraftBudget(String(category.budget));
    setError('');
  }

  function cancelEditing() {
    setEditingId(null);
    setDraftBudget('');
    setError('');
  }

  function saveBudget(event) {
    event.preventDefault();
    const budget = Number(draftBudget);
    if (draftBudget.trim() === '' || !Number.isFinite(budget) || budget < 0) {
      setError('Budget must be a number of 0 or more.');
      return;
    }
    onUpdateBudget(editingId, Math.round(budget * 100) / 100);
    cancelEditing();
  }

  function submitTransfer(event) {
    event.preventDefault();
    const amount = Number(transferAmount);
    const source = categorySummaries.find((category) => category.id === transferSource);

    if (!source || !transferTarget || transferSource === transferTarget) {
      setTransferError('Choose two different categories.');
      return;
    }
    if (transferAmount.trim() === '' || !Number.isFinite(amount) || amount <= 0) {
      setTransferError('Enter an amount greater than zero.');
      return;
    }
    if (amount > Math.max(0, source.remaining)) {
      setTransferError(`Only ${formatCurrency(Math.max(0, source.remaining))} is available to move.`);
      return;
    }

    onTransferBudget(transferSource, transferTarget, Math.round(amount * 100) / 100);
    setTransferAmount('');
    setTransferError('');
  }

  return (
    <section className="section" aria-labelledby="categories-heading">
      <h2 id="categories-heading" className="section__title">
        Category Budgets
      </h2>

      {categorySummaries.some(
        (category) => getBudgetStatus(category.spent, category.budget) !== 'normal'
      ) && (
        <div className="budget-alerts" aria-label="Budget alerts">
          {categorySummaries
            .filter((category) => getBudgetStatus(category.spent, category.budget) !== 'normal')
            .map((category) => {
              const status = getBudgetStatus(category.spent, category.budget);
              return (
                <p
                  key={category.id}
                  className={`budget-alert budget-alert--${statusClassByStatus[status]}`}
                  aria-live="polite"
                >
                  <strong>
                    {status === 'alert' ? 'Over budget' : 'Close to budget'}: {category.name}
                  </strong>{' '}
                  has used {formatCurrency(category.spent)} of {formatCurrency(category.budget)}.
                </p>
              );
            })}
        </div>
      )}

      <div className="card budget-transfer">
        <div>
          <h3 className="card__title">Move money between categories</h3>
          <p className="card__supporting-text">Move unspent budget without changing your total allocation.</p>
        </div>
        <form className="transfer-form" onSubmit={submitTransfer} noValidate>
          <div className="form-field">
            <label htmlFor="transfer-source">From</label>
            <select
              id="transfer-source"
              value={transferSource}
              onChange={(event) => setTransferSource(event.target.value)}
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="transfer-target">To</label>
            <select
              id="transfer-target"
              value={transferTarget}
              onChange={(event) => setTransferTarget(event.target.value)}
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="transfer-amount">Transfer amount (₦)</label>
            <input
              id="transfer-amount"
              type="number"
              min="0.01"
              step="0.01"
              inputMode="decimal"
              value={transferAmount}
              onChange={(event) => setTransferAmount(event.target.value)}
            />
          </div>
          <button type="submit" className="btn btn--primary">
            Move money
          </button>
          {transferError && (
            <p className="field-error transfer-form__error" role="alert">
              {transferError}
            </p>
          )}
        </form>
      </div>

      <div className="card card--flush">
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">Category</th>
              <th scope="col" className="num">
                Allocated Budget
              </th>
              <th scope="col" className="num">
                Spent
              </th>
              <th scope="col" className="num">
                Remaining
              </th>
              <th scope="col">Progress</th>
              <th scope="col">
                <span className="visually-hidden">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {categorySummaries.map((category) => {
              const isEditing = editingId === category.id;
              const inputId = `budget-${category.id}`;
              const errorId = `budget-error-${category.id}`;
              const status = getBudgetStatus(category.spent, category.budget);
              const statusClass = statusClassByStatus[status];
              const percentUsed = Math.round(
                calculateBudgetPercentageUsed(category.spent, category.budget)
              );
              const progressValue = Math.min(100, Math.max(0, percentUsed));

              return (
                <tr key={category.id}>
                  <th scope="row" data-label="Category">
                    <span className="category-icon" aria-hidden="true">
                      {category.icon}
                    </span>
                    {category.name}
                  </th>
                  <td className="num" data-label="Allocated Budget">
                    {isEditing ? (
                      <form className="budget-form" onSubmit={saveBudget} noValidate>
                        <label htmlFor={inputId} className="visually-hidden">
                          Allocated budget for {category.name}
                        </label>
                        <input
                          id={inputId}
                          type="number"
                          min="0"
                          step="0.01"
                          inputMode="decimal"
                          value={draftBudget}
                          onChange={(event) => setDraftBudget(event.target.value)}
                          aria-invalid={error ? 'true' : 'false'}
                          aria-describedby={error ? errorId : undefined}
                          autoFocus
                        />
                        <div className="budget-form__actions">
                          <button type="submit" className="btn btn--primary btn--small">
                            Save
                          </button>
                          <button
                            type="button"
                            className="btn btn--ghost btn--small"
                            onClick={cancelEditing}
                          >
                            Cancel
                          </button>
                        </div>
                        {error && (
                          <p id={errorId} className="field-error" role="alert">
                            {error}
                          </p>
                        )}
                      </form>
                    ) : (
                      formatCurrency(category.budget)
                    )}
                  </td>
                  <td className="num" data-label="Spent">
                    {formatCurrency(category.spent)}
                  </td>
                  <td className="num" data-label="Remaining">
                    {formatCurrency(category.remaining)}
                  </td>
                  <td data-label="Progress">
                    <div className="budget-progress">
                      <div
                        className={`budget-progress__track budget-progress__track--${statusClass}`}
                        role="progressbar"
                        aria-label={`${category.name} budget usage`}
                        aria-valuemin="0"
                        aria-valuemax="100"
                        aria-valuenow={progressValue}
                      >
                        <span
                          className="budget-progress__fill"
                          style={{ width: `${progressValue}%` }}
                        />
                      </div>
                      <span className={`budget-status budget-status--${statusClass}`}>
                        {status === 'alert'
                          ? 'Over budget'
                          : status === 'warning'
                            ? 'Close'
                            : 'On track'}{' '}
                        ({percentUsed}%)
                      </span>
                    </div>
                  </td>
                  <td className="actions">
                    {!isEditing && (
                      <button
                        type="button"
                        className="btn btn--secondary btn--small"
                        onClick={() => startEditing(category)}
                        aria-label={`Edit budget for ${category.name}`}
                      >
                        ✏️ Edit
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default CategoryBudgets;
