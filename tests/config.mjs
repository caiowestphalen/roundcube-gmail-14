import fs from 'node:fs';

// No deployment or account defaults: every browser run needs an explicit test target.
if (!process.env.RC_URL || !process.env.RC_TEST_ACCOUNTS_FILE) {
  throw new Error(
    'Set RC_URL and RC_TEST_ACCOUNTS_FILE for a dedicated test installation. See tests/README.md.'
  );
}
const url = new URL(process.env.RC_URL);
if (
  !['http:', 'https:'].includes(url.protocol) ||
  url.username ||
  url.password ||
  url.search ||
  url.hash
) {
  throw new Error(
    'RC_URL must be an HTTP(S) application URL without credentials, query or fragment.'
  );
}
export const base = url.href.replace(/\/$/, '');
export const accounts = fs
  .readFileSync(process.env.RC_TEST_ACCOUNTS_FILE, 'utf8')
  .split(/\r?\n/)
  .filter((line) => line.trim() && !line.trimStart().startsWith('#'))
  .map((line) => {
    const pair = line.match(/^(\S+)\s+(.+)$/);
    if (!pair)
      throw new Error(
        'Each account line must contain a username and password separated by whitespace.'
      );
    return [pair[1], pair[2]];
  });
if (!accounts.length) throw new Error('The test accounts file is empty.');
