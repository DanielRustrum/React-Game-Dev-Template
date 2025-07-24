module.exports = {
  overrides: [
    {
      files: ["src/**/*.ts", "*.tsx"],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-unused-vars': 'off',
        '@typescript-eslint/no-namespace': 'off',
        'react-hooks/exhaustive-deps': 'off'
      }

    }
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: {
      legacyDecorators: true
    },
    project: './tsconfig.json'
  }
}
