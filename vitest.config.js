const { defineConfig, configDefaults } = require("vitest/config");

module.exports = defineConfig({
  test: {
    exclude: [...configDefaults.exclude, "**/*.integration.test.js"],
  },
});
