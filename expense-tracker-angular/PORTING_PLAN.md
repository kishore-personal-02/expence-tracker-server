# PORTING PLAN — `expense-tracker-client` (React 19 + Vite) → Angular 21

Source project (read-only, must not be modified): `C:\Users\kisho\Desktop\expense-tracker\expense-tracker-client`
Target project: `C:\Users\kisho\Desktop\expense-tracker\expense-tracker-angular`
Companion inventory: `PORTING_INVENTORY.md` (1648 lines, 217-item parity checklist)

This document is the **complete source → target mapping** and the **build order** for Phase 3.
Every item referenced here maps 1:1 to checklist items in `PORTING_INVENTORY.md` §14.

---

## 1. Verified toolchain (checked against the live registry on 2026-10-01)

| Tool | Version | Notes |
| --- | --- | --- |
| Node.js | `24.18.0` | already installed, satisfies Angular 21 |
| npm | `11.16.0` | package manager of record |
| Angular CLI | `21.2.24` (`v21-lts`) | `latest` on npm is 22.2.0 — **pinned to `v21-lts`** |
| `@angular/*` | `21.2.x` | scaffolded by the CLI, so all framework packages align |
| `@angular/material` / `@angular/cdk` | `21.2.14` | latest v21 |
| `chart.js` | `4.5.1` | |
| `ng2-charts` | `10.0.0` | **required**: `11.0.0` declares `peerDependencies: @angular/core >=22.0.0`; `10.0.0` declares `>=21.0.0` (and `chart.js ^3.4.0 \|\| ^4.0.0`, `@angular/cdk >=21.0.0`) |
| `vitest` | `^4.0.8` | optional peer of `@angular/build`; the CLI installs it with `--test-runner vitest` |
| `jsdom` | latest | **must be added manually** — verified in `@angular/build@21.2.24` (`src/builders/unit-test/runners/vitest/index.js`): `checker.checkAny(['jsdom', 'happy-dom'], 'A DOM environment is required for non-browser tests…')`. Without it `ng test` fails immediately |
| Runner builder | `@angular/build:unit-test` | `runner: "vitest"`, jsdom by default when `browsers` is omitted |

Verified `ng new` options available in 21.2.24: `--style`, `--test-runner` (default `vitest`),
`--zoneless`, `--standalone`, `--strict`, `--ssr`, `--file-name-style-guide` (default `2025`),
`--prefix`, `--skip-git`, `--ai-config`.

---

## 2. Stage 0 — Scaffold

The target directory already exists (it holds the two phase documents), so the scaffold is
generated in a temporary directory and merged in. This avoids the CLI's non-empty-directory
interactive merge prompt and guarantees the documents are untouched.

```powershell
$src  = "C:\Users\kisho\Desktop\expense-tracker\expense-tracker-client"
$dst  = "C:\Users\kisho\Desktop\expense-tracker\expense-tracker-angular"
$tmp  = "$env:TEMP\et-angular-scaffold"

# 1. validate the command without writing anything
npx --yes @angular/cli@21 new expense-tracker-angular `
  --directory $tmp --dry-run `
  --style css --test-runner vitest --zoneless --standalone --strict `
  --routing --skip-git --package-manager npm --ai-config none `
  --file-name-style-guide 2025

# 2. real scaffold
npx --yes @angular/cli@21 new expense-tracker-angular `
  --directory $tmp `
  --style css --test-runner vitest --zoneless --standalone --strict `
  --routing --skip-git --package-manager npm --ai-config none `
  --file-name-style-guide 2025

# 3. merge into the target (PORTING_*.md are not scaffold files, so nothing is overwritten)
Copy-Item "$tmp\*" -Destination $dst -Recurse -Force
Remove-Item $tmp -Recurse -Force
```

Flags rationale:

* `--style css` — the source is plain CSS; no preprocessor, no utility framework.
* `--zoneless` — removes `zone.js` entirely (checklist 1).
* `--strict` — strict TS + stricter budgets (checklist 1, 211).
* `--test-runner vitest` — Angular 21 default unit-test runner (checklist 13).
* `--file-name-style-guide 2025` — `app.ts` / `app.html` / `app.css` naming (the current guide).
* `--skip-git` — the workspace root is not a git repository; do not create one unasked. A
  `.gitignore` is still written (checklist: hygiene).

Then add the dependencies:

```powershell
Set-Location $dst
npm i @angular/material@21.2.14 @angular/cdk@21.2.14 chart.js@4.5.1 ng2-charts@10.0.0
npm i -D jsdom
```

> **Do not run `ng add @angular/material`.** That schematic injects a Material prebuilt theme
> into global styles and registers animation providers, which would pollute the hand-written CSS
> and break pixel parity. Material/CDK are installed as plain packages: CDK is used only for
> behaviour (`CdkTrapFocus` in the modal), and `@angular/cdk` is additionally a hard peer
> dependency of `ng2-charts@10`.

Exit criteria for Stage 0: `ng build` succeeds on the untouched scaffold; `ng test` runs (with
`jsdom` present) and reports zero tests found; `ng lint` is configured and clean.

---

## 3. Configuration mapping

| Source artefact | Target artefact | What must carry over |
| --- | --- | --- |
| `vite.config.js` → `base: env.VITE_BASE \|\| '/'` | `angular.json` → `build.options.baseHref` **and** `<base href="/">` in `src/index.html` | checklist 17, 65. `PathLocationStrategy` reads the `<base href>`, so both are needed |
| `vite.config.js` → `server.proxy['/api'] = DEV_API_TARGET` | `proxy.conf.json` referenced from `angular.json` → `serve.options.proxyConfig` | checklist 18 |
| `.env` → `VITE_API_URL=/api`, `DEV_API_TARGET=https://expence-tracker-server-two.vercel.app/api`, `VITE_BASE=/` | `src/environments/environment.development.ts` (`apiUrl: '/api'`, `devApiTarget: …`) + `proxy.conf.json` | dev parity |
| `.env.production` → `VITE_API_URL=https://expence-tracker-server-two.vercel.app/api` | `src/environments/environment.ts` (`apiUrl: 'https://expence-tracker-server-two.vercel.app/api'`) | prod parity |
| `.env` / `.env.production` selection | `angular.json` → `configurations.development.fileReplacements` swapping `environment.ts` ⇄ `environment.development.ts` | checklist 16 |
| `index.html` | `src/index.html` | `lang="en"`, charset, favicon link, viewport, description, `theme-color="#dc2626"`, two `preconnect` links, Plus Jakarta Sans `wght@400;500;600;700;800&display=swap`, title. Body child becomes `<app-root></app-root>` and the Vite module script is replaced by Angular's build output. Add `<base href="/">` |
| `src/main.jsx` | `src/main.ts` + `src/app/app.config.ts` | `bootstrapApplication(App, appConfig)`; `index.css` → global `styles` array |
| `src/index.css` + `src/App.css` (plain global CSS) | `angular.json` → `build.options.styles` = ordered array of `src/styles/*.css` | checklist 19–28. Global (not component-scoped) CSS is mandatory so the cascade, specificity, `:nth-child`, `[data-theme='dark']`, `::selection` and `::-webkit-scrollbar` rules behave identically |
| `.oxlintrc.json` | `eslint.config.js` (ESLint 9 flat + `angular-eslint` + `typescript-eslint`) | checklist 14 |
| `public/favicon.svg` | `public/favicon.svg` (Angular `public/` is copied verbatim) | checklist 31 |
| `package.json` | `package.json` | `start`/`build`/`test`/`lint` scripts; `name: "expense-tracker-angular"` |

`proxy.conf.json`:

```json
{
  "/api": {
    "target": "https://expence-tracker-server-two.vercel.app",
    "secure": true,
    "changeOrigin": true,
    "logLevel": "warn"
  }
}
```

Equivalence note (verified empirically): the source's `vite.config.js` forwards `/api` to
`env.DEV_API_TARGET || 'http://localhost:5000'`, and Vite's bundled `http-proxy-3`
(`setupOutgoing`) computes `outgoing.path = urlJoin(target.pathname, req.url)`. Because
`.env` sets `DEV_API_TARGET=https://expence-tracker-server-two.vercel.app/api`, the target
pathname **is** `/api`, so the source dev server rewrites `/api/auth/profile` to
`/api/api/auth/profile`. Verified live:

```
GET http://localhost:5173/api/auth/profile  -> 404   (source dev proxy, double /api)
GET https://expence-tracker-server-two.vercel.app/api/auth/profile  -> 401  (correct)
GET https://expence-tracker-server-two.vercel.app/api/api/auth/profile -> 404
```

The `http://localhost:5000` alternative in the source `.env` has pathname `/` and therefore
works, so the double prefix is a latent bug of the currently-active value only. The Angular
proxy therefore targets the bare **origin** (`changeOrigin` on, `secure` on), which yields
`/api/auth/profile` — the *intended* source behaviour — and the commented `http://localhost:5000`
alternative drops in unchanged for the same reason (both have pathname `/`). No `pathRewrite`
is needed. Production is unaffected either way: `VITE_API_URL` is absolute and bypasses the
proxy entirely. This discrepancy is recorded in `PORTING_REPORT.md`.

---

## 4. Complete source → target file mapping

### 4.1 Target tree

```
expense-tracker-angular/
├── angular.json, package.json, tsconfig.json, tsconfig.app.json,
│   tsconfig.spec.json, eslint.config.js, vitest.config.ts,
│   proxy.conf.json, .gitignore
├── PORTING_INVENTORY.md, PORTING_PLAN.md, PORTING_REPORT.md
├── public/
│   └── favicon.svg                                  ← copied from source public/favicon.svg
└── src/
    ├── index.html                                   ← source index.html (+ <base href>)
    ├── main.ts                                      ← source src/main.jsx
    ├── styles/
    │   ├── 01-tokens.css                            ← :root/[data-theme] vars, body gradients
    │   ├── 02-base.css                              ← source src/index.css
    │   ├── 03-animations.css                        ← 9 @keyframes + reduced-motion block
    │   ├── 04-components.css                        ← source src/App.css (all ~214 rules)
    │   └── 05-imports.css                           ← remaining responsive/print rules (if any)
    ├── environments/
    │   ├── environment.ts
    │   └── environment.development.ts
    └── app/
        ├── app.ts / app.html / app.config.ts / app.routes.ts
        ├── core/
        │   ├── guards/auth.guard.ts
        │   ├── interceptors/auth.interceptor.ts
        │   ├── api/
        │   │   ├── api.config.ts
        │   │   ├── auth-api.ts
        │   │   ├── preferences-api.ts
        │   │   ├── expense-api.ts
        │   │   └── import-api.ts
        │   ├── stores/
        │   │   ├── auth.store.ts
        │   │   ├── theme.store.ts
        │   │   └── preferences.store.ts
        │   ├── models/
        │   │   ├── auth.model.ts
        │   │   ├── preferences.model.ts
        │   │   ├── expense.model.ts
        │   │   ├── import.model.ts
        │   │   └── ui.model.ts          (DateRange, ChartFilter, ThemePreference, ResolvedTheme)
        │   └── utils/
        │       ├── expense-icons.ts
        │       ├── formatters.ts
        │       ├── date-range.ts
        │       ├── http-error.ts
        │       └── storage.ts
        ├── shared/
        │   ├── avatar/avatar.ts + avatar.html + avatar.spec.ts
        │   ├── alert/alert.ts + alert.html + alert.spec.ts
        │   ├── empty-state/empty-state.ts + empty-state.html + empty-state.spec.ts
        │   ├── expense-form/expense-form.ts + .html + .spec.ts
        │   └── expense-modal/expense-modal.ts + .html + .spec.ts
        ├── layout/
        │   └── navbar/navbar.ts + navbar.html + navbar.spec.ts
        └── features/
            ├── auth/
            │   ├── login/login.ts + .html + .spec.ts
            │   └── register/register.ts + .html + .spec.ts
            ├── dashboard/
            │   ├── dashboard.ts + dashboard.html + dashboard.spec.ts
            │   ├── dashboard.store.ts + dashboard.store.spec.ts
            │   └── components/
            │       ├── time-filter.ts + .html + .spec.ts
            │       ├── expense-list.ts + .html + .spec.ts
            │       └── charts.ts + charts.html + charts.spec.ts
            │   └── charts/
            │       ├── chart-theme.ts                 (palettes, theme tokens, fadedOpacity)
            │       ├── chart-data.ts                  (categoryData/paymentData/trendData derivation)
            │       ├── chart-options.ts               (chart.js option factories)
            │       ├── external-tooltip.ts            (custom tooltip handler)
            │       └── percent-labels.plugin.ts       (outside % labels + connector lines)
            ├── profile/profile.ts + .html + .spec.ts
            └── import/import-page.ts + .html + import.store.ts + .spec.ts
```

### 4.2 File-by-file mapping

| # | Source file | Target files | Notes |
| --- | --- | --- | --- |
| 1 | `.env` | `src/environments/environment.development.ts`, `proxy.conf.json` | `/api` dev base URL; commented localhost alternative |
| 2 | `.env.production` | `src/environments/environment.ts` | absolute production base URL |
| 3 | `.gitignore` | `.gitignore` | keep source entries (`node_modules`, `dist`, `.env*`), add Angular ones (`/.angular/`, `/.nx/`) |
| 4 | `.oxlintrc.json` | `eslint.config.js` | `react/rules-of-hooks` / `only-export-components` have no Angular analogue; replaced by `angular-eslint` recommended + `@typescript-eslint` recommended-type-checked |
| 5 | `index.html` | `src/index.html` | verbatim head, `<base href="/">`, `<app-root>` |
| 6 | `package.json` | `package.json` | `start`, `build`, `test`, `lint` scripts |
| 7 | `README.md` | `README.md` | rewritten for Angular 21 (Angular has no `npm run preview`) |
| 8 | `vite.config.js` | `angular.json`, `proxy.conf.json`, `src/index.html` | base/proxy split as described in §3 |
| 9 | `public/favicon.svg` | `public/favicon.svg` | byte-identical copy |
| 10 | `src/index.css` (248 ln) | `src/styles/02-base.css` | reset, `html`/`body`, `::selection`, `.visually-hidden`, `:focus-visible`, scrollbars; `#root` → **`app-root`** |
| 11 | `src/App.css` (2906 ln) | `src/styles/04-components.css` | all ~214 class rules + 5 breakpoints + nth-child delays; recharts overrides re-pointed (§6.3) |
| 12 | `src/App.jsx` (70 ln) | `src/app/app.routes.ts`, `src/app/app.html`, `src/app/app.ts`, `core/guards/auth.guard.ts` | route table, `ProtectedRoute` → `authGuard`, `basename` → `baseHref`, layout wrapper |
| 13 | `src/main.jsx` (10 ln) | `src/main.ts`, `src/app/app.config.ts` | `bootstrapApplication`; providers below |
| 14 | `src/components/Avatar.jsx` | `shared/avatar/avatar.ts` + `.html` | props → `input()` signals: `name`, `photo`, `size`, `className` |
| 15 | `src/components/Charts.jsx` (376 ln) | `features/dashboard/components/charts.ts` + `.html` + `charts/chart-{theme,data,options}.ts`, `charts/external-tooltip.ts`, `charts/percent-labels.plugin.ts` | Recharts → Chart.js, detailed in §6 |
| 16 | `src/components/ExpenseForm.jsx` | `shared/expense-form/expense-form.ts` + `.html` | `noValidate` form → `FormGroup` with `novalidate` attribute, manual validation preserved in the submit handler |
| 17 | `src/components/ExpenseList.jsx` | `features/dashboard/components/expense-list.ts` + `.html` | `confirmId` signal + `setTimeout` clear; inline SVG icons moved to the template |
| 18 | `src/components/ExpenseModal.jsx` | `shared/expense-modal/expense-modal.ts` + `.html` | CDK `CdkTrapFocus` replaces the hand-rolled `Tab` trap; body scroll lock, `Escape`, focus restore kept |
| 19 | `src/components/Navbar.jsx` (277 ln) | `layout/navbar/navbar.ts` + `.html` | three menus, two outside-click listeners, `Escape`, body scroll lock, drawer |
| 20 | `src/components/TimeFilter.jsx` | `features/dashboard/components/time-filter.ts` + `.html` | `getRange` moves to `core/utils/date-range.ts` |
| 21 | `src/context/AuthContext.jsx` | `core/stores/auth.store.ts` + `core/api/auth-api.ts` | `user`/`loading` signals, `login`/`register`/`logout`, boot `GET /auth/profile` |
| 22 | `src/context/PreferencesContext.jsx` | `core/stores/preferences.store.ts` + `core/api/preferences-api.ts` | `emptyPrefs`, cancel-guarded fetch on user change |
| 23 | `src/context/ThemeContext.jsx` | `core/stores/theme.store.ts` | `theme`/`resolved`/`setTheme`, `matchMedia` listener, `data-theme` on `<html>` |
| 24 | `src/pages/Dashboard.jsx` (362 ln) | `features/dashboard/dashboard.ts` + `.html` + `dashboard.store.ts` + `core/api/expense-api.ts` | all 11 signals move into the store; template holds presentation only |
| 25 | `src/pages/Import.jsx` (363 ln) | `features/import/import-page.ts` + `.html` + `import.store.ts` + `core/api/import-api.ts` | file input + `entries` + `totals` + `categoryOptions` |
| 26 | `src/pages/Login.jsx` | `features/auth/login/login.ts` + `.html` | reactive form, `novalidate` not needed (native `required` kept) |
| 27 | `src/pages/Profile.jsx` (483 ln) | `features/profile/profile.ts` + `.html` | 5 sub-forms, 4 s message timer, tags, danger zone |
| 28 | `src/pages/Register.jsx` | `features/auth/register/register.ts` + `.html` | mismatch + length checks before the request |
| 29 | `src/utils/api.js` | `core/interceptors/auth.interceptor.ts` + `core/api/api.config.ts` | request/response interceptor pair → one `HttpInterceptorFn` |
| 30 | `src/utils/expenseIcons.js` | `core/utils/expense-icons.ts` | `CATEGORY_ICONS`, `FALLBACK_ICONS`, `getCategoryIcon` |

Files with **no source counterpart** (new, required by the brief):

| Target file | Purpose |
| --- | --- |
| `core/models/*.ts` | every type from inventory §11, no `any` |
| `core/utils/formatters.ts` | `formatCurrency` (2-digit), `formatCurrency0`, `formatAxisCurrency`, `formatDate`, `formatJoinDate`, `capitalise`, `paymentLabel`, `PAYMENT_LABELS` — deduplicated from the 4 source copies (checklist 213) |
| `core/utils/http-error.ts` | `extractErrorMessage(err, fallback)` = `err.error?.message \|\| fallback`, the exact axios→HttpErrorResponse translation of `err.response?.data?.message` (checklist 58) |
| `core/utils/storage.ts` | `TOKEN_KEY`, `USER_KEY`, `THEME_KEY` + guarded `readJson`/`writeJson`/`remove` |
| `core/guards/auth.guard.ts` | functional `authGuard` |
| `shared/alert/*` | one alert banner component used 6× in the source (`type`, optional `dismissible`, `role=alert`/`status`) — removes duplication without changing markup |
| `shared/empty-state/*` | one empty-state component for `ExpenseList` (icon/heading/body/CTA) and `Profile` loading (`⏳`, no `h3`) |

### 4.3 `app.config.ts` providers (source provider order preserved)

| Source | Target |
| --- | --- |
| `<ThemeProvider>` → `<AuthProvider>` → `<PreferencesProvider>` → `<BrowserRouter>` | `ThemeStore` / `AuthStore` / `PreferencesStore` are `providedIn: 'root'` injectable signal stores, so the nesting is replaced by DI. `PreferencesStore` `inject()`s `AuthStore` to reproduce the `[user]` dependency exactly |
| `axios.create({ baseURL })` | `provideHttpClient(withInterceptors([authInterceptor]))` |
| `<BrowserRouter basename>` | `provideRouter(routes, withComponentInputBinding())` |
| — | `provideCharts(withDefaultRegisterables())` (required by `ng2-charts`) |
| — | `provideBrowserGlobalErrorListeners()` (CLI default, keep) |
| — | `provideAnimationsAsync()` **not** added — nothing in the port uses Angular animations; CSS keyframes only |

---

## 5. React → Angular idiom mapping

| React | Angular 21 equivalent | Parity caution |
| --- | --- | --- |
| `useState` | `signal()` | — |
| derived value | `computed()` | — |
| `useEffect(..., deps)` | `effect(() => …)` + explicit dep list, cleanup inside the effect body | `effects` run after CD; the three store bootstraps and four document listeners must guard against re-running |
| `useEffect(..., [])` on mount | one-shot in `effect` with a `started` flag, or `afterNextRender` | the auth bootstrap must run exactly once |
| `useMemo` | `computed()` | — |
| `useCallback` | plain private methods (stability is irrelevant to template CD) | — |
| `useRef` for DOM | `viewChild()` / `ElementRef` | `fileInputRef.current.value = ''` → `this.fileInput().nativeElement.value = ''` |
| `useRef` for mutable non-state | plain private field | — |
| props | `input()` signals | — |
| `onX` callbacks | `output()` signals | — |
| `<Context.Provider>` | `providedIn: 'root'` signal store | — |
| `useNavigate()` | `inject(Router)` | `navigate('/x')` vs `router.navigate(['/x'])` |
| `<Navigate replace>` | `UrlTree` from the guard, or `redirectTo` in the route table | `createUrlTree(['/login'], { replaceUrl: true })` |
| `<Link>` / `<NavLink>` | `routerLink` / `routerLinkActive` | `NavLink` `end` → `[routerLinkActiveOptions]="{ exact: true }"` |
| conditional render `{cond && …}` | `@if` / `@else` | — |
| `.map()` | `@for (item of items; track item._id)` | `key` → `track` |
| `.map()` over the 8 palette entries in `Charts` | `@for` with `track $index` | source `key={idx}` there |
| `className={cls}` | `[class]` / `[class.x]` / `class="a b"` | keep class-name strings byte-identical so `App.css` needs no edits |
| inline `style={{ animationDelay }}` | `[style.animationDelay]="delay + 's'"` | — |
| inline `style={{ width: size }}` | `[style.width.px]="size()"` | — |
| inline `style` on the custom tooltip | build the DOM string in the tooltip handler | see §6.4 |
| `document.addEventListener` + cleanup | `effect()` body adds/removes, or `inject(DestroyRef).onDestroy` | — |
| `setTimeout` | `setTimeout` + `DestroyRef` clear, or `effect` cleanup | Profile 4 s message timer, delete 2.5 s confirm |
| `window.confirm` | `window.confirm` (kept as-is, it is source behaviour) | checklist 189 |

---

## 6. Charts: Recharts → Chart.js (`ng2-charts`)

Recharts renders SVG with declarative props; Chart.js renders a canvas that must be configured
option-by-option. Every visual constant is reproduced explicitly.

### 6.1 Shared plumbing

| Recharts | Chart.js equivalent |
| --- | --- |
| `<ResponsiveContainer width="100%" height={260}>` | wrapper `<div class="chart-canvas-wrap">` with `height: 260px; position: relative`, chart options `responsive: true, maintainAspectRatio: false` (checklist 140) |
| `animationDuration={800}` / `{1200}` | `animation: { duration: 800 \| 1200, easing: 'easeOutQuart' }` (closest to `ease-out`) |
| `style={CHART_CURSORS}` (`cursor: pointer`) | `options.onHover = (e, els) => { e.native.target.style.cursor = els.length ? 'pointer' : 'default' }` |
| `onClick={(state) => …}` | `BaseChartDirective` output `(chartClick)`, read `event.active[0].index` |
| `fill`/`opacity`/`stroke`/`strokeWidth` per `<Cell>` | dataset arrays: `backgroundColor[]`, `borderColor[]`, `borderWidth[]` |
| `cx="50%" cy="50%" innerRadius={60} outerRadius={100}` | `radius: 100, cutout: 60` (both accept pixel numbers in Chart.js, matching Recharts' pixel radii inside the fixed 260 px box) |
| `paddingAngle={3}` | `borderWidth: 4.2, borderColor: <slice colour>, borderAlign: 'inner'` — Recharts shrinks each side by `paddingAngle/2` degrees at the mid radius `(60+100)/2 = 80`, i.e. `3·π/180·80 ≈ 4.19 px` |
| `paddingAngle={5}` (payment) | `borderWidth: 7.0` (`5·π/180·80 ≈ 6.98 px`) |
| `radius={[0, 6, 6, 0]}` (bar) | `borderRadius: { topLeft: 0, bottomLeft: 0, topRight: 6, bottomRight: 6 }` |
| `stroke="#ef4444" strokeWidth={2.5}` on `<Area>` | dataset `borderColor: '#ef4444'`, `borderWidth: 2.5` |
| `type="monotone"` | `cubicInterpolationMode: 'monotone', tension: 0` |
| `fill="url(#colorAmt)"` gradient | scriptable `backgroundColor: (ctx) => vertical gradient` built with `ctx.chart.ctx.createLinearGradient(...)`, stops `rgba(areaGradientTop, 0.3)` → `rgba(areaGradientTop, 0)` at 95 % |
| `type="number"` + `tickFormatter` | `scales.<axis>.ticks.callback = (v) => \`₹${(v / 1000).toFixed(0)}k\`` |
| `tick={{ fill: tickColor }} fontSize={12}` | `ticks: { color: tickColor, font: { size: 12 } }` |
| `<CartesianGrid strokeDasharray="3 3" stroke={gridColor} />` | `scales.*.grid: { color: gridColor, borderDash: [3, 3] }` on **both** axes (Recharts draws both directions by default) |
| default Recharts axis line `#666` | `scales.*.border: { color: '#666' }` (Chart.js default `#666` is kept explicit) |
| `<Pie label={fn}>` with `labelLine: true` (payment chart only) | custom plugin `percent-labels.plugin.ts` drawing `${name} ${(percent*100).toFixed(0)}%` outside each arc **with** connector lines |
| category `<Pie>` has **no** `label` prop | **no** slice labels — verified in `node_modules/recharts/es6/polar/Pie.js`: `defaultPieProps.label === false`, so nothing is drawn (do not add labels) |
| `Pie.defaultProps.stroke === '#fff'` | every `<Cell>` in the source sets `stroke` explicitly (`'transparent'` or `activeStroke`), so Chart.js uses `borderColor: 'transparent'` for inactive arcs |

### 6.2 Chart-card inventory (3 cards, unchanged)

1. **By Category** — `📊` heading + `chart-active-badge` + Pie/Bar switch. Pie mode: doughnut
   (100/60, gap 4.2 px), themed legend below, Recharts-**default** tooltip. Bar mode: horizontal
   bar (`indexAxis: 'y'`), `₹Nk` value axis, 90 px category axis, **custom** tooltip.
2. **By Payment Method** — `💳` heading + badge. Doughnut (100/60, gap 7 px), outside
   `${name} ${pct}%` labels with connector lines, method colours
   (`cash` `#a1a1aa`/`#374151`, `upi` `#4ade80`/`#16a34a`, `bank` `#f59e0b`/`#d97706`),
   Recharts-**default** tooltip.
3. **Daily Trend** (`.wide`) — `📈` heading. Line chart, `#ef4444` stroke 2.5, gradient fill,
   1200 ms animation, `₹Nk` value axis, **custom** tooltip.

All three return `null` when `summary` is falsy (checklist 128) and show their own
`.chart-placeholder` copy when their dataset is empty (checklist 136).

### 6.3 The four Recharts CSS overrides (they cannot survive the library swap)

`App.css` lines 1343–1362 style Recharts' own DOM. Chart.js paints a canvas, so each override
must be re-implemented:

| CSS override | Re-implementation |
| --- | --- |
| `.recharts-default-tooltip { background: var(--card-bg); border: 1px solid var(--border); border-radius: 12px; box-shadow: var(--shadow-md) }` | `defaultTooltipStyle()` in `external-tooltip.ts`, reading the CSS variables through `getComputedStyle` so light/dark keep working |
| `.recharts-tooltip-label { color: var(--text); font-weight: 700 }` | same helper — the label `<div>` gets `color: var(--text); font-weight: 700` |
| `.recharts-legend-item-text { color: var(--text-secondary); font-size: 12px }` | replaced by `.chart-legend-item-text` on the custom legend; the **inline** `color: legendColor; font-size: 13` from the source `Legend.formatter` wins over this rule, so the rendered label must be **13 px in `legendColor`** (dark `#a1a1aa`, light `#555555`) — the CSS rule is retained for structural parity only |
| `.recharts-cartesian-grid line { stroke: var(--border) }` | **cannot be done in CSS** (canvas) — note that the *source prop* `stroke={gridColor}` (dark `#303038`, light `#fecaca`) is what is actually visible, so `grid.color` uses `gridColor`. The dead `var(--border)` override is not reproduced; this is the one deliberate CSS-rule drop and it is documented in the report |

New CSS introduced for the canvas (added to `04-components.css`, mirroring the Recharts layout it
replaces): `.chart-canvas-wrap` (260 px, relative), `.chart-legend`, `.chart-legend-item`,
`.chart-legend-swatch` (14 × 14, matching `Legend.defaultProps.iconSize = 14`), and
`.chart-legend-item-text`.

### 6.4 Two different tooltips (easy to get wrong)

The source uses **two** tooltip designs and they must not be merged:

* **Recharts default tooltip** — `<Tooltip formatter={formatCurrency} />` on the two pie charts.
  Effective style: `background var(--card-bg)`, `border 1px solid var(--border)`, `radius 12px`,
  `box-shadow var(--shadow-md)`, **plus Recharts' untouched defaults** `padding: 10px`,
  `font-size: 12px`; label bold `var(--text)`; value = `formatCurrency` (0 digits).
* **Custom tooltip** — `makeTooltip(...)` used as `content` on the bar and area charts.
  Inline style: `background tooltipBg`, `border 1px solid tooltipBorder`, `radius 12`,
  `padding '10px 14px'`, `box-shadow '0 8px 24px rgba(0,0,0,0.25)'`, `font-size 13`, label bold
  `tooltipText`, value `#ef4444` at weight 600 with `margin-top: 4px`.

`external-tooltip.ts` therefore exposes two factories, `defaultPieTooltip` and `customTrendTooltip`,
both returning a Chart.js `TooltipItem[]` that reproduces the exact DOM (`<div>` wrapping two
`<p>` elements for the custom variant).

---

## 7. Build order

Every stage ends with `ng build` and `ng lint` passing. Stages are ordered so that each one is
independently verifiable and so the highest-risk dependency (Chart.js) is reached with a working
application around it.

| Stage | Contents | Exit criteria |
| --- | --- | --- |
| **S0** | scaffold + dependencies + §3 configuration | build/test/lint all run on the clean scaffold |
| **S1** | `src/index.html`, `src/styles/*` (tokens, base, animations, all of `App.css`), `public/favicon.svg`, `styles` array, `baseHref` | tokens resolve in light and dark; every source class exists in the compiled CSS |
| **S2** | `core/models/*`, `core/utils/*`, `environments`, `api.config.ts`, `auth.interceptor.ts` | unit tests for utils pass; interceptor spec passes |
| **S3** | `auth.store.ts`, `theme.store.ts`, `preferences.store.ts` | store specs pass (bootstrap, 401, theme listener, prefs cancel-guard) |
| **S4** | `app.ts` / `app.html` / `app.config.ts` / `app.routes.ts`, `auth.guard.ts`, `layout/navbar/*` | all 6 routes reachable; navbar renders on every route; guard redirects unauthenticated users |
| **S5** | `shared/avatar`, `shared/alert`, `shared/empty-state`, `shared/expense-form`, `shared/expense-modal` | specs pass; modal focus trap + scroll lock + Escape work |
| **S6** | `features/auth/login`, `features/auth/register` | first end-to-end vertical slice: interceptor → store → route → form; build clean |
| **S7** | `features/dashboard/dashboard.ts` + `dashboard.store.ts` + `time-filter` + `expense-list` | shell, summary cards, toolbar filters, list states, FAB all render against a stubbed summary |
| **S8** | `features/dashboard/charts/*` (Chart.js) — **highest-risk stage** | three charts render with theme-correct palettes, both tooltip designs, legends, click cross-filtering, empty placeholders |
| **S9** | `features/profile/*` | all 7 setting cards, 5 forms, 4 s banner, delete-account flow |
| **S10** | `features/import/*` + `core/api/import-api.ts` | upload, parse, editable preview, totals, bulk import, reset |
| **S11** | specs for every stage (see §8) | `ng test` green |
| **S12** | full `PORTING_REPORT.md`, 217-item checklist marked `PASS` with target files, source checksum verification | all quality gates green |

De-risking rationale: S1 is large but mechanical and fully independent; S2–S4 build the request
pipeline and routing so that S6 can be validated end-to-end before the two heaviest UI stages
(charts and the dashboard) begin.

---

## 8. Test plan (`ng test`, Vitest + jsdom, `TestBed` + `HttpTestingController`)

| Spec | Covers |
| --- | --- |
| `core/utils/expense-icons.spec.ts` | known icons, falsy → `📦`, deterministic hash fallback, stability across calls |
| `core/utils/formatters.spec.ts` | `en-IN` INR output for 2-digit, 0-digit and `₹Nk` axis variants; `formatDate`, `formatJoinDate` (`—` fallback), `capitalise`, `paymentLabel` (upi/bank/cash fallbacks) |
| `core/utils/date-range.spec.ts` | all five ranges incl. Monday arithmetic, local-midnight starts, `custom` → `{null, null}` |
| `core/utils/http-error.spec.ts` | server message wins, fallback used when absent, `null` body |
| `core/interceptors/auth.interceptor.spec.ts` | `Authorization` header added when a token exists / omitted when not; 401 clears both keys and re-throws |
| `core/guards/auth.guard.spec.ts` | `true` when `user()` set, `UrlTree('/login')` with `replaceUrl` when not |
| `core/stores/auth.store.spec.ts` | synchronous `user` hydration, silent `token && !user` bootstrap, whole response stored, `loading` transitions, logout clears keys + signal |
| `core/stores/theme.store.spec.ts` | initial value, persistence, `data-theme` written on `<html>`, `matchMedia` change in `system` mode, listener removed on switch |
| `core/stores/preferences.store.spec.ts` | reset to `emptyPrefs` on logout, cancel-guard on user swap, every mutation returns the refreshed object, `encodeURIComponent` on delete paths |
| `shared/avatar/avatar.spec.ts` | initials (2 words max, `?` fallback), hue determinism, `size`/`className`/`photo` handling |
| `shared/expense-form/expense-form.spec.ts` | create vs edit initialisation, both validation messages in order, quick amounts, income payload (no `upiApp`, forced `bank`), submit labels |
| `shared/expense-modal/expense-modal.spec.ts` | renders only when `open`, title/label by `editing`, Escape and overlay click close, focus trap + restore, scroll lock |
| `layout/navbar/navbar.spec.ts` | auth-aware links, theme `aria-checked` + `✓`, mutual exclusion of menus, outside click, Escape, drawer open/close, logout path |
| `features/auth/login/login.spec.ts`, `register/register.spec.ts` | field attributes, validation order, spinner labels, error banner copy, navigation on success |
| `features/dashboard/dashboard.store.spec.ts` | param building, `fetchExpenses` + silent `fetchSummary`, add/edit/delete mutations, summary refetch policy, time-range clears month |
| `features/dashboard/components/time-filter.spec.ts` | default `month` tab, emitted ranges, `Apply` disabled until both dates, end-of-day extension |
| `features/dashboard/components/expense-list.spec.ts` | skeleton/empty/rows branches, filter-aware copy, income rendering, two-click delete with 2.5 s reset, animation delay |
| `features/dashboard/charts/chart-data.spec.ts` | sorted category data, `> 0` payment filter, `localeCompare` day sort, empty detection |
| `features/dashboard/charts/chart-options.spec.ts` | doughnut radii/gap widths, palette + fade + active stroke arrays, `₹Nk` tick callback, click index → filter |
| `features/dashboard/dashboard.spec.ts` | summary cards and count copy, toolbar filters, `hasFilters`, chart-filter badge and toggling, FAB, modal wiring |
| `features/profile/profile.spec.ts` | loading state, stat cards, theme radios, category/UPI add-remove with duplicate guard, password mismatch + reset, bare logout, typed delete + `window.confirm` |
| `features/import/import-page.spec.ts` | file handling, multipart body, entry `toEntry` mapping, totals, type↔category coupling, payload with `bankName: null`, success copy, reset |

No source test exists to port (inventory §13), so every spec above is new and is written against
the ported behaviour, not invented behaviour.

---

## 9. Verification gates

Run after **every** stage, and again in full before the report:

```powershell
ng build --configuration development     # no errors
ng build --configuration production      # no errors, no budget breach
ng lint                                  # zero errors
ng test                                  # all green
```

Parity spot-checks performed once per stage in the browser (`ng serve`):

* light and dark theme toggling, plus OS-level `prefers-color-scheme` change while on `system`
* every route at each of the 5 breakpoints (1100 / 860 / 768 / 640 / 380)
* keyboard-only pass: Tab order, `Escape` on menus/drawer/modal, focus restore
* `data-theme` attribute on `<html>`; `prefers-reduced-motion` honoured
* network panel: exactly 18 endpoint shapes, correct verbs/query strings/payloads, `Authorization`
  header present, no extra headers, no retries, no timeouts
* final: checksum comparison proving the original project is byte-identical (checklist 217)

---

## 10. Known parity risks and decisions

| # | Risk | Decision |
| --- | --- | --- |
| 1 | Recharts DOM classes (`.recharts-*`) have no Chart.js counterpart | re-implemented in `external-tooltip.ts` + a custom HTML legend; `.recharts-cartesian-grid line` cannot be styled (canvas) and is deliberately dropped in favour of the `gridColor` prop the source actually renders; recorded in the report |
| 2 | Chart.js tick marks are not drawn (Recharts draws them) | accepted micro-difference; tick **labels**, colours and sizes match. Noted in the report |
| 3 | Component-scoped styles would break the shared cascade | all CSS stays global in `src/styles/*`; no component carries `styleUrls` |
| 4 | Explicit `Content-Type: multipart/form-data` on the import upload | axios deleted that header in the browser so XHR could add the boundary; the Angular equivalent is to pass `FormData` **without** a `Content-Type` header. Identical wire request, no boundary bug |
| 5 | Axios error shape (`err.response.data.message`) | `extractErrorMessage()` reads `HttpErrorResponse.error.message`; the mapping is 1:1, including the silent `.catch(() => {})` sites |
| 6 | `Signal Forms` are experimental in v21 | Reactive Forms used throughout (checklist 12) |
| 7 | Store bootstraps running more than once | each boot effect has an explicit once-guard, matching React's `[]` dependency semantics |
| 8 | Server `POST /expenses` ignores `type` | client payload kept byte-identical to the source; the quirk is preserved, not worked around |
| 9 | `ng2-charts@11` requires Angular ≥ 22 | pinned to `10.0.0` |
| 10 | `ng test` needs `jsdom` | verified missing from `@angular/build`'s dependencies; installed explicitly |

---

## 11. Out of scope (explicitly not invented)

Budgets, recurring transactions, CSV/PDF export, sorting UI, free-text search, pagination,
notifications/toasts, offline mode, PWA/service worker, i18n, multi-currency, avatar upload,
per-component theme overrides. The source has none of these and the port adds none
(inventory §8, checklist 212).