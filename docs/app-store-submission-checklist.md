# App Store Submission Checklist

This checklist is the final repo-side release check for Money Leak. It covers the repository state and GitHub/EAS release flow only.

## Before Merge

- Confirm `package.json` includes the intended release version bump.
- Confirm `package-lock.json` root metadata matches the same version.
- Run `npm run release:preflight` and confirm it passes.
- Confirm the pull request `Validate` workflow passes.

## Release Workflow Verification

- Merge the release PR to `main` only after the version bump is present and intentional.
- Confirm the `Release iOS` workflow runs for the merge commit when `package.json.version` changed.
- Confirm a later `main` push without a version change exits through `Skip release when version is unchanged`.
- Confirm the version-changed `Release iOS` run reaches the EAS production iOS build step.

## External Follow-Up

- Confirm the uploaded build enters and completes App Store Connect processing as the post-release verification step.
