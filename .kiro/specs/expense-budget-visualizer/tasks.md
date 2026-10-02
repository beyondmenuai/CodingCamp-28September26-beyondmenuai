# Implementation Plan: Expense & Budget Visualizer

## Overview

Implement a client-side SPA using plain HTML, CSS, and vanilla JavaScript. All logic lives in two files: `css/style.css` and `js/app.js`. The JS file uses a single IIFE with internal layers: State, Storage, Validator, ChartManager, Renderer, and EventHandlers. Chart.js is loaded from CDN. All data is persisted in `localStorage`.

Tasks are ordered so each step builds on the previous one. The IIFE skeleton and pure utility functions come first, followed by UI/HTML scaffolding, then integration and wiring.

---

## Tasks

- [x] 1. Set up project structure and HTML skeleton
  - Create `index.html` with the full page structure: `<header>` for the balance display, `<main>` split into a left panel (input form, custom category input, sort control, theme toggle) and a right panel (transaction list, chart canvas), and `<footer>`
  - Add CDN `<script>` tag for Chart.js before the closing `</body>` tag, followed by `<script src="js/app.js">`; the Chart.js `<script>` tag MUST include an `onerror` handler (inline attribute or wired in JS) that sets a module-level `chartUnavailable` flag to `true` and calls `Renderer.showError(CDN_ERROR_MSG)`
  - Add `<link rel="stylesheet" href="css/style.css">` in `<head>`
  - Create empty `css/style.css` and `js/app.js` files
  - Assign all required IDs: `#total-balance`, `#expense-form`, `#item-name`, `#amount`, `#category-select`, `#transaction-list`, `#sort-select`, `#add-category-btn`, `#custom-category-input`, `#theme-toggle`, and the Chart.js `<canvas id="spending-chart">`
  - _Requirements: 1.1, 2.1, 4.1, 5.1, 7.1, 8.1, 9.1, 11.1, 11.2, 11.3_

- [x] 2. Implement CSS layout, theming, and responsive breakpoints
  - [x] 2.1 Define CSS custom properties and base styles
    - Declare all color tokens as CSS custom properties on `:root` for light mode (`--bg`, `--surface`, `--text`, `--accent`, `--border`, etc.)
    - Add `[data-theme="dark"]` block on `:root` overriding each token for dark mode
    - Set `box-sizing: border-box` globally; style `body`, `header`, `main`, `footer`
    - Style `.field-error`, `.warning-banner`, and `.error-banner` elements
    - _Requirements: 9.2, 9.4, 9.5_

  - [x] 2.2 Implement responsive layout breakpoints
    - Default (mobile-first): single-column layout, all controls full-width
    - `@media (min-width: 481px)`: two-column layout for main panels (tablet)
    - `@media (min-width: 768px)`: expanded multi-column layout (desktop)
    - Ensure touch targets (buttons, selects, inputs) have `min-height: 44px; min-width: 44px`
    - Ensure `#transaction-list` is independently scrollable (`overflow-y: auto; max-height: ...`)
    - _Requirements: 2.2, 10.1, 10.2, 10.3_

- [x] 3. Implement the IIFE skeleton, State object, and constants
  - Wrap all JS in an immediately-invoked function expression: `(function() { ... })();`
  - Declare `localStorage` key constants: `LS_KEY_TRANSACTIONS`, `LS_KEY_CATEGORIES`, `LS_KEY_SORT`, `LS_KEY_THEME`
  - Declare `COLOR_PALETTE` array (≥15 distinct CSS color strings) and `categoryColorMap` as a `new Map()`
  - Define the `state` object: `{ transactions: [], categories: ['Food', 'Transport', 'Fun'], sortOrder: 'amount-asc', theme: 'light' }`
  - _Requirements: 6.1, 8.1, 9.3, 11.2_

- [x] 4. Implement the Storage module
  - [x] 4.1 Implement all Storage read/write functions
    - `serializeTransactions(transactions)`: pure function — serializes array to JSON string
    - `deserializeTransactions(json)`: pure function — parses JSON; filters out entries with missing or invalid required fields; returns `[]` on parse error
    - `saveTransactions(transactions)`: calls `serializeTransactions` → `localStorage.setItem(LS_KEY_TRANSACTIONS, ...)`; wrapped in `try/catch`
    - `loadTransactions()`: reads raw JSON from `LS_KEY_TRANSACTIONS` → calls `deserializeTransactions`; returns `[]` on error
    - `saveCategories(categories)` / `loadCategories()`: same pattern for `LS_KEY_CATEGORIES`
    - `saveSortOrder(order)` / `loadSortOrder()`: `loadSortOrder` returns the raw stored string (pass through `parseSortOrder` to canonicalize); returns `''` on error
    - `saveTheme(theme)` / `loadTheme()`: `saveTheme` swallows errors silently; `loadTheme` returns the raw stored string (pass through `resolveTheme` to canonicalize); returns `''` on error
    - `resolveTheme(raw)`: pure function — returns `'dark'` only if `raw === 'dark'`, else `'light'` for all other values including `undefined`, `null`, and unrecognized strings
    - _Requirements: 6.1, 6.2, 7.4, 8.4, 9.3, 9.6_

  - [ ]* 4.2 Write property test for Storage round-trip (P8)
    - **Property 8: Transaction list LocalStorage round-trip preserves all valid entries**
    - Use `fast-check`: generate mixed arrays of valid and invalid transaction objects; assert `loadTransactions(saveTransactions(array))` returns only the valid entries
    - **Validates: Requirements 6.1, 6.2, 6.4**

  - [ ]* 4.3 Write property test for categories round-trip (P12)
    - **Property 12: Custom categories LocalStorage round-trip preserves the list**
    - Use `fast-check`: generate arrays of valid category name strings; assert serialization/deserialization produces a strictly equal list
    - **Validates: Requirements 8.4**

  - [ ]* 4.4 Write property test for theme resolution (P13)
    - **Property 13: Theme resolution is correct for all stored values**
    - Use `fast-check`: generate arbitrary strings including `'dark'`, `'light'`, empty, undefined; assert `resolveTheme` returns `'dark'` only for `'dark'`, `'light'` for all else
    - **Validates: Requirements 9.3, 9.6**

- [x] 5. Implement the Validator module
  - [x] 5.1 Implement all pure Validator functions
    - `validateItemName(name)`: returns error string if empty or `> 100` chars, else `null`
    - `validateAmount(raw)`: returns error string if not a finite number, `≤ 0`, or `> 999999999.99`, else `null`
    - `validateCategory(name, existing)`: returns error string if empty, whitespace-only (trimmed length is 0), `> 50` chars, or case-insensitive duplicate; else `null`
    - `validateTransaction(form, existing)`: runs all three; returns `{ isValid, errors: { itemName?, amount?, category? } }`
    - `parseSortOrder(raw)`: returns `'amount-asc'` for any unrecognized string, including `null`/`undefined`
    - _Requirements: 1.3, 1.4, 8.3, 7.6_

  - [ ]* 5.2 Write property test for invalid transaction inputs (P2)
    - **Property 2: Invalid transaction inputs are always rejected**
    - Use `fast-check`: generate each invalid subcase (empty name, name > 100 chars, amount ≤ 0, non-numeric amount, missing fields); assert `validateTransaction` returns `isValid: false` and no mutation of the transaction list
    - **Validates: Requirements 1.3, 1.4**

  - [ ]* 5.3 Write property test for category validation (P11)
    - **Property 11: Custom category validation rejects all invalid inputs**
    - Use `fast-check`: generate empty strings, whitespace-only strings (trimmed length 0), strings > 50 chars, and case variants of existing categories; assert `isValid: false`. Generate valid names (1–50 non-whitespace, non-duplicate); assert `isValid: true`
    - **Validates: Requirements 8.3**

  - [ ]* 5.4 Write property test for sort order fallback (P10)
    - **Property 10: Unrecognized sort order values always resolve to `amount-asc`**
    - Use `fast-check`: generate arbitrary strings filtered to exclude `'amount-asc'`, `'amount-desc'`, `'category-asc'`; assert `parseSortOrder` always returns `'amount-asc'`
    - **Validates: Requirements 7.6**

- [x] 6. Implement pure utility functions: `computeBalance`, `formatBalance`, `sortTransactions`
  - [x] 6.1 Implement `computeBalance` and `formatBalance`
    - `computeBalance(transactions)`: sums all `t.amount` values, rounds to 2 decimal places; returns `0.00` for empty array
    - `formatBalance(value)`: returns string with exactly 2 decimal places; negative values include `-` prefix; positive values have no sign prefix
    - _Requirements: 4.1, 4.3, 4.4, 4.5_

  - [ ]* 6.2 Write property test for balance computation (P4)
    - **Property 4: Balance equals the exact sum of all transaction amounts**
    - Use `fast-check`: generate arrays of transactions with valid amounts; assert `computeBalance` equals arithmetic sum rounded to 2 decimal places; assert empty array returns `0.00`
    - **Validates: Requirements 4.1, 4.3**

  - [ ]* 6.3 Write property test for delete decrements balance (P5)
    - **Property 5: Deleting a transaction decrements the balance by that transaction's amount**
    - Use `fast-check`: generate non-empty arrays, pick a random index; assert balance after removal equals balance before minus `t.amount`, rounded to 2 decimal places
    - **Validates: Requirements 3.3, 4.2**

  - [x] 6.4 Implement `sortTransactions`
    - `sortTransactions(transactions, order)`: pure function — MUST NOT mutate the input array; use `[...transactions].sort(...)` to sort a copy
    - `'amount-asc'`: sort by `amount` ascending, tiebreaker `date` ascending
    - `'amount-desc'`: sort by `amount` descending, tiebreaker `date` ascending
    - `'category-asc'`: sort by `category` locale-insensitive alphabetical, tiebreaker `date` ascending
    - _Requirements: 7.2, 7.3, 7.5_

  - [ ]* 6.5 Write property test for sort correctness (P9)
    - **Property 9: Sort order is correct for all inputs and sort keys**
    - Use `fast-check`: generate arbitrary transaction arrays × each `SortOrder`; assert every adjacent pair satisfies the ordering invariant; assert date tiebreaker holds when primary keys are equal; assert the input array is not mutated (reference equality check on original elements)
    - **Validates: Requirements 7.2, 7.3, 7.5**

  - [ ]* 6.6 Write property test for balance formatting sign-correctness (P14)
    - **Property 14: Balance formatting is sign-correct for all numeric inputs**
    - Use `fast-check`: generate positive floats and assert `formatBalance(v)` does NOT begin with `-`; generate negative floats and assert `formatBalance(v)` begins with `-`; assert all outputs have exactly 2 decimal places
    - **Validates: Requirements 4.4, 4.5**

- [x] 7. Implement the ChartManager module
  - [x] 7.1 Implement `assignCategoryColor` and `computeChartData`
    - `assignCategoryColor(label)`: checks `categoryColorMap`; on first call for a label, picks the next color from `COLOR_PALETTE` (cycling if exhausted) and caches it; returns cached color on subsequent calls
    - `categoryColorMap` is initialized as `new Map()` at IIFE startup and is **never** written to or read from `localStorage` — it is an in-memory, session-only structure that is discarded on every page reload; cross-session color consistency is not a requirement
    - `computeChartData(transactions)`: groups transactions by `category`, sums amounts per group, calls `assignCategoryColor` for each label; returns `{ labels, data, colors }`
    - _Requirements: 5.1, 5.4_

  - [ ]* 7.2 Write property test for chart data totals (P6)
    - **Property 6: Chart data reflects per-category totals**
    - Use `fast-check`: generate transaction arrays; assert every distinct category appears as a label, each `data[i]` equals the sum of amounts for that category, and `sum(data)` equals `computeBalance(transactions)`
    - **Validates: Requirements 5.1, 5.2, 8.6**

  - [ ]* 7.3 Write property test for color uniqueness and stability (P7)
    - **Property 7: Category colors are unique and stable within a session**
    - Use `fast-check`: generate sets of ≥2 distinct category labels; assert each label receives a different color; assert repeated calls for the same label return the same color within the same session
    - Note: color assignments are session-only — different page loads may produce different colors for the same label, and this is expected behavior
    - **Validates: Requirements 5.4**

  - [x] 7.4 Implement `ChartManager.init`, `update`, `showEmptyState`, `hideEmptyState`
    - `init(canvasId)`: checks the module-level `chartUnavailable` flag first (set by the `<script onerror>` handler on the CDN tag); if `true`, calls `Renderer.showError(CDN_ERROR_MSG)` (no-op if the error banner is already displayed) and returns without creating a chart instance; also guards with `typeof Chart === 'function'` as a safety fallback for any case where the flag was not set — if that check also fails, same `showError` + return behavior applies; otherwise creates a `new Chart(canvas, { type: 'pie', data: {...}, options: {...} })` and stores the instance
    - `update(transactions, categories)`: if no transactions, calls `showEmptyState()`; else calls `hideEmptyState()`, computes chart data, and calls `chart.data = newData; chart.update()`
    - `showEmptyState()` / `hideEmptyState()`: toggle visibility of `<canvas>` and the "No spending data is available" placeholder element
    - _Requirements: 5.1, 5.2, 5.3, 11.3, 11.4_

- [x] 8. Implement the Renderer module
  - [x] 8.1 Implement `renderBalance`, `renderCategorySelector`, `renderSortControl`, `applyTheme`
    - `renderBalance(transactions)`: calls `computeBalance` then `formatBalance`; sets `#total-balance` text content
    - `renderCategorySelector(categories)`: clears `#category-select` and repopulates `<option>` elements from the categories array
    - `renderSortControl(sortOrder)`: sets the selected `<option>` on `#sort-select` to match `sortOrder`
    - `applyTheme(theme)`: calls `document.documentElement.setAttribute('data-theme', theme)`
    - _Requirements: 4.1, 4.2, 7.1, 8.2, 9.2_

  - [x] 8.2 Implement `renderTransactionList`
    - `renderTransactionList(transactions, sortOrder)`: calls `sortTransactions`, then generates an HTML string (or `DocumentFragment`) for each transaction
    - Each item shows: `itemName`, formatted `amount`, `category`, `date` (formatted as a readable string), and a `<button class="delete-btn" data-id="...">` delete control
    - If `transactions` is empty, renders the empty-state message ("No transactions recorded yet.")
    - Sets `innerHTML` (or `replaceChildren`) on `#transaction-list`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1_

  - [ ]* 8.3 Write property test for transaction list rendering (P3)
    - **Property 3: Transaction list rendering includes all fields for every entry**
    - Use `fast-check`: generate non-empty transaction arrays; call `renderTransactionList` on a mock DOM element; assert each transaction's `itemName`, formatted `amount`, `category`, and `date` appear exactly once; assert each item contains a delete control element
    - **Validates: Requirements 2.1, 2.5, 3.1**

  - [x] 8.4 Implement `showFormErrors`, `clearFormErrors`, `showWarning`, `showError`
    - `showFormErrors(errors)`: for each error key, insert a `<span class="field-error" id="err-{field}">` after the relevant `<label>` or `<input>`; set `aria-describedby` on the input
    - `clearFormErrors()`: remove all `.field-error` elements and `aria-describedby` attributes
    - `showWarning(message, durationMs)`: insert `<div role="status" class="warning-banner">` in the DOM; call `setTimeout` to remove it after `durationMs`
    - `showError(message)`: insert `<div role="alert" class="error-banner">` (persistent, requires user dismissal or reload)
    - _Requirements: 1.3, 1.4, 3.5, 6.3, 6.4, 8.3, 8.5, 11.4_

- [x] 9. Checkpoint — Verify pure functions and rendering
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Implement the EventHandlers module and wire up interactions
  - [x] 10.1 Implement `onFormSubmit`
    - Read `#item-name`, `#amount`, `#category-select` values; call `validateTransaction`
    - On invalid: call `Renderer.showFormErrors(errors)` and return
    - On valid: call `Renderer.clearFormErrors()`, create a transaction object with `crypto.randomUUID()` for `id` and `new Date().toISOString()` for `date`, push to `state.transactions`, call `Storage.saveTransactions`, call all relevant Renderer functions and `ChartManager.update`
    - Reset form fields and set focus to `#item-name` within 200ms
    - _Requirements: 1.2, 1.3, 1.4, 1.5_

  - [x] 10.2 Implement `onDeleteClick`
    - Use event delegation on `#transaction-list` to handle clicks on `.delete-btn`
    - Read `data-id` from the button; find the transaction in `state.transactions`
    - **Call `Storage.saveTransactions` with the filtered list FIRST** — if it throws, call `Renderer.showError(...)` and abort without modifying `state.transactions`
    - On success: update `state.transactions`, call `Renderer.renderTransactionList`, `Renderer.renderBalance`, `ChartManager.update`
    - _Requirements: 3.2, 3.3, 3.4, 3.5_

  - [x] 10.3 Implement `onSortChange`
    - Listen to `#sort-select` `change` event; read new value
    - Call `parseSortOrder(value)` to sanitize; update `state.sortOrder`; call `Storage.saveSortOrder`; call `Renderer.renderTransactionList`
    - _Requirements: 7.2, 7.4_

  - [x] 10.4 Implement `onAddCategory`
    - Listen to `#add-category-btn` click; read `#custom-category-input` value
    - Call `validateCategory(name, state.categories)`; on error, call `Renderer.showFormErrors` (category field variant) and return
    - On valid: push to `state.categories`, call `Storage.saveCategories`, call `Renderer.renderCategorySelector`, clear the input
    - _Requirements: 8.2, 8.3_

  - [x] 10.5 Implement `onThemeToggle`
    - Listen to `#theme-toggle` click; flip `state.theme` between `'light'` and `'dark'`
    - **Call `Storage.saveTheme(state.theme)` FIRST**, then call `Renderer.applyTheme(state.theme)` — this order guarantees the preference is persisted before the visual transition completes (Req 9.7)
    - Update the toggle control label/icon to reflect the new state
    - _Requirements: 9.1, 9.2, 9.7_

- [x] 11. Implement app initialization (`init` function)
  - [x] 11.1 Implement `init` — load state from LocalStorage
    - Call `loadTheme()` → `resolveTheme()` (canonicalizes the raw string to `'light'` or `'dark'`) → set `state.theme`; call `Renderer.applyTheme` immediately (before any other rendering)
    - Call `loadTransactions()`: on thrown error, set `state.transactions = []`, call `Renderer.showWarning(..., 5000)`; on success, filter invalid entries (log count), if any discarded call `Renderer.showWarning(..., 5000)`
    - Call `loadCategories()`: on error, call `Renderer.showError(...)`; merge with built-in categories into `state.categories`
    - Call `parseSortOrder(loadSortOrder())` — `loadSortOrder` returns the raw stored string; `parseSortOrder` canonicalizes it → set `state.sortOrder`
    - _Requirements: 6.2, 6.3, 6.4, 7.4, 8.4, 8.5, 9.3_

  - [x] 11.2 Implement `init` — initial render and event wiring
    - Call `Renderer.renderBalance`, `Renderer.renderCategorySelector`, `Renderer.renderSortControl`, `Renderer.renderTransactionList`
    - Call `ChartManager.init('spending-chart')` then `ChartManager.update(state.transactions, state.categories)`
    - Attach all `EventHandlers` (`onFormSubmit`, `onDeleteClick`, `onSortChange`, `onAddCategory`, `onThemeToggle`)
    - Call `init()` at the bottom of the IIFE
    - _Requirements: 2.1, 4.1, 5.1, 6.2, 7.1, 8.2, 9.1, 11.4_

- [x] 12. Implement valid transaction persistence (Property 1 coverage)
  - [x] 12.1 Implement `serializeTransactions` and `deserializeTransactions` as named pure functions
    - Extract the serialize/deserialize logic from Storage into named pure functions testable independently: `serializeTransactions(arr)` → JSON string; `deserializeTransactions(json)` → `Transaction[]` (filters invalid)
    - Reuse these in `saveTransactions` / `loadTransactions`
    - _Requirements: 6.1, 6.2_

  - [ ]* 12.2 Write property test for valid transaction persistence (P1)
    - **Property 1: Valid transactions are persisted and retrievable**
    - Use `fast-check`: generate valid transaction records; assert `deserializeTransactions(serializeTransactions([t]))` contains a structurally equivalent entry with the same `itemName`, `amount`, `category`, and `date`
    - **Validates: Requirements 1.2, 6.1, 6.2**

- [ ] 13. Final checkpoint — Full integration pass
  - Ensure all tests pass, ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- `fast-check` property tests run in Node.js via `node --experimental-vm-modules` — no build tool required
- All property tests are tagged with `// Feature: expense-budget-visualizer, Property {N}: {property_text}` per the design's testing strategy
- Each task references specific requirements for traceability
- Checkpoints (tasks 9 and 13) are integration gates — all tests should pass before proceeding
- The IIFE structure means all modules share scope; no imports or exports are needed
- `crypto.randomUUID()` is available in all modern browsers (Chrome 92+, Firefox 95+, Edge 92+, Safari 15.4+) — no polyfill needed

---

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2.1", "3"] },
    { "id": 2, "tasks": ["2.2", "4.1"] },
    { "id": 3, "tasks": ["4.2", "4.3", "4.4", "5.1"] },
    { "id": 4, "tasks": ["5.2", "5.3", "5.4", "6.1"] },
    { "id": 5, "tasks": ["6.2", "6.3", "6.4"] },
    { "id": 6, "tasks": ["6.5", "6.6", "7.1", "8.1"] },
    { "id": 7, "tasks": ["7.2", "7.3", "7.4", "8.2"] },
    { "id": 8, "tasks": ["8.3", "8.4", "12.1"] },
    { "id": 9, "tasks": ["10.1", "10.2", "10.3", "10.4", "10.5", "12.2"] },
    { "id": 10, "tasks": ["11.1"] },
    { "id": 11, "tasks": ["11.2"] }
  ]
}
```
