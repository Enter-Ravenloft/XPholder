const awards = require("./xp");
const mappings = require("./mapping");
const getters = require("./getters");
const characterEmbed = require("./characterEmbed");
const logging = require("./logging");
const roleManagement = require("./roleManagement");
const characterManagement = require("./characterManagement");

module.exports = {
  ...awards,
  ...characterEmbed,
  ...characterManagement,
  ...getters,
  ...logging,
  ...mappings,
  ...roleManagement,
};
