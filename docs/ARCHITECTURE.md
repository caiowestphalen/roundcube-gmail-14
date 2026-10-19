# Architecture

## CSS

Tailwind v4, CSS-first. `styles.css` declares the layer order `rc-compat, theme, base, components,
utilities`; preflight is **not** imported (Roundcube and plugins render markup we do not own).
Every component file wraps its rules in `@layer components`. Consequences:

- Any **unlayered** stylesheet wins over ours regardless of specificity. Plugin stylesheets
  (`authres_status`, `tb_label`, `snoozed_messages`, `contextmenu`, `scheduled`, …) are unlayered and
  load after the skin — overrides for them live in `src/css/plugin-overrides.css` (also unlayered,
  prefixed with `html` for specificity).
  Thunderbird label colors also require `!important` to beat the upstream declarations;
  browser contrast checks verify the resulting palette in both themes.
- Icon glyphs: `icons-map.css` maps Roundcube/Elastic button and menu classes to Material Symbols via
  `::before { content: var(--ico-*) }`. The shared base rule is wrapped in `:where()` so it has
  specificity (0,0,1) and every mapping wins. Default glyph: `more_horiz` for toolbar buttons,
  empty box for menu items.
- Dark mode: tokens redefined under `html.dark-mode`; `@custom-variant dark` for utilities.
  `layout.html` sets the class before first paint from the `colorMode` cookie (`dark|light|auto`).
- Breakpoints: phone ≤480, small 481–1024 (one panel at a time, nav becomes a drawer), normal
  1025–1200, large >1200. CSS and layout classes share the 1024px drawer boundary.
  Message rows respond to the actual list pane: ≤620px uses two lines and 40px avatars;
  wider panes use a single row and 32px avatars. Compact density reduces the narrow row height.

## JS

`index.js` runs synchronously before `rcmail.init()`: `UI` shim, layout, theme, popup, core
overrides, unload guard. On DOMContentLoaded: toast, controls, avatars, mailUI, compose, search.

Core overrides (`core-overrides.js`):

- `rcmail.show_popup_dialog` → `modal.openDialog` (returns a jQuery-ish handle with `.dialog()`).
- `rcmail.show_menu/hide_menu` → `popup.js`; menus without a DOM node fire `menu-open` so listeners
  can build dialogs (`messagelistmenu` → `mail.js openListOptions`).
- `rcmail.open_window` for compose on desktop → `compose-window.js` (in-page popup with iframe,
  `_extwin=1`, `html.gm-in-popup` inside).
- `check_compose_input`, `window.confirm/alert`, `onbeforeunload` → async modals.

Modal results settle before teardown/cancel callbacks. Empty initial compose hashes are valid:
dirty checks never use truthiness. Popup close supports Cancel/Discard/Save, and saving closes only
after the core draft-saved event; timeout/error preserves the editor. `openDialog({local:true})`
keeps the recipient picker inside its compose frame, where the core contact-list instance lives.
The picker reuses `#recipient-dialog`, passes the explicit To/Cc/Bcc field to `add-recipient`, and
dispatches native `change` for chip synchronization after core's jQuery event.

`controls.js` keeps the original form fields as submission values. Single-select wrappers follow
visibility, disabled options/optgroups and dynamic plugin changes; multi-selects use accessible
toggle rows with arrow/Home/End keyboard navigation. Portalled dropdowns stay within the viewport
and stop Escape from closing their parent menu/dialog. `popup.js` moves menus to body, normalizes
plugin menu markup, and translates core folder depth into a 16px base inset plus 16px per level.

Other in-house pieces: `tooltip.js` (every `title` → dark pill after 320 ms; the attribute is
parked in `data-tip` only while showing because plugins read/write `title`), `datetime.js`
(date / date-time picker replacing native inputs and jQuery-UI datepickers; writes back in the
format each consumer expects), `loading.js` (skeleton overlays on content iframes — hooks
`rcmail.location_href` — and the compose popup; busy pill for core "loading" messages),
`lists.js` (empty states for every `data-label-msg` list, list-refresh shimmer), `fab.js`
(phone floating "+" proxying the hidden content toolbar's create action), `contact-dialog.js`
("add to address book" opens the framed contact form pre-filled in a modal).

Elastic ABI kept in `shim.js` so plugin JS keeps working: `UI.show_popup`, `toggle_list_selection`,
`switch_nav_list`, `smart_field_init/reset` (`smart-field.js` builds the `<id>_list` multi-input
managesieve expects), `form_errors`, `recipient_selector`, `about_dialog`, …

Message list: Roundcube renders a `<table>`; `mail.js` decorates each row on `insertrow`
(letter avatar, star before sender, hover actions) and CSS lays the subject cell out with grid.
Avatars are direct grid children; their initials use explicit grid centering. Phone checkbox
selection preserves the list and exposes a bottom bulk-action toolbar.
`listing.css` (generic lists) is scoped with `.listing:not(.messagelist)`; `list.css` owns the mail list.

## Skin-side plugin assets

Roundcube resolves plugin templates, scripts and stylesheets from `skins/gmail/plugins/<plugin>/`
before the plugin's own `skins/` folder (and, through `extends`, before Elastic's). We use it for:

- `jqueryui/jquery-ui.css` — neutralises jQuery UI styling (dialogs, datepickers are ours) and
  styles the tabs some plugin dialogs still use (hotkeys).
- `contextmenu/{functions.js,contextmenu.css,includes/}` — the plugin builds right-click menus
  by cloning toolbar/menu items by selector; Elastic's `functions.js` points at `#toolbar-menu`,
  ours points at `#mailtoolbar`, `#message-menu`, `#addressbooktoolbar`, … and styles the menu.

Plugin quirks that need JS rather than CSS live in `mail.js` (authres PNG → glyphs, scheduled
sending row) and `plugin-overrides.css` (unlayered, see above).

## Companion plugins

The skin degrades gracefully without them; when installed they only add `rcmail.env` entries and
actions the skin's modules look for.

- **gm_core** — `env.gm_apps` (sanitised label/url/icon/color/target) → `apps.js` appends tiles to
  the launcher card; `env.gm_ai {enabled, ops}` → `ai.js` adds the compose AI menu (`#ai-menu`,
  button registered with `register_button` so core's `set_button` keeps the `ai` class; the popup is
  opened directly because `env.compose_commands` blocks unknown commands) and the message Summarize
  card. Requests go to `plugin.gm_core.ai` (server-side proxy, per-session rate limit, providers
  `openrouter` / `gemini` / `echo`) and come back on the `plugin.gm_core.ai_result` event.
  Summary subjects exclude hidden accessibility labels, plugin scripts and header action links.
- **gm_avatars** — `env.gm_avatars.url` → `avatar-images.js` probes `…&_email=` with an `Image()`
  for every `.gm-avatar-initial[data-email]` (rows tagged in `mail.js insertrow`, header in
  `decorateMessageHeader`, contacts in `contacts.js`), swaps the letter for `<img>` on 200, keeps
  it on 404; misses are memoised per page and cached server-side (negative cache with `until`).
  Images are sniffed by magic bytes and served with `Content-Security-Policy: sandbox`.

## PWA

`includes/layout.html` links `manifest.json` and the apple-touch icon with skin-relative paths
(Roundcube rewrites them to `static.php/skins/gmail/…`, which serves `.json`). `tools/build-pwa.mjs`
renders the icons from `logo.svg` with Playwright and writes the manifest (`start_url: /?_task=mail`).
No service worker: Roundcube pages are session-bound and must not be cached offline.

## Templates

`meta.json` `extends: elastic` only affects template resolution for plugins that ship
`skins/elastic/templates/*.html`. Our own templates: `includes/{layout,header,menu,footer}`,
`mail`, `compose`, `addressbook`, `login`, `message`. Remaining files are Elastic copies restyled by CSS.
Roundcube's opening `<roundcube:form>` must close with HTML `</form>` (there is no closing custom
tag). Contact edit keeps its photo upload form separate; `contacts.js` proxies the real file input
and core delete-photo command with localized Add/Replace/Delete controls.

## Verification

`tests/sweep.mjs` captures ~44 states × {light,dark} × {1440,390} with JS/HTTP errors into
`summary.json`; `tests/frame-dump.mjs` dumps framed pages and lists native form controls still
visible. `tools/check-core-contracts.sh` + `tools/check-icons.mjs` run in CI.
On shared hosts, use the resource-capped `tools/sweep-slice.sh` or its queue.
All browser probes require explicit `RC_URL` and `RC_TEST_ACCOUNTS_FILE` settings; see
[verification setup](../tests/README.md). Local diagnostics and credentials are excluded from releases.
The expanded `audit-ui.mjs` covers pages/controls/scrolling at 390/820/1440 in both themes;
`audit-states.mjs` covers conditional filters, editor dialogs, picker insertion, photo upload and
2FA setup without saving. `probe-refine.mjs`, `probe-extras.mjs` and `probe-mail-refine.mjs` verify
responsive/draft behavior, form submission/keyboard behavior, and actual test-account delivery.
See `UI-AUDIT-2026-09-11.md` for evidence and coverage limitations.
