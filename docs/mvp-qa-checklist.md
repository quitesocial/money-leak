# Money Leak MVP QA Checklist

## Notes

- Primary QA target: native device or simulator builds.
- Web is a limited fallback in this build. `src/db/transactions.web.ts` intentionally does not support SQLite persistence, so transaction create/load/delete flows are not expected to work the same way on web.
- Do not mark native manual QA complete unless the flow was actually verified on a device or simulator.
- Before starting, clear app data or reinstall the app if you need a true first-launch / empty-DB run.

## Release Candidate

- `npm run release:preflight` passes against the checked-in local release configuration.
- The pull request `Validate` workflow passes before merge.
- `package.json.version` changes only when the merge is intended to trigger a release candidate.

## Epic 34: First Live CI Release Verification

- PR CI runs `npm run release:preflight`.
- The release workflow runs `npm run release:preflight`.
- A `main` merge with a version change continues into the release path.
- A `main` merge without a version change exits through `Skip release when version is unchanged`.
- The EAS production iOS build appears.
- The processed build appears in App Store Connect.
- The processed build is available in TestFlight.

## Epic 35: App Store / TestFlight Readiness

- Settings shows "Support & Legal"
- Privacy Policy button works or shows fallback alert
- Contact Support button works or shows fallback alert
- Existing reminder / import / export features still work
- No crashes in Settings

## Epic 36: Production Links & Metadata Finalization

- Privacy Policy opens the real URL
- Contact Support opens the mail client
- Settings screen remains stable if `Linking.openURL` fails
- No placeholder text remains in docs

## Epic 37: Screenshot Support + Demo Data v1

- `docs/app-store-screenshots.md` exists and documents the five canonical screenshot scenarios.
- `src/features/dev/demo-transactions.ts` exists and exports `createDemoTransactions(): Transaction[]`.
- Demo data is not seeded automatically at runtime from app startup, navigation, or Settings.
- No demo-data button, toggle, or other active runtime control was added.
- Regression check: `Home` still shows Today summary, History segmented controls, and transaction list behavior.
- Regression check: `Analytics` still shows the expected empty, no-leaks, and non-empty states.
- Regression check: `Shame Card` still shows the expected empty, no-leaks, populated preview, tone, and share states.
- Regression check: `Settings` still shows the reminder, `Data`, and `Support & Legal` sections without regressions.
- Regression check: Import and export flows still work with the existing CSV fixtures and native-only platform boundaries.
- Regression check: Reminder enable, disable, denied, and unsupported flows still work.

## Epic 38: App Store Release Submission Finalization v1

- `docs/app-store-submission-checklist.md` exists and stays focused on repo-side release verification.
- `docs/release-notes/1.2.3.md` exists and matches the shipped feature set.
- `npm run release:preflight` passes.
- The pull request `Validate` workflow passes before merge.
- `package.json.version` is bumped to `1.2.3` intentionally for the release.
- A `main` merge with a version change continues into the `Release iOS` workflow release path.
- A `main` merge without a version change exits through `Skip release when version is unchanged`.

## Epic 41: Add Transaction Navigation Cleanup v1

- Add Transaction is no longer visible in the bottom tab bar.
- Home, Analytics, Shame Card, and Settings remain visible and selectable as the persistent bottom tabs.
- The Home Add Transaction CTA opens the Add Transaction screen as a pushed screen.
- The Add Transaction screen shows the normal header/back affordance, and back returns to the previous screen.
- Saving a transaction returns to Home or the previous screen.
- Today summary values and the History list refresh after a successful save.
- The Home Add Transaction CTA still opens Add Transaction.
- Analytics, Shame Card, and Settings tabs still open and behave as before.

## Epic 42: Period Selector v2

- The shared period selector defaults to `Today`.
- The selector shows `Yesterday`, `Today`, `This week`, and `Choose date`.
- The selector no longer shows `This month` or `All time`.
- `Home` History updates correctly for `Today`, `Yesterday`, and `This week`.
- `Analytics` updates when switching between each period option.
- `Shame Card` updates when switching between each period option.
- Canceling `Choose date` closes the picker without changing the previous period or custom date.
- Empty states and no-leaks states render without crashing for every period option.
- Add Transaction is still not visible in the bottom tab bar.
- Add Transaction remains available from the Home CTA at `/add-transaction`.

## ML-43 / Epic 43: App Icon v1

- Expo config resolves the app icon path to `./assets/images/icon.png`.
- Production/TestFlight build shows the Money Leak icon on the Home Screen.
- TestFlight/App Store Connect build displays the new icon after processing.
- Existing app navigation still works.
- Settings / Support & Legal still works.
- No product behavior changed.

## ML-44 / Epic 44: Editable Categories v1

- Settings shows a `Categories` section with `Manage Categories`.
- `Manage Categories` opens `/categories` as a pushed screen.
- Adding a category with a valid unique name succeeds.
- Adding a duplicate active category name shows validation and does not create a duplicate.
- Editing a category name succeeds and keeps existing transactions attached to the same category ID.
- The new category appears in Add Transaction and Edit Transaction category selectors.
- A transaction saved with a custom category appears on Home with the custom category name.
- Analytics and Shame Card do not crash with custom categories.
- Deleting a category archives it after confirmation.
- Archived categories disappear from Add Transaction and normal Edit Transaction selectors.
- Existing transactions with archived categories still display a safe category name.
- Editing a transaction whose current category is archived does not crash and keeps the archived current value visible.
- `Other` cannot be deleted.
- Deleting the last active category is blocked.
- CSV export still uses the header `id,amount,category,isLeak,leakReason,note,createdAt`.
- CSV export still writes the stored category ID, not the display name.
- CSV import still accepts existing Money Leak CSV fixtures.
- CSV import with an unknown category ID imports safely and old transactions display a readable fallback category name.

## ML-47: iOS26 Footer Navigation

- ML-47 footer shows only `Home`, `Analytics & Leaks`, and `Settings`.
- Home tab active state matches Figma-style blue icon/label plus gray capsule.
- `Analytics & Leaks` label wraps into two lines.
- Settings tab icon and label render correctly.
- Switching tabs updates active state correctly.
- No gray spacer/band appears between screen content and footer.
- Shame Card is no longer a bottom tab.
- Shame Card opens from the Analytics CTA.
- Shame Card share still works.
- Add Transaction remains a pushed root screen and is not visible as a tab.
- Home, Analytics, Settings, Add/Edit Transaction, Manage Categories, CSV Import/Export, reminders, and editable categories still work.

## ML-48 / Epic 48: Home Page Redesign

- Home shows only the page title plus `Today summary` and `History` as the main content sections.
- Home and section titles use the bundled New York font on iOS.
- Old separate `Today check-in`, `Logging Streak`, and `Leak Risk` Home cards are not visible.
- Today summary empty state shows safe zero values and does not show `NaN`.
- Today summary updates after adding a normal transaction today.
- Today summary updates after adding a leak transaction today.
- Today summary excludes yesterday or older transactions.
- Home History segmented control shows only `Today`, `Yesterday`, and `This week`.
- History segmented control animates the selected capsule between periods.
- `More` beside `History` switches to the `Analytics & Leaks` tab.
- History empty state renders safely for the selected period.
- A normal History item shows amount, category display name, date/time, `Normal` state, and no leak-only details.
- A leak History item shows amount, category display name, date/time, `Leak` state, leak reason, and note when present.
- Swiping a History item left reveals the green edit action, opens the existing edit transaction screen, and updates Home after save.
- Swiping a History item right reveals the red delete action, asks for confirmation, and updates Today summary plus History after deletion.
- History items do not show persistent inline `Edit` or `Delete` buttons.
- History items do not show the retired gray left border.
- History items are gray at rest and the swiped foreground card becomes white while actions are revealed.
- Add Transaction remains a pushed screen from the Home CTA and is not visible as a tab.
- ML-47 footer still works and does not cover the last History item or create a gray/white spacer band.
- `Analytics & Leaks` and `Settings` tabs still work.
- Shame Card still opens from Analytics and remains a pushed root screen.

## ML-49: History Swipe Gesture Hardening

- Slow swipe left with slight upward/downward finger drift reveals the green edit action.
- Slow swipe right with slight upward/downward finger drift reveals the red delete action.
- Fast short swipe left can reveal Edit if velocity is high enough.
- Fast short swipe right can reveal Delete if velocity is high enough.
- Vertical scrolling over History cards still works normally.
- A mostly vertical gesture does not accidentally open swipe actions.
- Delete action still shows confirmation before removing.
- Edit action still opens `/transaction/[id]/edit`.
- Returning from edit preserves Home behavior.
- Opening one row closes the previously open row.
- Footer tabs remain `Home`, `Analytics & Leaks`, and `Settings`.

## ML-50 / Epic 50: Add/Edit Transaction Amount Autofocus

- Add Transaction opens with the amount input focused and ready for typing.
- Edit Transaction opens with the amount input focused and the existing amount still populated.
- The keyboard opens automatically on native devices when Add Transaction or Edit Transaction opens.
- Amount validation still works for empty, invalid, zero/negative, and valid values.
- Category selection, leak toggle, leak reason selection, note entry, and submit behavior still work.
- Back navigation from Add Transaction or Edit Transaction does not leave the app in a broken keyboard or focus state.
- Footer tabs remain `Home`, `Analytics & Leaks`, and `Settings`.
- Add Transaction and Shame Card remain pushed root screens and are not visible bottom tabs.

## ML-51: Auth & Sync Readiness Audit

- `docs/auth-sync-audit.md` exists and documents the current local-first auth/sync readiness baseline.
- `docs/ml-51-handoff.txt` exists and summarizes the audit handoff for the next epic.
- `package.json.version` is bumped to `1.10.3`.
- `package-lock.json` top-level and root package version fields are bumped to `1.10.3`.
- `app.config.js`, `app.json`, and `eas.json` are unchanged.
- Runtime app code is unchanged except for documentation and version metadata.
- Transaction and category TypeScript types are unchanged.
- SQLite transaction/category schemas are unchanged.
- CSV import/export format remains `id,amount,category,isLeak,leakReason,note,createdAt`.
- No auth, backend, account, cloud sync, or provider dependency was added.
- Footer tabs remain exactly `Home`, `Analytics & Leaks`, and `Settings`.
- Add Transaction and Shame Card remain pushed root screens and are not visible bottom tabs.
- `npm run release:preflight` passes.
- `npm test -- --runInBand` passes.
- `npm run typecheck` passes.
- `npm run lint` passes.
- `npm run format:check` passes.
- `npx expo config --json` resolves Expo version as `1.10.3`.
- `git diff --check` passes.

## ML-52 / Epic 52: Provider / Auth / Sync Config Decision

- `docs/auth-provider-decision.md` exists and documents Supabase Auth as the future auth provider decision.
- `docs/sync-provider-decision.md` exists and documents Supabase Postgres as the future remote backup/sync provider decision.
- `docs/auth-sync-env-contract.md` exists and documents future placeholder-only auth/sync config names.
- `.env.example` contains placeholders only and no real secrets.
- No runtime auth implementation was added.
- No backend, account, cloud sync, or provider runtime implementation was added.
- No Supabase, Firebase, Auth0, Clerk, Google auth, or Apple auth dependency was added.
- No secrets or Supabase service role key values were committed.
- CSV v1 remains `id,amount,category,isLeak,leakReason,note,createdAt`.
- Bottom tabs remain exactly `Home`, `Analytics & Leaks`, and `Settings`.
- Add Transaction, Shame Card, and Manage Categories remain pushed root Stack screens.
- `package.json.version` is bumped intentionally to `1.10.4`.
- `package-lock.json` top-level and root package version fields are bumped intentionally to `1.10.4`.
- `app.config.js`, `app.json`, and `eas.json` are unchanged.
- `npm run release:preflight` passes.
- `npm test -- --runInBand` passes.
- `npm run typecheck` passes.
- `npm run lint` passes.
- `npm run format:check` passes.
- `npx expo config --json` resolves Expo version as `1.10.4`.
- `git diff --check` passes.

## App Boot And Empty State

### 1. First app launch / empty DB

**Preconditions**

- App is installed with no existing local transaction data.

**Steps**

1. Launch the app for the first time.
2. Wait for the initial loading state to finish.
3. Open `Home`.
4. Open `Analytics`.
5. Open `Shame Card`.

**Expected result**

- App loads without crashing.
- Home shows the empty state with no transactions.
- Today summary shows `0.00€` total spent, `0.00€` total leaks, and `0%` leak percentage.
- Analytics shows the empty state for no transactions.
- Shame Card shows the empty state for no transactions.

## Add Transaction

### 2. Add a normal transaction

**Preconditions**

- App is running.
- There are no blocking store/database errors on screen.

**Steps**

1. Open `Add Transaction`.
2. Enter `12.50` as the amount.
3. Select any category.
4. Leave the type as `Normal`.
5. Tap `Save Transaction`.

**Expected result**

- Save succeeds without validation errors.
- App returns to `Home`.
- New transaction appears at the top of the list.
- Transaction shows the selected category, formatted amount, and `Normal` badge.
- Leak-only fields are not shown for this transaction.

### 3. Add a leak transaction

**Preconditions**

- App is running.

**Steps**

1. Open `Add Transaction`.
2. Enter `18.40` as the amount.
3. Select any category.
4. Switch type to `Leak`.
5. Select a leak reason.
6. Enter an optional note such as `Late-night impulse`.
7. Tap `Save Transaction`.

**Expected result**

- Save succeeds without validation errors.
- App returns to `Home`.
- New transaction appears at the top of the list.
- Transaction shows the `Leak` badge.
- Leak reason is shown.
- Note is shown when one was entered.
- Today summary updates total spent, total leaks, and leak percentage when the new transaction is from today.

### 4. Validation for missing amount

**Preconditions**

- App is on `Add Transaction`.

**Steps**

1. Leave amount empty.
2. Select any category.
3. Tap `Save Transaction`.

**Expected result**

- Amount field shows `Enter an amount.`
- Transaction is not saved.
- Screen stays on `Add Transaction`.

### 5. Validation for invalid amount

**Preconditions**

- App is on `Add Transaction`.

**Steps**

1. Enter a non-numeric value such as `abc`.
2. Select any category.
3. Tap `Save Transaction`.
4. Replace the value with `0`.
5. Tap `Save Transaction` again.

**Expected result**

- Non-numeric value shows `Use a number like 12.50.`
- Zero shows `Amount must be greater than 0.`
- Transaction is not saved in either case.

### 6. Validation for leak without leak reason

**Preconditions**

- App is on `Add Transaction`.

**Steps**

1. Enter a valid amount.
2. Select any category.
3. Switch type to `Leak`.
4. Do not select a leak reason.
5. Tap `Save Transaction`.

**Expected result**

- Leak reason field shows `Choose why this felt like a leak.`
- Transaction is not saved.

### 7. Switching Leak -> Normal clears leak-only fields

**Preconditions**

- App is on `Add Transaction`.

**Steps**

1. Enter a valid amount.
2. Select any category.
3. Switch type to `Leak`.
4. Select a leak reason.
5. Enter a note.
6. Switch type back to `Normal`.
7. Save the transaction.

**Expected result**

- Leak reason chips and note field disappear after switching back to `Normal`.
- Saved transaction is marked `Normal`.
- Saved transaction does not display a leak reason or note that came from the leak-only fields.

## Edit Transaction

### 8. Edit a normal transaction preserves identity and original timestamp

**Preconditions**

- At least one normal transaction exists on `Home`.

**Steps**

1. Open `Home`.
2. Pick a normal transaction and note its current amount, category, and timestamp.
3. Swipe the transaction left and tap the green edit action.
4. Change the amount.
5. Change the category.
6. Tap `Save Changes`.

**Expected result**

- Save succeeds without validation errors.
- App returns to `Home`.
- The edited transaction shows the new amount and category.
- The transaction keeps the same `id` and `createdAt`; in-app this means no duplicate transaction appears, the original timestamp stays the same, and sort order still matches the original creation time.

### 9. Edit a transaction to update leak fields

**Preconditions**

- At least one existing transaction is present.

**Steps**

1. Open `Home`.
2. Pick any transaction, swipe it left, and tap the green edit action.
3. Change the amount.
4. Change the category.
5. Switch type to `Leak`.
6. Select a leak reason.
7. Enter a note such as `Impulse snack run`.
8. Tap `Save Changes`.

**Expected result**

- Save succeeds without validation errors.
- App returns to `Home`.
- The edited transaction shows the new amount and category.
- The transaction now shows the `Leak` badge.
- Leak reason and note are shown with the updated values.
- Editing updates `amount`, `category`, `isLeak`, `leakReason`, and `note` for the saved transaction.

### 10. Switching Leak -> Normal clears leak-only fields on edit

**Preconditions**

- At least one leak transaction exists with a leak reason.

**Steps**

1. Open `Home`.
2. Pick a leak transaction, swipe it left, and tap the green edit action.
3. Confirm a leak reason is selected.
4. Enter or update the note field.
5. Switch type to `Normal`.
6. Tap `Save Changes`.

**Expected result**

- Leak reason chips and note field disappear after switching back to `Normal`.
- Save succeeds and returns to `Home`.
- Saved transaction is marked `Normal`.
- Saved transaction does not display a leak reason or note from the previous leak-only fields.

### 11. Today summary recalculates after edit

**Preconditions**

- At least one today-dated transaction exists on `Home`.

**Steps**

1. Open `Home`.
2. Note the current Today summary values.
3. Swipe any transaction left and tap the green edit action.
4. Change the amount and, if useful for verification, change the type between `Normal` and `Leak`.
5. Tap `Save Changes`.

**Expected result**

- App returns to `Home` after saving.
- The edited transaction card shows the updated values.
- Today summary `Total`, `Leak`, and `Leak %` recalculate immediately based on the edited today-dated transaction data.

### 12. Analytics reflects edited transaction data

**Preconditions**

- At least one transaction has been edited in the current session.

**Steps**

1. Edit a transaction so that it changes amount, category, type, or leak details.
2. After saving, open `Analytics`.
3. Review the summary card.
4. Review any visible metric cards or empty states.

**Expected result**

- Analytics reflects the latest edited transaction data without requiring app restart.
- Summary values match the current transaction list.
- Leak-related metric cards or no-leaks states update to match the post-edit data.

### 13. Add Transaction regression after shared form reuse

**Preconditions**

- App is running.

**Steps**

1. Re-run `Add Transaction` cases `2` through `7` without changing their steps.

**Expected result**

- Add Transaction behavior is unchanged after the Edit Transaction work.
- Normal and leak saves still work.
- Existing add-form validation and leak-field clearing behavior still match this checklist.

## Home

### 14. Home History item rendering

**Preconditions**

- At least one normal transaction and one leak transaction exist.

**Steps**

1. Open `Home`.
2. Review the `History` list.

**Expected result**

- History uses the selected period filter and renders transactions in descending `createdAt` order, newest first.
- Each item shows formatted amount, category display name, date/time, and `Normal` or `Leak` state.
- Leak transactions use subtle leak styling and show leak reason and note when present.
- Normal transactions use normal styling and do not show leak-only details.

### 15. Today summary recalculation

**Preconditions**

- At least one existing transaction is present.

**Steps**

1. Note the current Today summary values on `Home`.
2. Add one new normal transaction.
3. Add one new leak transaction.
4. Return to `Home` after each save.

**Expected result**

- Today summary `Total` increases by the sum of both new today-dated amounts.
- Today summary `Leak` increases only by the leak transaction amount.
- Today summary `Leak %` recalculates after each change.

### 16. Delete confirmation cancel

**Preconditions**

- At least one transaction exists on `Home`.

**Steps**

1. Swipe any transaction right and tap the red delete action.
2. In the confirmation alert, tap `Cancel`.

**Expected result**

- Transaction remains in the list.
- No loading or deleting state remains stuck on screen.
- Today summary and History values do not change.

### 17. Delete confirmation confirm

**Preconditions**

- At least one transaction exists on `Home`.

**Steps**

1. Swipe any transaction right and tap the red delete action.
2. In the confirmation alert, tap `Delete`.

**Expected result**

- Deleted transaction is removed from the list.
- Today summary recalculates after deletion completes when the deleted transaction was dated today.
- History recalculates for the selected period.
- Delete action closes after completion.

### 18. Deleting last transaction

**Preconditions**

- Exactly one transaction exists in local data.

**Steps**

1. Open `Home`.
2. Delete the final remaining transaction and confirm.
3. Open `Analytics`.
4. Open `Shame Card`.

**Expected result**

- Home returns to the empty state.
- Today summary returns to zero values.
- Analytics returns to the empty state.
- Shame Card returns to the empty state.

## Analytics

### 19. Analytics empty state

**Preconditions**

- Local transaction data is empty.

**Steps**

1. Open `Analytics`.

**Expected result**

- Empty-state copy is shown.
- No `Brutal insight` card is shown.
- No `Next move` card is shown.
- Screen does not crash.
- Summary values remain zero.

### 20. Analytics with only normal transactions

**Preconditions**

- At least one normal transaction exists.
- No leak transactions exist.

**Steps**

1. Open `Analytics`.

**Expected result**

- Summary reflects total spending and `0.00€` total leaks.
- `Leak percentage` shows `0%`.
- `No leaks yet` state is shown.
- Top leak cards, `Brutal insight` card, and `Next move` card are not shown.

### 21. Analytics with leak transactions

**Preconditions**

- At least two leak transactions exist.
- Leak data covers enough cases to generate category/reason/time groupings.

**Steps**

1. Open `Analytics`.
2. Review the summary card.
3. Review the `Brutal insight` card.
4. Review the `Next move` card.
5. Review the metric cards.
6. Change the underlying leak data so the dominant pattern changes.
7. Re-open or refresh `Analytics`.

**Expected result**

- Summary values match current transaction data.
- `Brutal insight` appears when leak transactions exist.
- `Next move` appears when leak transactions exist.
- `Brutal insight` changes when the leak pattern changes.
- `Next move` changes when the leak pattern changes.
- `Brutal insight` stays above `Next move`.
- Metric cards show top leak category, top leak reason, peak leak weekday, and peak leak hour when data exists.
- Analytics renders without crashing while showing the insight cards.

## Shame Card

### 22. Shame Card empty state

**Preconditions**

- Local transaction data is empty.

**Steps**

1. Open `Shame Card`.

**Expected result**

- Empty-state copy is shown.
- No preview card is shown.
- Share button is not shown.

### 23. Shame Card no-leaks state

**Preconditions**

- At least one normal transaction exists.
- No leak transactions exist.

**Steps**

1. Open `Shame Card`.

**Expected result**

- `No leaks yet` state is shown.
- Preview card is not shown.
- Share button is not shown.

### 24. Shame Card with leaks

**Preconditions**

- At least one leak transaction exists.

**Steps**

1. Open `Shame Card`.
2. Review the preview content.

**Expected result**

- Preview card is shown.
- Card includes a title, total leaks line, verdict, and any available top-category or peak-time lines.
- Screen does not crash when preview is rendered.

### 25. Shame Card tone switching

**Preconditions**

- At least one leak transaction exists.
- Shame Card preview is visible.

**Steps**

1. Open `Shame Card`.
2. Tap `Soft`.
3. Tap `Harsh`.
4. Tap `Unfiltered`.

**Expected result**

- Selected tone chip updates visually each time.
- Preview title and verdict change with the selected tone.
- No other leak data is lost while switching tone.

### 26. Share button visibility rules

**Preconditions**

- Ability to create both normal and leak test data.

**Steps**

1. Verify `Shame Card` with no transactions.
2. Verify `Shame Card` with only normal transactions.
3. Verify `Shame Card` with at least one leak transaction and no blocking error state.

**Expected result**

- Share button is hidden when there are no transactions.
- Share button is hidden when there are transactions but no leaks.
- Share button is visible only when the shame card preview is available for leak data.

### 27. Share action success path

**Preconditions**

- Test on a native device or simulator where sharing is available.
- At least one leak transaction exists.
- Shame Card preview and Share button are visible.

**Steps**

1. Open `Shame Card`.
2. Tap `Share`.
3. Wait for the platform share sheet.

**Expected result**

- Button changes to `Sharing...` while the share action is in flight.
- Native share sheet opens with the shame card image.
- App stays responsive after dismissing or completing the share sheet.
- No error message is shown on success.

### 28. Share unavailable/error path

**Preconditions**

- Use a runtime where sharing is unavailable, or simulate a capture/share failure if the environment allows it.
- At least one leak transaction exists.

**Steps**

1. Open `Shame Card`.
2. Tap `Share`.

**Expected result**

- If sharing is unavailable, the screen shows `Sharing is not available on this device.`
- If capture or share fails for another reason, the screen shows `Could not share the shame card. Try again.`
- App does not crash.
- Share button returns from `Sharing...` to its normal state after the failure.

## Settings / Data Export

### 29. Export CSV with an empty database

**Preconditions**

- Test on a native device or simulator where sharing is available.
- Local transaction data is empty.

**Steps**

1. Open `Settings`.
2. In the `Data` section, tap `Export CSV`.
3. Wait for the native share sheet.
4. Open the generated CSV in any available preview target if the platform allows it.

**Expected result**

- `Export CSV` changes to `Exporting...` while the export is in flight.
- Native share sheet opens with a CSV file named like `money-leak-transactions-YYYY-MM-DD.csv`.
- The CSV contains only the header row: `id,amount,category,isLeak,leakReason,note,createdAt`.
- App stays responsive after dismissing or completing the share sheet.

### 30. Export CSV with normal and leak transactions

**Preconditions**

- Test on a native device or simulator where sharing is available.
- At least one normal transaction and one leak transaction exist.

**Steps**

1. Open `Settings`.
2. Tap `Export CSV`.
3. Open the generated CSV in any available preview target if the platform allows it.

**Expected result**

- Native share sheet opens with the CSV file.
- CSV columns appear in this exact order: `id,amount,category,isLeak,leakReason,note,createdAt`.
- Each transaction is exported on its own row in newest-first order.
- Normal transactions export `isLeak` as `false` with empty `leakReason` and empty `note` when those values are null.
- Leak transactions export `isLeak` as `true`, include the saved `leakReason`, and preserve any saved note.
- `createdAt` values are ISO date strings.

### 31. Export CSV escapes commas, quotes, and newlines

**Preconditions**

- Test on a native device or simulator where sharing is available.
- At least two transactions exist whose notes collectively cover commas, double quotes, LF newlines, CRLF newlines, and embedded multi-line content.
- If useful, import `docs/qa-fixtures/valid-money-leak.csv` and `docs/qa-fixtures/valid-crlf.csv` first to create the data before exporting it again.

**Steps**

1. Open `Settings`.
2. Tap `Export CSV`.
3. Open the generated CSV in any available preview target if the platform allows it.

**Expected result**

- Native share sheet opens without crashing.
- Fields containing commas, quotes, LF newlines, CRLF newlines, or embedded multi-line content are wrapped in quotes.
- Embedded quotes are doubled inside the quoted CSV field.
- Line breaks inside notes stay inside the same CSV field instead of shifting later columns.

### 32. Export CSV loading state

**Preconditions**

- App has just launched, or `Settings` is the first tab opened in the session.

**Steps**

1. Open `Settings` immediately after launch.
2. Review the `Data` section before transaction loading settles.
3. Wait for loading to complete.
4. Tap `Export CSV`.

**Expected result**

- The `Data` section shows `Preparing your local transaction history for import and export…` while transaction data is still initializing.
- `Export CSV` is disabled until transaction loading finishes.
- Once loading finishes, `Export CSV` becomes enabled.
- Tapping the button changes the label to `Exporting...` until the export flow finishes.

### 33. Export CSV unavailable/error path

**Preconditions**

- Use a runtime where sharing is unavailable, or simulate a file/share failure if the environment allows it.

**Steps**

1. Open `Settings`.
2. Tap `Export CSV`.

**Expected result**

- If sharing is unavailable, the screen shows `Sharing is not available on this device.`
- If CSV file creation or sharing fails for another reason, the screen shows `Couldn't export transactions. Try again.`
- App does not crash.
- The button returns from `Exporting...` to `Export CSV` after the failure.
- Existing reminder controls still work after the error.

## Settings / Data Import

**Verification note**

- The shared CSV fixtures live in `docs/qa-fixtures/`.
- The shared period selector defaults to `Today` in Analytics and Shame Card. Home History only exposes `Today`, `Yesterday`, and `This week`, so fixed historical fixture rows are verified through Analytics and Shame Card `Choose date`.
- The fixture dates are fixed historical ISO timestamps. Clear app data before re-importing the same fixture if you need deterministic imported/skipped counts.

### 34. Import a valid Money Leak CSV backup

**Preconditions**

- Test on a native device or simulator.
- `docs/qa-fixtures/valid-money-leak.csv` is available on the device.
- Local transaction data is empty, or the fixture IDs have not been imported yet.

**Steps**

1. Open `Settings`.
2. In the `Data` section, tap `Import CSV`.
3. Pick `docs/qa-fixtures/valid-money-leak.csv` in the native document picker.
4. Wait for the import to finish.
5. Open `Home` and confirm the History selector still only offers `Today`, `Yesterday`, and `This week`.
6. Open `Analytics`, use `Choose date` for `Jan 1, 2025`, then `Jan 2, 2025`, and review the summary and any visible metric cards.
7. Open `Shame Card` with `Choose date` set to `Jan 2, 2025` and review the preview state.

**Expected result**

- Native document picker opens.
- `Import CSV` changes to `Importing...` while the import is in flight.
- Settings shows `Imported 2 transactions. Skipped 0 rows.`
- Imported leak transactions show their saved leak reason and optional note.
- `Analytics` and `Shame Card` reflect the imported data immediately.
- Home remains stable after import and keeps its three-period History selector.
- App stays responsive after the import completes.

### 35. Import a UTF-8 BOM CSV

**Preconditions**

- Test on a native device or simulator.
- `docs/qa-fixtures/valid-with-bom.csv` is available on the device.
- Local transaction data is empty, or the fixture IDs have not been imported yet.

**Steps**

1. Open `Settings`.
2. Tap `Import CSV`.
3. Pick `docs/qa-fixtures/valid-with-bom.csv`.
4. Wait for the import to finish.
5. Open `Analytics` and use `Choose date` to select `Jan 1, 2025`, then `Jan 2, 2025`.

**Expected result**

- Import succeeds without crashing.
- Settings shows `Imported 2 transactions. Skipped 0 rows.`
- The BOM at the start of the file does not create a header error or corrupt the first transaction ID.
- Both imported transactions appear in Analytics for the selected fixture dates.

### 36. Import a CRLF CSV

**Preconditions**

- Test on a native device or simulator.
- `docs/qa-fixtures/valid-crlf.csv` is available on the device.
- Local transaction data is empty, or the fixture IDs have not been imported yet.

**Steps**

1. Open `Settings`.
2. Tap `Import CSV`.
3. Pick `docs/qa-fixtures/valid-crlf.csv`.
4. Wait for the import to finish.
5. Open the imported leak transaction in `Home`.

**Expected result**

- Import succeeds without crashing.
- Settings shows `Imported 2 transactions. Skipped 0 rows.`
- CRLF row endings do not create malformed rows.
- The imported leak note keeps its embedded CRLF line break.

### 37. Import preserves quoted commas, quotes, LF, and embedded newlines

**Preconditions**

- Test on a native device or simulator.
- `docs/qa-fixtures/valid-money-leak.csv` has just been imported.

**Steps**

1. Open `Analytics`.
2. Confirm the shared period selector is still set to `Choose date: Jan 2`.
3. Review the imported leak transaction from `docs/qa-fixtures/valid-money-leak.csv` through the available imported-data QA path.

**Expected result**

- The imported note keeps the original comma, embedded double quotes, and LF newline.
- The note content appears in a single transaction instead of shifting later CSV columns into the UI.
- No extra transactions are created from the embedded newline.

### 38. Header-only CSV import

**Preconditions**

- Test on a native device or simulator.
- Prepare a CSV file containing only the header row: `id,amount,category,isLeak,leakReason,note,createdAt`.

**Steps**

1. Open `Settings`.
2. Tap `Import CSV`.
3. Pick the header-only CSV file.

**Expected result**

- Import completes without crashing.
- Settings shows `Imported 0 transactions. Skipped 0 rows.`
- Existing transaction data remains unchanged.

### 39. Duplicate IDs in one CSV file are skipped

**Preconditions**

- Test on a native device or simulator.
- `docs/qa-fixtures/duplicate-ids.csv` is available on the device.
- Local transaction data is empty, or the duplicate fixture ID has not been imported yet.

**Steps**

1. Open `Settings`.
2. Tap `Import CSV`.
3. Pick `docs/qa-fixtures/duplicate-ids.csv`.
4. Open `Analytics` with the shared period selector set to `Choose date: Jan 1`.

**Expected result**

- Import completes without crashing.
- Settings shows `Imported 1 transaction. Skipped 1 row.`
- Only one transaction appears for the duplicate ID.
- No duplicate transaction cards appear after the import completes.

### 40. Mixed valid and invalid rows skip bad rows only

**Preconditions**

- Test on a native device or simulator.
- `docs/qa-fixtures/mixed-valid-invalid.csv` is available on the device.
- Local transaction data is empty, or the valid fixture ID has not been imported yet.

**Steps**

1. Open `Settings`.
2. Tap `Import CSV`.
3. Pick `docs/qa-fixtures/mixed-valid-invalid.csv`.
4. Open `Analytics` with the shared period selector set to `Choose date: Jan 1`.

**Expected result**

- Import completes without crashing.
- Settings shows `Imported 1 transaction. Skipped 5 rows.`
- Only the valid transaction appears for the selected fixture date.
- The app does not partially render broken transaction data from invalid rows.

### 41. Empty file, wrong header, and malformed CSV show fatal inline errors

**Preconditions**

- Test on a native device or simulator.
- Prepare three files:
- An empty file with no content.
- `docs/qa-fixtures/wrong-header.csv`.
- `docs/qa-fixtures/malformed.csv`.

**Steps**

1. Open `Settings`.
2. Import the empty file.
3. Import `docs/qa-fixtures/wrong-header.csv`.
4. Import `docs/qa-fixtures/malformed.csv`.

**Expected result**

- Empty file shows `This CSV file is empty.`
- Wrong header shows `This CSV file doesn't match the Money Leak export format.`
- Malformed CSV shows `This CSV file is malformed.`
- The button returns to `Import CSV` after each failure.
- App does not crash and existing transaction data remains unchanged.

### 42. Import success and failure do not break export or reminders

**Preconditions**

- Test on a native device or simulator where sharing and notifications are available.
- `docs/qa-fixtures/valid-money-leak.csv` and `docs/qa-fixtures/wrong-header.csv` are available on the device.

**Steps**

1. Open `Settings`.
2. Import `docs/qa-fixtures/valid-money-leak.csv`.
3. Tap `Export CSV`.
4. Toggle the daily reminder.
5. Import `docs/qa-fixtures/wrong-header.csv`.
6. Tap `Export CSV` again.
7. Toggle the daily reminder again.

**Expected result**

- Export still opens the native share flow after both successful and failed imports.
- Reminder controls still work after both successful and failed imports.
- Import errors appear separately from export errors and reminder errors.
- The app remains responsive throughout the sequence.

## Onboarding

### 43. First-run onboarding can be skipped

**Preconditions**

- App is installed with no existing onboarding completion state.

**Steps**

1. Launch the app for the first time.
2. Wait for the onboarding screen to appear.
3. Tap `Skip`.
4. Let the redirect complete.
5. Fully close and relaunch the app.

**Expected result**

- Tapping `Skip` completes onboarding without crashing.
- App redirects to the main tab flow.
- On relaunch, the app opens the main tab flow instead of showing onboarding again.

### 44. First-run onboarding completes from the final step

**Preconditions**

- App is installed with no existing onboarding completion state.

**Steps**

1. Launch the app for the first time.
2. Tap `Next` until the final onboarding step appears.
3. Leave the reminder toggle unchanged.
4. Tap `Start tracking`.
5. Fully close and relaunch the app.

**Expected result**

- The final step appears without layout or state issues.
- Tapping `Start tracking` completes onboarding without crashing.
- App redirects to the main tab flow.
- On relaunch, the app opens the main tab flow instead of showing onboarding again.

### 45. Onboarding final-step reminder enable, deny, and disable flow

**Preconditions**

- App is installed with no existing onboarding completion state.
- Test on a native device or simulator where notifications are available.

**Steps**

1. Launch the app and advance to the final onboarding step.
2. Turn the daily reminder on.
3. If the system permission prompt appears, deny it once and verify the inline error state.
4. Turn the reminder on again and allow notifications.
5. Turn the reminder off.
6. Tap `Start tracking`.

**Expected result**

- The reminder card only appears on the final onboarding step.
- While reminder support is loading, the screen shows `Checking reminder support…` and the toggle is disabled.
- If notification permission is denied, the toggle returns to off and the screen shows `Notifications are off for Money Leak. Turn them on in system settings to get the daily check-in.`
- After notifications are allowed, the toggle stays on with no crash or stuck loading state.
- Turning the reminder off works on the onboarding screen before completing setup.
- Completing onboarding still succeeds after each reminder interaction.

## Settings / Reminders

### 46. Settings reminder enable and disable flow

**Preconditions**

- Test on a native device or simulator where notifications are available.
- App has already completed onboarding and is on the main tab flow.

**Steps**

1. Open `Settings`.
2. Wait for the reminder state to finish loading.
3. Turn the daily reminder on and allow notifications if prompted.
4. Turn the daily reminder off.

**Expected result**

- While reminder support is loading, the screen shows `Checking reminder support…` and the toggle is disabled.
- Turning the reminder on succeeds without crashing and leaves the toggle enabled.
- Turning the reminder off succeeds without crashing and leaves the toggle disabled.
- The reminder section stays responsive after the toggle is used more than once.

### 47. Settings reminder denied and unsupported states

**Preconditions**

- Use either:
- A native device or simulator where notification permission can be denied.
- Or a web runtime where reminders are unsupported.

**Steps**

1. Open `Settings`.
2. If notifications are available, try turning the reminder on and deny permission.
3. If reminders are unsupported, review the reminder section without toggling.

**Expected result**

- On native with denied permission, the toggle returns to off and the screen shows `Notifications are off for Money Leak. Turn them on in system settings to get the daily check-in.`
- On an unsupported platform, the toggle stays disabled and the screen shows `Daily reminders are not available on this platform.`
- The reminder section does not crash or block the rest of `Settings`.

## Web Fallback

### 48. Web Settings safely reflects native-only persistence limits

**Preconditions**

- Test in the web build.

**Steps**

1. Open the app on web.
2. Open `Settings`.
3. Wait for the `Data` section to finish its initial loading state.
4. Review the reminder and data sections.

**Expected result**

- App does not crash while `Settings` loads on web.
- The status text above the data actions shows `Your local transaction history could not be fully prepared on this platform.`
- The `Data` section shows `Import CSV is only available on native devices in this build.`
- The `Data` section shows an inline transaction error explaining that SQLite transaction persistence is only available on native platforms in this build.
- `Import CSV` stays disabled on web.
- `Export CSV` stays disabled when local transaction history could not be prepared on web.
- Reminder UI safely shows the unsupported platform state without affecting the rest of the screen.

## Retired Home Card Coverage

### 49. Daily Review helper coverage after ML-48

**Preconditions**

- Local transaction data is empty, then includes normal and leak transactions for today and yesterday.

**Steps**

1. Run the automated Home helper tests.
2. Open `Home`.
3. Review the visible Home sections.

**Expected result**

- `calculateDailyReviewSummary` tests still cover empty data, normal today data, leak today data, and yesterday exclusion.
- Home does not render the old `Today check-in` card.
- Home renders the ML-48 `Today summary` section instead.

### 50. Logging Streak helper coverage after ML-48

**Preconditions**

- Local data includes scenarios with empty history, today-only history, yesterday-only history, consecutive local days, and a gap.

**Steps**

1. Run the automated Logging Streak helper tests.
2. Open `Home`.

**Expected result**

- Logging Streak helper tests still pass.
- Home does not render the old Logging Streak card or its CTA.
- Add Transaction remains available from the ML-48 Today summary CTA.

### 51. Leak Risk helper coverage after ML-48

**Preconditions**

- Local data includes no-leak, low-risk, medium-risk, high-risk, and near-midnight risk-window scenarios.

**Steps**

1. Run the automated Leak Risk helper tests.
2. Open `Home`.

**Expected result**

- Leak Risk helper tests still pass.
- Home does not render the old `Leak risk today` card.
- Analytics and Shame Card continue to handle leak data without Home-specific changes.
