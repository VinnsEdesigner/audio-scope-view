import { packageConfig } from './packages/eslint/src/package.js';
import react from './packages/eslint/src/react.js';
import globals from 'globals';

export default [
  ...packageConfig,
  ...react,
  {
    ignores: ['dist', '.output', '.vinxi', 'node_modules', '.turbo', '*.min.js'],
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
  },
  {
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'server-only',
              message:
                'TanStack Start does not use the Next.js `server-only` package. Rename the module to `*.server.ts` or mark it with `@tanstack/react-start/server-only`.',
            },
          ],
        },
      ],
    },
  },
];
