---
name: uxui
description: SatSigner UX/UI design rules for AI agents. Read before implementing any layout, component, or screen in apps/mobile. Covers component inventory, styling rules, Bitcoin design principles, and when to compose vs. create.
version: 1.0.0
license: MIT
metadata:
  tags: react-native, design, ui, ux, bitcoin, components, styling
  filePattern: "apps/mobile/components/**/*.tsx,apps/mobile/app/**/*.tsx"
---

# SatSigner UI/UX Design Rules

**Read this before writing any layout, component, or screen.**

---

## Non-Negotiable Rules

### Never use raw primitives — always use SS components

| Raw (NEVER) | SS equivalent (ALWAYS) |
|---|---|
| `<View style={{flexDirection:'column'}}>` | `<SSVStack gap="md">` |
| `<View style={{flexDirection:'row'}}>` | `<SSHStack gap="sm">` |
| `<Text>` | `<SSText>` |
| `<TextInput>` | `<SSTextInput>` |
| `<TouchableOpacity>` (icon) | `<SSIconButton>` |
| `<TouchableOpacity>` (full-width CTA) | `<SSButton>` |

### Never hardcode values

- Colors: always `Colors.*` from `@/styles` — never `'#FFFFFF'`, `'black'`, `rgba(...)`
- Spacing/gaps: always `Layout.vStack.gap.*` tokens or SS component `gap` prop — never `gap: 16`
- Font sizes: always `Sizes.text.fontSize.*` — never `fontSize: 14`
- Font families: always `Typography.*` from `@/styles` — never `fontFamily: 'SF-Pro-Text-Regular'`
- User-facing strings: always `i18n.t('namespace.key')` — never hardcoded English. Add new keys to `locales/*.json` if absent.

### Dark theme only

- Default background: `Colors.gray[950]` (`#0A0A0A`)
- Screen wrapper: `<SSMainLayout>` (adds SafeAreaView + standard padding)
- No light mode, no conditional themes
- Muted text: `<SSText color="muted">` → `Colors.gray[300]`

### Compose, don't create

Only create a new `SS`-prefixed component if the same pattern repeats **3+ times** across the codebase. Otherwise compose inline from existing SS components.

### Lists: FlashList over FlatList

Always use `FlashList` (from `@shopify/flash-list`) instead of `FlatList`. Never use `ScrollView` for lists of dynamic data.

### No locally-defined functions as JSX props

Hoist handlers outside the component or use stable references. Inline arrow functions in JSX (`onPress={() => foo()}`) cause unnecessary re-renders even with react-compiler.

---

## Top-15 Components

### Layout

**`SSMainLayout`** — every screen root
```tsx
<SSMainLayout>          // gray[950] bg + SafeAreaView + horizontal padding
<SSMainLayout black>    // pure black bg
```

**`SSVStack`** — vertical flex column
```tsx
<SSVStack gap="lg">     // gap tokens: xxs|xs|sm|md|lg|xl|2xl|none
  // justifyBetween, itemsCenter, widthFull also available
```

**`SSHStack`** — horizontal flex row
```tsx
<SSHStack gap="sm" itemsCenter>
```

**`SSFormLayout`** — form container (standardized 16px gap between fields)

---

### Text & Amounts

**`SSText`** — the only text component
```tsx
<SSText size="xl" weight="medium">Title</SSText>
<SSText size="sm" color="muted">Subtitle</SSText>
<SSText size="md" type="mono">bc1q…3f7k</SSText>   // mono for addresses/keys/txids
```
- Sizes: `2xxs` `xxs` `xs` `sm` `md` `lg` `xl` `2xl` `3xl` `4xl` `5xl` `6xl` `7xl` `8xl`
- Weights: `ultralight` `light` `regular` `medium` `bold`
- Colors: `white` (default) | `black` | `muted`
- Type: `sans-serif` (default) | `mono`

**`SSStyledSatText`** — all bitcoin amount displays
```tsx
<SSStyledSatText amount={satoshis} currency="sats" />
<SSStyledSatText amount={satoshis} type="receive" noColor={false} />  // green
<SSStyledSatText amount={satoshis} type="send" noColor={false} />     // red
```
- `noColor={true}` (default): leading zeros muted, significant digits white
- `noColor={false}`: send = `mainRed`, receive = `mainGreen`
- Fiat is always secondary — show below or alongside, never replace

---

### Inputs & Forms

**`SSTextInput`**
```tsx
<SSTextInput variant="default" />         // filled gray[850] bg
<SSTextInput variant="outline" />         // bordered
<SSTextInput size="small" />
<SSTextInput status="invalid" error="Required" />
<SSTextInput status="valid" />
<SSTextInput actionRight={<SSIconButton>…</SSIconButton>} />
```

**`SSCheckbox`** — labeled checkbox

**`SSRadioButton`** — labeled radio option

---

### Actions

**`SSButton`** — primary CTA (full-width, 58px height)
```tsx
// All labels must be i18n.t('...') in production — illustrative keys shown below
<SSButton label={i18n.t('send.action')} onPress={onSend} />           // default: gray[600]
<SSButton label={i18n.t('common.cancel')} variant="secondary" />      // white bg, black text
<SSButton label={i18n.t('common.advanced')} variant="outline" />      // glass border, transparent
<SSButton label={i18n.t('common.skip')} variant="ghost" />            // transparent, muted text
<SSButton label={i18n.t('common.options')} variant="subtle" />        // gray[900] bg
<SSButton label={i18n.t('send.confirm')} variant="gradient" />        // animated gradient
<SSButton label={i18n.t('common.delete')} variant="danger" />         // error red
<SSButton label={i18n.t('common.sending')} loading />                 // spinner
<SSButton label={i18n.t('common.continue')} disabled />               // 0.3 opacity
```

**`SSIconButton`** — icon-only touchable (wraps SVG icon)

**`SSActionButton`** — full-height (62px) touchable row for action lists

---

### Utility

**`SSModal`** — modal overlay

**`SSClipboardCopy`** — copy-to-clipboard — use for every address, txid, key display

**`SSQRCode`** — QR code display for addresses and payment requests

**`SSSeparator`** — horizontal divider between sections

---

## Correct Usage Patterns

### Screen structure
```tsx
// CORRECT
export default function SendScreen() {
  return (
    <SSMainLayout>
      <SSVStack gap="lg" justifyBetween>
        <SSVStack gap="md">
          <SSText size="2xl" weight="medium">{i18n.t('send.title')}</SSText>
          <SSTextInput placeholder={i18n.t('send.amountPlaceholder')} />
        </SSVStack>
        <SSButton label={i18n.t('common.continue')} onPress={onContinue} />
      </SSVStack>
    </SSMainLayout>
  )
}

// WRONG — raw primitives, hardcoded values, hardcoded strings
export default function SendScreen() {
  return (
    <SafeAreaView style={{ backgroundColor: '#0A0A0A', flex: 1 }}>
      <View style={{ flexDirection: 'column', gap: 32, padding: 20 }}>
        <Text style={{ fontSize: 24, color: '#fff', fontWeight: '500' }}>Send</Text>
        <TextInput style={{ backgroundColor: '#242424' }} />
      </View>
    </SafeAreaView>
  )
}
```

### Bitcoin amounts
```tsx
// CORRECT — sats-first, color-coded, never raw number
<SSStyledSatText amount={amount} type="send" noColor={false} />

// WRONG — raw text, no formatting, no color semantics
<Text style={{ color: 'red' }}>{amount} sats</Text>
```

### Addresses and keys
```tsx
// CORRECT — mono font, truncated display, always copyable
<SSHStack gap="sm" itemsCenter>
  <SSText type="mono" size="sm" numberOfLines={1} ellipsizeMode="middle">
    {address}
  </SSText>
  <SSClipboardCopy value={address} />
</SSHStack>

// WRONG — full address in serif, no copy affordance
<SSText>{address}</SSText>
```

### Destructive / send actions
```tsx
// CORRECT — two-step: preview screen → confirm button
// Step 1: show all details (amounts, fees, destination)
// Step 2: <SSButton label="Confirm & Send" variant="gradient" onPress={onConfirm} />

// WRONG — single tap sends without review
<SSButton label="Send" onPress={broadcastTx} />
```

### Async loading state
```tsx
// CORRECT — button shows spinner while in-flight
<SSButton label="Broadcast" loading={isBroadcasting} onPress={onBroadcast} />

// WRONG — no feedback during async operation
<SSButton label="Broadcast" onPress={onBroadcast} />
```

---

## Bitcoin Design Principles

1. **Privacy-preserving display** — never show full addresses inline without truncation (`numberOfLines={1}` + `ellipsizeMode="middle"`). Always pair address display with `SSClipboardCopy`.

2. **Conservative confirmation flows** — send, sign, and broadcast operations require a dedicated review screen before the final action. Never trigger irreversible operations on a single tap.

3. **Sats-first denomination** — use `SSStyledSatText` for all bitcoin amounts. Fiat equivalent is secondary (smaller size, `color="muted"`). Default `currency="sats"` unless user has configured BTC display.

4. **Status clarity** — every async operation (sync, broadcast, fetch) must have a visible in-progress state and a clear success or failure outcome. Use `SSButton loading` prop, `SSLoader`, or inline `SSText` status messages. Never leave the user uncertain.

5. **Key material treatment** — seed words, xpubs, fingerprints, txids, and raw addresses always use `<SSText type="mono">`. These are security-critical strings; monospaced rendering aids verification and signals special handling.
