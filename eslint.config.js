export default [
  {
    root: true,
    ignores: ['dist/**/*', 'node_modules/**/*'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    env: {
      worker: true,
      browser: false,
      node: false,
    },
    extends: [
      'eslint:recommended',
      'plugin:@typescript-eslint/recommended',
      'prettier',
    ],
    plugins: ['@typescript-eslint'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      'no-console': 'off', // We use console.log/error for logging in workers
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },
];