# App Store Screenshots

ML-100 defines the canonical English (U.S.) iPhone 6.9-inch App Store set.
The committed deliverables live in `assets/app-store/ios/en-US/6.9/` and are
validated with `npm run screenshots:validate`.

## Final set

| Order | Figma source | File                                 | Exact copy                                                                                                                                              |
| ----- | ------------ | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | `342:6083`   | `01-see-where-money-goes.jpg`        | `See Where Your Money Really Goes`                                                                                                                      |
| 2     | `342:6181`   | `02-spot-draining-habits.jpg`        | `Spot the Habits Draining Your Wallet`                                                                                                                  |
| 3     | `342:6085`   | `03-add-income-or-spending-fast.jpg` | `Add New Income or Spending Fast`                                                                                                                       |
| 4     | `342:6184`   | `04-explore-spending.jpg`            | `Explore Your Spending by Day, Week or Month`                                                                                                           |
| 5     | `342:6088`   | `05-clear-insights.jpg`              | `Turn everyday spending into clear insights—see exactly where your money leaks and whether it’s driven by habit, impulse, stress, or something else 👀` |

Every file is an opaque JPEG at exactly `1320×2868`, exported at quality 96.
Colors, New York Bold typography, device bezels, first splash mockup, and the
closing illustration follow the source section `342:6189`.

The first frame has a Figma ownership detail that can look like a duplicate or
missing link: its device mockup is node `342:6187`, a direct child of section
`342:6189`, while frame `342:6083` contains the headline/background. Both are
required for screenshot 1. The five source frame IDs above are otherwise
unique and preserve the requested order.

## Product captures

The three current-product captures were made on an iPhone 17 Pro Max simulator
at the native `1320×2868` display size. Only the display area inside the
original Figma device bezel was replaced.

- Add Transaction: `12.50`, Leak, Boredom, Shopping; full one-page form.
- Home: `€1,234.56` balance; Add/Spend; Today/Yesterday/This week;
  Transactions/More; leak, balance, and normal-expense rows; floating tabs.
- Analytics & Leaks: Today/Week/Month/Custom; Overview; non-zero donut;
  Income `€1,249.12`, Expenses `€14.56`, Leaks `€10.00`; ledger and floating
  tabs.

All captures use English, EUR, simulated time `9:41`, and fictional local data.
They contain no keyboard, Metro/dev menu, debug overlay, account identifier,
notification, email, token, backend URL, or other personal data.

## Deterministic fixture

`createAppStoreScreenshotFixture` in
`src/features/dev/app-store-screenshot-fixture.ts` returns only
`{ transactions, balanceEntries }`. For its current local calendar day it
creates:

- salary balance entry: `€1,249.12` at 14:45;
- normal Food expense: `€4.56` at 12:33;
- leak Shopping expense: `€10.00`, reason Impulse, at 15:45.

The fixture is test/docs-only. To reproduce a simulator state, temporarily
import it from a local development entry point after database initialization,
import `transactions` through the existing transaction store, and add each
`balanceEntries` item through the existing balance store. Remove the temporary
import and calls before committing. Production runtime files must never import
the fixture.

For Add Transaction, enter the documented form values manually. If a capture
requires the keyboard to stay closed, use a local-only temporary capture edit
and revert it before validation; do not change the shipped focus behavior.

## Capture workflow

1. Use Node `20.19.4` and boot the iPhone 17 Pro Max simulator.
2. Set English and EUR in the app, then override the simulator status bar to
   `9:41` with normal signal/Wi-Fi and a charged battery.
3. Seed the fixture temporarily and start a production-like Expo session with
   `npx expo start --ios --no-dev --minify`.
4. Capture Home, Analytics & Leaks, and Add Transaction as native PNGs. Confirm
   each is `1320×2868` before placing it in the Figma device display.
5. Preserve the source compositions and replace only the three device display
   areas. Export flattened, opaque JPEG files at quality 95 or higher.
6. Inspect every final JPEG at 100% zoom, then run
   `npm run screenshots:validate` and the release validation chain.

ML-100 attempted to create the requested sibling Figma section named
`ML-100 App Store screens — iPhone 6.9 — 1320x2868`. The connected Figma
account rejected write operations because a Full seat is required. The source
section was not modified. The committed files therefore use read-only Figma
assets plus deterministic local composition; after a Full seat is granted,
copy the five source compositions into that sibling section and place these
same native captures into the three display areas.

## App Store Connect upload

1. Open the iOS app version in App Store Connect and select App Previews and
   Screenshots.
2. Choose English (U.S.) and the iPhone 6.9-inch display slot.
3. Upload the five JPEGs in numeric filename order.
4. Confirm all five previews remain portrait, uncropped, and in the documented
   order, then save the app version.
5. Do not upload fixture source files, simulator PNGs, or the manifest.

Future localizations should use new locale directories and translated Figma
copies; do not overwrite the canonical `en-US/6.9` set.
