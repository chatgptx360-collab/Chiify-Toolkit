import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypeScript from 'eslint-config-next/typescript'
import prettier from 'eslint-config-prettier'

/**
 * Flat ESLint config.
 *
 * `eslint-config-next` ships native flat configs, so they are composed
 * directly rather than through `FlatCompat` — the compatibility layer chokes
 * on the plugin object graph these configs contain.
 *
 * `eslint-config-prettier` is applied last so formatting rules never fight
 * Prettier: Prettier owns formatting, ESLint owns correctness.
 */
const eslintConfig = [
  {
    ignores: ['.next/**', 'node_modules/**', 'out/**', 'next-env.d.ts'],
  },
  ...nextCoreWebVitals,
  ...nextTypeScript,
  prettier,
  {
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
]

export default eslintConfig
