# Requirements Document

## Introduction

The Expense & Budget Visualizer is a mobile-friendly, client-side web application that helps users track their daily spending. Users can add transactions with a name, amount, and category; view a running total balance; see a pie chart of spending by category; delete transactions; sort transactions; add custom categories; and toggle between dark and light mode. All data is persisted in the browser's LocalStorage — no backend is required.

---

## Glossary

- **App**: The Expense & Budget Visualizer web application.
- **Transaction**: A single spending record consisting of an Item Name, Amount, and Category.
- **Item Name**: A non-empty text label describing what was purchased.
- **Amount**: A positive numeric value (in the user's local currency) representing the cost of a transaction.
- **Category**: A label used to group transactions. Built-in categories are Food, Transport, and Fun. Users may also define Custom Categories.
- **Custom Category**: A user-defined category name added at runtime.
- **Transaction List**: The scrollable UI component that displays all saved transactions.
- **Total Balance**: The running sum of all transaction amounts displayed prominently at the top of the App.
- **Pie Chart**: A Chart.js-powered visual showing the proportion of total spending per category.
- **LocalStorage**: The browser's built-in key-value storage API used to persist all data client-side.
- **Dark Mode**: A color theme with dark background and light foreground.
- **Light Mode**: A color theme with light background and dark foreground (the default).
- **Sort Order**: The current ordering criterion applied to the Transaction List — either by Amount (ascending or descending) or by Category (alphabetical).
- **Input Form**: The UI form containing fields for Item Name, Amount, and Category, plus a submit button.
- **Validator**: The client-side logic component responsible for checking Input Form field values before a transaction is saved.

---

## Requirements

### Requirement 1: Add a Transaction

**User Story:** As a user, I want to fill in a form with an item name, amount, and category and submit it, so that the transaction is recorded and visible in my spending list.

#### Acceptance Criteria

1. THE App SHALL render an Input Form containing an Item Name text field with a maximum of 100 characters, an Amount numeric field accepting values between 0.01 and 999,999,999.99, a Category selector with at least one selectable option, and a submit button.
2. WHEN the user submits the Input Form with all fields filled and a valid Amount between 0.01 and 999,999,999.99, THE App SHALL add the Transaction to the Transaction List and persist it to LocalStorage within 500 milliseconds.
3. IF the user submits the Input Form with any field empty, THEN THE Validator SHALL display an inline error message next to each empty field indicating the field is required and SHALL NOT save the Transaction.
4. IF the user submits the Input Form with an Amount that is not a number between 0.01 and 999,999,999.99, THEN THE Validator SHALL display an inline error message next to the Amount field indicating the expected range and SHALL NOT save the Transaction.
5. WHEN a Transaction is successfully added, THE App SHALL clear all Input Form fields and move focus to the Item Name field within 200 milliseconds.

---

### Requirement 2: View Transaction List

**User Story:** As a user, I want to see all my recorded transactions in a scrollable list, so that I can review what I have spent.

#### Acceptance Criteria

1. THE App SHALL display the Transaction List showing every saved Transaction's Item Name, Amount, and Category.
2. WHILE the Transaction List contains more items than the visible viewport allows, THE App SHALL make the Transaction List independently scrollable without affecting the rest of the page layout.
3. THE App SHALL display the Transaction List in the current Sort Order selected by the user.
4. IF no Transactions have been saved, THEN THE App SHALL display a message indicating that no transactions have been recorded yet.
5. WHEN the Transaction List is displayed, THE App SHALL show each Transaction's Date alongside its Item Name, Amount, and Category.

---

### Requirement 3: Delete a Transaction

**User Story:** As a user, I want to delete a transaction from the list, so that I can remove incorrect or unwanted entries.

#### Acceptance Criteria

1. THE App SHALL render a delete control (button or icon) for each Transaction in the Transaction List.
2. WHEN the user activates the delete control for a Transaction, THE App SHALL remove that Transaction from the Transaction List and from LocalStorage.
3. WHEN the user activates the delete control for a Transaction, THE App SHALL update the Total Balance to reflect the removed Transaction's amount within 100 milliseconds without requiring a page reload.
4. WHEN the user activates the delete control for a Transaction, THE App SHALL update the Pie Chart to reflect the removed Transaction's category within 100 milliseconds without requiring a page reload.
5. IF LocalStorage is unavailable when a Transaction deletion is attempted, THEN THE App SHALL display an error message indicating the deletion could not be saved and SHALL NOT remove the Transaction from the Transaction List.

---

### Requirement 4: Display Total Balance

**User Story:** As a user, I want to see my total spending balance at the top of the page, so that I always know how much I have spent in total.

#### Acceptance Criteria

1. THE App SHALL display the Total Balance as the sum of all Transaction Amounts, where the Total Balance is a numeric value with exactly 2 decimal places, at the top of the page above all other content.
2. WHEN a Transaction is added or deleted, THE App SHALL recalculate and update the displayed Total Balance within 100 milliseconds.
3. WHILE no Transactions exist, THE App SHALL display a Total Balance of 0.00.
4. IF the Total Balance is a positive value, THEN THE App SHALL display the Total Balance without a sign prefix.
5. IF the Total Balance is a negative value, THEN THE App SHALL display the Total Balance with a minus sign prefix.

---

### Requirement 5: Spending Pie Chart

**User Story:** As a user, I want to see a pie chart of my spending broken down by category, so that I can understand where my money goes.

#### Acceptance Criteria

1. THE App SHALL render a Pie Chart using Chart.js that displays each Category as a distinct slice proportional to its share of total Transaction spending amounts.
2. WHEN a Transaction is added or deleted, THE App SHALL update the Pie Chart within 100 milliseconds to reflect the new category totals.
3. WHILE no Transactions exist, THE App SHALL display a message stating "No spending data is available" in place of the Pie Chart.
4. THE App SHALL assign a unique color per Category label so that no two Categories share the same color within a session, and SHALL use the same color for each Category label on every render within the same session. Category-to-color assignments SHALL NOT be persisted to LocalStorage and MAY differ between sessions or after a page reload.

---

### Requirement 6: Persist Data with LocalStorage

**User Story:** As a user, I want my transactions to be saved in the browser, so that my data is not lost when I close or refresh the page.

#### Acceptance Criteria

1. WHEN a Transaction is added or deleted, THE App SHALL write the updated Transaction List to LocalStorage under a fixed, hardcoded key that does not change between sessions.
2. WHEN the App initializes, THE App SHALL read the Transaction List from LocalStorage and restore all previously saved Transactions before rendering any Transaction data to the user.
3. IF LocalStorage is unavailable or returns a parse error, THEN THE App SHALL initialize with an empty Transaction List and display a non-blocking warning message visible in the UI for at least 5 seconds.
4. IF the Transaction List stored in LocalStorage contains one or more entries with missing or invalid required fields, THEN THE App SHALL discard only the invalid entries, retain all valid entries, and display a non-blocking warning message indicating that some data could not be restored.

---

### Requirement 7: Sort Transactions

**User Story:** As a user, I want to sort my transaction list by amount or category, so that I can find and review entries more easily.

#### Acceptance Criteria

1. THE App SHALL provide a Sort Order control offering at minimum the options: Amount Ascending, Amount Descending, and Category Alphabetical.
2. WHEN the user selects a Sort Order, THE App SHALL re-render the Transaction List in the chosen order within 100 milliseconds.
3. WHEN new Transactions are added, THE App SHALL apply the currently active Sort Order to the updated Transaction List.
4. THE App SHALL persist the user's selected Sort Order to LocalStorage and restore it on initialization.
5. WHEN two Transactions share the same sort key value (amount or category), THE App SHALL order those Transactions by their creation date ascending as a tiebreaker.
6. IF the Sort Order value read from LocalStorage on initialization is not a recognized Sort Order option, THEN THE App SHALL default to Amount Ascending.

---

### Requirement 8: Custom Categories

**User Story:** As a user, I want to add my own spending categories beyond the built-in ones, so that I can track expenses in areas that matter to me.

#### Acceptance Criteria

1. THE App SHALL provide a text input field and a save control that allows the user to enter and save a Custom Category name of 1 to 50 characters.
2. WHEN the user saves a Custom Category with a non-empty, unique name, THE App SHALL add that Custom Category to the Category selector in the Input Form within 500 milliseconds.
3. IF the user attempts to save a Custom Category with an empty name, a name exceeding 50 characters, or a name that already matches an existing built-in or Custom Category name (case-insensitive), THEN THE Validator SHALL display an inline error message adjacent to the input field and SHALL NOT save the category.
4. THE App SHALL persist all Custom Categories to LocalStorage and restore them in the Category selector on initialization before the Input Form becomes interactive.
5. IF LocalStorage is unavailable or returns a read error on initialization, THEN THE App SHALL initialize with no Custom Categories and SHALL display an error message indicating that custom categories could not be loaded.
6. WHEN a Custom Category is available, THE Pie Chart SHALL include a slice for that category whenever Transactions assigned to it exist, using the same slice format as built-in categories.

---

### Requirement 9: Dark / Light Mode Toggle

**User Story:** As a user, I want to switch between dark and light color themes, so that I can use the app comfortably in different lighting environments.

#### Acceptance Criteria

1. THE App SHALL display a theme toggle control that is visible on every page view and indicates the currently active theme (Light Mode or Dark Mode).
2. WHEN the user activates the theme toggle, THE App SHALL apply the selected color theme to all visible UI components within 100 milliseconds.
3. WHEN the App initializes, THE App SHALL read the theme preference from LocalStorage and apply it before any UI content is rendered, defaulting to Light Mode if no preference is stored.
4. WHILE Dark Mode is active, THE App SHALL maintain sufficient color contrast so that all text and interactive elements meet WCAG 2.1 AA contrast requirements (minimum 4.5:1 for normal text).
5. WHILE Light Mode is active, THE App SHALL maintain sufficient color contrast so that all text and interactive elements meet WCAG 2.1 AA contrast requirements (minimum 4.5:1 for normal text).
6. IF LocalStorage is unavailable or returns a read/write error for the theme preference, THEN THE App SHALL silently fall back to Light Mode without displaying an error.
7. WHEN the user activates the theme toggle, THE App SHALL persist the new theme preference to LocalStorage before the theme transition completes.

---

### Requirement 10: Responsive and Mobile-Friendly Layout

**User Story:** As a user, I want the app to work well on my phone as well as my desktop browser, so that I can track spending on any device.

#### Acceptance Criteria

1. THE App SHALL render a single-column layout on viewport widths from 320px to 480px (mobile), such that all interactive controls are reachable without horizontal scrolling and all touch targets are at least 44×44px.
2. THE App SHALL render a multi-column layout on viewport widths from 481px to 767px (tablet), such that all interactive controls are reachable without horizontal scrolling.
3. THE App SHALL render a multi-column expanded layout on viewport widths of 768px and above (desktop), such that all interactive controls are reachable without horizontal scrolling.
4. THE App SHALL function correctly in the current stable release of Chrome, Firefox, Edge, and Safari without requiring browser-specific CSS hacks or JavaScript polyfills not already part of the standard build.
5. THE App SHALL load all assets and render the initial UI in under 3 seconds on a network connection with a minimum download speed of 10 Mbps and latency not exceeding 50ms.

---

### Requirement 11: Single-File Code Structure

**User Story:** As a developer, I want the codebase to follow a simple, predictable file structure, so that the project is easy to navigate and maintain.

#### Acceptance Criteria

1. THE App SHALL contain exactly one CSS file located at `css/style.css`.
2. THE App SHALL contain exactly one JavaScript file located at `js/app.js`.
3. THE App SHALL load Chart.js via a CDN `<script>` tag and SHALL NOT require a build tool, package manager, or local server to run.
4. IF the Chart.js CDN `<script>` tag fires an `onerror` event, THEN THE App SHALL display a persistent error message indicating that a required resource could not be loaded and the application cannot start.
