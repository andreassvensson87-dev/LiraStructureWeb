import globals from 'globals';
export default [
  { ignores: ['dist/**', 'node_modules/**'] },
  {
    files: ['src/**/*.js'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: globals.browser },
    rules: {
      'no-undef': 'error',
      'no-unreachable': 'error',
      'no-dupe-args': 'error',
      'no-dupe-keys': 'error',
    },
  },
  {
    files: ['tests/**/*.js', 'eslint.config.js'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: globals.node },
    rules: { 'no-undef': 'error' },
  },
];
