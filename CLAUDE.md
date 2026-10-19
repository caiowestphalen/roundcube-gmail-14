# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build and development commands

```bash
npm ci               # Install dependencies
npm run build        # Full build: clean → fonts → icons → JS → CSS → minify
npm run dev          # Watch mode: CSS (styles only) and JS in parallel
npm run lint         # ESLint + Stylelint + Prettier checks (run before committing)
npm run format       # Auto-format all supported files
npm run check        # lint + build (CI equivalent, no browser tests)
node tools/check-icons.mjs  # Verify all icon references exist in the subset
RC=/path/to/roundcube npm run deploy  # Sync built skin/ to $RC/skins/gmail/
```

Build outputs land in `skin/` (not tracked in full by git). Always run `npm run build` before deploying; `npm run dev` only rebuilds CSS and JS, not fonts or icons.

CI enforces size budgets: `styles.min.css` and `ui.min.js` must each be under 64 KB gzipped. CI also verifies that jQuery, Bootstrap, Popper and third-party UI libraries are absent from the bundle.

## Browser verification (requires a live Roundcube install)

```bash
export RC_URL=https://webmail.example.com
export RC_TEST_ACCOUNTS_FILE=/path/outside/checkout/accounts.txt
npm test                              # responsive layouts, controls, draft behavior
node tests/probe-mail-refine.mjs     # send, receive, attachments, labels, copy/move
node tests/probe-extras.mjs          # forms, recipient picker, login, plugin controls
node tests/audit-states.mjs --theme=dark --width=390
tools/audit-slice.sh light 1440      # full page/control inventory (Linux only)
```

`RC_TEST_ACCOUNTS_FILE` is one `username password` pair per line. Never commit it. Run one browser job at a time. Results go to ignored `test-results/`.

## Architecture

### Build pipeline

`tools/build-fonts.mjs` subsets Roboto Flex and the Material Symbols icon font from `src/icons.txt`. `tools/build-js.mjs` bundles `src/js/index.js` with esbuild into `skin/ui.js` / `skin/ui.min.js`. Tailwind CSS v4 compiles `src/css/styles.css` (plus `print.css` and `embed.css`) into `skin/styles/`. `tools/build-min.mjs` minifies the CSS.

### CSS layers

`src/css/styles.css` declares the layer order: `rc-compat, theme, base, components, utilities`. Preflight is **not** imported. Every component file wraps its rules in `@layer components`.

**Critical:** any unlayered stylesheet wins over our layered rules regardless of source order. Plugin stylesheets (`authres_status`, `tb_label`, `contextmenu`, etc.) are unlayered. Overrides for them live in `src/css/plugin-overrides.css` — also unlayered, prefixed with `html` for specificity. Thunderbird label colors additionally require `!important`.

Dark mode: tokens are redefined under `html.dark-mode`; use `@custom-variant dark` for utilities. The class is written before first paint from the `colorMode` cookie.

Breakpoints: phone ≤480px, small 481–1024px (drawer nav), normal 1025–1200px, large >1200px. Message rows switch between single-line (>620px, 32px avatars) and two-line (≤620px, 40px avatars) based on the actual list pane width.

### JavaScript modules

`src/js/index.js` is the entry point. It runs synchronously (before `rcmail.init()`) to set up the `UI` shim, layout, theme, popup and core overrides, then wires the rest on `DOMContentLoaded`.

Key modules and their responsibilities:

| Module | Responsibility |
|---|---|
| `core-overrides.js` | Replaces `rcmail.show_popup_dialog`, `show_menu/hide_menu`, `open_window` (compose), `window.confirm/alert` |
| `compose-window.js` | In-page compose popup (iframe with `_extwin=1`, dirty-draft check, save-then-close) |
| `controls.js` | Custom single/multi-select wrappers, portalled dropdowns; original `<select>` is kept as submission value |
| `popup.js` | Moves menus to `<body>`, normalizes plugin markup, translates folder depth to 16px indents |
| `mail.js` | Decorates message rows (`insertrow`): letter avatar, star, hover actions; phone bulk-action toolbar |
| `shim.js` | Elastic ABI compatibility (`UI.show_popup`, `smart_field_init`, `recipient_selector`, etc.) |
| `modal.js` | Async modal replacing `confirm/alert`; results settle before teardown/cancel callbacks |
| `tooltip.js` | Replaces `title` attributes with dark pill tooltips after 320 ms delay |
| `datetime.js` | Date/time picker replacing native inputs and jQuery-UI datepickers |
| `loading.js` | Skeleton overlays on content iframes (hooks `rcmail.location_href`) and compose popup |

### Skin-side plugin assets

`skin/plugins/<plugin>/` is resolved before the plugin's own `skins/` folder. This repo ships:
- `jqueryui/jquery-ui.css` — neutralizes jQuery UI dialogs/datepickers (ours replace them); keeps tab styling for plugins that still use jQuery UI tabs.
- `contextmenu/functions.js` — points context menus at `#mailtoolbar`, `#message-menu`, etc. (Elastic's version targets different selectors).

### Template model

`skin/meta.json` sets `extends: elastic` — this only affects plugin template lookup, not CSS or JS loading. Our templates are `includes/{layout,header,menu,footer}`, `mail`, `compose`, `addressbook`, `login`, `message`. Other templates are Elastic copies restyled by CSS.

Roundcube's `<roundcube:form>` opens a `<form>` but has no closing custom tag; close it with `</form>`.

### Companion plugins (optional)

`gm_core` and `gm_avatars` add `rcmail.env` entries the skin looks for; the skin degrades gracefully without them. See `docs/ARCHITECTURE.md` for the exact env keys and event names.

## Customization entry points

| What | Where |
|---|---|
| Colors, typography, shared dimensions | `src/css/tokens.css` |
| Icon subset | `src/icons.txt` (rebuild fonts after editing) |
| Plugin stylesheet overrides | `src/css/plugin-overrides.css` |
| App icons and manifest | `skin/images/logo.svg` → `npm run pwa` |
