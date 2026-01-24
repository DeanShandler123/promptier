import typescript from '@typescript-eslint/eslint-plugin';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import importPlugin from 'eslint-plugin-import';
import unusedImports from 'eslint-plugin-unused-imports';
import tsParser from '@typescript-eslint/parser';

export default [
  {
    ignores: ['**/node_modules/**', '**/dist/**'],
  },
  {
    files: ['**/*.{ts,mts}'],
    ignores: ['eslint.config.mjs'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.json',
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': typescript,
      import: importPlugin,
      'unused-imports': unusedImports,
    },
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-base-to-string': 'error',
      '@typescript-eslint/no-for-in-array': 'error',
      '@typescript-eslint/no-unused-vars': 'off',
      'no-loop-func': 'off',
      '@typescript-eslint/no-loop-func': 'error',
      'no-throw-literal': 'error',
      '@typescript-eslint/promise-function-async': 'warn',
      'require-await': 'off',
      '@typescript-eslint/require-await': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      'no-return-await': 'off',
      '@typescript-eslint/return-await': ['error', 'always'],
      '@typescript-eslint/no-namespace': ['error', { allowDeclarations: true }],
      'lines-between-class-members': [
        'error',
        'always',
        { exceptAfterSingleLine: true },
      ],
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external'],
          'newlines-between': 'always',
        },
      ],
      'import/no-extraneous-dependencies': [
        'error',
        {
          devDependencies: [
            '**/*.spec.ts',
            '**/*.test.ts',
            '**/tsup.config.ts',
            '**/examples/**/*.ts',
          ],
        },
      ],
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'error',
        {
          vars: 'all',
          varsIgnorePattern: '^_',
          args: 'after-used',
          argsIgnorePattern: '^_',
        },
      ],
      'max-params': ['error', 4],
    },
  },
  {
    files: ['*.js'],
    languageOptions: {
      globals: {
        node: true,
      },
    },
  },
  {
    files: ['examples/**/*.ts'],
    rules: {
      'import/no-extraneous-dependencies': 'off',
    },
  },
  eslintPluginPrettierRecommended,
];
