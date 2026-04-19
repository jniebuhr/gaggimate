# Brew Mode Profile Graph Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Display the profile graph (pressure/flow visualization) when entering Brew Mode, similar to the upstream project.

**Architecture:** Use the existing `ProcessProfileChart` component inside `ProcessControls` when a pro profile is selected. The chart will show the profile phases with pressure/flow curves and highlight the active phase during brewing. Falls back gracefully when no pro profile is selected.

**Tech Stack:** Preact, Chart.js, chartjs-plugin-annotation, existing ProcessProfileChart/ExtendedProfileChart components

---

## File Structure

| File | Responsibility |
|------|----------------|
| `web/src/pages/Home/ProcessControls.jsx` | Main container - needs modification to display chart and receive profileData |
| `web/src/components/ProcessProfileChart.jsx` | Existing - already handles active phase highlighting |
| `web/src/hooks/useProfileData.js` | Already fetches pro profile data - no changes needed |

---

## Task 1: Pass profileData from ProcessControls to ProcessDisplay

Currently `ProcessControls` calls `useProfileData` but doesn't use the returned `profileData`. We need to thread it through to `ProcessDisplay` (which conditionally renders `BrewProgress`).

**Files:**
- Modify: `web/src/pages/Home/ProcessControls.jsx:199-348`

**Steps:**

- [ ] **Step 1: Read current ProcessControls to locate exact insertion points**

```javascript
// After line 209 where useProfileData is called:
// Add destructuring of profileData from the hook result

const { profileData } = useProfileData(api, brew, status.value.selectedProfileId);
```

- [ ] **Step 2: Pass profileData to ProcessDisplay**

```javascript
// In the JSX where ProcessDisplay is rendered (around line 268-285),
// add profileData to the props:

<ProcessDisplay
  brew={brew}
  grind={grind}
  active={active}
  finished={finished}
  processInfo={processInfo}
  profileData={profileData}  // ADD THIS
  status={{...}}
/>
```

- [ ] **Step 3: Commit**

```bash
git add web/src/pages/Home/ProcessControls.jsx
git commit -m "feat: thread profileData through ProcessControls to ProcessDisplay"
```

---

## Task 2: Modify ProcessDisplay to accept and render ProcessProfileChart

`ProcessDisplay` currently renders `BrewProgress` which shows a simple progress bar. We need to replace this with the chart when `profileData` is available.

**Files:**
- Modify: `web/src/components/ProcessDisplay.jsx:1-139`

**Steps:**

- [ ] **Step 1: Add import for ProcessProfileChart**

```javascript
import { ProcessProfileChart } from './ProcessProfileChart.jsx';
```

- [ ] **Step 2: Update BrewProgress component signature to accept profileData and processInfo**

```javascript
const BrewProgress = ({ processInfo, profileData }) => (
  // Replace the simple progress display with the chart
  <div className='flex w-full flex-col items-center justify-center space-y-4 px-4'>
    {profileData ? (
      <ProcessProfileChart
        data={profileData}
        processInfo={processInfo}
        className='max-h-48 w-full'
      />
    ) : (
      <ProgressDisplay processInfo={processInfo} type='brew' />
    )}
    <ProgressBar progress={progress} />
    <div className='space-y-2 text-center'>
      <div className='text-base-content/60 text-xs sm:text-sm'>{targetDisplay}</div>
      <div className='text-base-content text-2xl font-bold sm:text-3xl'>{formatDuration(elapsedSeconds)}</div>
    </div>
  </div>
);
```

- [ ] **Step 3: Update ProcessDisplay to pass profileData to BrewProgress**

```javascript
{(active || finished) && brew && <BrewProgress processInfo={processInfo} profileData={profileData} />}
```

- [ ] **Step 4: Commit**

```bash
git add web/src/components/ProcessDisplay.jsx
git commit -m "feat: display profile chart in BrewProgress when profileData available"
```

---

## Task 3: Test the implementation

**Steps:**

- [ ] **Step 1: Verify the build passes**

Run: `cd web && npm run build`
Expected: Build completes without errors

- [ ] **Step 2: Test manually (if dev server available)**

Run: `cd web && npm run dev`
Expected: When entering Brew Mode with a pro profile selected, the graph should display above the progress bar

---

## Self-Review Checklist

1. **Spec coverage:** The request is to display the profile graph when entering Brew Mode. Task 2 implements this by rendering `ProcessProfileChart` inside `BrewProgress` when `profileData` exists.

2. **Placeholder scan:** No placeholders found. All steps have complete code.

3. **Type consistency:**
   - `ProcessProfileChart` takes `data` (profile object) and `processInfo` (process state) - this is passed correctly
   - `profileData` from `useSelectedProfile` is filtered to only pro profiles - matches upstream behavior
   - `ProcessDisplay` receives `profileData` as a prop and threads it to `BrewProgress`

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-04-19-brew-mode-profile-graph.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
