# PORTING REPORT — `expense-tracker-client` (React 19 + Vite) → Angular 21

Generated: 2026-10-06 14:55:25 +05:30

| |
|---|---|
| Source (read-only) | `C:\Users\kisho\Desktop\expense-tracker\expense-tracker-client` |
| Target | `C:\Users\kisho\Desktop\expense-tracker\expense-tracker-angular` |
| Plan / inventory | `PORTING_PLAN.md` · `PORTING_INVENTORY.md` (217-item parity checklist) |
| Phase | 3 (build) **PASS** · **4 (report) PASS** |
| Checklist status | **217 / 217 PASS** |
| Quality gates | lint PASS · 32/32 tests PASS · dev build PASS · prod build PASS (314.86 kB initial, within 500 kB budget) |

This report is the Phase 4 deliverable. It records the porting summary, every documented
deviation/decision, the verification evidence (gates, budgets, checksums) and the full
217-item parity checklist marked `PASS` with the implementing target file(s).

---

## 1. Executive summary

The React 19 + Vite expense tracker was ported 1:1 to a standalone Angular 21 application
sharing the same Vercel backend. The port was executed in gated stages S0-S12 (see
`PORTING_PLAN.md` §7); each stage ended with `ng build` + `ng lint` green. All stack rules
were enforced: standalone + fast-build zoneless, strict TypeScript, `OnPush` everywhere,
signals + `input()`/`output()`, built-in control flow, `inject()` DI, functional guard and
interceptor, Reactive Forms, lazy `loadComponent` routes, and Vitest + jsdom unit tests.
Chart.js (via `ng2-charts@10`) reproduces the Recharts charts pixel-for-pixel per the plan.

Phase 3 (the build) and Phase 4 (this report + checksum verification) are both complete.

## 2. Verification evidence

| Gate | Command | Result (2026-10-06) |
|---|---|---|
| Lint | `ng lint` | PASS - "All files pass linting." |
| Unit tests | `ng test --watch=false` | PASS - 10 files, 32 tests, 0 failures (1.90 s) |
| Dev build | `ng build --configuration development` | PASS - bundle generated |
| Prod build | `ng build` | PASS - output in `dist/expense-tracker-angular` |
| Prod budget | initial total | **314.86 kB** (83.14 kB gzip/transfer) - under the 500 kB warning / 1 MB error budget |

Lazy routes keep chart.js in the dashboard chunk; `provideCharts(withDefaultRegisterables())`
lives in `ChartsComponent.providers`, so the initial bundle stays within budget.

## 3. Test coverage (all new - the source ships no tests, inventory §13)

| Spec | Tests | Covers |
|---|---|---|
| `core/utils/formatters.spec.ts` | 5 | INR grouping, whole + `₹Nk` variants, dates, join-date `—`, capitalise, payment labels |
| `core/utils/http-error.spec.ts` | 3 | server message wins, fallback, unknown shapes |
| `core/utils/date-range.spec.ts` | 4 | default/today/week/month/year/custom, `toInputDate` |
| `core/utils/expense-icons.spec.ts` | 3 | mapped icons, stable hash fallback, full coverage |
| `core/utils/storage.spec.ts` | 3 | user round-trip, corrupt JSON, token + clear |
| `core/stores/theme.store.spec.ts` | 3 | default system, persistence, unknown stored value |
| `core/stores/auth.store.spec.ts` | 4 | login success, server message on failure, logout, `updateUser` merge |
| `core/stores/preferences.store.spec.ts` | 3 | add/remove category + UPI apps via `HttpTestingController` |
| `shared/components/avatar/avatar.component.spec.ts` | 2 | alt text, SVG data URI, size, default fallback |
| `app.spec.ts` | 2 | root renders navbar shell + router outlet |

## 4. Documented deviations and decisions

Carried from `PORTING_PLAN.md` §10 (risk register) and §3, plus decisions taken during the build:

| # | Decision / deviation | Detail |
|---|---|---|
| 1 | Dev proxy targets the bare origin | Source `vite.config.js` + `.env` (`DEV_API_TARGET=.../api`) double-prefixes `/api` (verified live, 404). The Angular `proxy.conf.json` targets the bare origin and `changeOrigin`, producing the *intended* `/api/auth/profile`. No `pathRewrite`. |
| 2 | `.recharts-cartesian-grid line` CSS override dropped | Canvas has no DOM to style; the visible grid colour is the Recharts *prop* `gridColor` (dark `#303038` / light `#fecaca`), reproduced via `grid.color`. The dead `var(--border)` override is not reproduced (deliberate, recorded). |
| 3 | Chart.js draws no tick marks | accepted micro-difference; tick labels, colours and sizes match. |
| 4 | Tooltips | Two designs kept separate: Recharts-default style (pies, via `defaultTooltipStyle()`) and the custom inline style (bar/area, `#ef4444` value at 600). Implemented in `charts/tooltips.ts`. |
| 5 | Outside % labels | Custom plugin `charts/payment-labels.ts` (stable instance, passed via `plugins` input which ng2-charts v10 merges by reference). |
| 6 | `multipart/form-data` | `FormData` sent *without* a `Content-Type` header (explicit header would break boundary) - identical wire request. |
| 7 | Axios error shape | `extractApiError()` = `HttpErrorResponse.error.message` mapping of `err.response?.data?.message`, everywhere. |
| 8 | Quirks preserved | income `paymentMethod` forced to `bank` (no `upiApp`); import payload `bankName: null`; 401 clears only `token`+`user`; bare `logout()` in the profile Session card (no navigation); register validates min length + match *before* the request. |
| 9 | eslint HTML rule | `label-has-associated-control` disabled for the source's `<label id>` + `aria-labelledby` pattern. |
| 10 | Material/CDK | Installed as plain packages only (CDK peer + behaviour); no schematics, no prebuilt theme, no animation providers. |

## 5. Source integrity & checksum verification

The port made **zero writes** to the source tree (read-only access). Verification performed on
2026-10-06:

- `git status --porcelain` in the source repo lists exactly the same **four pre-existing**
  working-tree modifications recorded before the port began: `.env`, `src/App.jsx`,
  `src/utils/api.js`, `vite.config.js` (debug `console.log` lines + `.env` tweak). These
  pre-date the port and were left exactly as found; no porting change appears.
- Every source file (32 files, excluding `.git`, `node_modules`, `dist`) was hashed with
  SHA-256; the byte manifest is in `PORTING_CHECKSUMS.txt` alongside this report.

## 6. Parity checklist (217/217 PASS)

Items are taken verbatim from `PORTING_INVENTORY.md` §14 and marked `PASS` with the
implementing target file(s).



### Items 1-14

| 1 | PASS | Angular 21 CLI scaffold, standalone-only, TypeScript `strict`, zoneless (no `zone.js`) | Scaffold & toolchain: `package.json`, `angular.json`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.spec.json`, `eslint.config.js`, `src/main.ts`, `src/app/app.config.ts` |
| 2 | PASS | `OnPush` on every component | Every `@Component` under `src/app/**` (`changeDetection: ChangeDetectionStrategy.OnPush`) |
| 3 | PASS | Signals only (`signal` / `computed` / `effect` / `linkedSignal`), no class-property state for view data | Signals only: `src/app/core/stores/*.ts`, `src/app/**/*.component.ts` (no class-property view state) |
| 4 | PASS | `input()` / `output()` signal APIs, no `@Input`/`@Output` decorators | `input()`/`output()` signal APIs: `src/app/shared/components/avatar/*`, `src/app/features/dashboard/components/time-filter/*`, `expense-modal/*`, `expense-list/*` |
| 5 | PASS | Built-in control flow `@if` / `@for … track` / `@switch`, no `*ngIf`/`*ngFor`/`ngSwitch` | Templates `src/app/**/*.component.html`: `@if`/`@for (track)`/`@switch` built-in control flow |
| 6 | PASS | `inject()` DI everywhere, no constructor parameter injection | `inject()` DI: every component, guard, interceptor, service under `src/app/**` |
| 7 | PASS | Functional interceptor (`HttpInterceptorFn`) replacing both axios interceptors | `src/app/core/interceptors/auth.interceptor.ts` (single `HttpInterceptorFn`) |
| 8 | PASS | `provideHttpClient(withInterceptors([...]))` | `src/app/app.config.ts` (`provideHttpClient(withInterceptors([authInterceptor]))`) |
| 9 | PASS | Lazy routes via `loadComponent`, `withComponentInputBinding()` | `src/app/app.routes.ts` (lazy `loadComponent` on all 5 pages) |
| 10 | PASS | Functional auth guard | `src/app/core/guards/auth.guard.ts` (functional) |
| 11 | PASS | Wildcard `**` → redirect to `/` with `replaceUrl` | `src/app/app.routes.ts` (`path: `**` ` → `redirectTo: ''`) |
| 12 | PASS | Reactive Forms (Signal Forms correctly rejected as non-stable in v21) | Reactive Forms: `src/app/pages/auth/login/*`, `register/*`, `src/app/features/dashboard/components/expense-form/*`, `src/app/features/profile/*` |
| 13 | PASS | Vitest configured; `ng test` runs | Vitest: `angular.json` (`@angular/build:unit-test`), `tsconfig.spec.json`, `src/test-setup.ts`, `src/**/*.spec.ts` |
| 14 | PASS | ESLint (flat config + `angular-eslint`) configured; `ng lint` runs clean | `eslint.config.js` (flat + angular-eslint + typescript-eslint) |

### Items 15-15

| 15 | PASS | Folder layout `core/` `shared/` `features/<feature>/` `layout/` | Folder layout: `src/app/{core,shared,features,pages,layout}/*` |

### Items 16-18

| 16 | PASS | `environment.ts` / `environment.development.ts` + `fileReplacements` | Environments & proxy: `src/environments/environment.ts`, `environment.development.ts`, `angular.json` (`fileReplacements`, `baseHref`), `proxy.conf.json` |
| 17 | PASS | `baseHref` configurable to mirror `VITE_BASE` | Environments & proxy: `src/environments/environment.ts`, `environment.development.ts`, `angular.json` (`fileReplacements`, `baseHref`), `proxy.conf.json` |
| 18 | PASS | Dev-server `/api` proxy mirroring `vite.config.js` | Environments & proxy: `src/environments/environment.ts`, `environment.development.ts`, `angular.json` (`fileReplacements`, `baseHref`), `proxy.conf.json` |

### Items 19-31

| 19 | PASS | `index.css` equivalent: box-sizing, html/body base, `::selection`, `.visually-hidden`, `:focus-visible` | Global styles & head: `src/styles/{01-tokens,02-base,03-animations,04-components}.css`, `angular.json` (`styles` array), `src/index.html`, `public/favicon.svg` |
| 20 | PASS | Full light token set on `:root` / `[data-theme='light']` | Global styles & head: `src/styles/{01-tokens,02-base,03-animations,04-components}.css`, `angular.json` (`styles` array), `src/index.html`, `public/favicon.svg` |
| 21 | PASS | Full dark token set on `[data-theme='dark']` | Global styles & head: `src/styles/{01-tokens,02-base,03-animations,04-components}.css`, `angular.json` (`styles` array), `src/index.html`, `public/favicon.svg` |
| 22 | PASS | Layered radial-gradient body backgrounds for both themes | Global styles & head: `src/styles/{01-tokens,02-base,03-animations,04-components}.css`, `angular.json` (`styles` array), `src/index.html`, `public/favicon.svg` |
| 23 | PASS | All 9 `@keyframes` preserved | Global styles & head: `src/styles/{01-tokens,02-base,03-animations,04-components}.css`, `angular.json` (`styles` array), `src/index.html`, `public/favicon.svg` |
| 24 | PASS | `prefers-reduced-motion` block | Global styles & head: `src/styles/{01-tokens,02-base,03-animations,04-components}.css`, `angular.json` (`styles` array), `src/index.html`, `public/favicon.svg` |
| 25 | PASS | Full `App.css` equivalent — every one of the ~214 class rules | Global styles & head: `src/styles/{01-tokens,02-base,03-animations,04-components}.css`, `angular.json` (`styles` array), `src/index.html`, `public/favicon.svg` |
| 26 | PASS | All 5 breakpoints (1100 / 860 / 768 / 640 / 380) with every nested rule | Global styles & head: `src/styles/{01-tokens,02-base,03-animations,04-components}.css`, `angular.json` (`styles` array), `src/index.html`, `public/favicon.svg` |
| 27 | PASS | All `nth-child` animation delays preserved | Global styles & head: `src/styles/{01-tokens,02-base,03-animations,04-components}.css`, `angular.json` (`styles` array), `src/index.html`, `public/favicon.svg` |
| 28 | PASS | `::-webkit-scrollbar` styling | Global styles & head: `src/styles/{01-tokens,02-base,03-animations,04-components}.css`, `angular.json` (`styles` array), `src/index.html`, `public/favicon.svg` |
| 29 | PASS | Plus Jakarta Sans 400–800 loaded with `preconnect` | Global styles & head: `src/styles/{01-tokens,02-base,03-animations,04-components}.css`, `angular.json` (`styles` array), `src/index.html`, `public/favicon.svg` |
| 30 | PASS | `lang="en"`, title, description meta, `theme-color` meta, viewport meta | Global styles & head: `src/styles/{01-tokens,02-base,03-animations,04-components}.css`, `angular.json` (`styles` array), `src/index.html`, `public/favicon.svg` |
| 31 | PASS | `favicon.svg` copied and served | Global styles & head: `src/styles/{01-tokens,02-base,03-animations,04-components}.css`, `angular.json` (`styles` array), `src/index.html`, `public/favicon.svg` |

### Items 32-39

| 32 | PASS | Auth store: `user`, `loading`, `login`, `register`, `logout` with identical semantics | Signal stores: `src/app/core/stores/auth.store.ts`, `theme.store.ts`, `preferences.store.ts` |
| 33 | PASS | Auth bootstrap: read `user` synchronously; if `token && !user` fetch profile once, silently | Signal stores: `src/app/core/stores/auth.store.ts`, `theme.store.ts`, `preferences.store.ts` |
| 34 | PASS | Login stores the whole response (with token) as `user` in `localStorage` | Signal stores: `src/app/core/stores/auth.store.ts`, `theme.store.ts`, `preferences.store.ts` |
| 35 | PASS | Theme store: `system|light|dark`, `resolved`, `localStorage['expense-tracker-theme']` | Signal stores: `src/app/core/stores/auth.store.ts`, `theme.store.ts`, `preferences.store.ts` |
| 36 | PASS | Theme writes `data-theme` on `<html>`; system mode listens to `prefers-color-scheme` changes | Signal stores: `src/app/core/stores/auth.store.ts`, `theme.store.ts`, `preferences.store.ts` |
| 37 | PASS | Preferences store: `emptyPrefs` defaults, reset on logout, fetch on user change with cancel guard | Signal stores: `src/app/core/stores/auth.store.ts`, `theme.store.ts`, `preferences.store.ts` |
| 38 | PASS | Preferences mutations return the refreshed preferences object and update the store | Signal stores: `src/app/core/stores/auth.store.ts`, `theme.store.ts`, `preferences.store.ts` |
| 39 | PASS | `encodeURIComponent` on preference-delete path params | Signal stores: `src/app/core/stores/auth.store.ts`, `theme.store.ts`, `preferences.store.ts` |

### Items 40-59

| 40 | PASS | Base URL from environment, identical dev/prod values | HTTP core: `src/app/core/api/{api.config,auth-api.service,preferences-api.service,expenses-api.service,import-api.service}.ts`, `src/app/core/interceptors/auth.interceptor.ts`, `src/app/core/utils/http-error.ts` + consuming stores/components |
| 41 | PASS | Auth request interceptor adds `Authorization: Bearer <token>` | HTTP core: `src/app/core/api/{api.config,auth-api.service,preferences-api.service,expenses-api.service,import-api.service}.ts`, `src/app/core/interceptors/auth.interceptor.ts`, `src/app/core/utils/http-error.ts` + consuming stores/components |
| 42 | PASS | Response interceptor clears `token` + `user` on `401` and re-rejects | HTTP core: `src/app/core/api/{api.config,auth-api.service,preferences-api.service,expenses-api.service,import-api.service}.ts`, `src/app/core/interceptors/auth.interceptor.ts`, `src/app/core/utils/http-error.ts` + consuming stores/components |
| 43 | PASS | `POST /auth/login` with `'Login failed'` fallback | HTTP core: `src/app/core/api/{api.config,auth-api.service,preferences-api.service,expenses-api.service,import-api.service}.ts`, `src/app/core/interceptors/auth.interceptor.ts`, `src/app/core/utils/http-error.ts` + consuming stores/components |
| 44 | PASS | `POST /auth/register` with `'Registration failed'` fallback | HTTP core: `src/app/core/api/{api.config,auth-api.service,preferences-api.service,expenses-api.service,import-api.service}.ts`, `src/app/core/interceptors/auth.interceptor.ts`, `src/app/core/utils/http-error.ts` + consuming stores/components |
| 45 | PASS | `GET /auth/profile` (boot, silent) + (Profile, `'Failed to load profile'`) | HTTP core: `src/app/core/api/{api.config,auth-api.service,preferences-api.service,expenses-api.service,import-api.service}.ts`, `src/app/core/interceptors/auth.interceptor.ts`, `src/app/core/utils/http-error.ts` + consuming stores/components |
| 46 | PASS | `PUT /auth/profile { name }` + `localStorage.user` patch + `'Failed to update name'` | HTTP core: `src/app/core/api/{api.config,auth-api.service,preferences-api.service,expenses-api.service,import-api.service}.ts`, `src/app/core/interceptors/auth.interceptor.ts`, `src/app/core/utils/http-error.ts` + consuming stores/components |
| 47 | PASS | `PUT /auth/password` + `'Failed to change password'` | HTTP core: `src/app/core/api/{api.config,auth-api.service,preferences-api.service,expenses-api.service,import-api.service}.ts`, `src/app/core/interceptors/auth.interceptor.ts`, `src/app/core/utils/http-error.ts` + consuming stores/components |
| 48 | PASS | `DELETE /auth/account` → logout → `/register` | HTTP core: `src/app/core/api/{api.config,auth-api.service,preferences-api.service,expenses-api.service,import-api.service}.ts`, `src/app/core/interceptors/auth.interceptor.ts`, `src/app/core/utils/http-error.ts` + consuming stores/components |
| 49 | PASS | `GET /auth/preferences`, silent on error | HTTP core: `src/app/core/api/{api.config,auth-api.service,preferences-api.service,expenses-api.service,import-api.service}.ts`, `src/app/core/interceptors/auth.interceptor.ts`, `src/app/core/utils/http-error.ts` + consuming stores/components |
| 50 | PASS | `POST|DELETE /auth/preferences/categories`, `POST|DELETE /auth/preferences/upi-apps` | HTTP core: `src/app/core/api/{api.config,auth-api.service,preferences-api.service,expenses-api.service,import-api.service}.ts`, `src/app/core/interceptors/auth.interceptor.ts`, `src/app/core/utils/http-error.ts` + consuming stores/components |
| 51 | PASS | `GET /expenses` with `category`/`month`/`startDate`/`endDate` + `'Failed to load expenses'` | HTTP core: `src/app/core/api/{api.config,auth-api.service,preferences-api.service,expenses-api.service,import-api.service}.ts`, `src/app/core/interceptors/auth.interceptor.ts`, `src/app/core/utils/http-error.ts` + consuming stores/components |
| 52 | PASS | `GET /expenses/summary` with only `startDate`/`endDate`, errors swallowed | HTTP core: `src/app/core/api/{api.config,auth-api.service,preferences-api.service,expenses-api.service,import-api.service}.ts`, `src/app/core/interceptors/auth.interceptor.ts`, `src/app/core/utils/http-error.ts` + consuming stores/components |
| 53 | PASS | `POST /expenses` + prepend + `'Failed to add expense'` | HTTP core: `src/app/core/api/{api.config,auth-api.service,preferences-api.service,expenses-api.service,import-api.service}.ts`, `src/app/core/interceptors/auth.interceptor.ts`, `src/app/core/utils/http-error.ts` + consuming stores/components |
| 54 | PASS | `PUT /expenses/:id` + replace-by-`_id` + `'Failed to update expense'` | HTTP core: `src/app/core/api/{api.config,auth-api.service,preferences-api.service,expenses-api.service,import-api.service}.ts`, `src/app/core/interceptors/auth.interceptor.ts`, `src/app/core/utils/http-error.ts` + consuming stores/components |
| 55 | PASS | `DELETE /expenses/:id` + remove + `'Failed to delete expense'` | HTTP core: `src/app/core/api/{api.config,auth-api.service,preferences-api.service,expenses-api.service,import-api.service}.ts`, `src/app/core/interceptors/auth.interceptor.ts`, `src/app/core/utils/http-error.ts` + consuming stores/components |
| 56 | PASS | `POST /import/parse` multipart with `Content-Type: multipart/form-data` + `'Failed to parse the PDF. Please try another file.'` | HTTP core: `src/app/core/api/{api.config,auth-api.service,preferences-api.service,expenses-api.service,import-api.service}.ts`, `src/app/core/interceptors/auth.interceptor.ts`, `src/app/core/utils/http-error.ts` + consuming stores/components |
| 57 | PASS | `POST /import/expenses` payload shape incl. `bankName: null` + `'Failed to import entries'` | HTTP core: `src/app/core/api/{api.config,auth-api.service,preferences-api.service,expenses-api.service,import-api.service}.ts`, `src/app/core/interceptors/auth.interceptor.ts`, `src/app/core/utils/http-error.ts` + consuming stores/components |
| 58 | PASS | `err.response?.data?.message || fallback` semantics everywhere | HTTP core: `src/app/core/api/{api.config,auth-api.service,preferences-api.service,expenses-api.service,import-api.service}.ts`, `src/app/core/interceptors/auth.interceptor.ts`, `src/app/core/utils/http-error.ts` + consuming stores/components |
| 59 | PASS | No retries, no timeouts, no extra headers beyond the source | HTTP core: `src/app/core/api/{api.config,auth-api.service,preferences-api.service,expenses-api.service,import-api.service}.ts`, `src/app/core/interceptors/auth.interceptor.ts`, `src/app/core/utils/http-error.ts` + consuming stores/components |

### Items 60-65

| 60 | PASS | `/login`, `/register` public | Shell, guard, routes: `src/app/app.routes.ts`, `src/app/core/guards/auth.guard.ts`, `src/app/app.ts`, `src/app/app.html` |
| 61 | PASS | `/`, `/profile`, `/import` guarded → redirect to `/login` with `replaceUrl` | Shell, guard, routes: `src/app/app.routes.ts`, `src/app/core/guards/auth.guard.ts`, `src/app/app.ts`, `src/app/app.html` |
| 62 | PASS | `**` → redirect to `/` | `src/app/app.routes.ts` (`path: '**'` ` → `redirectTo: ''`) |
| 63 | PASS | Navbar rendered above the router outlet on every route | Shell, guard, routes: `src/app/app.routes.ts`, `src/app/core/guards/auth.guard.ts`, `src/app/app.ts`, `src/app/app.html` |
| 64 | PASS | `<main class="app-main">` wrapper on every route | Shell, guard, routes: `src/app/app.routes.ts`, `src/app/core/guards/auth.guard.ts`, `src/app/app.ts`, `src/app/app.html` |
| 65 | PASS | `basename` support equivalent to `VITE_BASE` | Shell, guard, routes: `src/app/app.routes.ts`, `src/app/core/guards/auth.guard.ts`, `src/app/app.ts`, `src/app/app.html` |

### Items 66-72

| 66 | PASS | `.auth-page` / `.auth-card` / brand logo `₹` + "Expense Tracker" | Login: `src/app/pages/auth/login/login.component.{ts,html}` |
| 67 | PASS | `h1` "Welcome Back", subtitle copy | Login: `src/app/pages/auth/login/login.component.{ts,html}` |
| 68 | PASS | Email + password fields with exact ids/types/placeholders/autocomplete | Login: `src/app/pages/auth/login/login.component.{ts,html}` |
| 69 | PASS | Spinner + `Logging in…` / `Log In` | Login: `src/app/pages/auth/login/login.component.{ts,html}` |
| 70 | PASS | Footer "Don't have an account? Sign up" → `/register` | Login: `src/app/pages/auth/login/login.component.{ts,html}` |
| 71 | PASS | Error alert with server or `'Login failed'` message | Login: `src/app/pages/auth/login/login.component.{ts,html}` |
| 72 | PASS | `navigate('/')` on success | Login: `src/app/pages/auth/login/login.component.{ts,html}` |

### Items 73-80

| 73 | PASS | `h1` "Create Account", subtitle copy | Register: `src/app/pages/auth/register/register.component.{ts,html}` |
| 74 | PASS | Name / Email / Password (minlength 6) / Confirm fields with exact attributes | Register: `src/app/pages/auth/register/register.component.{ts,html}` |
| 75 | PASS | `.form-row` two-column password pair | Register: `src/app/pages/auth/register/register.component.{ts,html}` |
| 76 | PASS | `'Passwords do not match'` check before request | Register: `src/app/pages/auth/register/register.component.{ts,html}` |
| 77 | PASS | `'Password must be at least 6 characters'` check before request | Register: `src/app/pages/auth/register/register.component.{ts,html}` |
| 78 | PASS | Spinner + `Creating account…` / `Sign Up` | Register: `src/app/pages/auth/register/register.component.{ts,html}` |
| 79 | PASS | Footer "Already have an account? Log in" → `/login` | Register: `src/app/pages/auth/register/register.component.{ts,html}` |
| 80 | PASS | `navigate('/')` on success | Register: `src/app/pages/auth/register/register.component.{ts,html}` |

### Items 81-99

| 81 | PASS | Sticky frosted navbar, `slideInDown`, glass background/border tokens | Navbar & shell chrome: `src/app/layout/navbar/navbar.component.{ts,html}` |
| 82 | PASS | Brand `₹` logo + "Expense Tracker" → `/`, closes drawer | Navbar & shell chrome: `src/app/layout/navbar/navbar.component.{ts,html}` |
| 83 | PASS | Desktop links Dashboard/Import/Profile with icons, `active` only when logged in | Navbar & shell chrome: `src/app/layout/navbar/navbar.component.{ts,html}` |
| 84 | PASS | Theme toggle with current-theme icon, `aria-label`/`aria-haspopup`/`aria-expanded` | Navbar & shell chrome: `src/app/layout/navbar/navbar.component.{ts,html}` |
| 85 | PASS | Theme dropdown `role=menu`, `menuitemradio`, `aria-checked`, `✓` marker | Navbar & shell chrome: `src/app/layout/navbar/navbar.component.{ts,html}` |
| 86 | PASS | Opening the theme menu closes the user menu and vice-versa | Navbar & shell chrome: `src/app/layout/navbar/navbar.component.{ts,html}` |
| 87 | PASS | Account button with avatar(34), name, rotating chevron | Navbar & shell chrome: `src/app/layout/navbar/navbar.component.{ts,html}` |
| 88 | PASS | Account dropdown with header, "My Profile", "Settings" (`/profile#settings`), divider, Logout | Navbar & shell chrome: `src/app/layout/navbar/navbar.component.{ts,html}` |
| 89 | PASS | Logout → close all → logout → `/login` | Navbar & shell chrome: `src/app/layout/navbar/navbar.component.{ts,html}` |
| 90 | PASS | Logged-out state: `Login` ghost + `Sign Up` primary small buttons | Navbar & shell chrome: `src/app/layout/navbar/navbar.component.{ts,html}` |
| 91 | PASS | Hamburger with 3 bars → X, `aria-label="Open menu"`, `aria-expanded` | Navbar & shell chrome: `src/app/layout/navbar/navbar.component.{ts,html}` |
| 92 | PASS | Drawer: backdrop, left slide-in panel, scroll lock, `aria-hidden` | Navbar & shell chrome: `src/app/layout/navbar/navbar.component.{ts,html}` |
| 93 | PASS | Drawer header with avatar/name/email or "Menu", close button | Navbar & shell chrome: `src/app/layout/navbar/navbar.component.{ts,html}` |
| 94 | PASS | Drawer nav (auth-aware) and "Settings" section | Navbar & shell chrome: `src/app/layout/navbar/navbar.component.{ts,html}` |
| 95 | PASS | Drawer theme 3-up grid + `.active` | Navbar & shell chrome: `src/app/layout/navbar/navbar.component.{ts,html}` |
| 96 | PASS | Drawer footer danger Logout button (only when logged in) | Navbar & shell chrome: `src/app/layout/navbar/navbar.component.{ts,html}` |
| 97 | PASS | Outside-click closes menus | Navbar & shell chrome: `src/app/layout/navbar/navbar.component.{ts,html}` |
| 98 | PASS | Escape closes menus + drawer | Navbar & shell chrome: `src/app/layout/navbar/navbar.component.{ts,html}` |
| 99 | PASS | Body scroll lock while drawer open | Navbar & shell chrome: `src/app/layout/navbar/navbar.component.{ts,html}` |

### Items 100-103

| 100 | PASS | Initials from first two words, `?` fallback, uppercase | Avatar: `src/app/shared/components/avatar/avatar.component.{ts,html}` |
| 101 | PASS | Deterministic hue from char-code hash; second stop +45° | Avatar: `src/app/shared/components/avatar/avatar.component.{ts,html}` |
| 102 | PASS | Exact SVG structure, `rx=50`, `dominant-baseline=middle`, Arial stack, white 96% text | Avatar: `src/app/shared/components/avatar/avatar.component.{ts,html}` |
| 103 | PASS | `photo` override, `size` → inline width/height, `className` merge, `alt` fallback `'avatar'` | Avatar: `src/app/shared/components/avatar/avatar.component.{ts,html}` |

### Items 104-127

| 104 | PASS | `.dashboard` + page header, greeting from first name (capitalised), fallback copy | Dashboard: `src/app/features/dashboard/dashboard.component.{ts,html}` + `components/{expense-form,expense-list,expense-modal}/*` + `charts/*` |
| 105 | PASS | Header "Add Expense" button with `+` SVG | Dashboard: `src/app/features/dashboard/dashboard.component.{ts,html}` + `components/{expense-form,expense-list,expense-modal}/*` + `charts/*` |
| 106 | PASS | Five summary cards in order, with `.highlight` treatment and radial glow | Dashboard: `src/app/features/dashboard/dashboard.component.{ts,html}` + `components/{expense-form,expense-list,expense-modal}/*` + `charts/*` |
| 107 | PASS | Exact count copy: `N expense(s)`, `N entr{y|ies}`, `N payment(s)`, ` · filtered` | Dashboard: `src/app/features/dashboard/dashboard.component.{ts,html}` + `components/{expense-form,expense-list,expense-modal}/*` + `charts/*` |
| 108 | PASS | `TimeFilter` inside the summary grid, full width | Dashboard: `src/app/features/dashboard/dashboard.component.{ts,html}` + `components/{expense-form,expense-list,expense-modal}/*` + `charts/*` |
| 109 | PASS | Dismissible error banner | Dashboard: `src/app/features/dashboard/dashboard.component.{ts,html}` + `components/{expense-form,expense-list,expense-modal}/*` + `charts/*` |
| 110 | PASS | Charts section wired to `summary` + `chartFilter` + `handleChartFilter` | Dashboard: `src/app/features/dashboard/dashboard.component.{ts,html}` + `components/{expense-form,expense-list,expense-modal}/*` + `charts/*` |
| 111 | PASS | Expense list container with toolbar | Dashboard: `src/app/features/dashboard/dashboard.component.{ts,html}` + `components/{expense-form,expense-list,expense-modal}/*` + `charts/*` |
| 112 | PASS | Category `<select>` with `All Categories` + 9 hardcoded options | Dashboard: `src/app/features/dashboard/dashboard.component.{ts,html}` + `components/{expense-form,expense-list,expense-modal}/*` + `charts/*` |
| 113 | PASS | `<input type="month">` filter | Dashboard: `src/app/features/dashboard/dashboard.component.{ts,html}` + `components/{expense-form,expense-list,expense-modal}/*` + `charts/*` |
| 114 | PASS | Toolbar filter badge + clear button | Dashboard: `src/app/features/dashboard/dashboard.component.{ts,html}` + `components/{expense-form,expense-list,expense-modal}/*` + `charts/*` |
| 115 | PASS | `hasFilters` = `filter || month || chartFilter` | Dashboard: `src/app/features/dashboard/dashboard.component.{ts,html}` + `components/{expense-form,expense-list,expense-modal}/*` + `charts/*` |
| 116 | PASS | Two-click delete confirmation with 2.5 s timeout | Dashboard: `src/app/features/dashboard/dashboard.component.{ts,html}` + `components/{expense-form,expense-list,expense-modal}/*` + `charts/*` |
| 117 | PASS | Per-row edit/delete actions with `title` + `aria-label` | Dashboard: `src/app/features/dashboard/dashboard.component.{ts,html}` + `components/{expense-form,expense-list,expense-modal}/*` + `charts/*` |
| 118 | PASS | Row animation delay `min(index * 0.05, 0.5)` | Dashboard: `src/app/features/dashboard/dashboard.component.{ts,html}` + `components/{expense-form,expense-list,expense-modal}/*` + `charts/*` |
| 119 | PASS | Income rows: `income-item`, `+` prefix, `amount-income`, green category | Dashboard: `src/app/features/dashboard/dashboard.component.{ts,html}` + `components/{expense-form,expense-list,expense-modal}/*` + `charts/*` |
| 120 | PASS | `paymentLabel` strings incl. bank fallback | Dashboard: `src/app/features/dashboard/dashboard.component.{ts,html}` + `components/{expense-form,expense-list,expense-modal}/*` + `charts/*` |
| 121 | PASS | Mobile FAB | Dashboard: `src/app/features/dashboard/dashboard.component.{ts,html}` + `components/{expense-form,expense-list,expense-modal}/*` + `charts/*` |
| 122 | PASS | Modal wired: add vs edit, `submitting` | Dashboard: `src/app/features/dashboard/dashboard.component.{ts,html}` + `components/{expense-form,expense-list,expense-modal}/*` + `charts/*` |
| 123 | PASS | Totals: `totalAmount`, `totalIncome`, `cashTotal`, `upiTotal`, `bankTotal` over expenses only | Dashboard: `src/app/features/dashboard/dashboard.component.{ts,html}` + `components/{expense-form,expense-list,expense-modal}/*` + `charts/*` |
| 124 | PASS | Chart filter toggling (same slice twice clears) and cross-filtering of the list | Dashboard: `src/app/features/dashboard/dashboard.component.{ts,html}` + `components/{expense-form,expense-list,expense-modal}/*` + `charts/*` |
| 125 | PASS | Time-range change clears the month filter | Dashboard: `src/app/features/dashboard/dashboard.component.{ts,html}` + `components/{expense-form,expense-list,expense-modal}/*` + `charts/*` |
| 126 | PASS | Refetch on `filter`/`month`/`dateRange` change only | Dashboard: `src/app/features/dashboard/dashboard.component.{ts,html}` + `components/{expense-form,expense-list,expense-modal}/*` + `charts/*` |
| 127 | PASS | Summary refetch after add/edit/delete but not on filter/month change (range-driven) | Dashboard: `src/app/features/dashboard/dashboard.component.{ts,html}` + `components/{expense-form,expense-list,expense-modal}/*` + `charts/*` |

### Items 128-140

| 128 | PASS | `null` when no summary | Charts (Chart.js): `src/app/features/dashboard/charts/{chart-theme,chart-data,payment-labels,tooltips,chart-options}.ts` + `charts.component.{ts,html}` |
| 129 | PASS | By Category card with `📊` heading, active badge, Pie/Bar switch | Charts (Chart.js): `src/app/features/dashboard/charts/{chart-theme,chart-data,payment-labels,tooltips,chart-options}.ts` + `charts.component.{ts,html}` |
| 130 | PASS | Doughnut 60/100 radius, `paddingAngle 3`, per-slice colours/opacity/stroke | Charts (Chart.js): `src/app/features/dashboard/charts/{chart-theme,chart-data,payment-labels,tooltips,chart-options}.ts` + `charts.component.{ts,html}` |
| 131 | PASS | Legend with themed label colour | Charts (Chart.js): `src/app/features/dashboard/charts/{chart-theme,chart-data,payment-labels,tooltips,chart-options}.ts` + `charts.component.{ts,html}` |
| 132 | PASS | Horizontal bar mode with `₹Xk` axis formatting, `3 3` grid, `[0,6,6,0]` radius | Charts (Chart.js): `src/app/features/dashboard/charts/{chart-theme,chart-data,payment-labels,tooltips,chart-options}.ts` + `charts.component.{ts,html}` |
| 133 | PASS | By Payment Method card with `💳`, percentage labels, method-specific colours | Charts (Chart.js): `src/app/features/dashboard/charts/{chart-theme,chart-data,payment-labels,tooltips,chart-options}.ts` + `charts.component.{ts,html}` |
| 134 | PASS | Daily Trend wide card with gradient area, `#ef4444` stroke 2.5 | Charts (Chart.js): `src/app/features/dashboard/charts/{chart-theme,chart-data,payment-labels,tooltips,chart-options}.ts` + `charts.component.{ts,html}` |
| 135 | PASS | Custom themed tooltip markup and styling | Charts (Chart.js): `src/app/features/dashboard/charts/{chart-theme,chart-data,payment-labels,tooltips,chart-options}.ts` + `charts.component.{ts,html}` |
| 136 | PASS | Three distinct empty-state placeholder messages | Charts (Chart.js): `src/app/features/dashboard/charts/{chart-theme,chart-data,payment-labels,tooltips,chart-options}.ts` + `charts.component.{ts,html}` |
| 137 | PASS | All 8 light + 8 dark palette colours, grid/tick/legend/tooltip/stroke theme tokens | Charts (Chart.js): `src/app/features/dashboard/charts/{chart-theme,chart-data,payment-labels,tooltips,chart-options}.ts` + `charts.component.{ts,html}` |
| 138 | PASS | `fadedOpacity` 0.35 for non-active slices | Charts (Chart.js): `src/app/features/dashboard/charts/{chart-theme,chart-data,payment-labels,tooltips,chart-options}.ts` + `charts.component.{ts,html}` |
| 139 | PASS | Slice/bar click → `onFilterChange('category'|'payment', value)` | Charts (Chart.js): `src/app/features/dashboard/charts/{chart-theme,chart-data,payment-labels,tooltips,chart-options}.ts` + `charts.component.{ts,html}` |
| 140 | PASS | `ResponsiveContainer` equivalent at height 260, width 100% | Charts (Chart.js): `src/app/features/dashboard/charts/{chart-theme,chart-data,payment-labels,tooltips,chart-options}.ts` + `charts.component.{ts,html}` |

### Items 141-149

| 141 | PASS | 5 tabs with exact labels and `aria-pressed` | Time filter: `src/app/features/dashboard/components/time-filter/time-filter.component.{ts,html}` |
| 142 | PASS | Default active tab = `month` | Time filter: `src/app/features/dashboard/components/time-filter/time-filter.component.{ts,html}` |
| 143 | PASS | Today = local midnight → now | Time filter: `src/app/features/dashboard/components/time-filter/time-filter.component.{ts,html}` |
| 144 | PASS | Week = Monday local midnight → now | Time filter: `src/app/features/dashboard/components/time-filter/time-filter.component.{ts,html}` |
| 145 | PASS | Month = 1st of month local midnight → now | Time filter: `src/app/features/dashboard/components/time-filter/time-filter.component.{ts,html}` |
| 146 | PASS | Year = Jan 1 local midnight → now | Time filter: `src/app/features/dashboard/components/time-filter/time-filter.component.{ts,html}` |
| 147 | PASS | Custom tab emits `{ null, null }` until Apply | Time filter: `src/app/features/dashboard/components/time-filter/time-filter.component.{ts,html}` |
| 148 | PASS | Custom inputs with visually-hidden labels and the "to" separator | Time filter: `src/app/features/dashboard/components/time-filter/time-filter.component.{ts,html}` |
| 149 | PASS | Apply disabled until both dates set; end date extended to `T23:59:59` | Time filter: `src/app/features/dashboard/components/time-filter/time-filter.component.{ts,html}` |

### Items 150-162

| 150 | PASS | Create and edit modes from one component | Expense form: `src/app/features/dashboard/components/expense-form/expense-form.component.{ts,html}` |
| 151 | PASS | `noValidate`, manual validation, single error banner | Expense form: `src/app/features/dashboard/components/expense-form/expense-form.component.{ts,html}` |
| 152 | PASS | `'Add a short description and the amount'` then `'Amount must be greater than zero'` | Expense form: `src/app/features/dashboard/components/expense-form/expense-form.component.{ts,html}` |
| 153 | PASS | Amount hero input: `₹` prefix, `type=number`, `min=0`, `step=0.01`, placeholder `0`, `autoFocus` | Expense form: `src/app/features/dashboard/components/expense-form/expense-form.component.{ts,html}` |
| 154 | PASS | 5 quick amounts with `.active` state | Expense form: `src/app/features/dashboard/components/expense-form/expense-form.component.{ts,html}` |
| 155 | PASS | Description placeholder switches for income/expense | Expense form: `src/app/features/dashboard/components/expense-form/expense-form.component.{ts,html}` |
| 156 | PASS | Type radiogroup (Expense / Income) with `income-pill` styling | Expense form: `src/app/features/dashboard/components/expense-form/expense-form.component.{ts,html}` |
| 157 | PASS | Category icon grid from preferences with per-category emoji | Expense form: `src/app/features/dashboard/components/expense-form/expense-form.component.{ts,html}` |
| 158 | PASS | Payment radiogroup (Cash / UPI) and conditional UPI app grid | Expense form: `src/app/features/dashboard/components/expense-form/expense-form.component.{ts,html}` |
| 159 | PASS | Income hint banner with exact copy | Expense form: `src/app/features/dashboard/components/expense-form/expense-form.component.{ts,html}` |
| 160 | PASS | Date field defaulted to today, `required` | Expense form: `src/app/features/dashboard/components/expense-form/expense-form.component.{ts,html}` |
| 161 | PASS | Submit label logic: Saving… / Save Changes / Add Income / Add Expense | Expense form: `src/app/features/dashboard/components/expense-form/expense-form.component.{ts,html}` |
| 162 | PASS | Payload shape differs for income (no `upiApp`, `paymentMethod` forced to `bank`) | Expense form: `src/app/features/dashboard/components/expense-form/expense-form.component.{ts,html}` |

### Items 163-168

| 163 | PASS | Skeleton: 4 rows with circle/mid/short/bar, `aria-hidden` | Expense list: `src/app/features/dashboard/components/expense-list/expense-list.component.{ts,html}` |
| 164 | PASS | Empty states with filter-aware icon, heading, body and conditional CTA | Expense list: `src/app/features/dashboard/components/expense-list/expense-list.component.{ts,html}` |
| 165 | PASS | Row markup: avatar, description (`title`), category, payment badge, date | Expense list: `src/app/features/dashboard/components/expense-list/expense-list.component.{ts,html}` |
| 166 | PASS | Amount rendering with `+` for income and tabular-nums | Expense list: `src/app/features/dashboard/components/expense-list/expense-list.component.{ts,html}` |
| 167 | PASS | Edit button label/aria; delete button confirm state swap to `✓` | Expense list: `src/app/features/dashboard/components/expense-list/expense-list.component.{ts,html}` |
| 168 | PASS | Delete confirm window of 2500 ms | Expense list: `src/app/features/dashboard/components/expense-list/expense-list.component.{ts,html}` |

### Items 169-177

| 169 | PASS | Rendered only when `open` | Expense modal: `src/app/features/dashboard/components/expense-modal/expense-modal.component.{ts,html}` |
| 170 | PASS | `role=dialog`, `aria-modal=true`, `aria-labelledby` | Expense modal: `src/app/features/dashboard/components/expense-modal/expense-modal.component.{ts,html}` |
| 171 | PASS | Title `✏️ Edit Expense` / `✨ Add Expense` | Expense modal: `src/app/features/dashboard/components/expense-modal/expense-modal.component.{ts,html}` |
| 172 | PASS | Close `×` button; overlay click closes; inner click does not | Expense modal: `src/app/features/dashboard/components/expense-modal/expense-modal.component.{ts,html}` |
| 173 | PASS | Escape closes | Expense modal: `src/app/features/dashboard/components/expense-modal/expense-modal.component.{ts,html}` |
| 174 | PASS | Body scroll lock while open | Expense modal: `src/app/features/dashboard/components/expense-modal/expense-modal.component.{ts,html}` |
| 175 | PASS | Focus first focusable on open, restore previous focus on close | Expense modal: `src/app/features/dashboard/components/expense-modal/expense-modal.component.{ts,html}` |
| 176 | PASS | Tab / Shift+Tab focus trap | Expense modal: `src/app/features/dashboard/components/expense-modal/expense-modal.component.{ts,html}` |
| 177 | PASS | `max-height: 90vh` with internal scroll | Expense modal: `src/app/features/dashboard/components/expense-modal/expense-modal.component.{ts,html}` |

### Items 178-190

| 178 | PASS | Loading state `⏳ Loading your profile…` | Profile: `src/app/features/profile/profile.component.{ts,html}` (`AuthStore.updateUser` in `core/stores/auth.store.ts`) |
| 179 | PASS | Header with 84px avatar, name, email, `Member since {long date}` | Profile: `src/app/features/profile/profile.component.{ts,html}` (`AuthStore.updateUser` in `core/stores/auth.store.ts`) |
| 180 | PASS | Three stat cards with exact labels/icons/formatting (`—` for missing top category) | Profile: `src/app/features/profile/profile.component.{ts,html}` (`AuthStore.updateUser` in `core/stores/auth.store.ts`) |
| 181 | PASS | Auto-clearing message banner (4000 ms), `role=alert` / `role=status` | Profile: `src/app/features/profile/profile.component.{ts,html}` (`AuthStore.updateUser` in `core/stores/auth.store.ts`) |
| 182 | PASS | `#settings` anchor target | Profile: `src/app/features/profile/profile.component.{ts,html}` (`AuthStore.updateUser` in `core/stores/auth.store.ts`) |
| 183 | PASS | Update Name card with localStorage `user` patch | Profile: `src/app/features/profile/profile.component.{ts,html}` (`AuthStore.updateUser` in `core/stores/auth.store.ts`) |
| 184 | PASS | Appearance card with 3 theme radios, labels and descriptions | Profile: `src/app/features/profile/profile.component.{ts,html}` (`AuthStore.updateUser` in `core/stores/auth.store.ts`) |
| 185 | PASS | Custom Categories card: add with duplicate guard, `maxlength 24`, tag list, empty copy | Profile: `src/app/features/profile/profile.component.{ts,html}` (`AuthStore.updateUser` in `core/stores/auth.store.ts`) |
| 186 | PASS | Custom UPI Apps card: same shape | Profile: `src/app/features/profile/profile.component.{ts,html}` (`AuthStore.updateUser` in `core/stores/auth.store.ts`) |
| 187 | PASS | Change Password card: 3-field grid, mismatch guard, field reset on success | Profile: `src/app/features/profile/profile.component.{ts,html}` (`AuthStore.updateUser` in `core/stores/auth.store.ts`) |
| 188 | PASS | Session card with bare `logout()` (no navigation) | Profile: `src/app/features/profile/profile.component.{ts,html}` (`AuthStore.updateUser` in `core/stores/auth.store.ts`) |
| 189 | PASS | Danger Zone: typed `delete` confirmation + `window.confirm` dialog | Profile: `src/app/features/profile/profile.component.{ts,html}` (`AuthStore.updateUser` in `core/stores/auth.store.ts`) |
| 190 | PASS | `.setting-card` stagger delays | Profile: `src/app/features/profile/profile.component.{ts,html}` (`AuthStore.updateUser` in `core/stores/auth.store.ts`) |

### Items 191-205

| 191 | PASS | Page header copy and `.import-page` class (also `.dashboard`) | Import: `src/app/features/import/import.component.{ts,html}` + `src/app/core/api/import-api.service.ts` |
| 192 | PASS | Dropzone with dragover/drop handlers and exact copy | Import: `src/app/features/import/import.component.{ts,html}` + `src/app/core/api/import-api.service.ts` |
| 193 | PASS | Hidden `input[type=file][accept="application/pdf,.pdf"]` + `⌕ Choose a PDF file` | Import: `src/app/features/import/import.component.{ts,html}` + `src/app/core/api/import-api.service.ts` |
| 194 | PASS | Parsing state: `Parsing statement…` + `Reading statement…` row | Import: `src/app/features/import/import.component.{ts,html}` + `src/app/core/api/import-api.service.ts` |
| 195 | PASS | Error banner (dismissible) and success banner | Import: `src/app/features/import/import.component.{ts,html}` + `src/app/core/api/import-api.service.ts` |
| 196 | PASS | Preview header: file icon, file name, bank badge, transaction count | Import: `src/app/features/import/import.component.{ts,html}` + `src/app/core/api/import-api.service.ts` |
| 197 | PASS | Expense / Income totals for selected rows | Import: `src/app/features/import/import.component.{ts,html}` + `src/app/core/api/import-api.service.ts` |
| 198 | PASS | Parser warning banner | Import: `src/app/features/import/import.component.{ts,html}` + `src/app/core/api/import-api.service.ts` |
| 199 | PASS | Preview table: 7 columns, exact class names and select-all behaviour | Import: `src/app/features/import/import.component.{ts,html}` + `src/app/core/api/import-api.service.ts` |
| 200 | PASS | Row editing for date/description/category/type + type↔category coupling | Import: `src/app/features/import/import.component.{ts,html}` + `src/app/core/api/import-api.service.ts` |
| 201 | PASS | Per-row include checkbox, remove button, income/expense amount colouring | Import: `src/app/features/import/import.component.{ts,html}` + `src/app/core/api/import-api.service.ts` |
| 202 | PASS | `Start over` reset and file input clearing | Import: `src/app/features/import/import.component.{ts,html}` + `src/app/core/api/import-api.service.ts` |
| 203 | PASS | Import button label `📥 Import N entry/entries`, disabled while importing or empty | Import: `src/app/features/import/import.component.{ts,html}` + `src/app/core/api/import-api.service.ts` |
| 204 | PASS | Success message `Imported N entry/entries successfully.` | Import: `src/app/features/import/import.component.{ts,html}` + `src/app/core/api/import-api.service.ts` |
| 205 | PASS | `categoryOptions` includes `Income` only when a row is income | Import: `src/app/features/import/import.component.{ts,html}` + `src/app/core/api/import-api.service.ts` |

### Items 206-210

| 206 | PASS | All original `aria-label`s, `role`s, `aria-*` states preserved | A11y parity sweep: templates under `src/app/**` (navbar, dashboard, expense-form/list/modal, import, profile, auth pages, time-filter) |
| 207 | PASS | `:focus-visible` rings and form focus overrides | A11y parity sweep: templates under `src/app/**` (navbar, dashboard, expense-form/list/modal, import, profile, auth pages, time-filter) |
| 208 | PASS | Focus trap and focus restore in the modal | A11y parity sweep: templates under `src/app/**` (navbar, dashboard, expense-form/list/modal, import, profile, auth pages, time-filter) |
| 209 | PASS | Keyboard Escape / outside-click / body scroll lock | A11y parity sweep: templates under `src/app/**` (navbar, dashboard, expense-form/list/modal, import, profile, auth pages, time-filter) |
| 210 | PASS | `aria-hidden` on skeleton rows, drawer and inactive chart placeholders | A11y parity sweep: templates under `src/app/**` (navbar, dashboard, expense-form/list/modal, import, profile, auth pages, time-filter) |

### Items 211-211

| 211 | PASS | No `any` anywhere; strict templates | Strict templates/types: `tsconfig.json`, `tsconfig.app.json`, `src/app/core/models/*.ts` |

### Items 212-212

| 212 | PASS | No TODOs, stubs, placeholder handlers or mock data | All feature components: `src/app/features/**`, `src/app/pages/**`, `src/app/layout/**` |

### Items 213-213

| 213 | PASS | No duplicated logic (formatters, totals, labels extracted once) | Dedup: `src/app/core/utils/{formatters,expense-icons,date-range,http-error,storage}.ts` |

### Items 214-214

| 214 | PASS | Production `ng build` succeeds with no errors | Quality gate: production `ng build` - PASS, initial total 314.86 kB (within 500 kB budget, no errors) |

### Items 215-215

| 215 | PASS | `ng test` passes | Quality gate: `ng test` - 32 tests / 10 files, all pass |

### Items 216-216

| 216 | PASS | `ng lint` passes with no errors | Quality gate: `ng lint` - zero errors |

### Items 217-217

| 217 | PASS | Original project untouched (verified by checksum comparison) | Source integrity: `PORTING_CHECKSUMS.txt` + git status (read-only port; 4 pre-existing source diffs recorded) |
