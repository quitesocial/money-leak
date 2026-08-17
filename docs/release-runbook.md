# Money Leak iOS Release Runbook

This runbook covers the CI-driven production build/upload flow and the manual
steps required to submit Money Leak `1.28.2` for its first public iPhone
release.

## Release architecture

- A push to `main` starts `.github/workflows/release-ios.yml`.
- The workflow continues only when `package.json.version` changed from the
  previous `main` revision.
- GitHub Actions installs with Node `20.19.4`, validates the repository, writes
  the App Store Connect API key only to the runner's temporary directory, and
  replaces committed placeholder values in the runner copy of `eas.json`.
- EAS builds the `production` iOS profile, remotely auto-increments the build
  number, and auto-submits the binary to App Store Connect.
- EAS upload is not final App Review submission. Add for Review and Submit for
  Review remain manual owner actions.

## Preconditions

- The reviewed release PR contains version `1.28.2` in `package.json` and both
  root version fields in `package-lock.json`.
- PR `Validate` passes.
- The five existing iPhone 6.9-inch screenshots pass
  `npm run screenshots:validate`.
- GitHub Actions secrets are configured:
  - `EXPO_TOKEN`
  - `EXPO_ASC_APP_ID`
  - `EXPO_ASC_API_KEY_ID`
  - `EXPO_ASC_API_KEY_ISSUER_ID`
  - `EXPO_ASC_API_KEY_P8_BASE64`
- The EAS `production` environment provides the public app configuration:
  - `EXPO_PUBLIC_SUPABASE_URL`
  - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
  - `EXPO_PUBLIC_AUTH_REDIRECT_SCHEME`
  - `EXPO_PUBLIC_AUTH_REDIRECT_PATH`
  - `EXPO_PUBLIC_IOS_BUNDLE_IDENTIFIER`
  - `EXPO_PUBLIC_ANDROID_PACKAGE`
- Production Supabase migrations/RLS, Apple and Google providers, redirect
  allowlists, and the `delete-account` Edge Function are deployed and tested.
- EAS remote iOS build numbers are aligned with the latest build already in
  App Store Connect.

## 1. Validate and merge the release PR

1. Review the final diff and the ML-101 handoff.
2. Confirm PR `Validate` ran release preflight, format, lint, typecheck, tests,
   and the web export check successfully.
3. Confirm the version change is intentional and merge the PR to `main`.

## 2. Confirm GitHub release gating

1. Open the `Release iOS` run for the merge commit.
2. Confirm `Detect version change` reports the previous version and `1.28.2`
   and sets `should_release=true`.
3. Confirm secret validation, dependency installation, preflight, tests,
   typecheck, lint, and format checks pass before the build step.
4. For any later `main` push without a version change, confirm the workflow
   exits through `Skip release when version is unchanged` and does not build.

## 3. Confirm EAS build compatibility

Apple requires App Store uploads to be built with Xcode 26 or later and the
corresponding iOS 26 SDK generation. Expo SDK 54 currently maps its automatic
iOS image to an Xcode 26 image, so this release does not pin an image or perform
an Expo SDK upgrade.

1. Open `Build and auto-submit iOS` and follow the EAS build link.
2. In `Spin up build environment`, record the exact image, Xcode version, and
   iOS SDK version.
3. Stop the release if the log does not show Xcode 26+ and iOS 26 SDK+.
4. Confirm the production build completes and its build number auto-increments.

Because the default image is selected dynamically, repository inspection does
not replace this per-build log check.

## 4. Confirm App Store Connect processing

1. Confirm EAS auto-submit reports a successful upload.
2. Open `My Apps -> Money Leak -> TestFlight` in App Store Connect.
3. Confirm the new version/build appears, completes processing, and has no
   blocking compliance or binary warning.
4. Confirm the processed version and build number match the release merge and
   EAS build.

## 5. Run final TestFlight QA

1. Install the exact processed build on a supported iPhone.
2. Complete every item in the Final TestFlight smoke QA section of
   `docs/app-store-submission-checklist.md`.
3. Record the device/iOS version, build number, account/provider coverage, and
   PASS/FAIL result.
4. Do not select an untested replacement build for App Review.

## 6. Complete App Store Connect metadata and compliance

Use `docs/app-store-metadata.md`, `docs/app-store-privacy-checklist.md`, and
`docs/app-store-submission-checklist.md` as technical inputs. The owner must
personally verify and complete:

- screenshots and their order;
- metadata, public Privacy Policy, public Support URL, and review contact;
- App Privacy answers;
- age rating, export compliance, and DSA status;
- territories, Free pricing, and release behavior;
- App Review Notes and any reviewer access requested.

Do not treat repository wording as a legal declaration.

## 7. Submit manually

1. Select the exact TestFlight-tested build.
2. Click Add for Review manually.
3. Review every attached item and compliance answer.
4. Click Submit for Review manually.

No repository automation should perform these final review actions.

## Troubleshooting

### Missing GitHub secrets

If `Validate release secrets` fails, add the named secret in repository Actions
settings. Never print or commit secret values.

### App Store Connect API key decoding

If the temporary `.p8` write fails, replace `EXPO_ASC_API_KEY_P8_BASE64` with
the raw base64 representation of the key file, without quotes or extra
whitespace. The decoded key must remain runner-temporary.

### EAS remote build number mismatch

If the build number is behind App Store Connect, use `eas build:version:set`
for iOS to align the remote value, then produce a new intentional release
build. Do not add a hardcoded build number to `app.json`.

### Wrong Xcode/iOS SDK generation

Do not blindly pin an image or start a broad Expo upgrade. Capture the EAS log,
compare current Apple and Expo requirements, and report the incompatibility as
a release blocker before changing SDK/build infrastructure.

### App Store Connect processing delay

Wait for normal processing, then inspect the build details and App Store
Connect system status before retrying. Do not create repeated builds merely
because processing is still pending.

### Auth, backup, sync, feedback, or deletion failure

Verify the exact build's public EAS environment, Supabase provider settings,
redirect allowlist, migrations/RLS, and Edge Function deployment. Keep raw
URLs, keys, tokens, identifiers, and backend errors out of user-facing copy and
release documentation.
