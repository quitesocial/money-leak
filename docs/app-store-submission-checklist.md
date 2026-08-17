# App Store Submission Checklist

This is the final release checklist for the first public Money Leak iOS
release. Repository automation uploads the binary to App Store Connect; the
owner completes TestFlight QA, compliance declarations, Add for Review, and
Submit for Review manually.

**Completion record (2026-08-17):** The owner confirmed every repository,
TestFlight, App Store Connect, EAS, Apple Developer, and final manual review
item below completed successfully. Manual QA result: PASS. Remaining actions:
none.

## Automated / repository checks

- [x] `package.json` and both root `package-lock.json` version fields are
      `1.28.2`.
- [x] `app.config.js` resolves Expo version `1.28.2` from `package.json`.
- [x] Resolved Expo config reports `ios.supportsTablet: false`,
      `ios.usesAppleSignIn: true`, and
      `ITSAppUsesNonExemptEncryption: false`.
- [x] No local `ios.buildNumber` is set; EAS remote auto-increment owns it.
- [x] `npm run screenshots:validate` passes exactly five opaque JPEGs at
      `1320x2868` in the documented filename order.
- [x] `npm run release:preflight` passes.
- [x] `npm test -- --runInBand` passes.
- [x] `npm run typecheck` passes.
- [x] `npm run lint` passes.
- [x] `npm run format:check` passes.
- [x] `npx expo config --json` succeeds and shows the expected version/iOS
      configuration.
- [x] `git diff --check` passes.
- [x] The final diff has no secrets, credentials, raw backend errors, personal
      data, production identifiers, or screenshot-fixture imports in runtime
      code.
- [x] The pull request `Validate` workflow passes.
- [x] The reviewed release PR is the intended version-changing merge to
      `main`.

## Final TestFlight smoke QA

Run on the exact processed iPhone build selected for App Review.

- [x] Fresh install launches without a crash; onboarding can be completed or
      skipped.
- [x] Guest/local mode opens Home and remains fully usable without an account.
- [x] Home displays current balance and the transaction/balance feed.
- [x] Add Balance creates an income/balance row and updates current balance.
- [x] Add Transaction creates a Normal expense.
- [x] Add Transaction creates a Leak expense with a leak reason.
- [x] Transaction rows can be edited and deleted with correct totals.
- [x] Balance rows can be edited and deleted with correct totals.
- [x] Analytics & Leaks renders Today, Week, Month, and Custom states with
      correct totals and ledger rows.
- [x] Settings loads without exposing raw configuration or backend errors.
- [x] Each supported language can be selected and the chosen language persists.
- [x] Each display currency formats values correctly; no FX conversion occurs.
- [x] Local reminder enable, permission-denied, and disable flows behave safely.
- [x] Transaction CSV export opens the native share flow with the v1 header.
- [x] Transaction CSV import accepts a valid file and safely reports invalid or
      skipped rows.
- [x] Continue with Google succeeds in the production build and returns safely
      from the provider.
- [x] Continue with Apple is visible on iOS and succeeds in the production
      build.
- [x] Sign Out returns to guest mode and preserves local data.
- [x] Create Backup completes for an authenticated user and reports counts.
- [x] Restore from Backup handles confirmation, empty, and success states.
- [x] Sync Now completes; foreground sync respects its setting and throttle.
- [x] Delete Account is distinct from Sign Out, deletes the remote account, and
      returns safely to guest mode while local data remains.
- [x] Leave Feedback works in guest and authenticated states; failures use safe
      generic copy.
- [x] Privacy Policy opens the intended public page.
- [x] Support opens the intended contact destination.
- [x] No iPad QA or iPad screenshots are claimed for this iPhone-only release.

## Owner App Store Connect actions

- [x] Upload the five English (U.S.) iPhone 6.9-inch screenshots in numeric
      filename order and verify their previews are uncropped.
- [x] Enter and proofread the name, subtitle, category, description, keywords,
      release copy, and Support URL from `docs/app-store-metadata.md`.
- [x] Publish/update the public Privacy Policy, verify it opens logged-out, and
      enter the final URL.
- [x] Review and publish App Privacy answers for app code and Apple, Google, and
      Supabase practices.
- [x] Complete the current age-rating questionnaire, including current social
      capability questions; do not infer a rating from repository code.
- [x] Complete any export-compliance response, using the checked-in encryption
      configuration as technical evidence rather than a legal conclusion.
- [x] Complete the DSA trader/non-trader declaration and any required
      verification.
- [x] Choose territories/availability.
- [x] Confirm price is Free unless the product's monetization changes.
- [x] Select the desired release behavior after approval.
- [x] Enter App Review contact name, phone, and email.
- [x] Paste the final App Review Notes.
- [x] Decide whether optional authenticated flows require reviewer/demo
      credentials. If required, enter reviewer-only credentials in App Store
      Connect; never commit them.
- [x] Confirm production Supabase migrations/RLS, delete-account function,
      Apple/Google providers, EAS public environment values, and GitHub release
      secrets are configured.
- [x] Merge the reviewed release PR to `main` and confirm GitHub `Release iOS`
      detects the version change.
- [x] Confirm the EAS production build uses Xcode 26 or later and an iOS 26 SDK
      or later, auto-increments the build number, and finishes successfully.
- [x] Confirm EAS auto-submit uploads the build and App Store Connect processes
      it without a blocking warning.
- [x] Run and sign off the complete TestFlight smoke checklist above.
- [x] Select the exact tested build for the App Store version.
- [x] Click Add for Review manually.
- [x] Review every legal/compliance field one final time and click Submit for
      Review manually.
