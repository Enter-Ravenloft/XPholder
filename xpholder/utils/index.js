const awards = require("./awards");
const mappings = require("./mapping");
const getters = require("./getters");
const characterEmbed = require("./characterEmbed");
const logging = require("./logging");

/*
--------
SECURITY
--------
*/

function sqlInjectionCheck(myString) {
  return (
    myString.includes("`") ||
    myString.includes("'") ||
    myString.includes('"') ||
    myString.includes(";") ||
    myString.includes(",") ||
    myString.toLowerCase().includes("drop") ||
    myString.toLowerCase().includes("delete") ||
    myString.toLowerCase().includes("remove") ||
    myString.toLowerCase().includes("update") ||
    myString.toLowerCase().includes("create") ||
    myString.toLowerCase().includes("insert")
  );
}

module.exports = {
  ...awards,
  ...characterEmbed,
  ...getters,
  ...logging,
  ...mappings,
  sqlInjectionCheck,
};
