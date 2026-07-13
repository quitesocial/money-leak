# App Store Privacy Checklist

## Links

- Privacy Policy URL: https://www.notion.so/quitesocial/35357a24e62c804dab18c28d24a6c75a?showMoveTo=true&saveParent=true
- Support contact: asrazdorskiy@gmail.com
- Verify the Privacy Policy URL opens publicly without requiring a Notion login.
- Verify the Support mailto/contact action works on a test device.
- Verify all App Store Connect links open before submission.

## App Privacy Answers

- Include data types transmitted off-device.
- Account data can include email, name, avatar, and provider id when applicable.
- Financial/user content data can include transactions, categories, notes, leak metadata, amounts, and timestamps when backed up or synced.
- Anonymous feedback can include a 1-5 rating, an optional comment, app version, platform, runtime language, and server submission time. Verify no account, device, owner, financial, or transaction identifiers are stored with feedback.
- Mark data linked to user as yes for authenticated backup, sync, and profile data.
- Mark tracking as no only after dependency/code review confirms there is no tracking SDK or advertising cross-app tracking.

## Account And Review Checks

- Verify in-app Delete Account works before submission.
- Verify Sign in with Apple remains available on iOS because Google login exists.
- Verify guest/local mode still works without a login wall.
- Verify manual backup, restore, and sync still work for authenticated users.
- Before releasing feedback collection, update the public Notion Privacy Policy and verify anonymous feedback disclosure and retention language are accurate.
