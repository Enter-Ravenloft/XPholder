const { defineConfig } = require("vitest/config");

module.exports = defineConfig({
  test: {
    include: ["**/*.integration.test.js"],
    globalSetup: ["./tests/integration/globalSetup.js"],
    fileParallelism: false,
    testTimeout: 15000,
  },
});
