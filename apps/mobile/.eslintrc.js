module.exports = {
  root: true,
  env: {
    node: true
  },
  extends: ['universe/native'],
  plugins: ['simple-import-sort'],
  ignorePatterns: ['expo-env.d.ts', 'shim.js'],
  rules: {
    'no-console': 'error',
    'react-hooks/exhaustive-deps': 'error',
    'simple-import-sort/imports': 'error',
    'simple-import-sort/exports': 'error',
    'import/order': 'off',
    '@typescript-eslint/consistent-type-imports': [
      'error',
      {
        fixStyle: 'inline-type-imports'
      }
    ],
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        varsIgnorePattern: '^_',
        caughtErrors: 'all',
        caughtErrorsIgnorePattern: '^_'
      }
    ],
    // Add rule to prefer function declarations over arrow functions for components
    'react/function-component-definition': [
      'error',
      {
        namedComponents: 'function-declaration',
        unnamedComponents: 'arrow-function'
      }
    ]
  }
}
