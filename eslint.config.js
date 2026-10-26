// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'supabase/**', '.agents/**'],
  },
  {
    files: ['src/theme/use-color-scheme.web.ts'],
    rules: {
      // Expo template hydration gate; safe on web before reading color scheme.
      'react-hooks/set-state-in-effect': 'off',
    },
  },
]);

