# Browser verification

Use Node 24, install development dependencies with `npm ci`, and install Chromium with
`npx playwright install chromium`. Build and deploy the skin to a dedicated Roundcube
1.7.x test installation. Select the Gmail skin for each test account.

Every browser script imports `config.mjs` and requires explicit configuration:

```bash
export RC_URL=https://webmail.example.com
export RC_TEST_ACCOUNTS_FILE=/path/outside/the/checkout/accounts.txt
npm test
```

The account file contains one `username password` pair per line. Blank lines and lines
starting with `#` are ignored. Restrict its permissions to its owner. Never commit this
file or put credentials in the URL. The scripts have no default server or account path.

Provide two dedicated accounts for `probe-mail-refine.mjs`; the other probes use the first.
Populate test mail and contacts with fictional data. Mail workflows send messages between
these accounts, download attachments, change labels and copy/move messages. Other probes
can create drafts, change test preferences and exercise contact photo controls. Use accounts
whose data can be changed, not personal mailboxes.

Some checks require specific companion plugins, folders, contacts, messages or preferences.
Read the relevant probe before running it and configure its fixtures for your test installation.
For the login appearance checks in `probe-extras.mjs`, the unauthenticated installation must
render the Gmail skin; `RC_LOGIN_URL` optionally selects a separate login preview installation.

## Commands

- `npm test`: responsive layouts, custom controls and draft behavior.
- `node tests/probe-mail-refine.mjs`: delivery, attachments, replies, labels and folder actions.
- `node tests/probe-extras.mjs`: forms, recipient picker, login and plugin controls.
- `node tests/probe-label-contrast.mjs`: rendered label contrast.
- `node tests/frame-dump.mjs`: framed pages and remaining native controls.
- `tools/audit-slice.sh light 1440`: expanded page/control inventory.
- `node tests/audit-states.mjs --theme=dark --width=390`: nested and conditional states.
- `tools/sweep-slice.sh dark 390`: a single standard visual sweep.
- `node tools/audit-gallery.mjs <result-directory>`: local screenshot gallery.

Run one browser job at a time. The slice wrappers require Linux user systemd scopes and
cap memory at 3 GB with low CPU and I/O priority. Apply equivalent limits to direct probes
on shared machines. Put Node 24 on PATH before invoking the wrappers.

Screenshots, reports and browser logs stay in ignored `test-results/`. They may contain
account or session data: review and sanitize any artifact before sharing it. The public
README screenshots are separate, curated examples using fictional content.
