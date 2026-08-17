# App Store Metadata

This is the repository-side English (U.S.) metadata draft for Money Leak
`1.28.2`. Compare every field with the editable App Store Connect version
before submission.

## App name

Money Leak

## Subtitle

Spot spending leaks fast

## Primary category

Finance

## Keywords

`expense tracker,spending,finance,money,habits,cash flow,savings,expense log,personal finance`

The keyword string is 92 characters.

## Support

- In-app support action: `mailto:asrazdorskiy@gmail.com`
- Support contact: `asrazdorskiy@gmail.com`
- **OWNER ACTION:** Enter and verify the required public App Store Connect
  Support URL. The repository does not identify a public web support page;
  the in-app support action is email only.

## Privacy Policy URL

https://www.notion.so/quitesocial/35357a24e62c804dab18c28d24a6c75a?showMoveTo=true&saveParent=true

**OWNER ACTION:** Publish or update the public policy so it matches the
current data flows documented in `docs/privacy-policy.md`, then verify the URL
opens without a Notion login. Do not submit while the public policy still
claims that accounts, Supabase, backup, restore, sync, or feedback do not
exist.

## Description

Money Leak is a minimal, local-first expense tracker for noticing the spending
habits that quietly drain your money.

Track what comes in and what goes out:

- Add balance or income entries and see your current balance.
- Record expenses as Normal or Leak, with an optional leak reason and note.
- Review transaction and balance history from Home.
- Edit or delete transaction and balance rows.
- Explore totals, patterns, and leak insights in Analytics & Leaks.

Make the app yours:

- Choose your display language and currency. Currency is for display only;
  Money Leak does not perform foreign-exchange conversion.
- Set an optional local daily reminder.
- Import and export transaction data with CSV.

Use Money Leak your way:

- Guest/local mode is available immediately and remains usable without an
  account.
- Optionally sign in with Apple or Google to back up, restore, and sync
  supported app data through your account.
- Send anonymous feedback from Settings.

Money Leak has no bank connection, automatic bank import, advertising,
subscription, or in-app purchase.

## What's New / release notes

Welcome to Money Leak's first App Store release.

- Track income, normal spending, and money leaks.
- Explore your current balance and leak patterns.
- Use the app locally, or sign in optionally for backup, restore, and sync.
- Includes local reminders, transaction CSV import/export, and anonymous
  feedback.

Use this copy only if App Store Connect presents a What's New field for this
version. The same release summary is kept in
`docs/release-notes/1.28.2.md`.

## TestFlight notes

Please test the native iPhone build. Money Leak is iPhone-only for this
release.

1. Complete or skip onboarding and continue in guest/local mode without an
   account.
2. Add a balance entry, a Normal expense, and a Leak expense with a leak
   reason.
3. Edit and delete transaction and balance rows; verify Home totals and the
   Analytics & Leaks views.
4. Test language and display-currency preferences, the local reminder, and
   transaction CSV import/export.
5. Open Privacy Policy, Support, and Leave Feedback from Settings.
6. On iOS, test both Continue with Apple and Continue with Google. While
   authenticated, test Create Backup, Restore from Backup, Sync Now, Sign Out,
   and Delete Account.

Please report crashes, data loss, incorrect totals, auth/sync failures, CSV
issues, or external links and feedback that fail. Currency is display-only;
there is no FX conversion, bank integration, subscription, or in-app purchase.

## App Review Notes

Money Leak is local-first and its core functionality works immediately without
an account. On first launch, complete or skip onboarding to reach Home. Use Add
to create a balance/income entry and Spend to record a Normal or Leak expense
with an optional leak reason. Home rows can be edited or deleted. Analytics &
Leaks is the center tab.

Settings contains display currency and language, local reminders, transaction
CSV import/export, Privacy Policy, Support, and the anonymous Leave Feedback
action.

An account is optional and is used for account-backed backup, restore, and
sync. On iOS, guest users can choose Continue with Apple or Continue with
Google in Settings. Authenticated users see Sign Out and Manage Account >
Delete Account. Sign Out leaves local data on the device. Delete Account
removes the account and its cloud data, then signs out; these are separate
actions.

Money Leak has no bank integration, automatic bank import, subscription, or
in-app purchase. No reviewer credentials are required for core functionality.
Anonymous feedback is available from the Leave Feedback button at the bottom
of Settings.

**OWNER ACTION:** If App Review asks for separate credentials to test optional
account-backed flows, enter reviewer-only credentials in App Store Connect
Review Information. Never store credentials in this repository or in these
notes.

## Owner-only App Store Connect fields

Complete these directly in App Store Connect:

- App Review contact name, phone, and email.
- Copyright.
- Final Support URL.
- App Privacy answers and published privacy links.
- Age rating, export compliance, DSA status, availability, pricing, and release
  behavior.
- Reviewer access or demo-account information only if App Review requires it.
