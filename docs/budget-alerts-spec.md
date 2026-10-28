# Budget Alerts Specification

## 1. Overview

Budget Alerts extends ExpenseFlow's category budget view so users can see how
much of each category's budget has been spent, understand when a category is
approaching its limit, and move unused budget to another category.

The feature operates on the existing category and expense data:

- A category has an `id`, display name, icon, and allocated `budget`.
- An expense has an amount and `categoryId`.
- Category spending is the sum of expense amounts whose `categoryId` matches
  the category.
- Category remaining balance is `budget - spent` and may be negative.
- Data remains persisted in the browser's existing `localStorage` storage.

## 2. Functional Requirements

### 2.1 Warning at 80%

For each category with a positive allocated budget, calculate:

`percentage used = (spent / budget) * 100`

When percentage used is at least 80% but less than 100%, show a warning for
that category. The warning should identify the category and communicate that it
is close to its budget.

### 2.2 Alert at 100%

When percentage used is at least 100%, show an alert for that category. The
alert should identify the category and communicate that the budget has been
reached or exceeded.

The 100% alert takes precedence over the 80% warning; a category at or above
100% must not be presented as only a warning.

### 2.3 Visual Budget Status

Show one progress bar for every category in the category budget view. Each bar
must communicate:

- Category name.
- Amount spent.
- Allocated budget.
- Percentage used, where applicable.
- Current status: below warning, warning, or alert/over budget.

Progress bars must be accessible progress indicators with a category-specific
accessible name. The displayed progress value must be capped at 100% so an
over-budget category does not exceed the visual track, while its alert and
remaining balance continue to communicate the overspend.

### 2.4 Fund Reallocation

Allow the user to transfer available budget from one category to another.

The transfer form must provide:

- A source category selector.
- A destination category selector.
- A positive transfer amount.
- An action to confirm the transfer.

On a successful transfer:

1. Subtract the amount from the source category's allocated budget.
2. Add the amount to the destination category's allocated budget.
3. Keep the total allocated budget unchanged.
4. Persist the updated category budgets.
5. Recalculate both categories' statuses and progress bars immediately.

Only funds available in the source category may be transferred. Available funds
are the source category's non-negative remaining balance
(`max(budget - spent, 0)`). A transfer must not allow the source budget to
become less than its spending. The source and destination must be different
categories.

### 2.5 Automatic Updates

Warnings, alerts, progress bars, spent amounts, and remaining balances must be
recalculated whenever:

- An expense is added.
- An expense is deleted.
- A category budget is edited.
- A budget transfer succeeds.
- Data is loaded from or reset to the saved/demo data.

The UI must not require a page refresh or manual reload for any of these
changes. Derived status values must be calculated from the current expenses and
budgets rather than stored as independent, potentially stale values.

## 3. Status Rules

| Percentage used | Status | Expected presentation |
| --- | --- | --- |
| Less than 80% | On track | Normal progress bar; no budget warning or alert |
| 80% to less than 100% | Warning | Warning styling/message |
| 100% or greater | Alert | Alert styling/message; identify overage when applicable |

Percentages should be calculated using the unrounded spending and budget
values, with currency display rounded consistently to two decimal places.

## 4. Acceptance Criteria

### Thresholds and messaging

- Given a category has spent less than 80% of its positive budget, when the
  category view is displayed, then no warning or alert is shown for that
  category.
- Given a category has spent exactly 80% of its budget, then a warning is
  shown.
- Given a category has spent between 80% inclusive and 100% exclusive, then a
  warning is shown and no 100% alert is shown.
- Given a category has spent exactly 100% of its budget, then an alert is
  shown and no warning-only state is shown.
- Given a category has spent more than 100% of its budget, then an alert is
  shown and the remaining balance is negative.
- Each warning or alert identifies the affected category.

### Progress bars

- Exactly one progress bar is rendered for each category.
- Each progress bar is associated with the correct category through its
  accessible name.
- A category at 0% has an empty progress bar.
- A category at 80% has a progress value of 80.
- A category at 100% or above has a displayed progress value of 100, even
  though the status identifies the category as at or over budget.
- Progress bar styling reflects the category status without being the only
  indication of status.

### Fund reallocation

- A valid transfer decreases the source budget by exactly the requested amount.
- A valid transfer increases the destination budget by exactly the requested
  amount.
- The total allocated budget before and after a valid transfer is equal.
- A transfer from a source with no available funds is rejected and leaves all
  budgets unchanged.
- A transfer greater than the source's available funds is rejected with a
  clear validation message and leaves all budgets unchanged.
- Zero, negative, non-numeric, or blank transfer amounts are rejected.
- Selecting the same source and destination is rejected.
- A successful transfer updates affected spending percentages, progress bars,
  warnings, alerts, and remaining balances without a reload.
- Updated budgets survive a page refresh through the existing persistence
  mechanism.

### Automatic recalculation

- Adding an expense updates the matching category's spent amount, remaining
  balance, progress bar, and status immediately.
- Deleting an expense updates the matching category's derived values
  immediately.
- Editing a budget updates the category's percentage and status immediately.
- Resetting demo data restores category statuses and progress bars for the
  restored budgets and expenses.
- No derived warning, alert, or progress value remains stale after a state
  change.

## 5. Edge Cases

- **Zero budget:** A category with a budget of zero must not cause division by
  zero or `NaN`/`Infinity` output. If it has no spending, display 0% and no
  warning. If it has any positive spending, show the 100% alert and represent
  the progress visually as 100%.
- **Over-budget category as transfer source:** Only the non-negative available
  balance may be transferred. Existing overspending cannot be transferred away
  as available funds.
- **Transfer amount precision:** Monetary values are rounded consistently to two
  decimal places. Floating-point artifacts must not change the resulting
  budgets.
- **Exact threshold precision:** Values exactly at 80% and 100% must use the
  inclusive threshold rules, even when amounts contain cents.
- **Large overspending:** Progress remains capped at 100%, while the alert and
  displayed remaining balance show that spending exceeds the budget.
- **No expenses:** Every category still has a progress bar; each category
  shows zero spent and its full budget remaining.
- **Unknown expense category:** Expenses whose `categoryId` no longer matches a
  category must not be included in any visible category's spending or crash
  the budget view. They should not create a fabricated category status.
- **Missing or malformed saved data:** Existing persistence/loading behavior
  must remain safe. Invalid values must not produce broken progress bars or
  threshold messages; the user should receive the repository's standard
  validation/error behavior.
- **Single-category data:** The budget-transfer control must prevent a transfer
  when fewer than two categories are available.
- **Concurrent-looking edits:** A transfer must validate against the latest
  category state at submission time so a stale form cannot create a negative
  source budget.
- **Accessibility:** Status must not rely on color alone. Warnings and alerts
  should be exposed as readable text, and transfer validation errors should be
  associated with the relevant controls.

## 6. Out of Scope

- Notifications outside the application UI, such as email, SMS, or push
  notifications.
- Automatic creation, deletion, or renaming of categories.
- Changing the existing expense model or adding a backend.
- Carrying budgets or spending across reporting periods unless a separate
  reporting-period requirement is introduced.
