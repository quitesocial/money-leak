# Money Leak MVP QA Checklist

## Notes

- Primary QA target: native device or simulator builds.
- Web is a limited fallback in this build. `src/db/transactions.web.ts` intentionally does not support SQLite persistence, so transaction create/load/delete flows are not expected to work the same way on web.
- Do not mark native manual QA complete unless the flow was actually verified on a device or simulator.
- Before starting, clear app data or reinstall the app if you need a true first-launch / empty-DB run.

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
- Home summary shows `0.00€` total spent, `0.00€` total leaks, and `0%` leak percentage.
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
- Home summary updates total spent, total leaks, and leak percentage.

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
3. Tap `Edit`.
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
2. Pick any transaction and tap `Edit`.
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
2. Pick a leak transaction and tap `Edit`.
3. Confirm a leak reason is selected.
4. Enter or update the note field.
5. Switch type to `Normal`.
6. Tap `Save Changes`.

**Expected result**

- Leak reason chips and note field disappear after switching back to `Normal`.
- Save succeeds and returns to `Home`.
- Saved transaction is marked `Normal`.
- Saved transaction does not display a leak reason or note from the previous leak-only fields.

### 11. Home summary recalculates after edit

**Preconditions**

- At least one transaction exists on `Home`.

**Steps**

1. Open `Home`.
2. Note the current summary values.
3. Tap `Edit` on any transaction.
4. Change the amount and, if useful for verification, change the type between `Normal` and `Leak`.
5. Tap `Save Changes`.

**Expected result**

- App returns to `Home` after saving.
- The edited transaction card shows the updated values.
- `Total spent`, `Total leaks`, and `Leak percentage` recalculate immediately based on the edited transaction data.

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

### 14. Home list rendering

**Preconditions**

- At least one normal transaction and one leak transaction exist.

**Steps**

1. Open `Home`.
2. Review the full list.

**Expected result**

- Transactions render in descending `createdAt` order, newest first.
- Each card shows formatted amount, category label, timestamp, and type badge.
- Leak transactions use the leak styling and show leak reason when present.
- Normal transactions use the normal styling and do not show leak-only details.

### 15. Home summary recalculation

**Preconditions**

- At least one existing transaction is present.

**Steps**

1. Note the current summary values on `Home`.
2. Add one new normal transaction.
3. Add one new leak transaction.
4. Return to `Home` after each save.

**Expected result**

- `Total spent` increases by the sum of both new amounts.
- `Total leaks` increases only by the leak transaction amount.
- `Leak percentage` recalculates after each change.

### 16. Delete confirmation cancel

**Preconditions**

- At least one transaction exists on `Home`.

**Steps**

1. Tap `Delete` on any transaction.
2. In the confirmation alert, tap `Cancel`.

**Expected result**

- Transaction remains in the list.
- No loading or deleting state remains stuck on screen.
- Summary values do not change.

### 17. Delete confirmation confirm

**Preconditions**

- At least one transaction exists on `Home`.

**Steps**

1. Tap `Delete` on any transaction.
2. In the confirmation alert, tap `Delete`.

**Expected result**

- Deleted transaction is removed from the list.
- Summary values recalculate immediately after deletion completes.
- Delete button returns to its normal state after completion.

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
- Home summary returns to zero values.
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
- No leak insight cards are shown.
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
- Top leak and insight cards are not shown.

### 21. Analytics with leak transactions

**Preconditions**

- At least two leak transactions exist.
- Leak data covers enough cases to generate category/reason/time groupings.

**Steps**

1. Open `Analytics`.
2. Review the summary card.
3. Review the metric cards.
4. Review the insights section.

**Expected result**

- Summary values match current transaction data.
- Metric cards show top leak category, top leak reason, peak leak weekday, and peak leak hour when data exists.
- Insights section renders without crashing and reflects the current leak patterns.

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
