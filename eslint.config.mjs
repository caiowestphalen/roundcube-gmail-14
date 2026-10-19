import js from '@eslint/js';
import globals from 'globals';

// Roundcube core globals our skin code may READ. jQuery is present on the page (loaded by
// Roundcube core) but is banned in skin code — enforced by no-restricted-globals below.
const roundcubeGlobals = {
  rcmail: 'readonly',
  rcube_webmail: 'readonly',
  rcube_list_widget: 'readonly',
  rcube_treelist_widget: 'readonly',
  rcube_event: 'readonly',
  rcube_text_editor: 'readonly',
  bw: 'readonly',
  tinymce: 'readonly',
  UI: 'writable',
  $: 'readonly',
  jQuery: 'readonly',
};

export default [
  {
    ignores: [
      'node_modules/',
      'skin/styles/',
      'skin/ui.js',
      'skin/ui.min.js',
      'test-results/',
      'playwright-report/',
    ],
  },
  js.configs.recommended,
  {
    files: ['src/js/**/*.js'],
    languageOptions: {
      sourceType: 'module',
      ecmaVersion: 2024,
      globals: { ...globals.browser, ...roundcubeGlobals },
    },
    rules: {
      'no-restricted-globals': [
        'error',
        { name: '$', message: 'No jQuery in skin code — use vanilla DOM.' },
        { name: 'jQuery', message: 'No jQuery in skin code — use vanilla DOM.' },
        { name: 'alert', message: 'Use modal.alert() — native dialogs are banned.' },
        { name: 'confirm', message: 'Use modal.confirm() — native dialogs are banned.' },
        { name: 'prompt', message: 'Use modal.prompt() — native dialogs are banned.' },
      ],
      'no-var': 'error',
      'prefer-const': 'error',
      eqeqeq: ['error', 'smart'],
      curly: ['error', 'multi-line'],
    },
  },
  {
    // skin-side plugin glue (skins/gmail/plugins/<plugin>/*.js): classic scripts run by Roundcube
    files: ['skin/plugins/**/*.js'],
    languageOptions: {
      sourceType: 'script',
      ecmaVersion: 2024,
      globals: { ...globals.browser, ...roundcubeGlobals },
    },
  },
  {
    files: ['tools/**/*.mjs', 'tests/**/*.{js,mjs,ts}', 'playwright.config.*', 'eslint.config.mjs'],
    languageOptions: {
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.browser,
        UI: 'readonly',
        rcmail: 'readonly',
        tinymce: 'readonly',
      },
    },
    rules: { 'no-unused-vars': ['error', { caughtErrors: 'none' }] },
  },
];
