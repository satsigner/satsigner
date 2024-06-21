module.exports = {
  root: true,
  env: {
    node: true
  },
  extends: ['universe/native'],
  plugins: ['simple-import-sort'],
  rules: {
    'no-console': 'warn',
    'react-hooks/exhaustive-deps': 'warn',
    'simple-import-sort/imports': 'warn',
    'simple-import-sort/exports': 'warn',
    'import/order': 'off',
    '@typescript-eslint/no-unused-vars': [
      'warn',
      {
        caughtErrors: 'all',
        caughtErrorsIgnorePattern: '^_'
      }
    ]
  }
}
