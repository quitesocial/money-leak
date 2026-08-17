# Privacy Policy for Money Leak

This repository document is the technical source draft for the public Money
Leak Privacy Policy. The owner must review the wording, add any legally
required operator/contact details and retention periods, publish it at the
configured public URL, and verify the published page before App Store
submission.

## 1. Local-first use and guest mode

Money Leak is a local-first expense tracker. Core functionality is available
without an account. On supported native builds, the app stores transactions,
balance entries, categories, preferences, and related metadata locally on the
device.

Local financial data can include amounts, category or balance-type choices,
leak flags and reasons, optional notes, and timestamps entered through the app.

## 2. Optional accounts

Users can optionally sign in with Apple or Google. Authentication is provided
through Supabase Auth. Depending on what the identity provider supplies,
account/profile data can include a provider account identifier, email address,
display name, and avatar/profile-photo URL.

Guest/local mode remains available without authentication.

## 3. Optional backup, restore, and synchronization

Authenticated users can choose account-backed backup, restore, and sync
features. These features transmit supported app data to Supabase and associate
it with the authenticated account.

Uploaded data can include transactions, categories, balance types, balance
entries, language and display-currency preferences, record and schema
metadata, timestamps, and a source-device identifier used for synchronization.
Category icons are not included in the current remote schema.

Money Leak uses this data to provide authentication, backup, restore,
synchronization, conflict handling, and account deletion. It is not used for
advertising or cross-app tracking.

## 4. Account deletion and sign out

Authenticated users can choose Delete Account in Settings. The current
account-deletion service removes the account's Money Leak rows from Supabase
and deletes the Supabase authentication user, then signs out.

Sign Out is a separate action and does not delete the account or local device
data. Account deletion does not automatically erase local app data from the
device. Removing the app removes its locally stored app data subject to the
device platform's normal behavior.

## 5. Anonymous feedback

Users can optionally send feedback from Settings. A feedback submission can
contain a rating, optional comment, app version, platform, runtime language,
and server submission time. The feedback row uses a server-generated row ID.

The feedback record does not contain an account, email, auth/user/owner,
local-owner, device, financial, or transaction identifier. Feedback is not
included in local SQLite data, CSV files, account backup, restore, sync, or
account deletion.

**OWNER ACTION:** Add the actual feedback retention period and confirm that
provider-side logging does not change the anonymous classification before
publishing this policy.

## 6. CSV import and export

Transaction CSV import and export happen only when the user starts them.
Exported files are passed to the device's native share flow. Imported files
are read from a file selected by the user. Money Leak does not add balance
entries or account credentials to the Transaction CSV v1 format.

## 7. Notifications

If the user enables a daily reminder, Money Leak schedules a local notification
on the device. The reminder is not sent or managed by a Money Leak server.

## 8. Display currency and language

Language and currency are display preferences. Money Leak does not perform
foreign-exchange conversion and does not store per-transaction or per-balance
currencies. Authenticated backup/sync can include the selected language and
display-currency values.

## 9. No bank integrations, ads, or tracking

Money Leak does not connect to bank accounts, payment cards, or financial
institutions and does not automatically import bank transactions. The current
app does not include advertising, third-party analytics, crash-reporting,
telemetry, attribution, or cross-app tracking SDKs. It has no subscription or
in-app purchase.

## 10. Service providers and user choices

Apple and Google can process identity data when their sign-in options are used.
Supabase provides authentication, profile storage, backup/restore/sync storage,
account deletion infrastructure, and anonymous feedback storage. Their own
policies and infrastructure practices may also apply.

Users can continue in guest/local mode, decide whether to authenticate, choose
whether to run backup/restore/sync, edit or delete local entries, import or
export CSV files, turn reminders off, sign out, or delete an authenticated
account.

## 11. Contact

For privacy or support questions, email `asrazdorskiy@gmail.com`.

**OWNER ACTION:** Add any required operator identity, jurisdiction, effective
date, retention details, user-rights instructions, and other legally required
disclosures before publishing.
