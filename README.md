# Money Leak

Money Leak is a minimal mobile expense tracking app focused on behavioral money leaks, not classic budgeting.

This project uses Expo, React Native, TypeScript, Expo Router, and npm. The documented release flow below is iOS-only and uses Expo Application Services (EAS) plus Apple App Store Connect.

## Prerequisites

Use the project Node version before running any project or release commands:

```sh
source /Users/quitesocial/.nvm/nvm.sh
nvm use 20.19.4
```

Install project dependencies:

```sh
npm install
```

Install EAS CLI globally:

```sh
npm install --global eas-cli
```

Log in to Expo and verify the active account:

```sh
eas login
eas whoami
```

## Local Development

Start the Expo development server:

```sh
npm run start
```

Open the iOS simulator flow:

```sh
npm run ios
```

Run the web target when needed:

```sh
npm run web
```

## Validation Commands

Run the smallest relevant checks before shipping:

```sh
npm test
npm run typecheck
npm run lint
npm run format:check
```

For CI-level bundle validation, you can also run:

```sh
npx expo export --platform web --output-dir /private/tmp/money-leak-web-export-check
```

## Release Preflight

Before merging a TestFlight candidate, run the local release-readiness checks plus the existing validation set:

```sh
npm run release:preflight
npm test
npm run typecheck
npm run lint
npm run format:check
npx expo export --platform web --output-dir /tmp/money-leak-web-export
```

## Versioning Policy

The app uses Semantic Versioning for the user-facing store version:

- `patch`: small fixes, polish, and safe follow-up changes
- `minor`: a new user-facing epic or a meaningful product expansion
- `major`: a large product reset or intentionally breaking change

Release rules:

- Bump the version once per ship-ready epic, not on every commit.
- `package.json` is the single source of truth for the store version.
- Expo reads the app version from `package.json.version` through `app.config.js`.
- iOS build numbers are managed separately by EAS remote versioning.
- The repository is currently on the `1.1.x` release line.
- Use `patch` bumps for release-readiness or hotfix work on the current line.
- Do not change the iOS build number manually. EAS remote auto-increment handles it.

Version bump commands:

```sh
npm run version:patch
npm run version:minor
npm run version:major
```

## iOS Release Flow

Create a production iOS build:

```sh
npm run release:ios:build
```

Submit an iOS build to App Store Connect:

```sh
npm run release:ios:submit
```

Recommended release sequence:

```sh
npm run version:patch # or version:minor / version:major when appropriate
npm run release:ios:build
npm run release:ios:submit
```

Notes:

- `release:ios:build` uses the `production` EAS profile from `eas.json`.
- `release:ios:submit` uses the `manual` submit profile and will prompt you to choose the build to submit.
- GitHub Actions auto-submit uses `submit.production.ios` from `eas.json` after replacing its placeholder values at runtime.
- `eas.json` already uses `appVersionSource: "remote"` and `build.production.autoIncrement: true`, so each new production iOS build gets a new developer-facing build number automatically.

## GitHub Release Automation

The repository includes [`release-ios.yml`](.github/workflows/release-ios.yml), a GitHub Actions workflow that runs on every push to `main`.

Release rules:

- The workflow only builds and submits iOS when `package.json.version` changed between `github.event.before` and `github.sha`.
- Version bumps stay manual. Raise the version in your PR before merging to `main`.
- CI runs `eas build --platform ios --profile production --auto-submit --non-interactive`.
- The CI submit uploads the build to App Store Connect and TestFlight processing. It does not submit the app to App Review automatically.

### Required GitHub Secrets

Add these repository secrets in `Settings -> Secrets and variables -> Actions -> New repository secret`:

- `EXPO_TOKEN`
- `EXPO_ASC_APP_ID`
- `EXPO_ASC_API_KEY_ID`
- `EXPO_ASC_API_KEY_ISSUER_ID`
- `EXPO_ASC_API_KEY_P8_BASE64`

Where to get each value:

- `EXPO_TOKEN`: create a personal access token in [Expo Access Tokens](https://expo.dev/settings/access-tokens).
- `EXPO_ASC_APP_ID`: in App Store Connect, open your app and go to `App Store -> App Information`, then copy the `Apple ID`.
- `EXPO_ASC_API_KEY_ID`: in App Store Connect, go to `Users and Access -> Integrations -> App Store Connect API`, then copy the key's `Key ID`.
- `EXPO_ASC_API_KEY_ISSUER_ID`: in the same App Store Connect API screen, copy the `Issuer ID`.
- `EXPO_ASC_API_KEY_P8_BASE64`: download the `.p8` key file from `Users and Access -> Integrations -> App Store Connect API`, then base64-encode it and paste the encoded value into GitHub.

Apple only lets you download the `.p8` file once. Save it securely before closing the download flow.

Encode the `.p8` file like this on macOS:

```sh
base64 -i AuthKey_XXXXXX.p8
```

Paste the command output into the `EXPO_ASC_API_KEY_P8_BASE64` GitHub secret. Do not add extra quotes.

## Pull Request Checks

The repository also includes [`pr-checks.yml`](.github/workflows/pr-checks.yml), a GitHub Actions workflow for pull requests targeting `main`.

It runs these checks on every PR update:

- `npm run format:check`
- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npx expo export --platform web --output-dir <temp-dir>`

To make failed checks block merges, enable a GitHub branch protection rule or ruleset:

- Go to `Settings -> Rules -> Rulesets` or `Settings -> Branches`.
- Require status checks before merging.
- Add the `Validate` check from the `PR Checks` workflow as a required status check.

## First TestFlight Release Checklist

- GitHub Secrets must be added as repository secrets, not repository variables.
- Branch protection or a ruleset must require the `Validate` status check before merge.
- Check the EAS remote iOS build number and sync it with App Store Connect if needed.
- Merge to `main` only after the intended version bump is in the PR.
- Confirm the GitHub Actions `Release iOS` workflow starts after the merge.
- Confirm the EAS production iOS build completes successfully.
- Confirm the build finishes App Store Connect processing.
- Add the processed build to TestFlight internal or external testing.

## After Submit

After `eas submit`, wait for Apple to finish processing the build in App Store Connect. Once processing is complete, either:

- distribute the build through TestFlight, or
- attach the build to a new iOS App Store version in App Store Connect and continue the App Review flow

## One-Time Build Number Recovery

If EAS remote build numbers are not aligned with the build number that already exists in Apple, sync them once before the next release:

```sh
eas build:version:set
```

Choose `ios`, confirm remote version management if prompted, and initialize it with the latest build number already used in App Store Connect.
