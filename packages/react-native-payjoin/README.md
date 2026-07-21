# react-native-payjoin

UniFFI React Native bindings for [Payjoin Dev Kit](https://payjoindevkit.org/) (`payjoin` 0.25), used by SatSigner for BIP77 + BIP78.

## Build native artifacts

Requires Rust (1.88+), Xcode (iOS), and Android NDK + `cargo-ndk` (Android).

```bash
cd packages/react-native-payjoin
pnpm ubrn:ios         # writes build/RnPayjoin.xcframework
pnpm ubrn:android     # writes android/src/main/jniLibs + android/generated codegen
pnpm codegen:android  # regenerate TurboModule codegen only (no Rust rebuild)
```

`ubrn:*` scripts regenerate bindings and re-apply `src/index.ts` facade patches.

## App integration

Mobile depends on `workspace:*`. After building natives:

```bash
cd apps/mobile
pnpm variant -- --suffix payjoin   # prebuild + install on device
```

Confirm Payjoin is live: Settings → Features → Payjoin on, open Receive on a
singlesig signet account — the URI should include `pj=` / BIP77 params (not a
plain address-only QR).

Jest continues to use `apps/mobile/__mocks__/react-native-payjoin.ts`.
