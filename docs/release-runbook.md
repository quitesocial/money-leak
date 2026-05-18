# Money Leak Release Runbook

This runbook covers the first live CI-driven TestFlight release verification flow for Money Leak's iOS automation.

## Preconditions

- The release PR includes the intended `package.json.version` bump.
- The pull request `Validate` check is required before merge.
- The repository GitHub Actions secrets are configured:
  - `EXPO_TOKEN`
  - `EXPO_ASC_APP_ID`
  - `EXPO_ASC_API_KEY_ID`
  - `EXPO_ASC_API_KEY_ISSUER_ID`
  - `EXPO_ASC_API_KEY_P8_BASE64`
- For Google login builds, the production GitHub/EAS build environment has the
  required public Expo values configured:
  - `EXPO_PUBLIC_SUPABASE_URL`
  - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
  - `EXPO_PUBLIC_AUTH_REDIRECT_SCHEME`
  - `EXPO_PUBLIC_AUTH_REDIRECT_PATH`
  - `EXPO_PUBLIC_IOS_BUNDLE_IDENTIFIER`
  - `EXPO_PUBLIC_ANDROID_PACKAGE`
- EAS remote iOS build numbers are already aligned with the latest build number in App Store Connect.

## First Live Verification Flow

For auth config rebuilds such as ML-57, local `.env` values are not enough.
Expo bakes `EXPO_PUBLIC_*` values into the native app during the EAS build, so
adding or changing those values requires a new TestFlight build. The
`Release iOS` workflow only creates that build when `package.json.version`
changes.

### 1. Confirm PR `Validate` passes

- Open the release PR.
- Wait for the `Validate` check from `PR Checks` to pass.
- Confirm the job ran `npm run release:preflight` before format, lint, typecheck, tests, and the web export check.

### 2. Merge to `main`

- Merge the PR only after `Validate` passes.
- Open the GitHub Actions tab and select the `Release iOS` run for the merge commit.

### 3. Confirm the version-changed release path starts

- Open the `Detect version change` step and confirm the previous and current versions differ.
- Confirm the workflow continues past `Skip release when version is unchanged`.
- Confirm `Run release preflight` runs before tests and before `Write App Store Connect API key`, `Inject App Store Connect placeholders`, and `Build and auto-submit iOS`.

Note: `Release iOS` is triggered on every push to `main`. The release path only continues when `package.json.version` changed.

### 4. Confirm the unchanged-version path skips

- Merge or push a later `main` change without modifying `package.json.version`.
- Open the corresponding `Release iOS` run.
- Confirm the `Skip release when version is unchanged` step logs the unchanged-version reason.
- Confirm `Build and auto-submit iOS` does not run.

### 5. Confirm the EAS build is created

- In the version-changed `Release iOS` run, open the `Build and auto-submit iOS` logs.
- Confirm EAS reports a build URL or build ID.
- Confirm the `production` iOS build finishes successfully in EAS.

### 6. Confirm App Store Connect processing completes

- After EAS auto-submit finishes, open App Store Connect and go to `My Apps -> Money Leak -> TestFlight`.
- Confirm the new build appears and enters processing.
- Wait until processing completes and there are no blocking errors on the build.

### 7. Confirm the build appears in TestFlight

- In TestFlight, confirm the processed build is selectable for distribution.
- Confirm the version and build number match the release you just merged.

### 8. Confirm ML-57 Google login config on device

- Install the TestFlight build created from version `1.12.1`.
- Open Settings on a real device and confirm `Continue with Google` appears.
- Tap `Continue with Google` and confirm login succeeds, or that any provider
  or config failure uses safe copy without exposing URLs, keys, tokens, or
  secrets.
- Sign out and confirm local transactions and categories remain visible.

## Tester Distribution Paths

### Internal testers

- Open App Store Connect `TestFlight`.
- Select the processed build.
- Add the build to the intended internal testing group.
- Confirm at least one internal tester can see the build in TestFlight.

### External testers

- Open App Store Connect `TestFlight`.
- If Apple requires Beta App Review for the build, complete the required metadata and submit it for review.
- After approval, add the build to the intended external testing group.
- Confirm the build becomes available to external testers.

## Troubleshooting

### Missing GitHub secrets

- Symptom: `Validate release secrets` fails with a missing-secret error.
- Fix: add the missing repository secret in `Settings -> Secrets and variables -> Actions`.
- Required secrets are `EXPO_TOKEN`, `EXPO_ASC_APP_ID`, `EXPO_ASC_API_KEY_ID`, `EXPO_ASC_API_KEY_ISSUER_ID`, and `EXPO_ASC_API_KEY_P8_BASE64`.

### `.p8` base64 decoding errors

- Symptom: `Write App Store Connect API key` fails while running `base64 --decode`.
- Fix: replace `EXPO_ASC_API_KEY_P8_BASE64` with the raw base64 of the `.p8` file contents, with no quotes or extra whitespace.
- macOS example:

```sh
base64 -i AuthKey_XXXXXX.p8
```

### EAS remote build number mismatch

- Symptom: the EAS build or submit step fails because the remote iOS build number is behind the latest build already present in App Store Connect.
- Fix: run `eas build:version:set` locally, choose `ios`, and set the remote build number to the latest build number already visible in App Store Connect.
- Retry the release after the remote build number is aligned.

### App Store Connect processing delays

- Symptom: EAS submit succeeds, but the build stays in processing or does not become available in TestFlight yet.
- Fix: wait and refresh App Store Connect `TestFlight` periodically.
- If the delay persists, inspect the build details in App Store Connect for processing warnings or account-level blockers before retrying.
