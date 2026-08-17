# App Store Submission Checklist

This is the final release checklist for the first public Money Leak iOS
release. Repository automation uploads the binary to App Store Connect; the
owner completes TestFlight QA, compliance declarations, Add for Review, and
Submit for Review manually.

## Automated / repository checks

- [ ] `package.json` and both root `package-lock.json` version fields are
      `1.28.2`.
- [ ] `app.config.js` resolves Expo version `1.28.2` from `package.json`.
- [ ] Resolved Expo config reports `ios.supportsTablet: false`,
      `ios.usesAppleSignIn: true`, and
      `ITSAppUsesNonExemptEncryption: false`.
- [ ] No local `ios.buildNumber` is set; EAS remote auto-increment owns it.
- [ ] `npm run screenshots:validate` passes exactly five opaque JPEGs at
      `1320x2868` in the documented filename order.
- [ ] `npm run release:preflight` passes.
- [ ] `npm test -- --runInBand` passes.
- [ ] `npm run typecheck` passes.
- [ ] `npm run lint` passes.
- [ ] `npm run format:check` passes.
- [ ] `npx expo config --json` succeeds and shows the expected version/iOS
      configuration.
- [ ] `git diff --check` passes.
- [ ] The final diff has no secrets, credentials, raw backend errors, personal
      data, production identifiers, or screenshot-fixture imports in runtime
      code.
- [ ] The pull request `Validate` workflow passes.
- [ ] The reviewed release PR is the intended version-changing merge to
      `main`.

## Final TestFlight smoke QA

Run on the exact processed iPhone build selected for App Review.

- [ ] Fresh install launches without a crash; onboarding can be completed or
      skipped.
- [ ] Guest/local mode opens Home and remains fully usable without an account.
- [ ] Home displays current balance and the transaction/balance feed.
- [ ] Add Balance creates an income/balance row and updates current balance.
- [ ] Add Transaction creates a Normal expense.
- [ ] Add Transaction creates a Leak expense with a leak reason.
- [ ] Transaction rows can be edited and deleted with correct totals.
- [ ] Balance rows can be edited and deleted with correct totals.
- [ ] Analytics & Leaks renders Today, Week, Month, and Custom states with
      correct totals and ledger rows.
- [ ] Settings loads without exposing raw configuration or backend errors.
- [ ] Each supported language can be selected and the chosen language persists.
- [ ] Each display currency formats values correctly; no FX conversion occurs.
- [ ] Local reminder enable, permission-denied, and disable flows behave safely.
- [ ] Transaction CSV export opens the native share flow with the v1 header.
- [ ] Transaction CSV import accepts a valid file and safely reports invalid or
      skipped rows.
- [ ] Continue with Google succeeds in the production build and returns safely
      from the provider.
- [ ] Continue with Apple is visible on iOS and succeeds in the production
      build.
- [ ] Sign Out returns to guest mode and preserves local data.
- [ ] Create Backup completes for an authenticated user and reports counts.
- [ ] Restore from Backup handles confirmation, empty, and success states.
- [ ] Sync Now completes; foreground sync respects its setting and throttle.
- [ ] Delete Account is distinct from Sign Out, deletes the remote account, and
      returns safely to guest mode while local data remains.
- [ ] Leave Feedback works in guest and authenticated states; failures use safe
      generic copy.
- [ ] Privacy Policy opens the intended public page.
- [ ] Support opens the intended contact destination.
- [ ] No iPad QA or iPad screenshots are claimed for this iPhone-only release.

## Owner App Store Connect actions

- [ ] Upload the five English (U.S.) iPhone 6.9-inch screenshots in numeric
      filename order and verify their previews are uncropped.
- [ ] Enter and proofread the name, subtitle, category, description, keywords,
      release copy, and Support URL from `docs/app-store-metadata.md`.
- [ ] Publish/update the public Privacy Policy, verify it opens logged-out, and
      enter the final URL.
- [ ] Review and publish App Privacy answers for app code and Apple, Google, and
      Supabase practices.
- [ ] Complete the current age-rating questionnaire, including current social
      capability questions; do not infer a rating from repository code.
- [ ] Complete any export-compliance response, using the checked-in encryption
      configuration as technical evidence rather than a legal conclusion.
- [ ] Complete the DSA trader/non-trader declaration and any required
      verification.
- [ ] Choose territories/availability.
- [ ] Confirm price is Free unless the product's monetization changes.
- [ ] Select the desired release behavior after approval.
- [ ] Enter App Review contact name, phone, and email.
- [ ] Paste the final App Review Notes.
- [ ] Decide whether optional authenticated flows require reviewer/demo
      credentials. If required, enter reviewer-only credentials in App Store
      Connect; never commit them.
- [ ] Confirm production Supabase migrations/RLS, delete-account function,
      Apple/Google providers, EAS public environment values, and GitHub release
      secrets are configured.
- [ ] Merge the reviewed release PR to `main` and confirm GitHub `Release iOS`
      detects the version change.
- [ ] Confirm the EAS production build uses Xcode 26 or later and an iOS 26 SDK
      or later, auto-increments the build number, and finishes successfully.
- [ ] Confirm EAS auto-submit uploads the build and App Store Connect processes
      it without a blocking warning.
- [ ] Run and sign off the complete TestFlight smoke checklist above.
- [ ] Select the exact tested build for the App Store version.
- [ ] Click Add for Review manually.
- [ ] Review every legal/compliance field one final time and click Submit for
      Review manually.
