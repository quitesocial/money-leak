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
- For the first live CI/TestFlight verification flow, see the [release runbook](docs/release-runbook.md).

## GitHub Release Automation

The repository includes [`release-ios.yml`](.github/workflows/release-ios.yml), a GitHub Actions workflow that runs on every push to `main`.

Release rules:

- The workflow runs on every push to `main`, but only continues into the iOS release path when `package.json.version` changed between `github.event.before` and `github.sha`.
- Version bumps stay manual. Raise the version in your PR before merging to `main`.
- CI runs `eas build --platform ios --profile production --auto-submit --non-interactive`.
- The CI submit uploads the build to App Store Connect and TestFlight processing. It does not submit the app to App Review automatically.
- The detailed first-live verification flow, tester distribution steps, and troubleshooting live in the [release runbook](docs/release-runbook.md).

### Required GitHub Secrets

Configure these repository secrets in `Settings -> Secrets and variables -> Actions`:

- `EXPO_TOKEN`
- `EXPO_ASC_APP_ID`
- `EXPO_ASC_API_KEY_ID`
- `EXPO_ASC_API_KEY_ISSUER_ID`
- `EXPO_ASC_API_KEY_P8_BASE64`

## Pull Request Checks

The repository also includes [`pr-checks.yml`](.github/workflows/pr-checks.yml), a GitHub Actions workflow for pull requests targeting `main`.

It runs these checks on every PR update:

- `npm run release:preflight`
- `npm run format:check`
- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npx expo export --platform web --output-dir <temp-dir>`

To make failed checks block merges, enable a GitHub branch protection rule or ruleset:

- Go to `Settings -> Rules -> Rulesets` or `Settings -> Branches`.
- Require status checks before merging.
- Add the `Validate` check from the `PR Checks` workflow as a required status check.
