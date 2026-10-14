// https://docs.expo.dev/guides/using-eslint/
// @ts-check
/** @type {typeof import("eslint/config")} */
const { defineConfig } = require('eslint/config');
/** @type {import("eslint").Linter.Config[]} */
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  }
]);
