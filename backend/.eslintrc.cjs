/**
 * Backend ESLint configuration.
 *
 * Wires the @typescript-eslint baseline plus the SmartERP custom rule
 * `no-untenanted-query` (loaded via `--rulesdir eslint-rules` in
 * `package.json` lint script) to enforce doctrine R-D02 (plan §2.1.1).
 */
module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: 'tsconfig.json',
    tsconfigRootDir: __dirname,
    sourceType: 'module',
    ecmaVersion: 2022,
  },
  plugins: ['@typescript-eslint/eslint-plugin'],
  extends: [
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended',
  ],
  root: true,
  env: { node: true, jest: true },
  ignorePatterns: [
    '.eslintrc.cjs',
    'dist/**',
    'node_modules/**',
    'eslint-rules/**',
    'src/migrations/**',
    'test/**',
  ],
  rules: {
    '@typescript-eslint/interface-name-prefix': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': [
      'warn',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    'prettier/prettier': 'off',
    'no-untenanted-query': 'warn',
  },
  overrides: [
    {
      files: ['**/*.spec.ts', '**/seed/**', '**/migrations/**'],
      rules: { 'no-untenanted-query': 'off' },
    },
  ],
};
