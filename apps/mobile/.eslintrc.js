module.exports = {
  root: true,
  env: {
    node: true
  },
  extends: ['universe/native'],
  plugins: ['simple-import-sort'],
  rules: {
    'no-console': 'error',
    'react-hooks/exhaustive-deps': 'error',
    'simple-import-sort/imports': 'error',
    'simple-import-sort/exports': 'error',
    'import/order': 'off',
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        caughtErrors: 'all',
        caughtErrorsIgnorePattern: '^_'
      }
    ]
  }
}
