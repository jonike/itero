module.exports = {
    "env": {
        "browser": true,
        "es6": true,
        "jest": true
    },
    "extends": "eslint:recommended",
    "globals": {
        "Atomics": "readonly",
        "SharedArrayBuffer": "readonly"
    },
    "parserOptions": {
        "ecmaVersion": 2019,
        "sourceType": "module"
    },
    plugins: [
      'svelte3'
    ],
    overrides: [
      {
        files: ['*.svelte'],
        processor: 'svelte3/svelte3'
      }
    ],
    "rules": {
        "no-unused-vars": ["error",
          {"args": "after-used", "argsIgnorePattern": "^_", "varsIgnorePattern": "^_"}]
    }
};
