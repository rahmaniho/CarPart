import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

const typescriptRules = {
  '@typescript-eslint/no-unused-vars': [
    'error',
    { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
  ],
  '@typescript-eslint/no-explicit-any': 'warn',
  'no-constant-condition': 'error',
  'no-debugger': 'error',
  // TypeScript commonly separates value and `import type` declarations.
  'no-duplicate-imports': 'off',
  'no-unreachable': 'error',
};

export default [
  {
    ignores: ['**/dist/**', '**/coverage/**', '**/node_modules/**', '**/android/**'],
  },
  {
    files: ['apps/api/{src,test}/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    },
    plugins: { '@typescript-eslint': tsPlugin },
    rules: typescriptRules,
  },
  {
    files: ['apps/{web,mobile}/src/**/*.{ts,tsx}', 'apps/{web,mobile}/test/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...typescriptRules,
      ...reactHooks.configs.recommended.rules,
      // صفحات نقش‌ها عمداً Tab definition را کنار component صادر می‌کنند.
      'react-refresh/only-export-components': 'off',
    },
  },
];
