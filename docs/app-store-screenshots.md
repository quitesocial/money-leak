# App Store Screenshots

This document records the canonical in-app states for App Store screenshots.
It describes what the app should already be showing and what data must exist to
reach that state.

## Canonical screenshot scenarios

### 1. Home

**Expected UI state**

- `Home` is the active tab.
- The shared period selector remains on the default `Today` state.
- `Today check-in` shows non-zero `Total today`, non-zero `Leaks today`, a
  non-zero `Leak %`, and a visible `Top leak category` row.
- The streak card shows an active streak instead of the empty `Start your
streak` state.
- `Leak risk today` shows a populated risk state instead of `Not enough leak
history yet.`
- The `Today` transaction list is non-empty.

**Required data**

- At least one normal transaction exists today.
- At least one leak transaction exists today.
- Activity exists on today, yesterday, and the day before yesterday so the
  streak card can show a live streak.
- At least three leak transactions exist overall.
- At least three leak transactions exist on the current weekday across separate
  weeks so the risk card can render a visible risk state with detail rows.
- At least one transaction exists today so the default `Today` list is
  populated.

### 2. Add Transaction

**Expected UI state**

- `Add Transaction` is open as a pushed screen from the Home CTA.
- `Leak` is selected in the type picker.
- The leak-only fields are visible: leak reason chips and the optional note
  field.
- A realistic filled state is acceptable for the screenshot, for example an
  amount such as `28.50`, category `Shopping`, leak reason `Impulse`, and a
  short note.

**Required data**

- No existing transaction data is required.
- This state depends on the current form selections, not on stored
  transactions.

### 3. Analytics

**Expected UI state**

- `Analytics` is the active tab.
- The shared period selector remains on the default `Today` state.
- The summary card shows non-zero `Total spent`, non-zero `Total leaks`, and a
  non-zero `Leak percentage`.
- The non-empty analytics state is visible, with the metric cards rendered for
  `Top leak category`, `Top leak reason`, `Peak leak weekday`, and `Peak leak
hour`.
- The `Alternative reality` section is visible.

**Required data**

- At least one normal transaction exists today.
- At least one leak transaction exists today.
- Today's leak data is enough to keep Analytics out of the empty and
  no-leaks states.
- Under the current implementation, the screen does not render a separate
  insights list, so the canonical screenshot is the populated metrics state.

### 4. Shame Card

**Expected UI state**

- `Shame Card` is open as a pushed root Stack screen from Analytics.
- The shared period selector remains on the default `Today` state.
- The default `Harsh` tone is selected.
- The preview card is visible with a title, total leaks line, top category
  line, peak time line, alternative reality line, and verdict.
- The `Share` button is visible.

**Required data**

- At least one leak transaction exists today.
- Today's data keeps the screen out of the empty and no-leaks states.
- The leak total is greater than zero so the alternative reality line can
  render.

### 5. Settings

**Expected UI state**

- `Settings` is the active tab.
- The `Daily check-in reminder`, `Data`, and `Privacy & Support` sections are all
  visible.
- The `Data` section shows the idle `Import CSV` and `Export CSV` buttons.
- No loading, success, or error message is covering the `Data` or `Privacy &
Support` sections.

**Required data**

- No specific transaction dataset is required.
- The app must be initialized without a blocking transaction-store error.
- For native screenshots, local transaction history should already be loaded so
  the `Data` section is not stuck in a preparing state.

## Demo data usage

`createDemoTransactions` is a manual dev helper. It is meant for temporary
local seeding when someone needs to recreate the canonical screenshot states.

```ts
import { createDemoTransactions } from '@/features/dev/demo-transactions';
import { useTransactionsStore } from '@/store/transactions-store';

await useTransactionsStore
  .getState()
  .importTransactions(createDemoTransactions());
```

Use that import temporarily from a local-only dev entry point, then remove it
before committing. It must not remain wired into app startup, navigation,
Settings actions, or any other active runtime flow.

The helper uses deterministic same-day IDs, so rerunning it on the same day can
re-import safely through the existing duplicate-skipping import path.
