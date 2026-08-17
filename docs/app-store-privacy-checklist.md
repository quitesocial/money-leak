# App Store Privacy Checklist

This checklist maps the Money Leak `1.28.2` repository behavior to the facts
needed for App Store Connect. It is technical evidence, not legal advice or a
substitute for the owner's final declarations.

## Public links

- Privacy Policy URL:
  https://www.notion.so/quitesocial/35357a24e62c804dab18c28d24a6c75a?showMoveTo=true&saveParent=true
- In-app support action: `mailto:asrazdorskiy@gmail.com`
- **OWNER ACTION:** Verify the Privacy Policy opens publicly without a Notion
  login and matches `docs/privacy-policy.md`.
- **OWNER ACTION:** Enter and test a public App Store Connect Support URL; the
  repository currently identifies only the in-app email action.

## Data that stays on-device

The following stays on-device unless the user authenticates and chooses an
account-backed backup/sync action:

- transactions, amounts, category IDs, notes, leak flags/reasons, and
  timestamps;
- balance entries, amounts, balance types, and timestamps;
- categories and category icons;
- language/currency display preferences;
- the local owner identifier and local database metadata;
- onboarding completion, reminder preference/schedule, backup/sync UI
  metadata, and the foreground-sync preference;
- transaction CSV files selected for import or created for user-directed
  export/sharing.

Guest/local mode remains usable without authentication. A guest feedback
submission is an explicit exception: feedback is transmitted to Supabase as
described below.

## Data transmitted to Supabase and linked to an authenticated user

For optional Apple/Google authentication and account-backed functionality,
Supabase can receive and retain:

- account/profile data: Supabase user ID, provider, email, display name, and
  avatar/profile-photo URL when supplied by the identity provider;
- transactions: amount, category ID, leak flag/reason, optional note, record
  IDs, created/updated/deleted timestamps, schema version, and source-device
  ID;
- categories: name, default/archive state, order, timestamps, schema version,
  and source-device ID. Category icons remain local and are not in the current
  remote schema;
- balance types and entries: names/type IDs, amounts, record IDs, state,
  timestamps, schema version, and source-device ID;
- settings: language and display-currency value, timestamp, schema version,
  and source-device ID.

These records are keyed to the authenticated Supabase user and are used for
app functionality: authentication, profile preparation, backup, restore,
incremental sync, conflict handling, and account deletion.

Candidate App Store Connect data types for owner review:

- Contact Info: Name and Email Address;
- Identifiers: User ID and Device ID;
- Financial Info: Other Financial Info for expense, income, and balance data;
- User Content: Other User Content for notes and user-defined names/metadata;
- Photos or Videos: confirm whether the retained avatar/profile-photo URL
  requires this classification;
- Other Data Types: confirm classification of provider, settings, schema, and
  sync metadata.

Default purpose: App Functionality. **OWNER ACTION:** Decide whether synced
language/currency preferences also require Product Personalization and confirm
the final classification with current Apple guidance.

## Anonymous feedback transmitted to Supabase

The feedback table stores only:

- rating from 1 to 5;
- optional comment;
- app version;
- platform;
- runtime language;
- server-generated timestamp;
- a server-generated feedback-row ID.

The stored feedback row has no auth/user/owner/localOwner/device identifier,
email, token, financial data, or transaction data. Guests and authenticated
users can insert feedback, but neither client role can select, update, or
delete feedback rows.

Recommended App Store Connect treatment, pending owner/legal review:

- disclose the comment as Customer Support or Other User Content;
- disclose the rating/runtime metadata as Other Data Types;
- mark these feedback fields as not linked to identity and used for App
  Functionality/customer support;
- do not rely on Apple's optional-feedback disclosure exception without
  confirming every current eligibility condition.

**OWNER ACTION:** Confirm Supabase infrastructure logging and retention do not
create a link between feedback and identity, and document the actual feedback
retention policy in the public Privacy Policy.

## Tracking, advertising, analytics, and diagnostics

Repository review found no advertising, analytics, crash-reporting,
telemetry, attribution, or cross-app tracking SDK. The app contains no bank
integration, automatic bank import, subscription, or in-app purchase.

- Tracking: technical evidence supports `No`.
- Advertising: technical evidence supports `No`.
- Analytics/diagnostic collection by the developer: no implementation was
  found.
- **OWNER ACTION:** Include Apple, Google, Supabase, and any provider-side
  practices or logs that exist outside this repository when completing the
  final answers.

## Account and deletion checks

- Sign in with Apple and Google Sign-In are both enabled on iOS.
- Guest/local mode has no login wall.
- Authenticated backup, restore, and manual/incremental sync are present.
- Settings exposes Delete Account only for authenticated users.
- Delete Account calls the server-side Supabase function, removes app-owned
  remote rows and the Supabase auth user, then signs out.
- Sign Out is separate and preserves local device data.
- Anonymous feedback is not account-linked and is not part of account
  deletion, backup, restore, sync, SQLite, or CSV contracts.

**OWNER ACTION:** Verify these paths against the deployed production Supabase
project and final TestFlight build before submission.

## Final App Store Connect owner review

- Publish accurate answers for all data types collected by the app and its
  third-party partners.
- Confirm linked/not-linked status and purposes for every selected data type.
- Confirm public-policy wording, retention periods, deletion behavior, and
  contact details.
- Publish the App Privacy answers only after the TestFlight build and public
  policy agree with this audit.
