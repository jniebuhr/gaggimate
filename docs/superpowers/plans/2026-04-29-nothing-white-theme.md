# Nothing White Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a "Nothing White" (`nothing-light`) theme for GaggiMate Web UI — the inverted counterpart to the existing OLED-black `nothing` theme. Same typographic system, same red accent, flipped to a pure white base.

**Architecture:** Extend the daisyUI theme system with a new `nothing-light` theme. Mirror the `nothing` theme structure but invert base colors. Add a theme switcher toggle so users can flip between dark and light Nothing themes. All `nd-*` components and custom properties already defined under `html[data-theme='nothing']` will be cloned and inverted for `nothing-light`.

**Tech Stack:** Tailwind CSS, daisyUI v4, CSS custom properties, vanilla JS theme toggle

---

## File Structure

```
web/src/
├── style.css                                          # Add nothing-light daisyUI theme + CSS vars
├── pages/Home/
│   └── HomeModeCard.jsx                               # Theme-aware, no changes needed
└── components/                                        # All nd-* components inherit from CSS vars
```

---

## Design Decisions (for implementer)

**Scene sentence:** "Someone using their phone at noon in bright kitchen light, glancing at their espresso stats — they want clean, readable, no eye strain."

**Color strategy:** Restrained — signature red accent only (~8-10%), everything else white/gray. Same as `nothing` but inverted.

**Base palette (inverted from `nothing`):**
- `--color-base-100: #ffffff` (pure white)
- `--color-base-200: #f5f5f5`
- `--color-base-300: #eeeeee`
- `--color-base-content: #1a1a1a` (near-black text)
- `--color-primary: #d71921` (kept — Nothing's red)
- `--color-primary-content: #ffffff`
- `--color-accent: #d71921`
- `--color-accent-content: #ffffff`
- `--color-secondary: #e8e8e8`
- `--color-secondary-content: #1a1a1a`
- `--color-neutral: #f0f0f0`
- `--color-neutral-content: #666666`
- `--text-display: #000000`
- `--text-primary: #1a1a1a`
- `--text-secondary: #666666`
- `--text-disabled: #aaaaaa`

**Ring gauge colors (inverted):**
- `--home-ring-brew: #d71921`
- `--home-ring-standby: #e0e0e0`
- `--home-ring-steam: #d4a843`
- `--home-ring-water: #6699cc`
- `--home-ring-grind: #7cb876`
- `--home-ring-idle: rgba(0, 0, 0, 0.08)`
- `--home-ring-track: rgba(0, 0, 0, 0.04)`

---

## Tasks

### Task 1: Add `nothing-light` daisyUI theme to style.css

**Files:**
- Modify: `web/src/style.css` — add new `@plugin "daisyui/theme"` block after the `nothing` theme block

- [ ] **Step 1: Add nothing-light daisyUI theme**

Add this after the `html[data-theme='nothing']` block in `web/src/style.css`:

```css
/* Nothing White — inverted from nothing (OLED black) theme */
@plugin "daisyui/theme" {
  name: 'nothing-light';
  default: false;
  prefersdark: false;
  color-scheme: 'light';
  --color-base-100: oklch(100% 0 0);
  --color-base-200: oklch(98% 0 0);
  --color-base-300: oklch(96% 0 0);
  --color-base-content: oklch(19.133% 0.005 265.754);
  --color-primary: oklch(48.584% 0.186 13.118);
  --color-primary-content: oklch(100% 0 0);
  --color-secondary: oklch(93% 0.01 265.754);
  --color-secondary-content: oklch(19.133% 0.005 265.754);
  --color-accent: oklch(48.584% 0.186 13.118);
  --color-accent-content: oklch(100% 0 0);
  --color-neutral: oklch(98% 0.005 265.754);
  --color-neutral-content: oklch(50% 0.02 265.754);
  --color-info: oklch(65% 0.12 237.251);
  --color-info-content: oklch(100% 0 0);
  --color-success: oklch(72% 0.12 181.911);
  --color-success-content: oklch(100% 0 0);
  --color-warning: oklch(78% 0.14 82.95);
  --color-warning-content: oklch(20% 0.03 82.95);
  --color-error: oklch(48.584% 0.186 13.118);
  --color-error-content: oklch(100% 0 0);
  --radius-selector: 1rem;
  --radius-field: 0.5rem;
  --radius-box: 1rem;
  --size-selector: 0.25rem;
  --size-field: 0.25rem;
  --border: 1px;
  --depth: 0;
  --noise: 0;
}
```

- [ ] **Step 2: Add nothing-light CSS custom properties**

After the `html[data-theme='nothing']` block, add:

```css
html[data-theme='nothing-light'] {
  /* Base surfaces - pure white */
  --color-base-100: #ffffff;
  --color-base-200: #f8f8f8;
  --color-base-300: #f0f0f0;
  --color-base-content: #1a1a1a;

  /* Brand red accent - Nothing's signature color (kept) */
  --color-primary: #d71921;
  --color-primary-content: #ffffff;
  --color-accent: #d71921;
  --color-accent-content: #ffffff;

  /* Semantic */
  --color-secondary: #e8e8e8;
  --color-secondary-content: #1a1a1a;
  --color-neutral: #f5f5f5;
  --color-neutral-content: #666666;
  --color-info: #6699cc;
  --color-info-content: #ffffff;
  --color-success: #7cb876;
  --color-success-content: #ffffff;
  --color-warning: #d4a843;
  --color-warning-content: #000000;
  --color-error: #d71921;
  --color-error-content: #ffffff;

  /* Typography - inverted for light */
  --text-display: #000000;
  --text-primary: #1a1a1a;
  --text-secondary: #666666;
  --text-disabled: #aaaaaa;

  /* Ring gauge - muted grays for light */
  --home-ring-brew: #d71921;
  --home-ring-standby: #d0d0d0;
  --home-ring-steam: #d4a843;
  --home-ring-water: #6699cc;
  --home-ring-grind: #7cb876;
  --home-ring-idle: rgba(0, 0, 0, 0.08);
  --home-ring-track: rgba(0, 0, 0, 0.04);

  /* Spacing system (same as nothing) */
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-5: 1.25rem;
  --space-6: 1.5rem;
  --space-8: 2rem;
  --space-10: 2.5rem;
  --space-12: 3rem;

  /* Fonts (same as nothing) */
  --font-display: 'Doto', 'Space Grotesk', sans-serif;
  --font-heading: 'Doto', 'Space Grotesk', sans-serif;
  --font-body: 'Doto', 'Space Grotesk', sans-serif;
  --font-nd-mono: 'Doto', monospace;
}
```

- [ ] **Step 3: Add light-mode chart overrides**

Add inside the `html[data-theme='nothing-light']` block, before the closing `}`:

```css
  /* Chart overrides for white theme */
  --analyzer-hover-tooltip-bg: rgba(255, 255, 255, 0.96);
  --analyzer-hover-tooltip-border: rgba(0, 0, 0, 0.08);
  --analyzer-hover-tooltip-text: #1a1a1a;
  --analyzer-hover-tooltip-shadow: rgba(0, 0, 0, 0.12);
}

html[data-theme='nothing-light'] canvas {
  filter: saturate(0.9);
}

html[data-theme='nothing-light'] .chartjs-legend {
  font-family: var(--font-nd-mono, 'Space Mono', monospace) !important;
}

html[data-theme='nothing-light'] .chartjs-legend li {
  color: var(--text-secondary, #666) !important;
}

html[data-theme='nothing-light'] .chartjs-tooltip {
  font-family: var(--font-nd-mono, 'Space Mono', monospace) !important;
  background: rgba(255, 255, 255, 0.99) !important;
  border: 1px solid rgba(0, 0, 0, 0.08) !important;
  border-radius: 8px !important;
  color: #1a1a1a !important;
}
```

- [ ] **Step 4: Add inverted component styles for nothing-light**

Add at the bottom of the file (after all existing `nothing` component overrides):

```css
/* Nothing White component overrides — nd-* classes for light background */

html[data-theme='nothing-light'] .nd-card {
  background: #ffffff;
  border: 1px solid rgba(0, 0, 0, 0.08);
  box-shadow: 0 4px 24px -8px rgba(0, 0, 0, 0.12);
}

html[data-theme='nothing-light'] .nd-stat {
  background: #f8f8f8;
  border: 1px solid rgba(0, 0, 0, 0.06);
}

html[data-theme='nothing-light'] .nd-stat-value {
  color: #1a1a1a;
}

html[data-theme='nothing-light'] .nd-stat-label {
  color: #666666;
}

html[data-theme='nothing-light'] .nd-segmented {
  background: #f0f0f0;
}

html[data-theme='nothing-light'] .nd-segmented-control--active {
  background: #1a1a1a;
  color: #ffffff;
}

html[data-theme='nothing-light'] .nd-ring-track {
  stroke: rgba(0, 0, 0, 0.06);
}

html[data-theme='nothing-light'] .nd-popover {
  background: #ffffff;
  border: 1px solid rgba(0, 0, 0, 0.08);
  box-shadow: 0 8px 32px -8px rgba(0, 0, 0, 0.2);
}

html[data-theme='nothing-light'] .nd-input {
  background: #ffffff;
  border: 1px solid rgba(0, 0, 0, 0.12);
  color: #1a1a1a;
}

html[data-theme='nothing-light'] .nd-input:focus {
  border-color: #d71921;
}

html[data-theme='nothing-light'] .nd-input::placeholder {
  color: #aaaaaa;
}

html[data-theme='nothing-light'] .nd-input-unit {
  background: #f5f5f5;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-left: none;
  color: #666666;
}

html[data-theme='nothing-light'] .nd-toggle {
  background: #f0f0f0;
  border: 1px solid rgba(0, 0, 0, 0.08);
}

html[data-theme='nothing-light'] .nd-toggle--active {
  background: #d71921;
  border-color: #d71921;
}

html[data-theme='nothing-light'] .nd-toggle-thumb {
  background: #666666;
}

html[data-theme='nothing-light'] .nd-toggle--active .nd-toggle-thumb {
  background: #ffffff;
}

html[data-theme='nothing-light'] .nd-day-btn {
  background: #ffffff;
  border: 1px solid rgba(0, 0, 0, 0.08);
  color: #666666;
}

html[data-theme='nothing-light'] .nd-day-btn:hover {
  border-color: rgba(0, 0, 0, 0.16);
  color: #1a1a1a;
}

html[data-theme='nothing-light'] .nd-day-btn--active {
  background: #d71921;
  border-color: #d71921;
  color: #ffffff;
}

/* Home page surfaces for nothing-light */
html[data-theme='nothing-light'] .home-surface {
  background: #ffffff;
}

html[data-theme='nothing-light'] .home-surface-muted {
  background: #f5f5f5;
}

html[data-theme='nothing-light'] .home-surface-strong {
  background: #ffffff;
}

html[data-theme='nothing-light'] .home-border {
  border-color: rgba(0, 0, 0, 0.08);
}

html[data-theme='nothing-light'] .home-shadow-strong {
  rgba(0, 0, 0, 0.15);
}

html[data-theme='nothing-light'] .home-header-surface {
  background: #f8f8f8;
}

html[data-theme='nothing-light'] .home-info-pill {
  background: #f5f5f5;
  border-color: rgba(0, 0, 0, 0.06);
}

html[data-theme='nothing-light'] .home-mobile-pill {
  background: #f5f5f5;
  border-color: rgba(0, 0, 0, 0.06);
}
```

- [ ] **Step 5: Verify daisyUI theme loads correctly**

Run: `grep -n "nothing-light" web/src/style.css`
Expected: Theme block and CSS vars found

Run local dev server `http://localhost:5180/`, open browser devtools, run:
```js
document.documentElement.setAttribute('data-theme', 'nothing-light')
```
Expected: Page turns white with red accents, no layout breakage

- [ ] **Step 6: Commit**

```bash
git add web/src/style.css
git commit -m "feat: add nothing-light theme (inverted Nothing white variant)"
```

---

### Task 2: Add theme switcher toggle to Settings page

**Files:**
- Modify: `web/src/pages/Settings/index.jsx` — add Nothing theme dark/light toggle

- [ ] **Step 1: Find theme toggle location**

Run: `grep -n "theme" web/src/pages/Settings/index.jsx | head -20`
Look for existing theme selector or Appearance section

- [ ] **Step 2: Add Nothing theme dark/light toggle**

In the Settings page, add a toggle that switches between `nothing` and `nothing-light` themes. This is specifically a toggle for the Nothing theme variant — not a general dark/light switcher.

The toggle should:
- Show current state: "Nothing Dark" / "Nothing Light"
- Persist choice to `localStorage` key `gaggimate-nothing-theme`
- On toggle: set `data-theme` to selected theme, save to localStorage
- Default to `nothing` (existing dark) if no preference saved

```jsx
// Add in Settings/index.jsx Appearance section
const [nothingTheme, setNothingTheme] = useState(
  localStorage.getItem('gaggimate-nothing-theme') || 'nothing'
);

const toggleNothingTheme = () => {
  const next = nothingTheme === 'nothing' ? 'nothing-light' : 'nothing';
  setNothingTheme(next);
  localStorage.setItem('gaggimate-nothing-theme', next);
  document.documentElement.setAttribute('data-theme', next);
};
```

- [ ] **Step 3: Add toggle UI to Settings**

Add a setting row:
```jsx
<div className="flex items-center justify-between py-3 border-b border-[var(--home-border)]">
  <div>
    <div className="text-sm font-medium text-[var(--text-primary)]">Nothing Theme Variant</div>
    <div className="text-xs text-[var(--text-secondary)] mt-0.5">Switch between dark and light Nothing styles</div>
  </div>
  <div className="flex items-center gap-2">
    <span className={`text-xs font-nd-mono ${nothingTheme === 'nothing' ? 'text-[var(--text-primary)]' : 'text-[var(--text-disabled)]'}`}>Dark</span>
    <button
      onClick={toggleNothingTheme}
      className="nd-toggle nd-toggle--active"
      aria-label="Toggle Nothing theme variant"
    >
      <div className="nd-toggle-thumb" />
    </button>
    <span className={`text-xs font-nd-mono ${nothingTheme === 'nothing-light' ? 'text-[var(--text-primary)]' : 'text-[var(--text-disabled)]'}`}>Light</span>
  </div>
</div>
```

- [ ] **Step 4: Initialize theme from localStorage on app load**

Add to `web/src/App.jsx` or main layout component:
```jsx
useEffect(() => {
  const saved = localStorage.getItem('gaggimate-nothing-theme');
  if (saved) {
    document.documentElement.setAttribute('data-theme', saved);
  }
}, []);
```

- [ ] **Step 5: Verify toggle works**

Run dev server, go to Settings, find "Nothing Theme Variant" toggle, switch between dark/light. Page should flip theme instantly.

- [ ] **Step 6: Commit**

```bash
git add web/src/pages/Settings/index.jsx web/src/App.jsx
git commit -m "feat: add Nothing theme dark/light toggle to Settings"
```

---

### Task 3: Verify all pages/components respect nothing-light theme

**Files:**
- Inspect: `web/src/pages/Home/`, `web/src/pages/ProfileList/`, `web/src/pages/ShotHistory/`, `web/src/pages/ShotAnalyzer/`, `web/src/pages/Statistics/`, `web/src/pages/Settings/`

- [ ] **Step 1: Visual smoke test across all pages**

Run dev server `http://localhost:5180/`. Set theme to `nothing-light`. Navigate all pages and check:
- [ ] Home (ring gauge, mode pills, stat cards)
- [ ] Profile list (profile cards, favorite toggles)
- [ ] Beans (bean cards)
- [ ] Shot History (shot list, filters)
- [ ] Shot Analyzer (chart, analysis table)
- [ ] Statistics (trend charts, summary cards)
- [ ] Settings (all toggles, inputs)

All should be readable with white background, dark text, red accents.

- [ ] **Step 2: Fix any hardcoded colors that ignore CSS vars**

Run: `grep -rn "#000\|#fff\|#ffffff\|#000000\|rgb(0,0,0)\|rgba(0,0,0" web/src/pages/ --include="*.jsx" | grep -v "var(--" | grep -v "oklch\|#d71921\|#d4a843\|#6699cc\|#7cb876"`
Any hardcoded black/white that should be using CSS vars → fix to use `var(--text-primary)` / `var(--home-surface)` etc.

- [ ] **Step 3: Commit**

```bash
git add web/src/pages/
git commit -m "fix: ensure all pages respect nothing-light CSS variables"
```

---

## Success Criteria

1. `nothing-light` theme added as daisyUI theme, loads without errors
2. All `nd-*` components (cards, stats, rings, inputs, toggles) render correctly on white background
3. Ring gauge shows correct colors in light mode (muted standby ring, same red brew)
4. Charts use dark text and appropriate hover/tooltip styling for light background
5. Settings page has working toggle between `nothing` and `nothing-light`
6. Theme choice persists across page reloads via localStorage
7. No hardcoded colors that break readability in light mode
8. All pages (Home, Profiles, Beans, Shot History, Shot Analyzer, Statistics, Settings) render cleanly in nothing-light

---

**Execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?