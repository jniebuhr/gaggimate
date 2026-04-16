# Bold Minimal Web UI - Design Spec

> **For agentic workers:** Implementation should follow the superpowers:executing-plans skill. Use TDD and commit frequently.

**Goal:** Transform the Web UI with two new bold/minimal themes and comprehensive visual/functional improvements to the Home page (Process Controls + Temperature/Pressure Chart).

**Architecture:** Preact + Tailwind CSS + daisyUI web application with Chart.js for temperature/pressure visualization. Themes implemented via daisyUI theme system with CSS custom properties. Chart improvements focus on visual polish, readability, and smoother animations.

**Tech Stack:** Preact, Tailwind CSS, daisyUI, Chart.js, Chart.js Date adapter

---

## 1. Theme System

### 1.1 New Themes

**Stealth (Dark Theme)**
- Color scheme: Deep blacks with vibrant cyan/purple accents
- Use case: Users who prefer dark mode with bold visual punch

**Crisp (Light Theme)**
- Color scheme: Clean whites with darker cyan/purple accents
- Use case: Users who prefer light mode with bold minimal aesthetic

### 1.2 Theme Files

**Modify:** `web/src/style.css`
- Add Stealth theme definition (daisyUI format)
- Add Crisp theme definition (daisyUI format)

**Modify:** `web/src/utils/themeManager.js`
- Add 'stealth' and 'crisp' to AVAILABLE_THEMES array

### 1.3 Theme Color Palettes

**Stealth:**
```
--color-base-100: #0A0A0A
--color-base-200: #141414
--color-base-300: #1F1F1F
--color-base-content: #FAFAFA
--color-primary: #06B6D4 (cyan)
--color-primary-content: #0A0A0A
--color-secondary: #8B5CF6 (purple)
--color-secondary-content: #FFFFFF
--color-accent: #06B6D4
--color-accent-content: #0A0A0A
--color-neutral: #262626
--color-neutral-content: #FAFAFA
--color-info: #38BDF8
--color-info-content: #0A0A0A
--color-success: #10B981
--color-success-content: #0A0A0A
--color-warning: #FBBF24
--color-warning-content: #0A0A0A
--color-error: #EF4444
--color-error-content: #FFFFFF
```

**Crisp:**
```
--color-base-100: #FFFFFF
--color-base-200: #FAFAFA
--color-base-300: #F5F5F5
--color-base-content: #171717
--color-primary: #0891B2 (darker cyan)
--color-primary-content: #FFFFFF
--color-secondary: #7C3AED (darker purple)
--color-secondary-content: #FFFFFF
--color-accent: #0891B2
--color-accent-content: #FFFFFF
--color-neutral: #E5E5E5
--color-neutral-content: #171717
--color-info: #0EA5E9
--color-info-content: #FFFFFF
--color-success: #059669
--color-success-content: #FFFFFF
--color-warning: #D97706
--color-warning-content: #FFFFFF
--color-error: #DC2626
--color-error-content: #FFFFFF
```

---

## 2. Process Controls Card

### 2.1 Files

**Modify:** `web/src/pages/Home/ProcessControls.jsx`

### 2.2 Improvements

**Action Buttons:**
- Size: btn-lg (larger touch target)
- Primary color with bold hover state
- 2px accent ring on hover/active
- Icon + label clearly visible

**State Indicators:**
- Pill badges with accent background
- States: "Brewing" (cyan), "Finished" (green), "Idle" (muted)
- Pulsing dot indicator during active brewing

**Temperature Display:**
- Current temp: Large font (text-2xl), bold weight
- Target temp: Muted color, smaller font
- Accent color for temperature ready state (within 5°C)

**Progress Indication:**
- Thicker progress bar (h-2 → h-3)
- Accent color fill during brewing
- Smooth width transitions

**Grind Target Bar:**
- Cleaner +/- button styling
- Consistent icon sizing
- Accent color for active state

**Layout Structure:**
- Mode tabs at top
- Status/progress in center
- Action buttons at bottom
- Generous padding (py-4, px-6)

---

## 3. Temperature & Pressure Chart

### 3.1 Files

**Modify:** `web/src/components/OverviewChart.jsx`

### 3.2 Improvements

**Legend:**
- Accent-colored line samples
- Cleaner grouping by metric type
- Better spacing between items (padding: 12px)

**Axis Labels:**
- Larger font (font-size: 12px → 13px)
- Consistent integer rounding
- Cleaner unit display ("°C", "bar", "g/s", "g")
- Better tick density

**Line Styling:**
- Thicker lines (borderWidth: 2 → 3)
- Smooth curve rendering (tension: 0.3)
- Better point visibility

**Phase Annotations:**
- Brighter accent color (theme-aware)
- Better label positioning
- Clearer brew start marker
- More visible transition lines

**Time Axis:**
- Cleaner tick marks
- Better countdown format during brew (-30s, -45s, -60s)
- Consistent display formats

**Animations:**
- Reduced jitter on live updates
- Smoother line transitions
- Better resize handling

**Tooltip:**
- Cleaner styling matching theme
- Better data readability
- Consistent accent colors

### 3.3 Chart Color Constants

Chart-specific colors that harmonize with new themes:
```
Temperature Line: #F0561D
Target Temp Line: #731F00
Pressure Line: #0066CC
Target Pressure Line: #003366
Flow Line: #63993D
Weight Line: #8B5CF6
Target Weight Line: #4C1D95
Phase Marker Accent: Cyan matching theme primary
```

---

## 4. Implementation Tasks

### Task 1: Add Stealth and Crisp Themes

**Files:**
- Modify: `web/src/style.css`
- Modify: `web/src/utils/themeManager.js`

**Steps:**
1. Add Stealth theme definition (dark, bold/minimal)
2. Add Crisp theme definition (light, bold/minimal)
3. Update AVAILABLE_THEMES in themeManager.js

### Task 2: Update Process Controls Card

**Files:**
- Modify: `web/src/pages/Home/ProcessControls.jsx`

**Steps:**
1. Enhance action button styling
2. Add state indicator pills
3. Improve temperature display formatting
4. Add progress bar enhancements
5. Refine layout spacing

### Task 3: Improve Temperature/Pressure Chart

**Files:**
- Modify: `web/src/components/OverviewChart.jsx`

**Steps:**
1. Enhance legend styling
2. Improve axis label formatting
3. Thicken lines and improve curve rendering
4. Better phase annotation visibility
5. Optimize animations and transitions

---

## 5. Success Criteria

- Two new themes available in theme selector
- Process Controls card shows clear state indication
- Chart legend readable and properly grouped
- Temperature/pressure data clearly distinguishable
- Phase markers visible during brewing
- Smooth animations without visual jitter
- Consistent bold/minimal aesthetic across all updates