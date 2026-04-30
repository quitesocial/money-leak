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
- Because Apple already has `1.0.0`, the next feature epic should ship as `1.1.0`.
- Use `1.0.1` only for a hotfix branch off the current `1.0.0` release line.

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
npm run version:minor
npm run release:ios:build
npm run release:ios:submit
```

Notes:

- `release:ios:build` uses the `production` EAS profile from `eas.json`.
- `release:ios:submit` also uses the `production` profile and will prompt you to choose the build to submit.
- `eas.json` already uses `appVersionSource: "remote"` and `build.production.autoIncrement: true`, so each new production iOS build gets a new developer-facing build number automatically.

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
