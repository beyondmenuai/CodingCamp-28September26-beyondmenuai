/* js/app.js — Expense & Budget Visualizer application logic
 *
 * All code is wrapped in a single IIFE to avoid polluting the global scope.
 * Internal layers (in order of definition):
 *   1. Constants & State
 *   2. Storage        — localStorage read/write, serialization
 *   3. Validator      — pure validation functions
 *   4. Utility        — computeBalance, formatBalance, sortTransactions
 *   5. ChartManager   — Chart.js lifecycle management
 *   6. Renderer       — DOM rendering and updates
 *   7. EventHandlers  — user interaction entry points
 *   8. init()         — app initialization (called at the bottom of the IIFE)
 */

(function () {
  'use strict';

  // ─────────────────────────────────────────────────────────────────────────────
  // § 1. CONSTANTS & STATE
  // ─────────────────────────────────────────────────────────────────────────────

  /** LocalStorage keys — hardcoded, never change between sessions (Req 6.1) */
  const LS_KEY_TRANSACTIONS = 'ebv_transactions';
  const LS_KEY_CATEGORIES   = 'ebv_categories';
  const LS_KEY_SORT         = 'ebv_sort_order';
  const LS_KEY_THEME        = 'ebv_theme';

  /**
   * Persistent error message shown when Chart.js CDN load fails (Req 11.4).
   * Matches the wording in the index.html onerror handler and the design doc.
   */
  const CDN_ERROR_MSG =
    'A required resource (Chart.js) could not be loaded. ' +
    'Please check your internet connection and reload the page.';

  /**
   * Module-level flag set to true by the Chart.js <script onerror> handler
   * in index.html BEFORE this IIFE executes.  ChartManager.init() reads this
   * flag to bail out early without attempting to create a chart instance.
   *
   * The index.html handler writes to window.__chartLoadError; we read it here
   * once and cache the result so ChartManager has a simple boolean to check.
   */
  let chartUnavailable = window.__chartLoadError === true;

  /**
   * COLOR_PALETTE — ≥ 15 distinct, accessible CSS color strings used by
   * ChartManager to assign a unique color to each category label (Req 5.4).
   * Colors are assigned in registration order and cached for the session.
   */
  const COLOR_PALETTE = [
    '#e6194b', // vivid red
    '#3cb44b', // vivid green
    '#4363d8', // vivid blue
    '#f58231', // vivid orange
    '#911eb4', // vivid purple
    '#42d4f4', // vivid cyan
    '#f032e6', // vivid magenta
    '#bfef45', // lime
    '#fabed4', // pink
    '#469990', // teal
    '#dcbeff', // lavender
    '#9a6324', // brown
    '#fffac8', // beige
    '#800000', // maroon
    '#aaffc3', // mint
    '#808000', // olive
    '#ffd8b1', // apricot
  ];

  /**
   * In-memory map from category label → CSS color string.
   * Never persisted to localStorage; reset on every page load (Req 5.4).
   */
  const categoryColorMap = new Map();

  /**
   * Single source of truth for runtime application state.
   * Hydrated from localStorage during init(); mutated only by EventHandlers.
   */
  const state = {
    /** @type {Array<{id:string, itemName:string, amount:number, category:string, date:string}>} */
    transactions: [],

    /** Built-in categories always appear first; custom categories are appended */
    categories: ['Food', 'Transport', 'Fun'],

    /** @type {'amount-asc'|'amount-desc'|'category-asc'} */
    sortOrder: 'amount-asc',

    /** @type {'light'|'dark'} */
    theme: 'light',
  };

  // Expose a Renderer hook so the inline onerror on the <script> tag (which
  // fires before app.js runs) can queue a deferred error banner display.
  // ChartManager.init() and Renderer.showError() complete the wiring later.
  window.__rendererShowError = function (msg) {
    chartUnavailable = true;
    // If the Renderer is already initialised, call it immediately.
    // Otherwise the message is picked up by ChartManager.init() on first run.
    if (typeof Renderer !== 'undefined' && Renderer.showError) {
      Renderer.showError(msg);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // § 2. STORAGE MODULE
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Pure function — serializes a Transaction array to a JSON string.
   * Exposed as a named function for independent testability (Req 6.1).
   *
   * @param {Array<Object>} transactions
   * @returns {string}
   */
  function serializeTransactions(transactions) {
    return JSON.stringify(transactions);
  }

  /**
   * Pure function — parses a JSON string into a Transaction array.
   * Silently discards any entry that fails the validity check:
   *   - id:       non-empty string
   *   - itemName: non-empty string
   *   - amount:   finite, positive number
   *   - category: non-empty string
   *   - date:     non-empty string
   * Returns [] on any parse error.
   * Exposed as a named function for independent testability (Req 6.2).
   *
   * @param {string} json
   * @returns {Array<Object>}
   */
  function deserializeTransactions(json) {
    try {
      const parsed = JSON.parse(json);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(function (t) {
        return (
          t !== null &&
          typeof t === 'object' &&
          typeof t.id       === 'string' && t.id.length       > 0 &&
          typeof t.itemName === 'string' && t.itemName.length > 0 &&
          typeof t.amount   === 'number' && isFinite(t.amount) && t.amount > 0 &&
          typeof t.category === 'string' && t.category.length > 0 &&
          typeof t.date     === 'string' && t.date.length     > 0
        );
      });
    } catch (_) {
      return [];
    }
  }

  /**
   * Pure function — returns 'dark' if raw === 'dark', otherwise 'light'.
   * Handles undefined, null, empty string, and all unrecognized values (Req 9.3, 9.6).
   *
   * @param {*} raw
   * @returns {'light'|'dark'}
   */
  function resolveTheme(raw) {
    return raw === 'dark' ? 'dark' : 'light';
  }

  const Storage = {
    /**
     * Writes the transaction list to localStorage.
     * Rethrows any error so callers can detect failure (Req 3.5).
     *
     * @param {Array<Object>} transactions
     */
    saveTransactions: function (transactions) {
      try {
        localStorage.setItem(LS_KEY_TRANSACTIONS, serializeTransactions(transactions));
      } catch (err) {
        throw err;
      }
    },

    /**
     * Reads and deserializes the transaction list from localStorage.
     * Returns [] on any error.
     *
     * @returns {Array<Object>}
     */
    loadTransactions: function () {
      try {
        var raw = localStorage.getItem(LS_KEY_TRANSACTIONS);
        if (raw === null) return [];
        return deserializeTransactions(raw);
      } catch (_) {
        return [];
      }
    },

    /**
     * Persists the custom categories array to localStorage.
     * Throws on error so callers can surface a warning.
     *
     * @param {string[]} categories
     */
    saveCategories: function (categories) {
      try {
        localStorage.setItem(LS_KEY_CATEGORIES, JSON.stringify(categories));
      } catch (err) {
        throw err;
      }
    },

    /**
     * Reads the custom categories array from localStorage.
     * Returns [] on any error (Req 8.5).
     *
     * @returns {string[]}
     */
    loadCategories: function () {
      try {
        var raw = localStorage.getItem(LS_KEY_CATEGORIES);
        if (raw === null) return [];
        var parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch (_) {
        return [];
      }
    },

    /**
     * Persists the current sort order string to localStorage.
     * Throws on error so callers can surface a warning.
     *
     * @param {string} order
     */
    saveSortOrder: function (order) {
      try {
        localStorage.setItem(LS_KEY_SORT, order);
      } catch (err) {
        throw err;
      }
    },

    /**
     * Reads the raw sort order string from localStorage.
     * Returns '' on error — callers pass this through parseSortOrder to canonicalize (Req 7.6).
     *
     * @returns {string}
     */
    loadSortOrder: function () {
      try {
        return localStorage.getItem(LS_KEY_SORT) || '';
      } catch (_) {
        return '';
      }
    },

    /**
     * Persists the theme preference to localStorage.
     * Swallows all errors silently (Req 9.6).
     *
     * @param {string} theme
     */
    saveTheme: function (theme) {
      try {
        localStorage.setItem(LS_KEY_THEME, theme);
      } catch (_) {
        // silently swallow — theme still applied in-memory
      }
    },

    /**
     * Reads the raw theme string from localStorage.
     * Returns '' on error — callers pass this through resolveTheme to canonicalize (Req 9.6).
     *
     * @returns {string}
     */
    loadTheme: function () {
      try {
        return localStorage.getItem(LS_KEY_THEME) || '';
      } catch (_) {
        return '';
      }
    },

    // Expose the pure helpers on the Storage object as well so callers can
    // reference Storage.resolveTheme / Storage.serializeTransactions if needed.
    serializeTransactions,
    deserializeTransactions,
    resolveTheme,
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // § 3. VALIDATOR MODULE
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Pure function — validates an item name.
   * Returns an error string if the trimmed value is empty OR the original
   * string exceeds 100 characters; else returns null.
   *
   * @param {string} name
   * @returns {string|null}
   */
  function validateItemName(name) {
    if (typeof name !== 'string' || name.trim().length === 0) {
      return 'Item name is required.';
    }
    if (name.length > 100) {
      return 'Item name must not exceed 100 characters.';
    }
    return null;
  }

  /**
   * Pure function — validates an amount value.
   * Accepts both string input (from a form field) and numeric input.
   * Returns an error string if the parsed value is not a finite number,
   * is NaN, Infinity, ≤ 0, or > 999,999,999.99; else returns null.
   *
   * @param {string|number} raw
   * @returns {string|null}
   */
  function validateAmount(raw) {
    var value = typeof raw === 'number' ? raw : parseFloat(raw);
    if (raw === '' || raw === null || raw === undefined || !isFinite(value) || isNaN(value)) {
      return 'Amount must be a valid number.';
    }
    if (value <= 0) {
      return 'Amount must be greater than 0.';
    }
    if (value > 999999999.99) {
      return 'Amount must not exceed 999,999,999.99.';
    }
    return null;
  }

  /**
   * Pure function — validates a category name for the custom-category input.
   * Returns an error string if:
   *   - the trimmed value is empty (whitespace-only)
   *   - the raw value exceeds 50 characters
   *   - the trimmed value case-insensitively matches any entry in `existing`
   * Else returns null.
   *
   * @param {string} name
   * @param {string[]} existing
   * @returns {string|null}
   */
  function validateCategory(name, existing) {
    if (typeof name !== 'string' || name.trim().length === 0) {
      return 'Category name is required.';
    }
    if (name.length > 50) {
      return 'Category name must not exceed 50 characters.';
    }
    var trimmedLower = name.trim().toLowerCase();
    var duplicate = existing.some(function (cat) {
      return cat.toLowerCase() === trimmedLower;
    });
    if (duplicate) {
      return 'A category with this name already exists.';
    }
    return null;
  }

  /**
   * Pure function — canonicalizes a raw sort order string.
   * Returns the raw value unchanged if it is exactly 'amount-asc',
   * 'amount-desc', or 'category-asc'; returns 'amount-asc' for any
   * other value, including null and undefined (Req 7.6).
   *
   * Defined as a standalone named function so it can be tested independently
   * of the Validator object.
   *
   * @param {*} raw
   * @returns {'amount-asc'|'amount-desc'|'category-asc'}
   */
  function parseSortOrder(raw) {
    if (raw === 'amount-asc' || raw === 'amount-desc' || raw === 'category-asc') {
      return raw;
    }
    return 'amount-asc';
  }

  const Validator = {
    /**
     * Validates the item name field.
     * @param {string} name
     * @returns {string|null}
     */
    validateItemName,

    /**
     * Validates the amount field.
     * @param {string|number} raw
     * @returns {string|null}
     */
    validateAmount,

    /**
     * Validates a custom category name against the existing categories list.
     * @param {string} name
     * @param {string[]} existing
     * @returns {string|null}
     */
    validateCategory,

    /**
     * Validates all three transaction fields and returns a composite result.
     * Note: for the category field in the transaction form, we only check that
     * a value is selected (non-empty), not for duplicates — those are caught
     * by validateCategory in the custom-category flow.
     *
     * @param {string} itemName  — value from #item-name
     * @param {string|number} amount    — value from #amount
     * @param {string} category — value from #category-select
     * @returns {{ isValid: boolean, errors: { itemName?: string, amount?: string, category?: string } }}
     */
    validateTransaction: function (itemName, amount, category) {
      var errors = {};

      var nameError = validateItemName(itemName);
      if (nameError !== null) {
        errors.itemName = nameError;
      }

      var amountError = validateAmount(amount);
      if (amountError !== null) {
        errors.amount = amountError;
      }

      // In the transaction form context, only check that a category is selected.
      if (typeof category !== 'string' || category.trim().length === 0) {
        errors.category = 'Please select a category.';
      }

      return {
        isValid: Object.keys(errors).length === 0,
        errors: errors,
      };
    },

    /**
     * Canonicalizes a raw sort order string.
     * Alias of the standalone parseSortOrder function.
     * @param {*} raw
     * @returns {'amount-asc'|'amount-desc'|'category-asc'}
     */
    parseSortOrder,
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // § 4. UTILITY FUNCTIONS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Pure function — returns the arithmetic sum of all transaction amounts,
   * rounded to exactly 2 decimal places. Returns 0 for an empty array.
   * Uses Math.round(sum * 100) / 100 to avoid floating-point drift (Req 4.1, 4.3).
   *
   * @param {Array<{amount: number}>} transactions
   * @returns {number}
   */
  function computeBalance(transactions) {
    if (!transactions || transactions.length === 0) return 0;
    var sum = transactions.reduce(function (acc, t) {
      return acc + t.amount;
    }, 0);
    return Math.round(sum * 100) / 100;
  }

  /**
   * Pure function — formats a numeric balance as a sign-aware string with
   * exactly 2 decimal places (Req 4.4, 4.5).
   *   - Positive values and zero: no sign prefix  e.g. "42.00", "0.00"
   *   - Negative values: prefixed with "-"         e.g. "-12.50"
   *
   * @param {number} value
   * @returns {string}
   */
  function formatBalance(value) {
    var abs = Math.abs(value).toFixed(2);
    return value < 0 ? '-' + abs : abs;
  }

  /**
   * Pure function — returns a new sorted copy of `transactions` according to
   * `order`. Never mutates the input array (Req 7.2, 7.3, 7.5).
   *
   * Sort orders:
   *   'amount-asc'    — amount ascending;  tiebreaker: date ascending
   *   'amount-desc'   — amount descending; tiebreaker: date ascending
   *   'category-asc'  — category alphabetical (localeCompare); tiebreaker: date ascending
   *
   * Any unrecognized order falls back to 'amount-asc' behaviour.
   *
   * @param {Array<{amount: number, category: string, date: string}>} transactions
   * @param {'amount-asc'|'amount-desc'|'category-asc'} order
   * @returns {Array<Object>}
   */
  function sortTransactions(transactions, order) {
    var copy = transactions.slice();

    copy.sort(function (a, b) {
      var primary;

      if (order === 'amount-desc') {
        primary = b.amount - a.amount;
      } else if (order === 'category-asc') {
        primary = a.category.localeCompare(b.category);
      } else {
        // 'amount-asc' and any unrecognized value
        primary = a.amount - b.amount;
      }

      if (primary !== 0) return primary;

      // Tiebreaker: date ascending (ISO 8601 strings compare lexicographically)
      if (a.date < b.date) return -1;
      if (a.date > b.date) return 1;
      return 0;
    });

    return copy;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // § 5. CHARTMANAGER MODULE
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Returns a session-stable CSS color string for the given category label.
   * On the first call for a label within this session, picks the next unused
   * color from COLOR_PALETTE (cycling via modulo when the palette is exhausted)
   * and caches it in categoryColorMap. Returns the cached color on all
   * subsequent calls for the same label.
   *
   * Color assignments are never persisted to localStorage — they reset on
   * every page load (Req 5.4).
   *
   * @param {string} label  — category label string
   * @returns {string}      — CSS color string
   */
  function assignCategoryColor(label) {
    if (categoryColorMap.has(label)) {
      return categoryColorMap.get(label);
    }
    var index = categoryColorMap.size % COLOR_PALETTE.length;
    var color = COLOR_PALETTE[index];
    categoryColorMap.set(label, color);
    return color;
  }

  /**
   * Pure function — groups transactions by category, sums amounts per group
   * (rounded to 2 decimal places), and maps each category label to a color
   * via assignCategoryColor.
   *
   * Returns a ChartData object where labels, data, and colors are all the
   * same length and indexed consistently (Req 5.1, 5.2).
   *
   * @param {Array<{category: string, amount: number}>} transactions
   * @returns {{ labels: string[], data: number[], colors: string[] }}
   */
  function computeChartData(transactions) {
    /** @type {Map<string, number>} */
    var totals = new Map();

    transactions.forEach(function (t) {
      var current = totals.has(t.category) ? totals.get(t.category) : 0;
      totals.set(t.category, current + t.amount);
    });

    var labels = [];
    var data   = [];
    var colors = [];

    totals.forEach(function (sum, label) {
      labels.push(label);
      data.push(Math.round(sum * 100) / 100);
      colors.push(assignCategoryColor(label));
    });

    return { labels: labels, data: data, colors: colors };
  }

  /** @type {Chart|null} */
  var chartInstance = null;

  const ChartManager = {
    /**
     * Creates and stores the Chart.js pie chart instance.
     *
     * Checks the module-level `chartUnavailable` flag first (set by the
     * <script onerror> handler in index.html), then guards with
     * `typeof Chart === 'function'` as a safety fallback. If either condition
     * indicates Chart.js is absent, calls Renderer.showError and returns
     * without creating an instance (Req 11.4).
     *
     * @param {string} canvasId  — id of the <canvas> element
     */
    init: function (canvasId) {
      if (chartUnavailable || typeof Chart !== 'function') {
        Renderer.showError(CDN_ERROR_MSG);
        return;
      }

      var canvas = document.getElementById(canvasId);
      if (!canvas) {
        Renderer.showError('Chart canvas element not found.');
        return;
      }

      chartInstance = new Chart(canvas, {
        type: 'pie',
        data: {
          labels: [],
          datasets: [{
            data: [],
            backgroundColor: [],
          }],
        },
        options: {
          responsive: true,
          plugins: {
            legend: {
              position: 'bottom',
            },
          },
        },
      });
    },

    /**
     * Updates the pie chart to reflect the current transaction list.
     *
     * If transactions is empty, delegates to showEmptyState().
     * Otherwise hides the empty-state placeholder, computes chart data via
     * computeChartData, and pushes the new data into the existing chart
     * instance using chart.data = ...; chart.update() to avoid flickering
     * and canvas context leaks (Req 5.1, 5.2).
     *
     * @param {Array<{category: string, amount: number}>} transactions
     */
    update: function (transactions) {
      if (!transactions || transactions.length === 0) {
        ChartManager.showEmptyState();
        return;
      }

      ChartManager.hideEmptyState();

      if (!chartInstance) return;

      var chartData = computeChartData(transactions);
      chartInstance.data.labels = chartData.labels;
      chartInstance.data.datasets[0].data = chartData.data;
      chartInstance.data.datasets[0].backgroundColor = chartData.colors;
      chartInstance.update();
    },

    /**
     * Hides the <canvas> element and shows the "No spending data" placeholder.
     * Called when there are no transactions to display (Req 5.3).
     */
    showEmptyState: function () {
      var canvas = document.getElementById('spending-chart');
      var placeholder = document.getElementById('chart-placeholder');
      if (canvas)      canvas.style.display = 'none';
      if (placeholder) placeholder.style.display = '';
    },

    /**
     * Shows the <canvas> element and hides the "No spending data" placeholder.
     * Called when there is at least one transaction to display.
     */
    hideEmptyState: function () {
      var canvas = document.getElementById('spending-chart');
      var placeholder = document.getElementById('chart-placeholder');
      if (canvas)      canvas.style.display = 'block';
      if (placeholder) placeholder.style.display = 'none';
    },

    // Expose pure helpers for testing
    assignCategoryColor,
    computeChartData,
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // § 6. RENDERER MODULE
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Field ID map used by showFormErrors / clearFormErrors.
   * Maps ValidationResult error keys → DOM element IDs.
   */
  var FIELD_ID_MAP = {
    itemName: 'item-name',
    amount:   'amount',
    category: 'category-select',
  };

  const Renderer = {

    // ── Task 8.1 ────────────────────────────────────────────────────────────

    /**
     * Recalculates and displays the total balance (Req 4.1, 4.2).
     * Uses computeBalance → formatBalance and writes to #total-balance.
     *
     * @param {Array<{amount: number}>} transactions
     */
    renderBalance: function (transactions) {
      var value = computeBalance(transactions);
      var text  = formatBalance(value);
      document.getElementById('total-balance').textContent = text;
    },

    /**
     * Clears and repopulates the #category-select dropdown (Req 8.2).
     * Always starts with a blank placeholder option, then one <option> per
     * category in the supplied array (built-ins first, then custom).
     *
     * @param {string[]} categories
     */
    renderCategorySelector: function (categories) {
      var select = document.getElementById('category-select');
      // Clear all existing options
      select.innerHTML = '';

      // Blank placeholder
      var placeholder = document.createElement('option');
      placeholder.value       = '';
      placeholder.textContent = 'Select a category';
      select.appendChild(placeholder);

      // One option per category
      categories.forEach(function (cat) {
        var opt = document.createElement('option');
        opt.value       = cat;
        opt.textContent = cat;
        select.appendChild(opt);
      });
    },

    /**
     * Reflects the current sort order in the #sort-select control (Req 7.1).
     *
     * @param {'amount-asc'|'amount-desc'|'category-asc'} sortOrder
     */
    renderSortControl: function (sortOrder) {
      document.getElementById('sort-select').value = sortOrder;
    },

    /**
     * Applies the given color theme to the document and updates the toggle
     * button label/aria-pressed to reflect the CURRENT state (Req 9.2).
     *
     * Convention for the button label:
     *   - When theme is 'light' → button shows "🌙 Dark Mode"  (next action = switch to dark)
     *   - When theme is 'dark'  → button shows "☀️ Light Mode" (next action = switch to light)
     *
     * aria-pressed reflects whether Dark Mode is currently ON (i.e. true when 'dark').
     *
     * @param {'light'|'dark'} theme
     */
    applyTheme: function (theme) {
      document.documentElement.setAttribute('data-theme', theme);

      var btn = document.getElementById('theme-toggle');
      if (btn) {
        if (theme === 'dark') {
          btn.textContent          = '☀️ Light Mode';
          btn.setAttribute('aria-pressed', 'true');
        } else {
          btn.textContent          = '🌙 Dark Mode';
          btn.setAttribute('aria-pressed', 'false');
        }
      }
    },

    // ── Task 8.2 ────────────────────────────────────────────────────────────

    /**
     * Sorts `transactions` by `sortOrder` (via sortTransactions) and renders
     * them into #transaction-list (Req 2.1–2.5, 3.1).
     *
     * Each <li> contains:
     *   - .transaction-info > .transaction-name + .transaction-meta
     *     (.transaction-category badge + .transaction-date)
     *   - .transaction-amount
     *   - <button class="delete-btn" data-id="…">
     *
     * When the array is empty, a single empty-state <li> is rendered.
     *
     * @param {Array<{id:string, itemName:string, amount:number, category:string, date:string}>} transactions
     * @param {'amount-asc'|'amount-desc'|'category-asc'} sortOrder
     */
    renderTransactionList: function (transactions, sortOrder) {
      var list = document.getElementById('transaction-list');

      if (!transactions || transactions.length === 0) {
        list.innerHTML = '<li class="empty-state">No transactions recorded yet.</li>';
        return;
      }

      var sorted = sortTransactions(transactions, sortOrder);

      var html = sorted.map(function (t) {
        // Format date to a human-readable locale string
        var dateStr = '';
        try {
          dateStr = new Date(t.date).toLocaleDateString();
        } catch (_) {
          dateStr = t.date;
        }

        // Escape user-supplied strings to prevent XSS in innerHTML
        var safeName     = Renderer._escapeHtml(t.itemName);
        var safeCategory = Renderer._escapeHtml(t.category);
        var safeId       = Renderer._escapeHtml(t.id);

        return (
          '<li class="transaction-item">' +
            '<div class="transaction-info">' +
              '<span class="transaction-name">' + safeName + '</span>' +
              '<span class="transaction-meta">' +
                '<span class="transaction-category">' + safeCategory + '</span>' +
                '<span class="transaction-date">'     + dateStr      + '</span>' +
              '</span>' +
            '</div>' +
            '<span class="transaction-amount">' + formatBalance(t.amount) + '</span>' +
            '<button class="delete-btn" data-id="' + safeId + '" ' +
              'aria-label="Delete ' + safeName + '">&#x2715;</button>' +
          '</li>'
        );
      }).join('');

      list.innerHTML = html;
    },

    // ── Task 8.4 ────────────────────────────────────────────────────────────

    /**
     * Inserts inline error <span> elements next to the relevant form fields
     * and sets aria-describedby on each failing input (Req 1.3, 1.4, 8.3).
     *
     * Calls clearFormErrors() first to remove any stale errors from a prior
     * submission attempt.
     *
     * @param {{ itemName?: string, amount?: string, category?: string }} errors
     */
    showFormErrors: function (errors) {
      this.clearFormErrors();

      Object.keys(errors).forEach(function (field) {
        var inputId = FIELD_ID_MAP[field];
        if (!inputId) return;

        var input = document.getElementById(inputId);
        if (!input) return;

        var spanId  = 'err-' + field;
        var span    = document.createElement('span');
        span.id          = spanId;
        span.className   = 'field-error';
        span.textContent = errors[field];

        // Insert the error span immediately after the input/select
        input.parentNode.insertBefore(span, input.nextSibling);

        // Link input to error message for screen readers
        input.setAttribute('aria-describedby', spanId);
      });
    },

    /**
     * Removes all .field-error elements and clears aria-describedby on the
     * three transaction-form fields (Req 1.3, 1.4).
     */
    clearFormErrors: function () {
      // Remove every error span
      var errorSpans = document.querySelectorAll('.field-error');
      errorSpans.forEach(function (el) {
        el.parentNode.removeChild(el);
      });

      // Clear aria-describedby on each tracked field
      Object.keys(FIELD_ID_MAP).forEach(function (field) {
        var input = document.getElementById(FIELD_ID_MAP[field]);
        if (input) {
          input.removeAttribute('aria-describedby');
        }
      });
    },

    /**
     * Shows a non-blocking warning banner at the top of <body> that
     * auto-dismisses after `durationMs` milliseconds (default 5000).
     * Minimum 5000ms for LocalStorage-related warnings (Req 6.3, 6.4, 8.5).
     *
     * @param {string} message
     * @param {number} [durationMs=5000]
     */
    showWarning: function (message, durationMs) {
      var duration = (typeof durationMs === 'number' && durationMs > 0)
        ? durationMs
        : 5000;

      var div = document.createElement('div');
      div.setAttribute('role', 'status');
      div.className   = 'warning-banner';
      div.textContent = message;

      // Insert as the first child of <body> so it is immediately visible
      document.body.insertBefore(div, document.body.firstChild);

      setTimeout(function () {
        if (div.parentNode) {
          div.parentNode.removeChild(div);
        }
      }, duration);
    },

    /**
     * Shows a persistent error banner at the top of <body> (Req 3.5, 11.4).
     * Deduplicates by message text — does NOT insert a second banner if an
     * identical message is already displayed (checked via data-error-msg).
     *
     * @param {string} message
     */
    showError: function (message) {
      // Deduplication: skip if a banner with the same message already exists
      var existing = document.querySelector('.error-banner[data-error-msg]');
      if (existing) {
        var existingMsg = existing.getAttribute('data-error-msg');
        if (existingMsg === message) return;
      }

      var div = document.createElement('div');
      div.setAttribute('role', 'alert');
      div.className = 'error-banner';
      div.setAttribute('data-error-msg', message);
      div.textContent = message;

      // Insert as the first child of <body> so it is immediately visible
      document.body.insertBefore(div, document.body.firstChild);
    },

    // ── Internal helpers ────────────────────────────────────────────────────

    /**
     * Escapes HTML special characters in a string to prevent XSS when
     * inserting user-supplied data via innerHTML.
     *
     * @param {string} str
     * @returns {string}
     */
    _escapeHtml: function (str) {
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    },
  };

  // Re-wire window.__rendererShowError now that Renderer exists in scope.
  // Any deferred CDN error queued before this point will fire on next call.
  window.__rendererShowError = function (msg) {
    chartUnavailable = true;
    if (typeof Renderer.showError === 'function') {
      Renderer.showError(msg);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // § 7. EVENTHANDLERS MODULE
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Handles #expense-form submit event.
   * Validates fields, creates a Transaction on success, persists and re-renders.
   * Requirements: 1.2, 1.3, 1.4, 1.5
   *
   * @param {Event} event
   */
  function onFormSubmit(event) {
    event.preventDefault();

    var itemName = document.getElementById('item-name').value;
    var amount   = document.getElementById('amount').value;
    var category = document.getElementById('category-select').value;

    var result = Validator.validateTransaction(itemName, amount, category);

    if (!result.isValid) {
      Renderer.showFormErrors(result.errors);
      return;
    }

    Renderer.clearFormErrors();

    var transaction = {
      id:       crypto.randomUUID(),
      itemName: itemName.trim(),
      amount:   parseFloat(amount),
      category: category,
      date:     new Date().toISOString(),
    };

    try {
      // Push to state first so we can pass the full list to Storage
      state.transactions.push(transaction);
      Storage.saveTransactions(state.transactions);
    } catch (err) {
      // Roll back the optimistic push if save failed
      state.transactions.pop();
      Renderer.showError('Could not save the transaction. Please try again.');
      return;
    }

    Renderer.renderBalance(state.transactions);
    Renderer.renderTransactionList(state.transactions, state.sortOrder);
    ChartManager.update(state.transactions, state.categories);

    // Reset form and return focus to item name field (Req 1.5)
    event.target.reset();
    setTimeout(function () {
      document.getElementById('item-name').focus();
    }, 0);
  }

  /**
   * Handles delegated click events on #transaction-list for .delete-btn elements.
   * Follows delete-before-update pattern: saves to localStorage FIRST, then
   * updates in-memory state only on success (Req 3.5).
   * Requirements: 3.2, 3.3, 3.4, 3.5
   *
   * @param {Event} event
   */
  function onDeleteClick(event) {
    if (!event.target.classList.contains('delete-btn')) return;

    var id = event.target.getAttribute('data-id');
    if (!id) return;

    var filteredList = state.transactions.filter(function (t) {
      return t.id !== id;
    });

    // CRITICAL: save to localStorage FIRST — if it throws, do NOT update state
    try {
      Storage.saveTransactions(filteredList);
    } catch (e) {
      Renderer.showError('Could not delete transaction: ' + e.message);
      return;
    }

    // Save succeeded — now update in-memory state
    state.transactions = filteredList;

    Renderer.renderBalance(state.transactions);
    Renderer.renderTransactionList(state.transactions, state.sortOrder);
    ChartManager.update(state.transactions, state.categories);
  }

  /**
   * Handles #sort-select change event.
   * Canonicalizes the value, persists, and re-renders the transaction list.
   * Requirements: 7.2, 7.4
   *
   * @param {Event} event
   */
  function onSortChange(event) {
    state.sortOrder = parseSortOrder(event.target.value);

    try {
      Storage.saveSortOrder(state.sortOrder);
    } catch (_) {
      // Non-critical — sort still applied in-memory
    }

    Renderer.renderTransactionList(state.transactions, state.sortOrder);
  }

  /**
   * Handles #add-category-btn click event.
   * Validates the custom category name, persists, and updates the category
   * selector on success. Shows an inline error on validation failure.
   * Requirements: 8.2, 8.3
   */
  function onAddCategory() {
    var input = document.getElementById('custom-category-input');
    var name  = input.value;

    // Remove any existing custom-category error span
    var existing = document.getElementById('err-custom-category');
    if (existing) {
      existing.parentNode.removeChild(existing);
    }
    input.removeAttribute('aria-describedby');

    var error = validateCategory(name, state.categories);

    if (error !== null) {
      // Insert inline error span after the input (special case — not in FIELD_ID_MAP)
      var span    = document.createElement('span');
      span.id          = 'err-custom-category';
      span.className   = 'field-error';
      span.textContent = error;
      input.parentNode.insertBefore(span, input.nextSibling);
      input.setAttribute('aria-describedby', 'err-custom-category');
      return;
    }

    var trimmedName = name.trim();
    state.categories.push(trimmedName);

    // Persist only the custom categories (everything after the 3 built-ins)
    try {
      Storage.saveCategories(state.categories.slice(3));
    } catch (_) {
      Renderer.showWarning('Could not save the custom category.', 5000);
    }

    Renderer.renderCategorySelector(state.categories);
    input.value = '';
  }

  /**
   * Handles #theme-toggle click event.
   * CRITICAL ORDER: saveTheme is called before applyTheme (Req 9.7).
   * Requirements: 9.1, 9.2, 9.7
   */
  function onThemeToggle() {
    state.theme = state.theme === 'light' ? 'dark' : 'light';

    // Persist FIRST, then apply visually (Req 9.7)
    Storage.saveTheme(state.theme);
    Renderer.applyTheme(state.theme);
  }

  const EventHandlers = {
    onFormSubmit,
    onDeleteClick,
    onSortChange,
    onAddCategory,
    onThemeToggle,
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // § 8. INITIALIZATION
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Bootstraps the application:
   *   1. Apply persisted theme immediately (prevent FOUC)          — Req 9.3
   *   2. Load and validate transactions from localStorage           — Req 6.2, 6.3, 6.4
   *   3. Load custom categories from localStorage                   — Req 8.4, 8.5
   *   4. Load sort order from localStorage                          — Req 7.4, 7.6
   *   5. Render the initial UI                                      — Req 2.1, 4.1, 7.1, 8.2
   *   6. Initialise the chart                                       — Req 5.1, 11.4
   *   7. Wire all event handlers                                    — Req 1.2, 3.2, 7.2, 8.2, 9.1
   */
  function init() {

    // ── Step 1: Theme (must be FIRST to prevent flash of unstyled content) ──
    state.theme = resolveTheme(Storage.loadTheme());
    Renderer.applyTheme(state.theme);

    // ── Step 2: Transactions ─────────────────────────────────────────────────
    try {
      var rawJson = null;
      try { rawJson = localStorage.getItem(LS_KEY_TRANSACTIONS); } catch(_) {}
      state.transactions = Storage.loadTransactions();
      // Check if any entries were discarded (invalid)
      if (rawJson) {
        try {
          var allParsed = JSON.parse(rawJson);
          if (Array.isArray(allParsed) && allParsed.length > state.transactions.length) {
            Renderer.showWarning('Some saved transactions could not be restored.', 5000);
          }
        } catch(_) {}
      }
    } catch (e) {
      state.transactions = [];
      Renderer.showWarning('Could not load saved transactions. Starting fresh.', 5000);
    }

    // ── Step 3: Custom categories ────────────────────────────────────────────
    try {
      var custom = Storage.loadCategories();
      state.categories = ['Food', 'Transport', 'Fun'].concat(custom);
    } catch (e) {
      // loadCategories() itself swallows errors and returns []; this catch is
      // a belt-and-suspenders guard for unexpected throws.
      state.categories = ['Food', 'Transport', 'Fun'];
      Renderer.showError('Custom categories could not be loaded.');
    }

    // ── Step 4: Sort order ───────────────────────────────────────────────────
    state.sortOrder = parseSortOrder(Storage.loadSortOrder());

    // ── Step 5: Render initial UI ────────────────────────────────────────────
    Renderer.renderBalance(state.transactions);
    Renderer.renderCategorySelector(state.categories);
    Renderer.renderSortControl(state.sortOrder);
    Renderer.renderTransactionList(state.transactions, state.sortOrder);

    // ── Step 6: Initialise chart ─────────────────────────────────────────────
    ChartManager.init('spending-chart');
    ChartManager.update(state.transactions, state.categories);

    // ── Step 7: Wire event handlers ──────────────────────────────────────────
    document.getElementById('expense-form')
      .addEventListener('submit', EventHandlers.onFormSubmit);

    document.getElementById('transaction-list')
      .addEventListener('click', EventHandlers.onDeleteClick);

    document.getElementById('sort-select')
      .addEventListener('change', EventHandlers.onSortChange);

    document.getElementById('add-category-btn')
      .addEventListener('click', EventHandlers.onAddCategory);

    document.getElementById('theme-toggle')
      .addEventListener('click', EventHandlers.onThemeToggle);
  }

  init();

}());
