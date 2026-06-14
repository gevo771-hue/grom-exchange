/**
 * ESLint 9 flat config for grom-backend.
 *
 * Intentionally permissive — this repo is an active prototype; CI must
 * stay green so frontend deploys aren't blocked on backend lint nits.
 * We enforce only the hard correctness checks (no-undef, no-redeclare,
 * no-dupe-keys, no-unreachable) and let style live. As the codebase
 * stabilises we can ratchet rules up without changing the workflow.
 *
 * No dependency on the `globals` package — we list the Node + browser
 * names we actually use ourselves so `npm ci` doesn't need updating.
 */

const NODE_GLOBALS = {
  // Node built-ins
  process: 'readonly',
  Buffer: 'readonly',
  __dirname: 'readonly',
  __filename: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  setInterval: 'readonly',
  clearInterval: 'readonly',
  setImmediate: 'readonly',
  clearImmediate: 'readonly',
  global: 'readonly',
  console: 'readonly',
  module: 'readonly',
  require: 'readonly',
  exports: 'readonly',
  // Fetch + URL APIs available in Node 18+
  fetch: 'readonly',
  URL: 'readonly',
  URLSearchParams: 'readonly',
  AbortController: 'readonly',
  AbortSignal: 'readonly',
  FormData: 'readonly',
  Headers: 'readonly',
  Request: 'readonly',
  Response: 'readonly',
  Blob: 'readonly',
  // Crypto / web standards
  crypto: 'readonly',
  TextEncoder: 'readonly',
  TextDecoder: 'readonly',
  performance: 'readonly',
  structuredClone: 'readonly',
  queueMicrotask: 'readonly',
  globalThis: 'readonly',
};

export default [
  {
    files: ['src/**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: NODE_GLOBALS,
    },
    rules: {
      'no-undef': 'error',
      'no-redeclare': 'error',
      'no-dupe-keys': 'error',
      'no-unreachable': 'warn',
      // Style / unused — explicitly off so CI doesn't bikeshed during dev
      'no-unused-vars': 'off',
      'no-empty': 'off',
      'no-constant-condition': 'off',
      'no-prototype-builtins': 'off',
      'no-useless-escape': 'off',
    },
  },
  {
    ignores: ['node_modules/**', 'dist/**', 'coverage/**', 'test/**'],
  },
];
