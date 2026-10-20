# Screen demo protocol

Turn one SatSigner React Native screen into a static HTML, CSS, and JavaScript phone demo. Source of truth is [satsigner/satsigner](https://github.com/satsigner/satsigner/) (`apps/mobile`). This folder is a separate test site. It does not change the marketing homepage.

## Files

- `tokens.css` — CSS variables copied from `apps/mobile/styles/colors.ts`, `sizes.ts`, and `layout.ts`. Glass borders come from `SSButton` elevated styles.
- `index.html` — test page and phone frame.
- `screen.css` — layout for one screen. Uses variables from `tokens.css` only.
- `screen.js` — fixture data and light interaction.
- `icons.js` — SVG markup copied from `apps/mobile/components/icons`.

## Rules

1. Name the source screen in a comment at the top of `screen.js`. The first demo is `apps/mobile/app/(authenticated)/(tabs)/(signer,explorer,converter)/index.tsx`, plus `SSButton`, `SSText`, `SSMainLayout`, and `constants/navItems.ts`.
2. Map `View` to `div`, `Text` to `p` or `span`, and `Pressable` to `button`.
3. `StyleSheet` numbers become `px`. Percent paddings stay percentages (`mainContainer` is `6%`).
4. No new hex values in `screen.css` or `screen.js`. Add a token only when it already exists in the app styles.
5. Type is Inter (the website font). SF Pro stays in the app.
6. Data is a fixture. No wallet, network, or native modules.
7. Interaction is limited to press feedback, the home stagger (60ms delay, 150ms, 24px slide), and the Signer / Explorer / Converter tab switch.
8. The phone is a fixed 390 by 844 frame.

## Adding another screen

Copy this folder’s pattern: one source file, one fixture, one `screen.css`. Reuse `tokens.css`.
