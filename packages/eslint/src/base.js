import js from '@eslint/js';
import pluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import unicorn from 'eslint-plugin-unicorn';

export const base = [
  js.configs.recommended,
  pluginPrettierRecommended,
  {
    plugins: {
      unicorn,
    },
    rules: {
      ...unicorn.configs.recommended.rules,
    },
  },
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      '.output/**',
      '.turbo/**',
      '*.min.js',
    ],
  },
];

export default base;
