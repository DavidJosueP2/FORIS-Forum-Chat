import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default [
  { ignores: ['**/node_modules/**', '**/dist/**', '**/dist-test/**', 'coverage/**', 'playwright-report/**', 'test-results/**', '.impeccable/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { files: ['**/*.{js,ts,tsx}'], languageOptions: { globals: globals.node } },
  { files: ['apps/web/src/**/*.{ts,tsx}'], languageOptions: { globals: globals.browser } },
  { ...reactHooks.configs.flat.recommended, files: ['apps/web/src/**/*.{ts,tsx}'] },
  { ...reactRefresh.configs.vite, files: ['apps/web/src/**/*.{ts,tsx}'] },
  { rules: { 'no-var': 'error', 'prefer-const': 'error' } },
  { files: ['**/*.js'], rules: { 'no-unused-vars': ['error', { argsIgnorePattern: '^_' }] } },
  { files: ['**/*.{ts,tsx}'], rules: { '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }] } },
];
