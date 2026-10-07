# PORTING INVENTORY — `expense-tracker-client` (React 19 + Vite) → Angular 21

Source project: `C:\Users\kisho\Desktop\expense-tracker\expense-tracker-client`
Target project: `C:\Users\kisho\Desktop\expense-tracker\expense-tracker-angular`

Every file in the source project was read (excluding `node_modules`, `dist`, `.git`).
The paired Express server (`expense-tracker-server`) was also read, so that API contracts and
response shapes are documented with certainty rather than inferred.

Source file list (16 files, all read):

```
.env
.env.production
.gitignore
.oxlintrc.json
index.html
package.json
README.md
vite.config.js
public/favicon.svg
src/App.css              (2906 lines)
src/App.jsx              (70)
src/index.css            (248)
src/main.jsx             (10)
src/components/Avatar.jsx        (37)
src/components/Charts.jsx        (376)
src/components/ExpenseForm.jsx   (243)
src/components/ExpenseList.jsx   (149)
src/components/ExpenseModal.jsx  (80)
src/components/Navbar.jsx        (277)
src/components/TimeFilter.jsx    (120)
src/context/AuthContext.jsx      (85)
src/context/PreferencesContext.jsx (83)
src/context/ThemeContext.jsx     (50)
src/pages/Dashboard.jsx    (362)
src/pages/Import.jsx       (363)
src/pages/Login.jsx        (85)
src/pages/Profile.jsx      (483)
src/pages/Register.jsx     (129)
src/utils/api.js           (34)
src/utils/expenseIcons.js  (20)
```

---

## 1. Stack + dependencies and the Angular 21 equivalent

### 1.1 Detected source stack

| Concern | Source implementation |
| --- | --- |
| Framework | React 19.2.8 + ReactDOM 19.2.8, plain `.jsx` (no TypeScript) |
| Build tool | Vite 8.2.2 + `@vitejs/plugin-react` 6.1.0 (Oxc transform) |
| Router | `react-router-dom` 7.18.3 — `BrowserRouter`, `Routes`, `Route`, `Navigate`, `Link`, `NavLink`, `useNavigate` |
| State management | None. Three React Contexts (`AuthContext`, `ThemeContext`, `PreferencesContext`) holding `useState` |
| HTTP client | `axios` 1.20.0 — `axios.create({ baseURL })`, request + response interceptors |
| Charts | `recharts` 3.10.1 |
| Forms | None. Plain `useState` + manual `handleSubmit`; native `required`, `minLength`, `maxLength`, `type` |
| Validation | Hand-written inline checks in submit handlers; `noValidate` on the expense form |
| CSS approach | Plain global CSS, two files (`index.css` tokens/keyframes, `App.css` components). No CSS modules, no preprocessor, no utility framework, no UI kit |
| Date library | None. Native `Date`, `Date.toISOString()`, `toLocaleDateString('en-IN', …)` |
| Intl | Native `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })` |
| Icon system | Emoji glyphs (`🍽️ 💸 💳 …`) + a handful of hand-written inline SVGs |
| State persistence | `localStorage` keys `token`, `user`, `expense-tracker-theme` |
| Env/config | Vite env files (`.env`, `.env.production`) + `import.meta.env.*`; `base` and dev proxy in `vite.config.js` |
| Lint | `oxlint` 1.79.0 with `react/rules-of-hooks` (error) and `react/only-export-components` (warn) |
| Tests | **None.** No test runner, no test files, no test script in `package.json` |

### 1.2 `package.json` dependency mapping

Source dependencies (exact versions from `package.json`):

```json
"dependencies": {
  "axios": "^1.20.0",
  "react": "^19.2.8",
  "react-dom": "^19.2.8",
  "react-router-dom": "^7.18.3",
  "recharts": "^3.10.1"
},
"devDependencies": {
  "@types/react": "^19.2.18",
  "@types/react-dom": "^19.2.4",
  "@vitejs/plugin-react": "^6.1.0",
  "oxlint": "^1.79.0",
  "vite": "^8.2.2"
}
```

| Source package | Angular 21 replacement | Rationale / decision |
| --- | --- | --- |
| `react` + `react-dom` | `@angular/core`, `@angular/common`, `@angular/platform-browser`, `@angular/forms`, `@angular/router` | Angular standalone components + signals replace React function components |
| — | `@angular/cdk` + `@angular/material` 21.2.14 | Chosen as the Angular UI layer, but **not** used for visual chrome. Every visible widget (buttons, chips, pills, dropdowns, modal) is hand-styled with the original CSS so the look is pixel-parity. Material/CDK is used only where behaviour without look is needed (focus trap, a11y overlay utilities) |
| `react-router-dom` | `@angular/router` (`provideRouter`, `withComponentInputBinding`, `RedirectCommand`, `UrlTree`) | Same declarative route table, functional guards |
| `axios` | `@angular/common/http` (`HttpClient`, `provideHttpClient(withInterceptors([...]))`, `HttpInterceptorFn`) | Functional interceptors map 1:1 to the two axios interceptors |
| `recharts` | `chart.js` 4.5.1 + `ng2-charts` 10.x (`BaseChartDirective`) | Closest Angular equivalent: doughnut/pie, horizontal bar and area/line charts, custom tooltips, per-dataset/point colours, click events, responsive resize. `ng2-charts@10` declares `peerDependencies: @angular/core >=21.0.0`, so it is the version line that matches Angular 21 (v11 requires Angular ≥22) |
| `oxlint` | ESLint 9 flat config + `angular-eslint` + `typescript-eslint` (+ `eslint-plugin-prettier` optional) | Angular's canonical lint stack |
| `vite` | `@angular/build:application` (esbuild) | Angular CLI default builder |
| `@vitejs/plugin-react` | — | No analogue; the CLI compiles templates natively |
| `@types/react`, `@types/react-dom` | — | Angular templates are type-checked by the compiler; `tsconfig` has `strict: true` + `strictTemplates` |
| — (new) | `typescript` ~5.9, `vitest` (Angular 21 default `ng test` runner), `jsdom` | Source has no TS and no tests; TS strict is required by the brief, and tests must be written from scratch |
| — (new) | `@angular/compiler-cli` | AOT + template type checking |

Deliberately **not** introduced: Tailwind, PrimeNG, NgRx, Signal Forms, any date library,
any icon package. Rationale in §1.3.

### 1.3 Explicit library decisions (asked-for vs. parity-preserving)

* **UI library.** The original has *zero* UI-library widgets — every button, chip, pill, tab,
  dropdown, modal, table, checkbox and skeleton is raw markup plus `App.css`. Introducing
  Material/PrimeNG theme styling would *break* pixel parity. So: `@angular/material` + CDK are
  installed, but the visual layer is a faithful hand-written CSS port. Angular CDK is used for
  behaviour-only helpers (`FocusTrap`, `CdkTrapFocus`) inside the modal and drawer.
* **Forms.** The brief says to use Reactive Forms unless Signal Forms are clearly stable in the
  installed version. Signal Forms are **experimental/developer-preview in Angular v21**
  (introduced in v21, still not stable). Therefore **Reactive Forms** everywhere, with a custom
  `ExpenseFormErrorComponent`-style inline `alert` replicating the original's single error
  banner rather than per-field messages.
* **CSS variables.** `:root`/body-level CSS custom properties carry the theme. In Angular,
  component styles are emulated-scoped, so all design tokens and the full component CSS live in
  **global** stylesheets (`src/styles/*.css`) exactly as in Vite, and components reference only
  class names. This guarantees identical cascade, specificity and pseudo-selector behaviour
  (`:nth-child`, `[data-theme='dark']`, `::selection`, `::-webkit-scrollbar`, media queries).
* **Zoneless.** Zoneless change detection is the v21 default; `zone.js` is removed entirely.
  All state is signals, all components are `OnPush`.

---

## 2. Routes, guards, redirects, 404

Route table lives in `src/App.jsx` inside `<BrowserRouter basename={routerBasename}>`.
There is **no** nested/child routing, no route params, no query params anywhere in the source.

| Path | Element | Guard | Notes |
| --- | --- | --- | --- |
| `/login` | `<Login />` | none | Public. Reachable while logged in (no redirect away) |
| `/register` | `<Register />` | none | Public. Reachable while logged in |
| `/` | `<ProtectedRoute><Dashboard /></ProtectedRoute>` | `ProtectedRoute` | `end`-matched by nav link |
| `/profile` | `<ProtectedRoute><Profile /></ProtectedRoute>` | `ProtectedRoute` | Also the target of `/profile#settings` hash links |
| `/import` | `<ProtectedRoute><Import /></ProtectedRoute>` | `ProtectedRoute` | |
| `*` | `<Navigate to="/" replace />` | none | Catch-all 404 → redirect to `/` with `replace` |

Guard implementation (`src/App.jsx:13-16`):

```jsx
const ProtectedRoute = ({ children }) => {
  const { user } = useAuth()
  return user ? children : <Navigate to="/login" replace />
}
```

* Redirect is **`replace`**, so no history entry is left behind.
* Guard reads only the in-memory `user` signal; there is no "auth pending" state, so a route
  renders the moment `user` flips to non-null.
* `basename` derivation (`src/App.jsx:19-20`):
  `base = import.meta.env.VITE_BASE || '/'`; `routerBasename = base === '/' ? '/' : base.replace(/\/+$/, '')`.

Layout structure (all routes share it):

```
<ThemeProvider>
  <AuthProvider>
    <PreferencesProvider>
      <BrowserRouter>
        <Navbar />                 // outside <main>, always rendered
        <main className="app-main">
          <Routes> …               // the route table above
```

`<Navbar />` is rendered *above* the router outlet and therefore visible on every screen
including login/register. `<main class="app-main">` is the only page container.

---

## 3. Components — props, local state, effects, refs, conditionals, memoization

### 3.1 `src/components/Avatar.jsx` → `shared/avatar/avatar.ts`

Props: `{ name = '', photo = null, size = 40, className = '' }`.

* **Initials**: `name?.split(' ').filter(Boolean).map(p => p[0]).slice(0,2).join('').toUpperCase() || '?'`
* **Seed/hue**: `seed = (name || 'user').split('').reduce((a,c) => a + c.charCodeAt(0), 0)`;
  `hue = seed % 360`; `hue2 = (hue + 45) % 360`
* **SVG**: 100×100 viewBox, `linearGradient id='g'` `hsl(hue,72%,52%) → hsl(hue2,72%,40%)`,
  `<rect rx='50'>`, `<text>` at `x=50 y=54`, `font-family='Arial, Helvetica, sans-serif'`,
  `font-size=44`, `font-weight=700`, `fill='rgba(255,255,255,0.96)'`, `dominant-baseline='middle'`
* `src = photo || 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)`
* Output `<img>`: `alt={name || 'avatar'}`, `class="avatar-img {className}"`,
  `style={{ width: size, height: size }}`
* No state, no effects, no refs. Used at sizes 34 (nav button), 42 (dropdown header), 44 (drawer), 84 (profile).

### 3.2 `src/components/Navbar.jsx` → `layout/navbar/navbar.ts`

Props: **none**. Consumers: `useAuth()` → `{ user, logout }`, `useTheme()` → `{ theme, setTheme }`,
`useNavigate()`.

Local state:
| State | Default | Purpose |
| --- | --- | --- |
| `themeMenuOpen` | `false` | Theme dropdown visibility |
| `userMenuOpen` | `false` | Account dropdown visibility |
| `drawerOpen` | `false` | Mobile drawer visibility |

Refs: `themeMenuRef`, `userMenuRef` (used for outside-click detection).

Constant: `THEMES = [{value:'system',icon:'🖥️',label:'System'}, {value:'light',icon:'☀️',label:'Light'}, {value:'dark',icon:'🌙',label:'Dark'}]`

`currentTheme = THEMES.find(t => t.value === theme) || THEMES[0]`

Helpers:
* `closeAll()` — closes theme menu, user menu and drawer
* `handleLogout()` — `closeAll()` → `logout()` → `navigate('/login')`
* `navLinkClass({isActive})` → `navbar-nav-link` + `' active'` when `isActive && user`
  (i.e. links are never highlighted when logged out)
* `drawerItemClass({isActive})` → `drawer-item` + `' active'` under the same condition

Effects:
1. `document.addEventListener('mousedown', close)` — closes each menu when the click target is
   outside the corresponding ref. Cleanup removes the listener. `[]` deps.
2. `document.addEventListener('keydown', onKey)` — `Escape` → `closeAll()`. `[]` deps.
3. `document.body.style.overflow = drawerOpen ? 'hidden' : ''`, cleanup restores `''`. `[drawerOpen]`.

Conditional rendering:
* `.navbar-links` block only when `user` — three `NavLink`s: `/` (end) `📊 Dashboard`, `/import` `📄 Import`, `/profile` `👤 Profile`
* Theme picker is **always** rendered (logged in or out). Toggle button
  `aria-label="Change theme"`, `aria-haspopup="menu"`, `aria-expanded={themeMenuOpen}`.
  Toggling it forces `setUserMenuOpen(false)`. Dropdown `role="menu"`, items `role="menuitemradio"`,
  `aria-checked`, with `theme-check` `✓` on the active option.
* When `user`: `.user-menu` with `.user-menu-btn` (`aria-label="Account menu"`, `aria-haspopup="menu"`,
  `aria-expanded`) containing `Avatar(34)`, `.user-menu-name` = `user.name`, `.user-menu-chevron` = `▾`
  (gets `.up` class → `rotate(180deg)` when open). Dropdown `role="menu"`:
  header (`Avatar(42)`, `strong` name, `span` email), `Link /profile` `👤 My Profile`,
  `Link /profile#settings` `⚙️ Settings`, `.dropdown-divider`,
  `button.dropdown-item.danger` `🚪 Logout`.
* When **not** `user`: `Link /login` `class="btn btn-ghost btn-sm"` "Login" and
  `Link /register` `class="btn btn-primary btn-sm"` "Sign Up".
* Hamburger `button` is always rendered; `aria-label="Open menu"`, `aria-expanded={drawerOpen}`;
  three `<span>` bars transform into an X when `.active`.
* `.mobile-drawer` is always in the DOM (`aria-hidden={!drawerOpen}`), with
  `.drawer-backdrop` (click → `setDrawerOpen(false)`) and `aside.drawer-panel` containing:
  header (`Avatar(name ?? 'E', 44)`, name+email or `<strong>Menu</strong>`, `.drawer-close` `×`),
  `.drawer-nav` (logged in: Dashboard/Import/Profile; logged out: `🔑 Login` / `✨ Sign Up`),
  then **only when `user`**: `.drawer-section-title` "Settings" + `⚙️ Settings` link,
  `.drawer-section-title` "Theme" + `.drawer-theme` grid of 3 `.drawer-theme-option` buttons
  (icon + label, `.active` when selected), and `.drawer-footer` with
  `button.btn.btn-danger.btn-block` `🚪 Logout`.
* All drawer links call `closeAll()` on click; brand `Link to="/"` sets `drawerOpen=false`.

### 3.3 `src/components/TimeFilter.jsx` → `features/dashboard/components/time-filter.ts`

Props: `{ onRangeChange }` (called with `{ startDate: string|null, endDate: string|null }`).

Local state: `activeRange = 'month'` (default!), `customStart = ''`, `customEnd = ''`.

`RANGE_OPTIONS = [ {today,'Today'}, {week,'This Week'}, {month,'This Month'}, {year,'This Year'}, {custom,'Custom'} ]`

`getRange(key)` — all values are **ISO strings**:
* `today` → `{ startDate: todayStart.toISOString(), endDate: now.toISOString() }`
  where `todayStart = new Date(y, m, d)` (local midnight)
* `week` → Monday of the current week at local midnight → now (week starts Monday:
  `monday.setDate(todayStart.getDate() - ((dayOfWeek + 6) % 7))`)
* `month` → `new Date(y, m, 1)` local midnight → now
* `year` → `new Date(y, 0, 1)` local midnight → now
* `custom` / default → `{ startDate: null, endDate: null }`

`handleTabChange(key)`: sets `activeRange`; if not custom → `onRangeChange(getRange(key))`,
if custom → `onRangeChange({ startDate: null, endDate: null })`.

`handleCustomDateChange()`: only when **both** dates present →
`{ startDate: new Date(customStart).toISOString(), endDate: new Date(customEnd + 'T23:59:59').toISOString() }`.

Rendering: `div.time-range-tabs` `role="group"` `aria-label="Time range"`. Five
`button.tab-btn` with `aria-pressed={activeRange === key}`. When `activeRange === 'custom'`,
appends `.date-range-inputs` with visually-hidden labels "Start date" / "End date",
two `input[type=date]` (`custom-start`, `custom-end`), a `<span>to</span>`, and
`button.btn.btn-sm.btn-primary` "Apply" `disabled={!customStart || !customEnd}`.

Note: the active tab is **local state only** — switching to Custom without applying leaves the
dashboard on an unfiltered range. This quirk must be preserved.

### 3.4 `src/components/ExpenseForm.jsx` → `shared/expense-form/expense-form.ts`

Props: `{ initialExpense = null, onSubmit, submitting }`.

`QUICK_AMOUNTS = [50, 100, 200, 500, 1000]`

`toInputDate(dateStr)`: `dateStr ? new Date(dateStr).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]`

Local state (all initialised from `initialExpense`, i.e. **create and edit are the same component**):
| State | Initial value |
| --- | --- |
| `type` | `initialExpense?.type \|\| 'expense'` |
| `description` | `initialExpense?.description \|\| ''` |
| `amount` | `initialExpense ? String(initialExpense.amount) : ''` |
| `category` | `initialExpense?.category \|\| (isIncome ? 'Income' : categories[0] \|\| 'Food')` |
| `upiApp` | `initialExpense?.upiApp \|\| upiApps[0] \|\| 'GPay'` |
| `paymentMethod` | `initialExpense?.paymentMethod \|\| 'cash'` |
| `date` | `toInputDate(initialExpense?.date)` |
| `error` | `''` |

`isIncome = type === 'income'`.

`handleSubmit(e)` — `e.preventDefault()`, `setError('')`, then:
1. `if (!description.trim() || !amount)` → `setError('Add a short description and the amount')`
2. `if (Number(amount) <= 0)` → `setError('Amount must be greater than zero')`
3. Otherwise `onSubmit({ description, amount: Number(amount), type,
   category: isIncome ? 'Income' : category, date,
   ...(isIncome ? { paymentMethod: initialExpense?.paymentMethod || 'bank' }
                : { paymentMethod, ...(paymentMethod === 'upi' ? { upiApp } : {}) }) })`

`invalid = Boolean(error)`.

Rendering (`form.expense-form` with `noValidate`):
* `@if error` → `div.alert.alert-error[role=alert]` with the message
* **Amount hero**: `label[for=amount]` `Amount` + `.field-req` `*`;
  `.amount-wrap` with `span.amount-currency` `₹` and
  `input#amount[type=number][min=0][step=0.01][placeholder="0"][autoFocus][aria-invalid={invalid]`
* `.quick-amounts` `aria-label="Quick amounts"` — 5 `button[type=button].quick-amount` labelled
  `₹50 ₹100 ₹200 ₹500 ₹1000`, `.active` when `Number(amount) === amt`, click sets the amount.
* **Description**: `label[for=description]` + `.field-req`; `input#description[type=text][required]`,
  placeholder switches: income → `e.g. Salary, Refund, Interest`, expense → `e.g. Lunch, Groceries, Rent`
* **Type**: `label#type-label` "Type"; `.payment-toggle[role=radiogroup][aria-labelledby=type-label]`
  with two `button[role=radio]` — `💸 Expense` (`.payment-pill`, active when `!isIncome`) and
  `💰 Income` (`.payment-pill.income-pill`, active when `isIncome`)
* `@if !isIncome`: **Category** — `label#category-label`, `.category-grid[role=radiogroup]`
  over `categories` from `usePreferences()`, each `button[role=radio].category-chip`
  (`.category-chip-icon` = `getCategoryIcon(cat)`, `.category-chip-label` = name).
  **Payment Method** — `label#payment-label`, `.payment-toggle[role=radiogroup]` with
  `💵 Cash` (`paymentMethod === 'cash'`) and `📱 UPI` (`paymentMethod === 'upi'`).
  `@if paymentMethod === 'upi'` → **UPI App** — `label#upi-label`, `.upi-app-grid[role=radiogroup]`
  over `upiApps`, each `button[role=radio].upi-chip`.
* `@if isIncome` → `div.form-hint.income-hint`:
  `💰 Income is recorded under the **Income** category and does not count toward your spending totals.`
* **Date**: `label[for=date]` `Date` + `.field-req`; `input#date[type=date][required]`
* **Submit**: `button[type=submit].btn.btn-primary.btn-block[disabled={submitting}]` with
  `submitting` → `.btn-spinner` + `Saving…`; else `initialExpense` → `💾 Save Changes`;
  else `isIncome` → `💰 Add Income`; else `➕ Add Expense`

### 3.5 `src/components/ExpenseList.jsx` → `features/dashboard/components/expense-list.ts`

Props: `{ expenses, onEdit, onDelete, onAdd, loading, hasFilters }`.

Helpers (module scope):
* `formatDate(dateStr)` → `new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })`
* `formatCurrency(amount)` → `Intl.NumberFormat('en-IN', { style:'currency', currency:'INR', maximumFractionDigits: 2 })`
* `paymentLabel(expense)`: `upi` → `📱 ${upiApp || 'UPI'}`; `bank` → `🏦 ${bankName || 'Bank'}`; else `💵 Cash`
* `EditIcon` inline SVG 15×15, `viewBox 0 0 24 24`, `stroke-width 2`, path `M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z`
* `TrashIcon` inline SVG 15×15, three paths (`M3 6h18`, `M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6`, `M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2`)

Local state: `confirmId` (`string | null`).

`handleTrashClick(id)` — **two-click inline confirmation**: first click sets `confirmId = id` and
starts a `setTimeout(..., 2500)` that clears it (guarded by `cur === id`); second click clears it
and calls `onDelete(id)`.

Rendering, three mutually exclusive branches:
1. `loading` → `LoadingSkeleton`: `div.expense-list[aria-hidden=true]` with 4
   `div.skeleton-row` each containing `.skeleton.sk-circle`, `.skeleton.sk-line.mid`,
   `.skeleton.sk-line.short`, `.skeleton.sk-bar`
2. `!expenses.length` → `div.empty-state`:
   icon `hasFilters ? '🔍' : '💸'` (`.empty-state-icon`),
   `h3` = `hasFilters ? 'No matching expenses' : 'No expenses yet'`,
   `p` = `hasFilters ? 'Try adjusting your filters or date range to find what you are looking for.'`
   : `'Click "Add Expense" to record your first expense and start tracking your spending.'`;
   `@if !hasFilters && onAdd` → `button.btn.btn-primary.btn-sm` `+ Add your first expense`
3. Otherwise `div.expense-list` with one `div.expense-item` per expense,
   `key={expense._id}`, class `+ ' income-item'` when `type === 'income'`,
   inline `style="animation-delay: {min(idx * 0.05, 0.5)}s"`:
   * `.expense-info` → `.expense-avatar` (`getCategoryIcon(expense.category)`), then
     `.expense-description` (`title={expense.description}`) and `.expense-meta` containing
     `.expense-category` (`+ ' category-income'` for income), `span.payment-badge.{paymentMethod}`,
     `span.expense-date`
   * `.expense-right` → `.expense-amount` (`+ ' amount-income'` for income; text is
     `'+'` for income then `formatCurrency(amount)`), `.expense-actions` with
     `button.icon-btn` Edit (`title="Edit"`, `aria-label={`Edit ${description}`}`) and
     `button.icon-btn.danger` (`+ ' confirming'` when `confirmId === _id`) whose content is `✓`
     when confirming else `TrashIcon`; `title` is `'Click again to confirm'` when confirming
     else `'Delete'`, `aria-label={`Delete ${description}`}`

### 3.6 `src/components/ExpenseModal.jsx` → `shared/expense-modal/expense-modal.ts`

Props: `{ open, editing, onClose, onSubmit, submitting }`.

`FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'`

Effect (`[open, onClose]`), early-returns when `!open`:
1. `keydown` listener: `Escape` → `onClose()`
2. `document.body.style.overflow = 'hidden'`
3. Saves `document.activeElement`, queries all focusables inside the dialog, focuses the first
   (or the dialog itself if there are none)
4. `Tab` focus trap: `Shift+Tab` on first → focus last; `Tab` on last → focus first
5. Cleanup: removes both listeners, resets body overflow, restores previous focus

Rendering: `@if !open return null`. `div.modal-overlay` with `(click) = onClose`;
inside `div.expense-modal[role=dialog][aria-modal=true][aria-labelledby=expense-modal-title]`
with `(click) stopPropagation()`:
* `.modal-header` → `h2.modal-title#expense-modal-title` with
  `span.modal-title-icon` = `editing ? '✏️' : '✨'` and title
  `editing ? 'Edit Expense' : 'Add Expense'`; `button.modal-close[aria-label=Close]` `×`
* `<ExpenseForm [initialExpense]="editing" [onSubmit]="onSubmit" [submitting]="submitting" />`

### 3.7 `src/components/Charts.jsx` → `features/dashboard/components/charts.ts`

Props: `{ summary, activeFilter, onFilterChange }`. Local state: `categoryChartType: 'pie' | 'bar'`.
`useTheme()` → `{ resolved }`; `isDark = resolved === 'dark'`.

Theme-dependent palette (all must be reproduced exactly):
```
COLORS            dark ? DARK_COLORS : LIGHT_COLORS
LIGHT_COLORS = ['#dc2626','#d97706','#059669','#2563eb','#7c3aed','#db2777','#0d9488','#64748b']
DARK_COLORS  = ['#f36a5e','#f59e0b','#34d399','#60a5fa','#a78bfa','#f472b6','#2dd4bf','#94a3b8']
gridColor         dark '#303038' : '#fecaca'
tickColor         dark '#6b6b76' : '#888888'
legendColor       dark '#a1a1aa' : '#555555'
tooltipBg         dark '#1e1e24' : '#ffffff'
tooltipBorder     dark '#303038' : '#fecaca'
tooltipText       dark '#f0f0f0' : '#1a1a1a'
areaGradientTop   dark '#ef4444' : '#dc2626'
activeStroke      dark '#f0f0f0' : '#1a1a1a'
fadedOpacity = 0.35
CHART_CURSORS = { cursor: 'pointer' }
```

`formatCurrency(val)` — `Intl.NumberFormat('en-IN', { currency INR, maximumFractionDigits: 0 })`.

`makeTooltip(bg, border, text)` returns a custom tooltip component:
`null` unless `active && payload?.length`; renders a div with inline styles
(`border: 1px solid <border>`, `borderRadius: 12`, `padding: '10px 14px'`,
`boxShadow: '0 8px 24px rgba(0,0,0,0.25)'`, `fontSize: 13`) containing
`<p style="margin:0;font-weight:700;color:<text>">{label}</p>` and
`<p style="margin:'4px 0 0';color:'#ef4444';font-weight:600">{formatCurrency(payload[0].value)}</p>`.

Data derivation:
* `categoryData` = `Object.entries(byCategory)` → `{ name, value }`, **sorted desc by value**
* `PAYMENT_LABELS = { cash: 'Cash', upi: 'UPI', bank: 'Bank' }`
* `paymentData` = `Object.entries(byPaymentMethod)` filtered to `value > 0`, mapped to
  `{ name: PAYMENT_LABELS[name] || name, value, key: name }`
* `trendData` = `Object.entries(byDay)` sorted by key `localeCompare`, mapped to
  `{ date: new Date(date).toLocaleDateString('en-IN', { day:'numeric', month:'short' }), amount: value }`
* `hasCategoryData`, `hasPaymentData`, `hasTrendData`
* `if (!summary) return null`

Interaction:
* `handleCategoryClick(data)` — `if (!data?.name) return; onFilterChange?.('category', data.name)`
* `handlePaymentClick(data)` — `if (!data?.key) return; onFilterChange?.('payment', data.key)`
* `isCategoryActive(name)` — `activeFilter?.type === 'category' && activeFilter?.value === name`
* `isPaymentActive(key)` — `activeFilter?.type === 'payment' && activeFilter?.value === key`
* Active-fade: when a category/payment filter is active, non-matching slices render at
  `opacity: 0.35`; the matching slice gets `stroke: activeStroke`, `strokeWidth: 2`
* Payment slice colours: `cash` → dark `#a1a1aa` / light `#374151`;
  `upi` → dark `#4ade80` / light `#16a34a`; else (`bank`) → dark `#f59e0b` / light `#d97706`

Three chart cards inside `div.charts-section`:

**A. `.chart-card` — By Category**
* `.chart-title` → `h3` (`📊 By Category`) with `span.chart-active-badge`
  (`activeFilter.value`) shown when `activeFilter?.type === 'category'`;
  plus `.chart-type-switch` with two `button.chart-type-btn` "Pie" / "Bar"
* Pie mode: doughnut `innerRadius 60`, `outerRadius 100`, `dataKey "value"`, `paddingAngle 3`,
  `animationDuration 800`, `animationEasing "ease-out"`, per-slice `Cell` fill/opacity/stroke;
  `Tooltip` with `formatter = formatCurrency`; `Legend` with `formatter` wrapping the label in
  `<span style="color: legendColor; fontSize: 13">`
* Bar mode: `layout="vertical"`, `margin={{ left: 20 }}`,
  `CartesianGrid strokeDasharray="3 3" stroke=gridColor`,
  `XAxis type="number"` with `tickFormatter = v => '₹' + (v/1000).toFixed(0) + 'k'`, `fontSize 12`,
  `YAxis dataKey="name" type="category" width={90}` `tick={{fill: legendColor}}`,
  custom `Tooltip`, `Bar dataKey="value" radius={[0,6,6,0]} animationDuration 800` with per-bar `Cell`
* Empty → `.chart-placeholder` (`📊` + `No expenses for this time range`)
* Click: pie slice `onClick={(_, idx) => handleCategoryClick(categoryData[idx])}`;
  bar chart `onClick={state => state?.activePayload?.[0] && handleCategoryClick(state.activePayload[0].payload)}`

**B. `.chart-card` — By Payment Method**
* `h3` `💳 By Payment Method` + `span.chart-active-badge`
  (`PAYMENT_LABELS[activeFilter.value] || activeFilter.value`) when a payment filter is active
* Doughnut `innerRadius 60`, `outerRadius 100`, `paddingAngle 5`, `animationDuration 800`,
  `animationEasing "ease-out"`, label formatter `` `${name} ${(percent*100).toFixed(0)}%` ``,
  `onClick={(_, idx) => handlePaymentClick(paymentData[idx])}`, `Tooltip formatter = formatCurrency`
* Empty → `.chart-placeholder` (`💳` + `No expenses for this time range`)

**C. `.chart-card.wide` — Daily Trend**
* `h3` `📈 Daily Trend`
* `AreaChart margin={{ top: 5, right: 20, left: 0, bottom: 5 }}`,
  `<linearGradient id="colorAmt">` stops `5%` `areaGradientTop` @0.3 → `95%` @0,
  `CartesianGrid strokeDasharray="3 3"`, `XAxis dataKey="date"`,
  `YAxis tickFormatter = '₹' + (v/1000).toFixed(0) + 'k'`, custom `Tooltip`,
  `Area type="monotone" dataKey="amount" stroke="#ef4444" strokeWidth={2.5}
   fill="url(#colorAmt)" animationDuration={1200} animationEasing="ease-out"`
* Empty → `.chart-placeholder` (`📈` + `No spending in this period yet`)

All three wrapped in `ResponsiveContainer width="100%" height={260}`.

### 3.8 Pages

#### `src/pages/Login.jsx`

State: `email`, `password`, `error`. Uses `useAuth()` → `{ login, loading }`, `useNavigate()`.

`handleSubmit(e)` — `e.preventDefault()`, `setError('')`,
`result = await login(email, password)`; `result.ok` → `navigate('/')`, else `setError(result.message)`.

Markup: `div.auth-page` → `div.auth-card` → `div.auth-brand` (`span.auth-brand-logo` `₹`,
`span.auth-brand-name` "Expense Tracker") → `h1` "Welcome Back" →
`p.auth-subtitle` "Log in to continue tracking your spending" →
`@if error` `div.alert.alert-error[role=alert]` →
`form`:
* `.form-group` label `Email` + `.field-req`, `input#email[type=email][required]
  [placeholder="you@example.com"][autocomplete=email]`
* `.form-group` label `Password` + `.field-req`, `input#password[type=password][required]
  [placeholder="••••••••"][autocomplete=current-password]`
* `button[type=submit].btn.btn-primary.btn-block[disabled=loading]` — `loading` →
  `.btn-spinner` + `Logging in…`, else `Log In`
→ `p.auth-footer`: `Don't have an account? <Link to="/register">Sign up</Link>`

#### `src/pages/Register.jsx`

State: `name`, `email`, `password`, `confirmPassword`, `error`. `useAuth()` → `{ register, loading }`.

`handleSubmit(e)`:
1. `e.preventDefault()`, `setError('')`
2. `password !== confirmPassword` → `setError('Passwords do not match')`, return
3. `password.length < 6` → `setError('Password must be at least 6 characters')`, return
4. `result = await register(name, email, password)`; `ok` → `navigate('/')`, else `setError(result.message)`

Markup: same `auth-page/auth-card/auth-brand` shell; `h1` "Create Account";
`p.auth-subtitle` "Start tracking your spending in under a minute";
error alert; form fields:
* `Name` — `input#name[type=text][required][placeholder="Your name"][autocomplete=name]`
* `Email` — `input#email[type=email][required][placeholder="you@example.com"][autocomplete=email]`
* `.form-row` containing two `.form-group`s:
  `Password` — `input#password[type=password][required][minlength=6]
   [placeholder="At least 6 characters"][autocomplete=new-password]`
  and `Confirm` — `input#confirmPassword[type=password][required]
   [placeholder="Re-enter password"][autocomplete=new-password]`
* submit: `loading` → spinner + `Creating account…`, else `Sign Up`
→ `p.auth-footer`: `Already have an account? <Link to="/login">Log in</Link>`

#### `src/pages/Dashboard.jsx`

`formatCurrency` — `maximumFractionDigits: 2`. `capitalise(str)` — uppercases first char.

State (10):
| Signal | Default |
| --- | --- |
| `expenses` | `[]` |
| `loading` | `true` |
| `submitting` | `false` |
| `editingExpense` | `null` |
| `modalOpen` | `false` |
| `filter` (category) | `''` |
| `month` | `''` |
| `error` | `''` |
| `summary` | `null` |
| `chartFilter` | `null` |
| `dateRange` | `{ startDate: new Date(y, m, 1).toISOString(), endDate: new Date().toISOString() }` (this-month) |

`buildParams(extra = {})` (`useCallback`, deps `[filter, month, dateRange]`): starts from `extra`
and adds `category` if `filter`, `month` if `month`, `startDate`/`endDate` when non-null.

`fetchExpenses()` — `loading = true`; `GET /expenses` with `buildParams()`; on success
`expenses = data.expenses`; on error `error = err.response?.data?.message || 'Failed to load expenses'`;
`finally loading = false`.

`fetchSummary()` — `GET /expenses/summary` with **only** `startDate`/`endDate` from `dateRange`
(no category/month); on success `summary = data`; **catch is silent** (comment: "summary is optional").

Effect (`[filter, month, dateRange]`, `exhaustive-deps` intentionally disabled): calls
`fetchExpenses()` then `fetchSummary()`.

Mutations:
* `handleAdd(expenseData)` — `submitting = true`, `error = ''`;
  `POST /expenses`; prepend `data` to `expenses`; `closeModal()`; `fetchSummary()`;
  catch → `err.response?.data?.message || 'Failed to add expense'`; `finally submitting = false`
* `handleEdit(expenseData)` — `if (!editingExpense) return`; `PUT /expenses/${editingExpense._id}`;
  replace in `expenses` by matching `e._id === data._id`; `closeModal()`; `fetchSummary()`;
  catch → `'Failed to update expense'`
* `handleDelete(id)` — `DELETE /expenses/${id}`; filter out by `_id`; `fetchSummary()`;
  catch → `'Failed to delete expense'` (no loading state)
* `openAddModal()` — `editingExpense = null`, `modalOpen = true`, `error = ''`
* `startEdit(expense)` — `editingExpense = expense`, `modalOpen = true`, `error = ''`
* `closeModal()` — `editingExpense = null`, `modalOpen = false`, `error = ''`
* `handleTimeRangeChange(range)` — `dateRange = range`, `month = ''` (month filter is reset)
* `handleChartFilter(type, value)` — toggles: if `prev` matches both type and value → `null`, else `{ type, value }`
* `clearChartFilter()` — `chartFilter = null`

Derived (`useMemo` / plain):
* `displayedExpenses` — `expenses` filtered by `chartFilter` (`payment` → `e.paymentMethod === value`;
  `category` → `e.category === value`); no filter → all
* `expensesOnly` — `type !== 'income'`
* `incomeOnly` — `type === 'income'`
* `totalAmount`, `totalIncome`, `cashTotal`, `upiTotal`, `bankTotal` (the latter three over `expensesOnly`)
* `PAYMENT_LABELS = { cash:'Cash', upi:'UPI', bank:'Bank' }`
* `filterLabel` — `chartFilter.type === 'payment' ? (PAYMENT_LABELS[value] || 'Bank') : value`; `null` when no filter
* `greeting` — `user?.name ? \`Welcome back, ${capitalise(user.name.split(' ')[0])}\` : 'Your spending at a glance'`

Markup:
* `header.page-header` → `div` with `h1.page-title` "Dashboard" and
  `p.page-subtitle` `{greeting} — here's an overview of your expenses.`;
  `button.btn.btn-primary` (plus inline 15×15 `+` SVG) "Add Expense"
* `section.dashboard-summary` — five `.summary-card`s:
  1. `.highlight` — `💸` / `Total Spent` / `formatCurrency(totalAmount)` /
     `{expensesOnly.length} expense{s}` + `' · filtered'` when `chartFilter`
  2. `💰` / `Income` / `.summary-value.summary-income` `formatCurrency(totalIncome)` /
     `{incomeOnly.length} entr{y|ies}`
  3. `💵` / `Cash` / `formatCurrency(cashTotal)` /
     `{expensesOnly.filter(cash).length} payment(s)`
  4. `📱` / `UPI` / `formatCurrency(upiTotal)` / `{…upi…} payment(s)`
  5. `🏦` / `Bank` / `formatCurrency(bankTotal)` / `{…bank…} payment(s)`
  then `<TimeFilter (onRangeChange)="handleTimeRangeChange" />` (spans `grid-column: 1 / -1`)
* `@if error` → `div.alert.alert-error[role=alert]` with `span` + `button.alert-dismiss[aria-label=Dismiss]` `×`
* `section.dashboard-body` → `<Charts …/>` then `div.expense-list-container`:
  * `.expense-toolbar` → `h2` `📋 Your Expenses` plus, when `chartFilter`,
    `span.toolbar-filter-badge` with `filterLabel` and `button.badge-clear` `×` (clear)
  * `.toolbar-filters` → `select[aria-label="Filter by category"]` bound to `filter` with
    `<option value="">All Categories</option>` followed by a **hardcoded** list:
    Food, Transport, Housing, Utilities, Entertainment, Healthcare, Shopping, Education, Other;
    plus `input.month-filter[type=month][aria-label="Filter by month"]` bound to `month`
  * `<ExpenseList [expenses]="displayedExpenses" [onEdit]="startEdit" [onDelete]="handleDelete"
     [onAdd]="openAddModal" [loading]="loading"
     [hasFilters]="Boolean(filter || month || chartFilter)" />`
* `button.fab[aria-label="Add expense"]` with a 26×26 `+` SVG
* `<ExpenseModal [open] [editing] [onClose]="closeModal"
   [onSubmit]="editingExpense ? handleEdit : handleAdd" [submitting] />`

#### `src/pages/Profile.jsx`

Helpers: `formatCurrency` (2 digits), `formatJoinDate(dateStr)` →
`toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' })` or `'—'` when falsy.

`STATS = [ {key:'totalExpenses', label:'Total Expenses', icon:'🧾'},
           {key:'totalSpent', label:'Total Spent', icon:'💸', format: formatCurrency},
           {key:'topCategory', label:'Top Category', icon:'🏆', format: v => v || '—'} ]`

State:
`profile` (`null`), `loading` (`true`), `message` (`{ type: '', text: '' }`),
`name` (`authUser?.name || ''`, re-synced from `authUser` via effect),
`savingPw`/`savingName`/`addingCategory`/`addingUpiApp`/`deleting` (`false`),
`pw = { currentPassword:'', newPassword:'', confirm:'' }`, `confirmDelete` (`''`),
`newCategory` (`''`), `newUpiApp` (`''`).

`usePreferences()` → `{ categories, upiApps, customCategories, customUpiApps, addCategory, removeCategory, addUpiApp, removeUpiApp }`.

Effect on mount: `GET /auth/profile` → `profile = data`; catch → `message = { type:'error', text:'Failed to load profile' }`; `finally loading = false`.

`showMessage(type, text)` — sets message and clears it after **4000 ms** via `setTimeout`.

Handlers:
* `handleNameSave(e)` — `if (!name.trim()) return`; `PUT /auth/profile { name }`; writes
  `localStorage.user = JSON.stringify({ ...authUser, name: data.name })`;
  merges `name` into `profile`; `showMessage('success','Name updated')`;
  catch → `err.response?.data?.message || 'Failed to update name'`
* `handlePasswordChange(e)` — clears message; `pw.newPassword !== pw.confirm` →
  `showMessage('error','New passwords do not match')`, return;
  `PUT /auth/password { currentPassword, newPassword }`; resets all three fields;
  `showMessage('success','Password changed successfully')`;
  catch → `… || 'Failed to change password'`
* `handleDeleteAccount()` — `confirmDelete.toLowerCase() !== 'delete'` →
  `showMessage('error','Type "delete" to confirm')`, return;
  then **`window.confirm('This will permanently delete your account and ALL expenses. Continue?')`**
  (native browser dialog — cancel returns); `DELETE /auth/account`; `logout()`; `navigate('/register')`;
  catch → `… || 'Failed to delete account'` and resets `deleting = false`
* `handleAddCategory(e)` — trims input, returns if empty; rejects case-insensitive duplicates with
  `showMessage('error', \`Category "${clean}" already exists\`)`; `addCategory(clean)`;
  clears input; `showMessage('success', \`Added category "${clean}"\`)`;
  catch → `… || 'Failed to add category'`
* `handleAddUpiApp(e)` — identical shape with `UPI app "${clean}" already exists` /
  `Added UPI app "${clean}"` / `'Failed to add UPI app'`
* `handleRemoveCategory(cat)` — `removeCategory(cat)`; `showMessage('success', \`Removed "${cat}"\`)`;
  catch → `'Failed to remove category'`
* `handleRemoveUpiApp(app)` — same with `'Failed to remove UPI app'`

Loading branch (`if (loading)`): `div.empty-state` with `.empty-state-icon` `⏳` and
`<p>Loading your profile…</p>` (no `h3`).

Rendered markup (`div.profile-page`):
* `@if message.text` → `div.alert` + `alert-error` or `alert-success`,
  `role="alert"` / `role="status"` respectively
* `div.profile-header` → `Avatar(authUser?.name, 84, 'profile-avatar-img')`,
  `div.profile-id` with `h1` `{profile?.name || authUser?.name}`,
  `p` `{profile?.email || authUser?.email}`,
  `span.profile-since` `Member since {formatJoinDate(profile?.createdAt)}`
* `div.profile-stats` → three `div.stat-card` from `STATS`: `span.stat-icon` + `div` with
  `div.stat-value` (`+ ' long'` for `topCategory`; `s.format ? s.format(profile?.stats[key]) : (profile?.stats[key] ?? 0)`)
  and `div.stat-label`
* `div.settings-section#settings` → `h2` `⚙️ Account Settings`, then 7 `.setting-card`s:
  1. **Update Name** `🏷️` — `form.setting-form` with `input[type=text][placeholder="Your name"][aria-label="Your name"]`
     and `button[type=submit].btn.btn-primary[disabled=savingName]` (`savingName` → `'Saving…'`, else `'Save'`)
  2. **Appearance** `🎨` — `p.setting-desc` "Choose how the app looks on this device.";
     `.theme-radios` with three `button.theme-radio` (`aria-pressed`):
     `🖥️ System`/`Follow device`, `☀️ Light`/`Light theme`, `🌙 Dark`/`Dark theme`
  3. **Custom Categories** `📂` — desc "Add your own categories so they appear in the Add Expense form.";
     form with `input[type=text][placeholder="e.g. Pets, Subscriptions"][maxlength=24]
     [aria-label="New category name"]` and `Add` / `Adding…` button;
     `@if customCategories.length > 0` → `.tag-list` of `.tag` spans each with a
     `button.tag-remove` `×` (`aria-label={`Remove ${cat}`}`); else `p.setting-empty` "No custom categories yet."
  4. **Custom UPI Apps** `📱` — desc "Add your payment apps so they show up when you pay by UPI.";
     `input[type=text][placeholder="e.g. Cred, Mobikwik"][maxlength=24][aria-label="New UPI app name"]`;
     tags from `customUpiApps`; else "No custom UPI apps yet."
  5. **Change Password** `🔒` — `form.setting-form` with `.setting-form-grid` of three `.form-group`s:
     `Current Password` (`#currentPassword`, `autocomplete=current-password`, required),
     `New Password` (`#newPassword`, `minlength=6`, required, `autocomplete=new-password`),
     `Confirm New Password` (`#confirmPassword`, required, `autocomplete=new-password`);
     submit button `'Update Password'` (spinner + `Updating…` while `savingPw`)
  6. **Session** `🔐` — desc `Signed in as {authUser?.email}. Log out to switch accounts.`;
     `button[type=button].btn.btn-ghost` calling bare `logout()` → `🚪 Logout`
  7. **Danger Zone** `.setting-card.danger` `⚠️` — desc
     "Deleting your account removes all your data permanently. This cannot be undone.";
     `input[type=text][placeholder='Type "delete" to confirm'][aria-label='Type "delete" to confirm']`;
     `button[type=button].btn.btn-danger[disabled=deleting]` → `'Delete Account'` / `'Deleting…'`

#### `src/pages/Import.jsx`

Helper `toDateInput(iso)` → `''` when falsy or invalid, else `new Date(iso).toISOString().split('T')[0]`.

State: `fileName`, `bankName`, `warning`, `parsing`, `importing`, `error`, `success`, `entries`.
Ref: `fileInputRef` (the hidden `input[type=file]`).

`toEntry(txn)` → `{ key: \`${txn.date}-${txn.amount}-${Math.random().toString(36).slice(2,8)}\`,
date: toDateInput(txn.date), description: txn.description, amount: txn.amount,
type: txn.type === 'credit' ? 'income' : 'expense',
category: txn.type === 'credit' ? 'Income' : 'Other', selected: true }`

`reset()` — clears `entries`, `fileName`, `bankName`, `warning`, `success`, `error`, and
`fileInputRef.current.value = ''`.

`handleFile(file)` — `if (!file) return`; clears error/success/warning; `parsing = true`;
builds `FormData` with `'file'`; `POST /import/parse` with
`headers: { 'Content-Type': 'multipart/form-data' }`;
sets `fileName = data.fileName || file.name`, `bankName = data.bankName || ''`,
`warning = data.warning || ''`, `entries = data.transactions.map(toEntry)`;
catch → `err.response?.data?.message || 'Failed to parse the PDF. Please try another file.'` and `entries = []`;
`finally parsing = false`.

`onDrop(e)` — `preventDefault()`, takes `e.dataTransfer?.files?.[0]`.
Dropzone also has `onDragOver={e => e.preventDefault()}`.

Row operations: `toggleEntry(key)`, `updateEntry(key, field, value)`, `removeEntry(key)`.

`selectedEntries` (`useMemo`) — `entries.filter(e => e.selected)`.
`totals` (`useMemo`) — reduce into `{ expense: 0, income: 0, count: 0 }`, `acc[e.type] += e.amount`.

`handleImport()` — `if (!selectedEntries.length) return`; `importing = true`; builds payload
`selectedEntries.map(({ date, description, amount, type, category, bankName: bank }) =>
  ({ date, description, amount, type, category, bankName: bank || null }))`
— note `bankName` is destructured out of the entry but is never set on entries, so it is always `null`;
`POST /import/expenses { entries: payload }`;
`success = \`Imported ${data.imported} entr${data.imported === 1 ? 'y' : 'ies'} successfully.\``;
`reset()`; catch → `… || 'Failed to import entries'`.

`categoryOptions` (`useMemo` on `[entries, categories]`) — `['Income', ...categories]` when any
entry is income, else `categories`.

Markup (`div.dashboard.import-page`):
* `header.page-header` → `h1.page-title` "Import Statement",
  `p.page-subtitle` "Upload a bank passbook or statement PDF and we'll detect the transactions for you."
* `@if !entries.length` → `section.import-upload` → `div.dropzone` (drag handlers):
  `.dropzone-icon` `🗂️`, `h3` "Drop your PDF here",
  `p` "Passbook PDFs, account statements, payment statements — any text-based PDF works.",
  hidden `input#statement-file[type=file][accept="application/pdf,.pdf"]`,
  `button.btn.btn-primary[disabled=parsing]` → `parsing ? 'Parsing statement…' : '⌕  Choose a PDF file'`,
  and `@if parsing` → `.import-progress` with `.btn-spinner` + "Reading statement…"
* `@if error` → dismissible `div.alert.alert-error[role=alert]`
* `@if success` → `div.alert.alert-success[role=alert]`
* `@if entries.length > 0` → `section.import-preview`:
  * `.import-preview-header` → `.import-file-info` (`span.import-file-icon` `📄`, `strong` fileName,
    `.import-file-meta` with `@if bankName` `span.bank-badge` `🏦 {bankName}` and
    `{entries.length} transactions detected`);
    `.import-totals` with `.import-total.entry-expense` (`Expenses` / `formatCurrency(totals.expense)`)
    and `.import-total.entry-income` (`Income` / `formatCurrency(totals.income)`)
  * `@if warning` → `div.alert.alert-warning[role=alert]`
  * `.import-table-wrap` → `table.import-table`, `thead` cells:
    `.col-check` (select-all checkbox, `aria-label="Select all"`, `checked = selectedEntries.length === entries.length`,
    toggles all), `Date`, `Description`, `Category`, `Type`, `.col-amount` "Amount", `.col-remove` (empty)
  * `tbody` → one `tr` per entry, `.row-unselected` when `!entry.selected`, with:
    `.col-check` checkbox `aria-label={`Include ${entry.description}`}`;
    `input[type=date]` (`aria-label="Date"`);
    `input[type=text]` (`aria-label="Description"`);
    `select` (`aria-label="Category"`) over `categoryOptions`;
    `select` (`aria-label="Type"`, class `type-income` / `type-expense`) over
    `expense`/`income` — changing it also coerces category to `Income` (from income) or `Other` (from income);
    `.col-amount` → `span.amount-income` / `span.amount-expense` with `+`/`−` prefix + `formatCurrency(entry.amount)`;
    `.col-remove` → `button.icon-btn.danger` `×` `title="Remove"` `aria-label={`Remove ${entry.description}`}`
  * `.import-actions` → `button.btn.btn-ghost` `↺ Start over` (calls `reset()`), and
    `button.btn.btn-primary[disabled=importing || !selectedEntries.length]` →
    `importing` ? spinner + `Importing…` : `📥 Import {n} entr{y|ies}`

---

## 4. Global state (contexts → signal stores)

### 4.1 `src/context/AuthContext.jsx` → `core/services/auth.store.ts` (`@Injectable({providedIn:'root'})` signal store)

Shape: `{ user: AuthUser | null, loading: boolean, login(email, password), register(name, email, password), logout() }`

* `user` initialised lazily from `localStorage.getItem('user')` (`JSON.parse` or `null`)
* `loading` starts `false`
* Mount effect (`[]`): `if (token && !user)` → `GET /auth/profile` → `setUser(res.data)` and
  `localStorage.setItem('user', JSON.stringify(res.data))`; **`.catch(() => {})` is silent**
* `login(email, password)` — `loading = true`; `POST /auth/login`;
  stores `localStorage.token = data.token` and `localStorage.user = JSON.stringify(data)`
  (the **entire response including the `token` field** is stored as `user`);
  `user = data`; returns `{ ok: true }`;
  catch → `{ ok: false, message: error.response?.data?.message || 'Login failed' }`; `finally loading = false`
* `register(name, email, password)` — same shape against `POST /auth/register`, fallback
  message `'Registration failed'`
* `logout()` — `localStorage.removeItem('token')`, `localStorage.removeItem('user')`, `user = null`
* Consumers: `Navbar`, `Login`, `Register`, `Profile`, `Dashboard` (via `App.jsx` guard)

### 4.2 `src/context/ThemeContext.jsx` → `core/services/theme.store.ts`

`STORAGE_KEY = 'expense-tracker-theme'`

Shape: `{ theme: 'system'|'light'|'dark', resolved: 'light'|'dark', setTheme(t) }`

* `getSystemTheme()` — `window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'`
  (returns `'light'` when `typeof window === 'undefined'`)
* `theme` initialised from `localStorage.getItem(STORAGE_KEY) || 'system'`
* `resolved = theme === 'system' ? getSystemTheme() : theme`
* Effect `[resolved]` — `document.documentElement.setAttribute('data-theme', resolved)`
* Effect `[theme]` — when `theme !== 'system'` it returns early; otherwise it adds a
  `change` listener on the `prefers-color-scheme` media query that writes `data-theme` directly
  (`mq.matches ? 'dark' : 'light'`), and removes the listener on cleanup
* `updateTheme(t)` — `theme = t`; `localStorage.setItem(STORAGE_KEY, t)`
* Consumers: `Navbar`, `Profile`, `Charts`

### 4.3 `src/context/PreferencesContext.jsx` → `core/services/preferences.store.ts`

Constants: `DEFAULT_CATEGORIES = ['Food','Transport','Housing','Utilities','Entertainment',
'Healthcare','Shopping','Education','Other']`;
`DEFAULT_UPI_APPS = ['GPay','PhonePe','Paytm','Amazon Pay','BHIM','Other']`.

`emptyPrefs = { categories: DEFAULT_CATEGORIES, upiApps: DEFAULT_UPI_APPS,
customCategories: [], customUpiApps: [] }`

Shape: `{ categories, upiApps, customCategories, customUpiApps, addCategory(name),
removeCategory(name), addUpiApp(name), removeUpiApp(name) }`

* `prefs` initialised to `emptyPrefs`
* Effect `[user]` (dependency on `useAuth().user`):
  * `!user` → `prefs = emptyPrefs`, return
  * otherwise `GET /auth/preferences` → `prefs = data`, guarded by a `cancelled` flag
    so a late response after unmount/user change is ignored; `.catch(() => {})` silent
* `apply(request)` higher-order helper: awaits `request(...args)`, sets `prefs` to the response
  `data` and returns it — so **every mutation returns the whole refreshed preferences object**
* `addCategory(name)` → `POST /auth/preferences/categories { name }`
* `removeCategory(name)` → `DELETE /auth/preferences/categories/${encodeURIComponent(name)}`
* `addUpiApp(name)` → `POST /auth/preferences/upi-apps { name }`
* `removeUpiApp(name)` → `DELETE /auth/preferences/upi-apps/${encodeURIComponent(name)}`
* Consumers: `ExpenseForm` (categories, upiApps), `Profile` (all four lists + all four mutations),
  `Import` (categories)

### 4.4 Provider nesting order (dependency order)

`ThemeProvider` → `AuthProvider` → `PreferencesProvider` → `BrowserRouter`.
`PreferencesProvider` consumes `AuthProvider`, hence the strict ordering.

---

## 5. Every API call

### 5.1 HTTP client (`src/utils/api.js`) → `core/interceptors/auth.interceptor.ts` + `api.config.ts`

```
axios.create({ baseURL: import.meta.env.VITE_API_URL })
```
* **Request interceptor** — `localStorage.getItem('token')`; if present, sets
  `config.headers.Authorization = \`Bearer ${token}\``
* **Response interceptor (error)** — if `error.response?.status === 401`:
  `localStorage.removeItem('token')` and `localStorage.removeItem('user')`;
  then re-rejects the error unchanged

Notes to preserve: there is **no** timeout, **no** retry, **no** refresh-token flow, **no**
loading interceptor, **no** `withCredentials`. The 401 handler clears storage but does **not**
clear the in-memory `user`, so an already-rendered page keeps working until a reload. This is
a source-app quirk that will be reproduced verbatim rather than "fixed", and documented in the report.

### 5.2 Endpoint table (all relative to `baseURL`)

| # | Method | URL | Payload / query | Response shape | Error fallback message | Used by |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | POST | `/auth/login` | `{ email, password }` | `{ _id, name, email, token }` | `'Login failed'` | `AuthContext.login` |
| 2 | POST | `/auth/register` | `{ name, email, password }` | `{ _id, name, email, token }` (201) | `'Registration failed'` | `AuthContext.register` |
| 3 | GET | `/auth/profile` | — | `{ _id, name, email, createdAt, stats: { totalExpenses, totalSpent, totalIncome, topCategory } }` | `'Failed to load profile'` (Profile); silent (AuthContext) | AuthContext boot, Profile |
| 4 | PUT | `/auth/profile` | `{ name }` | `{ _id, name, email }` | `'Failed to update name'` | Profile |
| 5 | PUT | `/auth/password` | `{ currentPassword, newPassword }` | `{ message }` | `'Failed to change password'` | Profile |
| 6 | DELETE | `/auth/account` | — | `{ message }` | `'Failed to delete account'` | Profile |
| 7 | GET | `/auth/preferences` | — | `{ categories: string[], upiApps: string[], customCategories: string[], customUpiApps: string[] }` | silent | PreferencesContext |
| 8 | POST | `/auth/preferences/categories` | `{ name }` | preferences object (201) | `'Failed to add category'` (client) / `'Category name is required'`, `'Category name must be 24 characters or less'`, `Category "X" already exists` (server) | Profile |
| 9 | DELETE | `/auth/preferences/categories/:name` | path param `encodeURIComponent(name)` | preferences object | `'Failed to remove category'` | Profile |
| 10 | POST | `/auth/preferences/upi-apps` | `{ name }` | preferences object (201) | `'Failed to add UPI app'` / `'UPI app name is required'`, `'UPI app name must be 24 characters or less'`, `UPI app "X" already exists` | Profile |
| 11 | DELETE | `/auth/preferences/upi-apps/:name` | path param `encodeURIComponent(name)` | preferences object | `'Failed to remove UPI app'` | Profile |
| 12 | GET | `/expenses` | query: `category?`, `month?` (`YYYY-MM`), `startDate?`, `endDate?` (ISO) | `{ expenses: Expense[], totalAmount: number, totalIncome: number }`; server sorts `date: -1` | `'Failed to load expenses'` | Dashboard |
| 13 | GET | `/expenses/summary` | query: `startDate?`, `endDate?` **only** | `{ totalAmount, totalCount, totalIncome, incomeCount, byCategory: Record<string,number>, byPaymentMethod: { cash, upi, bank }, byDay: Record<'YYYY-MM-DD', number> }` | **silently swallowed** | Dashboard |
| 14 | POST | `/expenses` | `{ description, amount: number, type, category, date, paymentMethod, upiApp? }` | created `Expense` (201) | `'Failed to add expense'` | Dashboard |
| 15 | PUT | `/expenses/:id` | same body as #14 | updated `Expense` | `'Failed to update expense'` | Dashboard |
| 16 | DELETE | `/expenses/:id` | — | `{ message: 'Expense removed' }` | `'Failed to delete expense'` | Dashboard |
| 17 | POST | `/import/parse` | `multipart/form-data`, field `file`; explicit `Content-Type: multipart/form-data` | `{ fileName, size, transactions: ParsedTransaction[], textLength, detectedColumns, bankName, warning }` where `ParsedTransaction = { date: string, rawDate: string\|null, narration, description, amount: number, type: 'debit'\|'credit', balance: number\|null }` | `'Failed to parse the PDF. Please try another file.'` / `'Only PDF files are allowed'`, `'File upload failed. Please upload a PDF under 15 MB.'`, `'Please upload a PDF file'` | Import |
| 18 | POST | `/import/expenses` | `{ entries: [{ date, description, amount, type, category, bankName: string\|null }] }` | `{ imported: number, expenses: Expense[] }` (201) | `'Failed to import entries'` / `'No entries to import'` | Import |

`Expense` shape (from `models/Expense.js`): `{ _id, user, description, amount, type,
category, paymentMethod, upiApp, bankName, date, createdAt, updatedAt }`.
Server-side `POST /expenses` does not read `type` — it always creates `type: 'expense'`.
`PUT /expenses/:id` does read `type`. This server quirk is preserved by keeping the client
payload byte-identical to the source.

Route-ordering note: the Express server registers `/expenses/summary` **before** `/expenses/:id`.
Angular's explicit route/URL strings make this a non-issue.

### 5.3 Loading / error / retry behaviour

* No automatic retry anywhere.
* `GET /expenses` sets `loading = true` before and `false` in `finally`; it drives the
  4-row skeleton.
* `GET /expenses/summary` has **no** loading flag and swallows errors.
* `GET /auth/preferences` and the boot `GET /auth/profile` swallow errors.
* Mutations expose only `submitting` (add/edit) or nothing (delete, import, preferences).
* All errors are surfaced as a single `alert-error` banner with a `×` dismiss button
  (Profile and Import use `message`; Dashboard and Import also allow dismissing).

---

## 6. Auth flow

1. **Persistence keys** — `localStorage['token']` (JWT, server TTL 30 days) and
   `localStorage['user']` (JSON of the login/register response, *including* its `token` field;
   after boot-profile it is the profile object *without* `token`).
2. **Bootstrap** — `user` is read synchronously from `localStorage` before first render, so a
   refresh on a protected route does not bounce to `/login` when `user` is present.
   If a `token` exists but `user` does not, `GET /auth/profile` runs once and back-fills both.
3. **Login** (`/login`) — form → `login()` → `POST /auth/login` → store → `navigate('/')`.
   Failure renders the server `message` (e.g. `Invalid email or password`) in the alert.
   Button disabled with a spinner + `Logging in…` while `loading`.
4. **Register** (`/register`) — form → client validation → `register()` → `POST /auth/register`
   → store → `navigate('/')`. Failure message from server, e.g. `User already exists`.
5. **Logout** — three entry points, subtly different:
   * Navbar user dropdown → `closeAll()` + `logout()` + `navigate('/login')`
   * Navbar drawer → `closeAll()` + `logout()` + `navigate('/login')`
   * Profile "Session" card → bare `logout()`, **no navigation** (the guard on the current route
     redirects to `/login` on the next change detection)
   * Local state cleared: both `localStorage` keys and the in-memory `user`
6. **Protected routes** — the `ProtectedRoute` wrapper; unauthenticated access redirects to
   `/login` with `replace`.
7. **Session expiry** — there is no proactive timer. On any `401`, the response interceptor deletes
   `token` and `user` from `localStorage` and the request rejects; the caller shows the error
   message. The in-memory `user` is *not* cleared, matching the source.
8. **Account deletion** — `DELETE /auth/account` then `logout()` then `navigate('/register')`.

---

## 7. Every form (fields, validators, messages, submit, reset, create vs edit)

### 7.1 Login form
| Field | id | Type | Required attr | Placeholder | autocomplete |
| --- | --- | --- | --- | --- | --- |
| Email | `email` | `email` | yes | `you@example.com` | `email` |
| Password | `password` | `password` | yes | `••••••••` | `current-password` |

Submit: no client validation (native `required` only); error from the server or `'Login failed'`.
Success → `navigate('/')`. No reset.

### 7.2 Register form
| Field | id | Type | Required | minLength | Placeholder | autocomplete |
| --- | --- | --- | --- | --- | --- | --- |
| Name | `name` | `text` | yes | — | `Your name` | `name` |
| Email | `email` | `email` | yes | — | `you@example.com` | `email` |
| Password | `password` | `password` | yes | 6 | `At least 6 characters` | `new-password` |
| Confirm | `confirmPassword` | `password` | yes | — | `Re-enter password` | `new-password` |

Client validation (in order, both before any request):
1. `password !== confirmPassword` → `'Passwords do not match'`
2. `password.length < 6` → `'Password must be at least 6 characters'`
Success → `navigate('/')`. No reset.

### 7.3 Expense form (`shared/expense-form`, used inline by nothing and by the modal)

* **Dual-mode**: `initialExpense = null` → create; otherwise edit. Same component, same
  validators; only the heading, submit label and icon change.
* Form is `noValidate`, so native validation is suppressed; all checks are manual.
* Validation order: (1) description/amount missing → `'Add a short description and the amount'`;
  (2) `Number(amount) <= 0` → `'Amount must be greater than zero'`.
* Amount input is `type=number min=0 step=0.01` and `autoFocus` (this is why the modal focuses it first).
* The quick-amount chips write into the same control.
* Conditional fields: category grid + payment method + (UPI app when `upi`) are hidden for income;
  income instead shows the `.income-hint` explanation and forces `category: 'Income'` plus
  `paymentMethod: initialExpense?.paymentMethod || 'bank'`.
* Submit payload differs by type (income omits `upiApp` entirely).
* Submit is `disabled` while `submitting` and shows `Saving…`.
* Reset: the modal component is destroyed and re-created with fresh `initialExpense`, so state
  resets naturally. Editing an existing expense while the modal is already open is **not** possible
  in this app (modal is opened per row), so no explicit reset logic is needed.

### 7.4 Profile forms

| Form | Fields | Validation | Reset after success | Messages |
| --- | --- | --- | --- | --- |
| Update Name | text `#` none (`aria-label="Your name"`), placeholder `Your name` | silently returns if `!name.trim()` | no (value kept) | `Name updated` / server msg / `Failed to update name` |
| Change Password | `#currentPassword` (required), `#newPassword` (required, minlength 6), `#confirmPassword` (required) | `newPassword !== confirm` → `New passwords do not match` | yes — all three cleared | `Password changed successfully` / server msg / `Failed to change password` |
| Add Category | text, `maxlength=24`, placeholder `e.g. Pets, Subscriptions` | empty → silent return; case-insensitive duplicate → `Category "X" already exists` | yes — input cleared | `Added category "X"` / server msg / `Failed to add category` |
| Add UPI App | text, `maxlength=24`, placeholder `e.g. Cred, Mobikwik` | same | yes | `Added UPI app "X"` / server msg / `Failed to add UPI app` |
| Danger Zone | text, placeholder `Type "delete" to confirm` | `toLowerCase() !== 'delete'` → `Type "delete" to confirm`; then `window.confirm(...)` | n/a | server msg / `Failed to delete account` |

All Profile messages are shown in one `.alert` that auto-clears after **4000 ms**
(note: it is a banner, not a toast, and it is not dismissible by hand).

### 7.5 Import forms
* The file input is uncontrolled, `accept="application/pdf,.pdf"`, hidden
  (`style="display:none"`), opened by the `⌕  Choose a PDF file` button, and cleared by `reset()`.
* Per-row editors are uncontrolled-by-design inputs bound to plain state
  (`date`, `description`, `category`, `type`) with **no validation** at all.
* Changing a row's `type` cascades the category (`income` → `Income`, `expense` from `Income` → `Other`).
* `Start over` / `reset()` and a successful import both call the same `reset()`.

---

## 8. Feature inventory (as discovered, nothing assumed)

**Expense tracking**
1. Create expense (modal from header button, mobile FAB, and the empty-state CTA)
2. Edit expense (per-row pencil → modal re-used in edit mode)
3. Delete expense (per-row trash with **two-click inline confirmation**, 2.5 s window)
4. Record **income** as a first-class entry type inside the same form
5. Categories — user-configurable list, rendered as an emoji icon grid
6. Payment methods — `cash`, `upi`, `bank`
7. UPI app attribution (`GPay`, `PhonePe`, `Paytm`, `Amazon Pay`, `BHIM`, `Other` + custom)
8. Bank attribution (`bankName`) for imported rows and for display of `bank` expenses
9. Quick-amount chips `₹50 / ₹100 / ₹200 / ₹500 / ₹1000`
10. Amount hero input with `₹` prefix

**Filters, search, date ranges**
11. Time-range tabs: Today / This Week / This Month / This Year / Custom (with start+end date pickers and an Apply button)
12. Category filter — `<select>` with `All Categories` + the 9 hardcoded defaults
13. Month filter — `<input type="month">`
14. Interaction rule: changing the time range **clears the month filter**; changing the month
    filter does **not** change the time range
15. Cross-filtering from charts: clicking a category slice/bar or a payment slice sets a
    "chart filter" that further filters the expense list, shows a filter badge in the toolbar
    and a `chart-active-badge` on the chart card, and adds ` · filtered` to the Total Spent card
16. Toggling the same chart slice clears the filter
17. `hasFilters` drives the empty-state wording (🔍 vs 💸) and hides the empty-state CTA
18. **No** free-text search, **no** sorting UI (server returns `date: -1` and the client keeps that order),
    **no** pagination (server returns all matching rows)

**Summaries, stats, charts**
19. Five summary cards: Total Spent (highlighted), Income, Cash, UPI, Bank — each with a count line
20. Donut chart "By Category" with a Pie/Bar toggle
21. Horizontal bar variant of the category chart
22. Donut chart "By Payment Method" with percentage labels
23. Area chart "Daily Trend" with a gradient fill
24. Custom tooltips (themed per light/dark) on all three charts
25. Per-slice theming: 8-colour palette (light and dark variants), faded non-selected slices,
    active-slice outline
26. Chart placeholders with per-chart empty copy
27. Profile account stats: total expenses, total spent, top category, member-since date

**Import**
28. Drag-and-drop or click-to-browse PDF upload
29. Server-side PDF statement parsing with detected transactions
30. Editable preview table (date, description, category, type, amount)
31. Per-row include/exclude checkboxes + select-all
32. Per-row category and type override with category/type coupling
33. Per-row removal
34. Running totals for expenses and income across selected rows
35. Bank-name badge when the parser detects one
36. Parser warning banner
37. Bulk save via `POST /import/expenses` with a success count message
38. "Start over" reset

**Account & settings**
39. Register with name/email/password/confirm
40. Login
41. Logout (3 entry points)
42. Update display name (also patches the cached `user` in `localStorage`)
43. Change password
44. Delete account with typed confirmation + native confirm dialog
45. Custom category management (add/remove, tags UI)
46. Custom UPI app management (add/remove, tags UI)
47. Theme preference: System / Light / Dark, persisted, live-switching, OS-change-aware

**Shell, UX**
48. Sticky frosted-glass navbar with brand, links, theme picker, account menu, hamburger
49. Mobile drawer with nav, settings, theme grid and logout
50. Body scroll lock while the drawer or modal is open
51. Escape closes menus, drawer and modal
52. Outside-click closes menus
53. Modal focus trap + focus restore
54. Dismissible error banners
55. 4-row shimmer skeleton for the list
56. Empty states for list and charts
57. Mobile FAB (visible < 768 px; the header button is hidden < 768 px)
58. Full dark/light theming including body background gradients
59. `prefers-reduced-motion` support
60. Visible `:focus-visible` rings with form-specific overrides
61. Web-font loading (Plus Jakarta Sans 400–800) with `system-ui` fallbacks

**Explicitly absent** (so the port does not invent them): budgets, recurring items, export/CSV,
server-side pagination, sorting controls, free-text search, push notifications, offline mode,
PWA/service worker, i18n, avatars uploaded from disk, multi-currency, dark-mode per-component overrides.

---

## 9. Every UI state

| State | Where | Presentation |
| --- | --- | --- |
| Loading list | `ExpenseList` | 4 shimmer `.skeleton-row`s, `aria-hidden="true"` |
| Loading profile | `Profile` | `⏳` + `Loading your profile…` in an `.empty-state` |
| Loading / parsing PDF | `Import` | Button label `Parsing statement…` + `.import-progress` row with spinner and `Reading statement…` |
| Loading (generic button) | all submit buttons | `.btn-spinner` + label change, button `disabled` |
| Empty list (no filters) | `ExpenseList` | `💸` / `No expenses yet` / `Click "Add Expense" to record your first expense and start tracking your spending.` + `+ Add your first expense` button |
| Empty list (filtered) | `ExpenseList` | `🔍` / `No matching expenses` / `Try adjusting your filters or date range to find what you are looking for.` (no CTA) |
| Empty charts | `Charts` | `📊 No expenses for this time range`, `💳 No expenses for this time range`, `📈 No spending in this period yet` |
| Error | Dashboard, Login, Register, ExpenseForm, Profile, Import | `.alert.alert-error[role=alert]`; Dashboard + Import have a `.alert-dismiss` `×`; others persist until the next submit |
| Success | Profile, Import | `.alert.alert-success` (`role="status"` on Profile, `role="alert"` on Import); Profile auto-clears after 4 s, Import clears on `reset()` |
| Warning | Import | `.alert.alert-warning` (amber, dark-mode override) |
| Disabled | submit buttons, `Apply` in Custom range, import button | `:disabled { opacity: .55; cursor: not-allowed }` |
| Hover | everything | `:hover` rules on buttons, rows, cards, chips, pills, nav links, dropdown items, category chips, quick amounts |
| Focus | all interactive | `:focus-visible { outline: 2px solid var(--ring) }`; inputs/selects/textareas instead get `border-color: var(--primary)` + `0 0 0 3px var(--primary-glow)` |
| Active nav | Navbar, drawer | `.active` class → `color: var(--primary); background: var(--primary-light)` (desktop) / `font-weight: 700` |
| Modal open | `ExpenseModal` | `.modal-overlay` (fixed, blurred backdrop) + `.expense-modal` |
| Drawer open | `Navbar` | `.mobile-drawer.open` → backdrop fades in, panel slides from `translateX(-105%)` |
| Dropdown open | Navbar | `.theme-dropdown` / `.user-dropdown`, both `scaleIn` 0.18 s, `z-index: 200` |
| Inline delete confirm | `ExpenseList` | `.icon-btn.danger.confirming` → red fill, `pulseGlow` 1.1 s infinite, content becomes `✓`, title `Click again to confirm` |
| Chart filter active | `Charts`, `Dashboard` | `.chart-active-badge` on the card, `.toolbar-filter-badge` with `.badge-clear` in the toolbar, faded slices, ` · filtered` on Total Spent |
| Quick amount active | `ExpenseForm` | `.quick-amount.active` → `primary-light` background + primary border |
| Category/payment/UPI active | `ExpenseForm` | `.category-chip.active`, `.payment-pill.active`, `.upi-chip.active`, `.income-pill.active` |
| Theme option active | Navbar, Profile | `.theme-option.active`, `.drawer-theme-option.active`, `.theme-radio.active` |
| Theme toggle chevron | Navbar | `.user-menu-chevron.up` → `rotate(180deg)` |
| Tags | Profile | `.tag` + `.tag-remove` |
| Danger zone | Profile | `.setting-card.danger` |
| No notifications | — | **No toasts/snackbars, no dialog component, no tooltips.** The `title` attribute is the only native tooltip. The Profile "message" is a static banner, not a floating toast. |

---

## 10. Design system

### 10.1 Fonts
`'Plus Jakarta Sans'` weights **400, 500, 600, 700, 800**, loaded from Google Fonts with
`preconnect` to `fonts.googleapis.com` and `fonts.gstatic.com`.
Body stack: `'Plus Jakarta Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`.
Avatar SVG text uses its own stack: `Arial, Helvetica, sans-serif`.

### 10.2 Meta / document head (`index.html`)
```html
<meta charset="UTF-8" />
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="description" content="A clean, fast expense tracker for tracking daily spending by category and payment method (Cash & UPI)." />
<meta name="theme-color" content="#dc2626" />
<title>Expense Tracker — Smart Spending Insights</title>
<html lang="en">
```

### 10.3 Base
* `box-sizing: border-box` on `*`, `*::before`, `*::after`
* `html { scroll-behavior: smooth }`
* `body { margin: 0; min-height: 100vh; font-size: 14px; line-height: 1.5;
  -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;
  transition: background-color .35s ease, color .35s ease }`
* `#root { min-height: 100vh }`
* `::selection { background: var(--primary-light); color: var(--primary-dark) }`
* `.visually-hidden` utility (used by the Custom date-range labels)
* `:focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; border-radius: 6px }`
* `input:focus-visible, select:focus-visible, textarea:focus-visible { outline: none }`

### 10.4 Light theme — `:root, [data-theme='light']`
```
--primary #dc2626          --primary-dark #b91c1c     --primary-darker #991b1b
--primary-light #fee2e2   --primary-lighter #fef2f2  --primary-glow rgba(220,38,38,.16)
--ring rgba(220,38,38,.45)
--danger #dc2626           --danger-dark #b91c1c      --danger-light #fee2e2
--bg #faf9fb               --bg-elevated #ffffff      --card-bg #ffffff
--card-bg-hover #fef6f6    --surface #f4f3f6          --surface-light #ecebf0
--border #ece8ee           --border-light #d6d1dd     --border-accent rgba(220,38,38,.35)
--text #191820             --text-secondary #4b4857   --text-muted #8a8696
--shadow-xs 0 1px 2px rgba(24,22,31,.05)     --shadow-sm 0 2px 8px rgba(24,22,31,.06)
--shadow-md 0 6px 20px rgba(24,22,31,.08)    --shadow-lg 0 14px 40px rgba(24,22,31,.12)
--shadow-glow 0 6px 22px rgba(220,38,38,.14)
--gradient      linear-gradient(135deg,#dc2626 0%,#e8544a 100%)
--gradient-subtle linear-gradient(135deg,#fef2f2 0%,#fff 100%)
--gradient-dark linear-gradient(145deg,#2b2230 0%,#171419 100%)
--glass rgba(255,255,255,.82)   --glass-border rgba(24,22,31,.08)
--badge-upi-bg #ecfdf5   --badge-upi-text #047857   --badge-upi-border #a7f3d0
--success-bg #ecfdf5     --success-text #047857     --success-border #a7f3d0
color: var(--text); background: var(--bg)
```
Body background (layered radial gradients + base):
```
radial-gradient(ellipse 55% 42% at 12% -5%,  rgba(252,228,228,.6) 0%, transparent 55%),
radial-gradient(ellipse 42% 34% at 95% 105%, rgba(245,232,236,.5) 0%, transparent 55%),
var(--bg)
```

### 10.5 Dark theme — `[data-theme='dark']`
```
--primary #f36a5e          --primary-dark #ef4444     --primary-darker #dc2626
--primary-light rgba(243,106,94,.14)  --primary-lighter rgba(243,106,94,.06)
--primary-glow rgba(243,106,94,.22)   --ring rgba(243,106,94,.5)
--danger #f36a5e           --danger-dark #ef4444      --danger-light rgba(243,106,94,.14)
--bg #0f0f13               --bg-elevated #17171d      --card-bg #1b1b22
--card-bg-hover #23232c    --surface #26262f          --surface-light #2f2f3a
--border #2a2a34           --border-light #3d3d49     --border-accent rgba(243,106,94,.35)
--text #f1f0f4             --text-secondary #a6a3b2   --text-muted #6f6c7c
--shadow-xs 0 1px 2px rgba(0,0,0,.3)      --shadow-sm 0 2px 8px rgba(0,0,0,.35)
--shadow-md 0 6px 20px rgba(0,0,0,.45)     --shadow-lg 0 14px 40px rgba(0,0,0,.55)
--shadow-glow 0 6px 22px rgba(243,106,94,.18)
--gradient      linear-gradient(135deg,#f36a5e 0%,#ef4444 100%)
--gradient-subtle linear-gradient(135deg,rgba(243,106,94,.08) 0%,rgba(243,106,94,.02) 100%)
--gradient-dark linear-gradient(145deg,#23202a 0%,#131318 100%)
--glass rgba(19,19,24,.85)   --glass-border rgba(255,255,255,.07)
--badge-upi-bg rgba(16,185,129,.12)   --badge-upi-text #34d399   --badge-upi-border rgba(16,185,129,.3)
--success-bg rgba(16,185,129,.12)     --success-text #34d399     --success-border rgba(16,185,129,.3)
```
Body background:
```
radial-gradient(ellipse 60% 45% at 8% -5%,  rgba(243,106,94,.07) 0%, transparent 55%),
radial-gradient(ellipse 45% 32% at 95% 105%, rgba(185,28,28,.06) 0%, transparent 45%),
var(--bg)
```
Theme attribute is written to `<html>` (`document.documentElement`).

### 10.6 Keyframes (8)
`fadeInUp` (translateY 14px→0), `fadeIn` (opacity), `scaleIn` (scale .96→1),
`slideInDown` (translateY -12px→0), `slideInLeft` (translateX -28px→0),
`float` (±4px Y), `pulseGlow` (box-shadow ring 0→8px transparent), `shimmer` (background-position
-400px→400px), `spin` (0→360deg). Used by:
`.page-header` fadeInUp, `.auth-page` fadeIn, `.auth-card` scaleIn, `.navbar` slideInDown,
`.user-dropdown`/`.theme-dropdown`/`.tag`/`.expense-modal` scaleIn, `.skeleton::after` shimmer,
`.btn-spinner` spin, `.icon-btn.confirming` pulseGlow,
`.summary-card`/`.time-range-tabs`/`.chart-card`/`.expense-form-container`/
`.expense-list-container`/`.expense-item`/`.setting-card`/`.profile-*`/`.import-preview` fadeInUp,
`.toolbar-filter-badge` fadeInUp.
(`slideInLeft` and `float` are declared but currently unused by any rule — preserved anyway.)

`@media (prefers-reduced-motion: reduce)` zeroes animation duration/iteration and transition
duration for `*`, `*::before`, `*::after` and sets `scroll-behavior: auto`.

### 10.7 Staggered animation delays (must be preserved)
`.summary-card:nth-child(2) .06s`, `:nth-child(3) .12s` ·
`.chart-card:nth-child(2) .08s`, `:nth-child(3) .16s` ·
`.setting-card:nth-child(2) .05s`, `:nth-child(3) .1s`, `:nth-child(4) .15s`, `:nth-child(5) .2s` ·
`.time-range-tabs` `fadeInUp … 0.18s` · `.expense-form-container` `0.1s` ·
`.expense-list-container` `0.2s` · list rows `animation-delay: min(index * 0.05s, 0.5s)` (inline style).

### 10.8 Breakpoints and their rules
| Max width | Rules |
| --- | --- |
| `1100px` | `.charts-section` → 1 column; `.chart-card.wide` → `grid-column: 1` |
| `860px` | `.app-main` padding `20px 18px 90px`; `.navbar` height 58px, padding `0 14px`; `.dashboard-summary` `repeat(auto-fit, minmax(160px,1fr))` gap 12px; `.summary-card` padding `16px 18px` radius 15px; `.summary-value` 21px; `.profile-stats` gap 10px; `.user-menu-name` hidden; `.form-row` column; `.expense-toolbar` column/stretch; `.toolbar-filters` wrap + `flex:1` selects; `.expense-item` padding `12px 14px`; `.btn` padding `10px 17px` font-size 12px |
| `768px` | `.navbar-links` hidden; `.hamburger` shown; `.page-header` `align-items: center`; `.page-header .btn` hidden; `.fab` shown |
| `640px` | `.dashboard-summary` 2 cols gap 10px; `.summary-card.highlight` full-width; `.summary-card` padding `14px 16px` radius 14px gap 1px; `.summary-icon` 36px/16px; `.summary-value` 19px; `.time-range-tabs` gap 2px; `.tab-btn` `flex: 1 1 calc(33% - 4px)` padding `8px` font-size 11px centered; `.date-range-inputs` full width, wrap, `justify-content: flex-end`; `.charts-section` gap 14px; `.chart-card` padding 16px; form/list containers padding 18px radius 15px; `.expense-form h2`/`.expense-toolbar h2` 15px; `.profile-header` column/center; `.profile-avatar-img` 76px (`!important`); `.profile-stats` 1 column gap 8px; `.stat-card` row layout with right-aligned last child; `.theme-radios` 1 column; `.setting-form` column; `.setting-form input` `min-width: 0`; `.setting-card` padding `18px`; `.payment-pill` padding `11px 8px` font-size 12px; `.expense-item` padding `11px 12px` gap 10px; `.expense-info` gap 10px; `.expense-avatar` 40px/15px; `.expense-right` gap 8px; `.expense-amount` 14px; `.expense-description` `max-width: 46vw`; `.auth-page` padding `24px 16px`; `.auth-card` padding `30px 22px 26px` radius 18px; `.auth-card h1` 21px; `.expense-modal` padding `20px 18px` `max-height: 92vh` radius 17px; `.amount-wrap input` 24px, padding `14px 14px 14px 44px`; `.category-grid` `minmax(78px, 1fr)` |
| `380px` | `.summary-card.highlight .summary-value` 20px; `.expense-actions` column |

### 10.9 Layout & component style inventory (`App.css`, 2906 lines — all 214 class rules ported)

Layout: `.app-main` (max-width 1180px, padding `28px 24px 110px`, auto margins) ·
`.page-header` / `.page-title` (`clamp(1.55rem, 3vw, 1.9rem)`, weight 800, `-0.02em`) /
`.page-subtitle` (13px, muted)
Skeleton: `.skeleton`, `.skeleton::after`, `[data-theme='dark'] .skeleton::after`,
`.skeleton-row`, `.sk-circle` (44px/13px), `.sk-line` + `.short` (90px) + `.mid` (160px), `.sk-bar` (70×22px)
Navbar: `.navbar`, `.navbar-inner`, `.navbar-brand`, `.navbar-logo` (34px, gradient, rotate −6deg on hover),
`.navbar-links`, `.navbar-nav-link` (+`.active`), `.nav-link-icon`, `.navbar-right`
Avatar: `.avatar-img`
User menu: `.user-menu`, `.user-menu-btn`, `.user-menu-name` (max-width 130px, ellipsis),
`.user-menu-chevron` (+`.up`), `.user-dropdown`, `.user-dropdown-header`, `.user-dropdown-id`,
`.dropdown-item` (+`.danger`), `.dropdown-icon`, `.dropdown-divider`
Theme picker: `.theme-picker`, `.theme-toggle` (40px), `.theme-dropdown` (min-width 164px),
`.theme-option` (+`.active`), `.theme-option-icon`, `.theme-option-label`, `.theme-check`
Hamburger/drawer: `.hamburger` (+`.active` bar transforms), `.mobile-drawer` (+`.open`),
`.drawer-backdrop`, `.drawer-panel` (`width: min(320px, 84vw)`, `translateX(-105%)`),
`.drawer-header`, `.drawer-id`, `.drawer-close`, `.drawer-nav`, `.drawer-item` (+`.active`),
`.drawer-item-icon`, `.drawer-section-title`, `.drawer-theme`, `.drawer-theme-option` (+`.active`),
`.drawer-theme-icon`, `.drawer-footer`
Buttons: `.btn`, `:active:not(:disabled)`, `:disabled`, `.btn-primary`, `.btn-ghost`, `.btn-danger`,
`.btn-block`, `.btn-spinner`, `.btn-sm`
Alerts: `.alert`, `.alert-dismiss`, `.alert-error` (+dark), `.alert-success`, `.alert-warning` (+dark)
Auth: `.auth-page` (`min-height: calc(100dvh - 64px)`), `.auth-card` (max-width 436px, radius 22px),
`.auth-brand`, `.auth-brand-logo` (52px), `.auth-brand-name`, `.auth-card h1`, `.auth-subtitle`,
`.auth-footer`
Forms: `.form-group`, `label`, `.field-req`, `input`/`select` (focus ring), custom select arrow,
`.form-row`, `.form-hint`
Dashboard: `.dashboard`, `.dashboard-summary`, `.summary-card` (+`.highlight` with `::after` glow),
`.summary-icon`, `.summary-label`, `.summary-value`, `.summary-count`
Time filter: `.time-range-tabs`, `.tab-btn` (+`.active`), `.date-range-inputs` (+ input/span)
Body/cards: `.dashboard-body`, `.card`
Charts: `.charts-section`, `.chart-card` (+`.wide`), `.chart-card h3` (+`.chart-icon`),
`.chart-title`, `.chart-type-switch`, `.chart-type-btn` (+`.active`), `.chart-placeholder`,
`.chart-placeholder-icon`, `.chart-active-badge`, `.toolbar-filter-badge`, `.badge-clear`,
plus the recharts overrides `.recharts-default-tooltip`, `.recharts-tooltip-label`,
`.recharts-legend-item-text`, `.recharts-cartesian-grid line` (will be re-pointed at chart.js
classes, since recharts DOM classes do not exist in the port)
Expense form: `.expense-form-container`, `.expense-form h2` (+`.form-icon`), `.cancel-edit`,
`.amount-wrap`, `.amount-currency`, `.amount-wrap input`, `.quick-amounts`, `.quick-amount` (+`.active`),
`.category-grid`, `.category-chip` (+`.active`), `.category-chip-icon`, `.category-chip-label`,
`.payment-toggle`, `.payment-pill` (+`.active`, `.pm-icon`), `.upi-app-grid`, `.upi-chip` (+`.active`)
List: `.expense-list-container`, `.expense-toolbar`, `.expense-toolbar h2`, `.toolbar-filters`,
`.expense-list`, `.expense-item`, `.expense-info`, `.expense-avatar`, `.expense-description`,
`.expense-meta`, `.expense-category`, `.expense-date`, `.payment-badge` (+`.cash`, `.upi`, `.bank`),
`.expense-right`, `.expense-amount`, `.expense-actions`
Empty: `.empty-state`, `.empty-state-icon`, `.empty-state h3`, `.empty-state p`, `.empty-state .btn`
Profile: `.profile-page`, `.profile-header`, `.profile-avatar-img`, `.profile-id`, `.profile-since`,
`.profile-stats`, `.stat-card`, `.stat-icon`, `.stat-value` (+`.long`), `.stat-label`,
`.settings-section`, `.settings-section > h2`, `.section-icon`, `.setting-card` (+`.danger`),
`.setting-card-header`, `.setting-card-icon`, `.setting-card h3`, `.setting-desc`, `.setting-form`,
`.setting-form .form-group`, `.setting-form input[type=text|password|email]`, `.setting-form-grid`,
`.theme-radios`, `.theme-radio` (+`.active`), `.theme-radio-label`, `.theme-radio-desc`,
`.tag-list`, `.tag`, `.tag-remove`, `.setting-empty`
Modal/FAB: `.fab`, `.modal-overlay`, `.expense-modal`, `.modal-header`, `.modal-title`,
`.modal-title-icon`, `.modal-close`
Icon buttons: `.icon-btn` (+`.danger:hover`, `.confirming`)
Scrollbar: `::-webkit-scrollbar` (10px), `::-webkit-scrollbar-track`, `::-webkit-scrollbar-thumb` (+hover)
Import: `.import-page`, `.dropzone` (+hover), `.dropzone-icon`, `.dropzone h3/p`, `.import-progress`,
`.import-preview`, `.import-preview-header`, `.import-file-info`, `.import-file-icon`,
`.import-file-meta`, `.bank-badge`, `.import-totals`, `.import-total`, `.import-total span/strong`,
`.import-total.entry-expense`, `.import-total.entry-income`, `.import-table-wrap`, `.import-table`,
`.import-table th/td`, `.row-unselected`, `.col-check`, `.col-amount`, `.col-remove`,
`.import-table input[type=checkbox]` (`accent-color: var(--primary)`), table inputs/selects,
`select.type-income`, `select.type-expense`, `.amount-income`, `.amount-expense`, `.import-actions`
Income/bank: `.summary-income`, `.income-item`, `.payment-badge.bank` (+dark), `.category-income`,
`.income-pill.active`, `.income-hint`

Notable spacing/radii conventions: cards `18px` radius, inner cards `16px`, chips `12–13px`,
pills/dropdowns `14px`, modal `20px`, auth card `22px`, buttons `12px` (10px for `.btn-sm`),
inputs `12px`, FAB `50%` circle `56px`, `.icon-btn` `10px`.

---

## 11. Utilities, helpers, constants, enums, types, formatters

| Name | Source | Purpose / exact behaviour |
| --- | --- | --- |
| `CATEGORY_ICONS` | `utils/expenseIcons.js` | `{ Food:'🍽️', Transport:'🚗', Housing:'🏠', Utilities:'💡', Entertainment:'🎬', Healthcare:'💊', Shopping:'🛍️', Education:'📚', Other:'📦' }` |
| `FALLBACK_ICONS` | `utils/expenseIcons.js` | `['📦','🧾','💼','🎁','☕','🐾','🏖️','🎮','📈','🛒']` |
| `getCategoryIcon(category)` | `utils/expenseIcons.js` | falsy → `'📦'`; known → mapped; otherwise `hash = sum(charCodeAt)` of the whole string, `FALLBACK_ICONS[hash % 10]` |
| `formatCurrency` (3 copies: Dashboard, ExpenseList, Profile) | inline | `Intl.NumberFormat('en-IN', { style:'currency', currency:'INR', maximumFractionDigits: 2 })` |
| `formatCurrency` (Charts copy) | `Charts.jsx` | same but `maximumFractionDigits: 0` |
| `formatDate` | `ExpenseList.jsx` | `en-IN`, `day:'numeric', month:'short', year:'numeric'` |
| `formatJoinDate` | `Profile.jsx` | `en-IN`, `day:'numeric', month:'long', year:'numeric'`; `'—'` when falsy |
| `capitalise` | `Dashboard.jsx` | `str.charAt(0).toUpperCase() + str.slice(1)` |
| `paymentLabel` | `ExpenseList.jsx` | `upi` → `📱 ${upiApp \|\| 'UPI'}`, `bank` → `🏦 ${bankName \|\| 'Bank'}`, else `💵 Cash` |
| `toInputDate` | `ExpenseForm.jsx` | ISO date part (`YYYY-MM-DD`) of a date string or today |
| `toDateInput` | `Import.jsx` | same, but returns `''` for falsy/invalid input |
| `getRange` | `TimeFilter.jsx` | see §3.3 |
| `PAYMENT_LABELS` | `Charts.jsx` + `Dashboard.jsx` | `{ cash:'Cash', upi:'UPI', bank:'Bank' }` |
| `QUICK_AMOUNTS` | `ExpenseForm.jsx` | `[50, 100, 200, 500, 1000]` |
| `RANGE_OPTIONS` | `TimeFilter.jsx` | 5 entries (see §3.3) |
| `THEMES` | `Navbar.jsx` | 3 entries (see §3.2) |
| `DEFAULT_CATEGORIES` | `PreferencesContext.jsx` | 9 entries |
| `DEFAULT_UPI_APPS` | `PreferencesContext.jsx` | 6 entries |
| `emptyPrefs` | `PreferencesContext.jsx` | defaults + empty custom lists |
| `STATS` | `Profile.jsx` | 3 stat descriptors (see §3.8) |
| `formatCurrency` (charts axis) | `Charts.jsx` | `v => \`₹${(v / 1000).toFixed(0)}k\`` |
| `FOCUSABLE` selector | `ExpenseModal.jsx` | focus-trap selector |
| `CHART_CURSORS` | `Charts.jsx` | `{ cursor: 'pointer' }` |
| Env vars | `.env` / `.env.production` | `VITE_API_URL`, `VITE_BASE`, `DEV_API_TARGET` (dev only) |

Target-project types to introduce (no `any`): `AuthUser`, `UserProfile`, `ProfileStats`,
`Preferences`, `Expense`, `ExpenseType`, `PaymentMethod`, `ExpenseDraft`, `ExpensesResponse`,
`SummaryResponse`, `ParsedTransaction`, `TransactionSide`, `ParseResponse`,
`ImportEntry`, `ImportResponse`, `DateRange`, `ChartFilterType`, `ChartFilter`,
`ThemePreference`, `ResolvedTheme`, `ImportTotal`.

---

## 12. Assets

| File | Type | Usage |
| --- | --- | --- |
| `public/favicon.svg` | SVG (Vite logo mark, 48×46, single line, ~2 KB) | `<link rel="icon" type="image/svg+xml">` |

That is the **only** static asset file. Everything else visual is:
* inline SVG (edit/trash icons, the `+` icons in the header button and the FAB)
* data-URI SVG (avatars, generated at runtime)
* emoji (all category/payment/stat/theme icons)
* Google Fonts (remote, two `<link>` tags)
* CSS gradients (logo, highlights, skeleton shimmer, body backgrounds)

---

## 13. Existing tests

**None.** The source project has no test runner, no test script, no test files, no testing
dependencies and no CI configuration. Therefore nothing to port — but per the brief, new tests
will be written for the services, stores, guard and key components (Vitest, Angular 21 default),
plus unit tests for every ported pure utility (`getCategoryIcon`, the three formatters,
`getRange`, the totals reducers, `toEntry`, `capitalise`).

---

## 14. PARITY CHECKLIST

Each item must be marked `PASS` with the implementing target file during Phase 4.

**Stack & project setup**
1. [x] Angular 21 CLI scaffold, standalone-only, TypeScript `strict`, zoneless (no `zone.js`)
2. [x] `OnPush` on every component
3. [x] Signals only (`signal` / `computed` / `effect` / `linkedSignal`), no class-property state for view data
4. [x] `input()` / `output()` signal APIs, no `@Input`/`@Output` decorators
5. [x] Built-in control flow `@if` / `@for … track` / `@switch`, no `*ngIf`/`*ngFor`/`ngSwitch`
6. [x] `inject()` DI everywhere, no constructor parameter injection
7. [x] Functional interceptor (`HttpInterceptorFn`) replacing both axios interceptors
8. [x] `provideHttpClient(withInterceptors([...]))`
9. [x] Lazy routes via `loadComponent`, `withComponentInputBinding()`
10. [x] Functional auth guard
11. [x] Wildcard `**` → redirect to `/` with `replaceUrl`
12. [x] Reactive Forms (Signal Forms correctly rejected as non-stable in v21)
13. [x] Vitest configured; `ng test` runs
14. [x] ESLint (flat config + `angular-eslint`) configured; `ng lint` runs clean
15. [x] Folder layout `core/` `shared/` `features/<feature>/` `layout/`
16. [x] `environment.ts` / `environment.development.ts` + `fileReplacements`
17. [x] `baseHref` configurable to mirror `VITE_BASE`
18. [x] Dev-server `/api` proxy mirroring `vite.config.js`

**Design system / global styles**
19. [x] `index.css` equivalent: box-sizing, html/body base, `::selection`, `.visually-hidden`, `:focus-visible`
20. [x] Full light token set on `:root` / `[data-theme='light']`
21. [x] Full dark token set on `[data-theme='dark']`
22. [x] Layered radial-gradient body backgrounds for both themes
23. [x] All 9 `@keyframes` preserved
24. [x] `prefers-reduced-motion` block
25. [x] Full `App.css` equivalent — every one of the ~214 class rules
26. [x] All 5 breakpoints (1100 / 860 / 768 / 640 / 380) with every nested rule
27. [x] All `nth-child` animation delays preserved
28. [x] `::-webkit-scrollbar` styling
29. [x] Plus Jakarta Sans 400–800 loaded with `preconnect`
30. [x] `lang="en"`, title, description meta, `theme-color` meta, viewport meta
31. [x] `favicon.svg` copied and served

**Global state**
32. [x] Auth store: `user`, `loading`, `login`, `register`, `logout` with identical semantics
33. [x] Auth bootstrap: read `user` synchronously; if `token && !user` fetch profile once, silently
34. [x] Login stores the whole response (with token) as `user` in `localStorage`
35. [x] Theme store: `system|light|dark`, `resolved`, `localStorage['expense-tracker-theme']`
36. [x] Theme writes `data-theme` on `<html>`; system mode listens to `prefers-color-scheme` changes
37. [x] Preferences store: `emptyPrefs` defaults, reset on logout, fetch on user change with cancel guard
38. [x] Preferences mutations return the refreshed preferences object and update the store
39. [x] `encodeURIComponent` on preference-delete path params

**API layer**
40. [x] Base URL from environment, identical dev/prod values
41. [x] Auth request interceptor adds `Authorization: Bearer <token>`
42. [x] Response interceptor clears `token` + `user` on `401` and re-rejects
43. [x] `POST /auth/login` with `'Login failed'` fallback
44. [x] `POST /auth/register` with `'Registration failed'` fallback
45. [x] `GET /auth/profile` (boot, silent) + (Profile, `'Failed to load profile'`)
46. [x] `PUT /auth/profile { name }` + `localStorage.user` patch + `'Failed to update name'`
47. [x] `PUT /auth/password` + `'Failed to change password'`
48. [x] `DELETE /auth/account` → logout → `/register`
49. [x] `GET /auth/preferences`, silent on error
50. [x] `POST|DELETE /auth/preferences/categories`, `POST|DELETE /auth/preferences/upi-apps`
51. [x] `GET /expenses` with `category`/`month`/`startDate`/`endDate` + `'Failed to load expenses'`
52. [x] `GET /expenses/summary` with only `startDate`/`endDate`, errors swallowed
53. [x] `POST /expenses` + prepend + `'Failed to add expense'`
54. [x] `PUT /expenses/:id` + replace-by-`_id` + `'Failed to update expense'`
55. [x] `DELETE /expenses/:id` + remove + `'Failed to delete expense'`
56. [x] `POST /import/parse` multipart with `Content-Type: multipart/form-data` + `'Failed to parse the PDF. Please try another file.'`
57. [x] `POST /import/expenses` payload shape incl. `bankName: null` + `'Failed to import entries'`
58. [x] `err.response?.data?.message || fallback` semantics everywhere
59. [x] No retries, no timeouts, no extra headers beyond the source

**Routing & guard**
60. [x] `/login`, `/register` public
61. [x] `/`, `/profile`, `/import` guarded → redirect to `/login` with `replaceUrl`
62. [x] `**` → redirect to `/`
63. [x] Navbar rendered above the router outlet on every route
64. [x] `<main class="app-main">` wrapper on every route
65. [x] `basename` support equivalent to `VITE_BASE`

**Login**
66. [x] `.auth-page` / `.auth-card` / brand logo `₹` + "Expense Tracker"
67. [x] `h1` "Welcome Back", subtitle copy
68. [x] Email + password fields with exact ids/types/placeholders/autocomplete
69. [x] Spinner + `Logging in…` / `Log In`
70. [x] Footer "Don't have an account? Sign up" → `/register`
71. [x] Error alert with server or `'Login failed'` message
72. [x] `navigate('/')` on success

**Register**
73. [x] `h1` "Create Account", subtitle copy
74. [x] Name / Email / Password (minlength 6) / Confirm fields with exact attributes
75. [x] `.form-row` two-column password pair
76. [x] `'Passwords do not match'` check before request
77. [x] `'Password must be at least 6 characters'` check before request
78. [x] Spinner + `Creating account…` / `Sign Up`
79. [x] Footer "Already have an account? Log in" → `/login`
80. [x] `navigate('/')` on success

**Navbar**
81. [x] Sticky frosted navbar, `slideInDown`, glass background/border tokens
82. [x] Brand `₹` logo + "Expense Tracker" → `/`, closes drawer
83. [x] Desktop links Dashboard/Import/Profile with icons, `active` only when logged in
84. [x] Theme toggle with current-theme icon, `aria-label`/`aria-haspopup`/`aria-expanded`
85. [x] Theme dropdown `role=menu`, `menuitemradio`, `aria-checked`, `✓` marker
86. [x] Opening the theme menu closes the user menu and vice-versa
87. [x] Account button with avatar(34), name, rotating chevron
88. [x] Account dropdown with header, "My Profile", "Settings" (`/profile#settings`), divider, Logout
89. [x] Logout → close all → logout → `/login`
90. [x] Logged-out state: `Login` ghost + `Sign Up` primary small buttons
91. [x] Hamburger with 3 bars → X, `aria-label="Open menu"`, `aria-expanded`
92. [x] Drawer: backdrop, left slide-in panel, scroll lock, `aria-hidden`
93. [x] Drawer header with avatar/name/email or "Menu", close button
94. [x] Drawer nav (auth-aware) and "Settings" section
95. [x] Drawer theme 3-up grid + `.active`
96. [x] Drawer footer danger Logout button (only when logged in)
97. [x] Outside-click closes menus
98. [x] Escape closes menus + drawer
99. [x] Body scroll lock while drawer open

**Avatar**
100. [x] Initials from first two words, `?` fallback, uppercase
101. [x] Deterministic hue from char-code hash; second stop +45°
102. [x] Exact SVG structure, `rx=50`, `dominant-baseline=middle`, Arial stack, white 96% text
103. [x] `photo` override, `size` → inline width/height, `className` merge, `alt` fallback `'avatar'`

**Dashboard**
104. [x] `.dashboard` + page header, greeting from first name (capitalised), fallback copy
105. [x] Header "Add Expense" button with `+` SVG
106. [x] Five summary cards in order, with `.highlight` treatment and radial glow
107. [x] Exact count copy: `N expense(s)`, `N entr{y|ies}`, `N payment(s)`, ` · filtered`
108. [x] `TimeFilter` inside the summary grid, full width
109. [x] Dismissible error banner
110. [x] Charts section wired to `summary` + `chartFilter` + `handleChartFilter`
111. [x] Expense list container with toolbar
112. [x] Category `<select>` with `All Categories` + 9 hardcoded options
113. [x] `<input type="month">` filter
114. [x] Toolbar filter badge + clear button
115. [x] `hasFilters` = `filter || month || chartFilter`
116. [x] Two-click delete confirmation with 2.5 s timeout
117. [x] Per-row edit/delete actions with `title` + `aria-label`
118. [x] Row animation delay `min(index * 0.05, 0.5)`
119. [x] Income rows: `income-item`, `+` prefix, `amount-income`, green category
120. [x] `paymentLabel` strings incl. bank fallback
121. [x] Mobile FAB
122. [x] Modal wired: add vs edit, `submitting`
123. [x] Totals: `totalAmount`, `totalIncome`, `cashTotal`, `upiTotal`, `bankTotal` over expenses only
124. [x] Chart filter toggling (same slice twice clears) and cross-filtering of the list
125. [x] Time-range change clears the month filter
126. [x] Refetch on `filter`/`month`/`dateRange` change only
127. [x] Summary refetch after add/edit/delete but not on filter/month change (range-driven)

**Charts**
128. [x] `null` when no summary
129. [x] By Category card with `📊` heading, active badge, Pie/Bar switch
130. [x] Doughnut 60/100 radius, `paddingAngle 3`, per-slice colours/opacity/stroke
131. [x] Legend with themed label colour
132. [x] Horizontal bar mode with `₹Xk` axis formatting, `3 3` grid, `[0,6,6,0]` radius
133. [x] By Payment Method card with `💳`, percentage labels, method-specific colours
134. [x] Daily Trend wide card with gradient area, `#ef4444` stroke 2.5
135. [x] Custom themed tooltip markup and styling
136. [x] Three distinct empty-state placeholder messages
137. [x] All 8 light + 8 dark palette colours, grid/tick/legend/tooltip/stroke theme tokens
138. [x] `fadedOpacity` 0.35 for non-active slices
139. [x] Slice/bar click → `onFilterChange('category'|'payment', value)`
140. [x] `ResponsiveContainer` equivalent at height 260, width 100%

**TimeFilter**
141. [x] 5 tabs with exact labels and `aria-pressed`
142. [x] Default active tab = `month`
143. [x] Today = local midnight → now
144. [x] Week = Monday local midnight → now
145. [x] Month = 1st of month local midnight → now
146. [x] Year = Jan 1 local midnight → now
147. [x] Custom tab emits `{ null, null }` until Apply
148. [x] Custom inputs with visually-hidden labels and the "to" separator
149. [x] Apply disabled until both dates set; end date extended to `T23:59:59`

**Expense form**
150. [x] Create and edit modes from one component
151. [x] `noValidate`, manual validation, single error banner
152. [x] `'Add a short description and the amount'` then `'Amount must be greater than zero'`
153. [x] Amount hero input: `₹` prefix, `type=number`, `min=0`, `step=0.01`, placeholder `0`, `autoFocus`
154. [x] 5 quick amounts with `.active` state
155. [x] Description placeholder switches for income/expense
156. [x] Type radiogroup (Expense / Income) with `income-pill` styling
157. [x] Category icon grid from preferences with per-category emoji
158. [x] Payment radiogroup (Cash / UPI) and conditional UPI app grid
159. [x] Income hint banner with exact copy
160. [x] Date field defaulted to today, `required`
161. [x] Submit label logic: Saving… / Save Changes / Add Income / Add Expense
162. [x] Payload shape differs for income (no `upiApp`, `paymentMethod` forced to `bank`)

**Expense list**
163. [x] Skeleton: 4 rows with circle/mid/short/bar, `aria-hidden`
164. [x] Empty states with filter-aware icon, heading, body and conditional CTA
165. [x] Row markup: avatar, description (`title`), category, payment badge, date
166. [x] Amount rendering with `+` for income and tabular-nums
167. [x] Edit button label/aria; delete button confirm state swap to `✓`
168. [x] Delete confirm window of 2500 ms

**Expense modal**
169. [x] Rendered only when `open`
170. [x] `role=dialog`, `aria-modal=true`, `aria-labelledby`
171. [x] Title `✏️ Edit Expense` / `✨ Add Expense`
172. [x] Close `×` button; overlay click closes; inner click does not
173. [x] Escape closes
174. [x] Body scroll lock while open
175. [x] Focus first focusable on open, restore previous focus on close
176. [x] Tab / Shift+Tab focus trap
177. [x] `max-height: 90vh` with internal scroll

**Profile**
178. [x] Loading state `⏳ Loading your profile…`
179. [x] Header with 84px avatar, name, email, `Member since {long date}`
180. [x] Three stat cards with exact labels/icons/formatting (`—` for missing top category)
181. [x] Auto-clearing message banner (4000 ms), `role=alert` / `role=status`
182. [x] `#settings` anchor target
183. [x] Update Name card with localStorage `user` patch
184. [x] Appearance card with 3 theme radios, labels and descriptions
185. [x] Custom Categories card: add with duplicate guard, `maxlength 24`, tag list, empty copy
186. [x] Custom UPI Apps card: same shape
187. [x] Change Password card: 3-field grid, mismatch guard, field reset on success
188. [x] Session card with bare `logout()` (no navigation)
189. [x] Danger Zone: typed `delete` confirmation + `window.confirm` dialog
190. [x] `.setting-card` stagger delays

**Import**
191. [x] Page header copy and `.import-page` class (also `.dashboard`)
192. [x] Dropzone with dragover/drop handlers and exact copy
193. [x] Hidden `input[type=file][accept="application/pdf,.pdf"]` + `⌕  Choose a PDF file`
194. [x] Parsing state: `Parsing statement…` + `Reading statement…` row
195. [x] Error banner (dismissible) and success banner
196. [x] Preview header: file icon, file name, bank badge, transaction count
197. [x] Expense / Income totals for selected rows
198. [x] Parser warning banner
199. [x] Preview table: 7 columns, exact class names and select-all behaviour
200. [x] Row editing for date/description/category/type + type↔category coupling
201. [x] Per-row include checkbox, remove button, income/expense amount colouring
202. [x] `Start over` reset and file input clearing
203. [x] Import button label `📥 Import N entry/entries`, disabled while importing or empty
204. [x] Success message `Imported N entry/entries successfully.`
205. [x] `categoryOptions` includes `Income` only when a row is income

**Accessibility**
206. [x] All original `aria-label`s, `role`s, `aria-*` states preserved
207. [x] `:focus-visible` rings and form focus overrides
208. [x] Focus trap and focus restore in the modal
209. [x] Keyboard Escape / outside-click / body scroll lock
210. [x] `aria-hidden` on skeleton rows, drawer and inactive chart placeholders

**Quality gates**
211. [x] No `any` anywhere; strict templates
212. [x] No TODOs, stubs, placeholder handlers or mock data
213. [x] No duplicated logic (formatters, totals, labels extracted once)
214. [x] Production `ng build` succeeds with no errors
215. [x] `ng test` passes
216. [x] `ng lint` passes with no errors
217. [x] Original project untouched (verified by checksum comparison)

> Note: no porting work modified the source tree (read-only access throughout the port).
> The source repo carries **pre-existing** working-tree diffs vs its own HEAD
> (debug `console.log` lines in `src/App.jsx`, `src/utils/api.js`, `vite.config.js`
> and a `.env` tweak). These predate the Angular port and were left as found.

---
