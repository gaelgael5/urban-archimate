import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default [
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'vendor/**',
      'coverage/**',
      'python/**'
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: [ 'src/**/*.ts' ]
  })),
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser
      }
    },
    rules: {
      // the imported archimate-js code base predates this configuration;
      // keep the signal useful without rewriting every legacy file
      'no-unused-vars': [ 'warn', { args: 'none', caughtErrors: 'none' } ]
    }
  },
  {
    // legacy code imported from archimate-js: tolerate stylistic noise,
    // keep real errors (no-undef, ...) blocking
    files: [ 'lib/**' ],
    rules: {
      'no-useless-assignment': 'warn'
    }
  },
  {
    files: [ 'test/**', 'vite.config.js', 'vitest.config.js', 'eslint.config.js', 'scripts/**' ],
    languageOptions: {
      globals: {
        ...globals.node
      }
    }
  }
];
