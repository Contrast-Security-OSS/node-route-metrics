'use strict';

module.exports = {
  root: true,
  env: {
    node: true,
    'es2021': true,
    commonjs: true,
    mocha: true
  },

  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'script'
  },

  rules: {
    // Possible Errors
    // http://eslint.org/docs/rules/#possible-errors
    'comma-dangle': ['error', 'only-multiline'],
    'no-control-regex': 'error',
    'no-debugger': 2,
    'no-console': 2,
    'no-dupe-args': 2,
    'no-dupe-keys': 2,
    'no-duplicate-case': 2,
    'no-empty-character-class': 2,
    'no-ex-assign': 2,
    'no-extra-boolean-cast': 2,
    'no-extra-parens': [2, 'functions'],
    'no-extra-semi': 2,
    'no-func-assign': 2,
    'no-invalid-regexp': 2,
    'no-irregular-whitespace': 2,
    'no-negated-in-lhs': 2,
    'no-obj-calls': 2,
    'no-proto': 2,
    'no-unexpected-multiline': 2,
    'no-unreachable': 2,
    'use-isnan': 2,
    'valid-typeof': 2,
    'no-var': 2,
    'object-curly-spacing': [2, 'never'],
    semi: ['warn', 'always', {omitLastInOneLineBlock: true}],
    'linebreak-style': ['error', 'unix'],

    // Best Practices
    // http://eslint.org/docs/rules/#best-practices
    'no-fallthrough': 2,
    'no-octal': 2,
    'no-redeclare': 2,
    'no-self-assign': 2,
    'no-unused-labels': 2,
    'no-useless-catch': 2,

    // Strict Mode
    // http://eslint.org/docs/rules/#strict-mode
    strict: [2, 'global'],

    // Variables
    // http://eslint.org/docs/rules/#variables
    'no-delete-var': 2,
    'no-undef': 2,
    //'no-unused-vars': [2, {args: 'after-used'}],
    // don't complain about unused args
    'no-unused-vars': [2, {args: 'none'}],

    // Node.js and CommonJS
    // http://eslint.org/docs/rules/#nodejs-and-commonjs
    'no-mixed-requires': 2,
    'no-new-require': 2,
    'no-path-concat': 2,
    'no-restricted-modules': [2, 'sys', '_linklist'],

    // Stylistic Issues
    // http://eslint.org/docs/rules/#stylistic-issues
    'comma-spacing': 2,
    'eol-last': 2,
    indent: [2, 2, {SwitchCase: 1}],
    'keyword-spacing': 2,
    'max-len': [2, 130, 2, {
      ignoreComments: true,
      ignoreStrings: true,
      ignoreTemplateLiterals: true,
      ignoreRegExpLiterals: true
    }],
    'new-parens': 2,
    'no-mixed-spaces-and-tabs': 2,
    'no-multiple-empty-lines': [2, {max: 2}],
    'no-trailing-spaces': 2,
    quotes: [2, 'single', {avoidEscape: true}],
    // semi: 2
    'space-before-blocks': [2, 'always'],
    'space-before-function-paren': [2, 'never'],
    // space-in-parens: [2, 'never']
    'space-infix-ops': ['warn', {'int32Hint': true}],
    'space-unary-ops': 2,

    // ECMAScript 6
    // http://eslint.org/docs/rules/#ecmascript-6
    // arrow-parens: [2, 'always']
    'arrow-spacing': [2, {before: true, after: true}],
    'constructor-super': 2,
    'no-class-assign': 2,
    // no-confusing-arrow: [2, {allowParens: true}]
    'no-const-assign': 2,
    'no-dupe-class-members': 2,
    'no-new-symbol': 2,
    'no-this-before-super': 2,
    'prefer-const': 2
  },
  overrides: [
    {
      files: ['**/*.mjs'],
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
  ],
};
