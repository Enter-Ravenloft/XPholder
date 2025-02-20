const dotenv = require("dotenv");
const fs = require("fs");

/*
-----------------------
LOADING ENV VARS (.env)
-----------------------
*/

dotenv.config();

const {
  Client,
  Collection,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  InteractionType,
  ChannelType,
} = require("discord.js");
const { db } = require("./xpholder/database/postgres.js");

const { guildService } = require("./xpholder/services/guild");

const {
  getActiveCharacterNumber,
  getXp,
  getRoleMultiplier,
  getLevelInfo,
  getTier,
  logCommand,
  logError,
  logRPXP,
} = require("./xpholder/utils");
const {
  XPHOLDER_COLOUR,
  XPHOLDER_ICON_URL,
  XPHOLDER_RETIRE_COLOUR,
  XPHOLDER_APPROVE_COLOUR,
} = require("./xpholder/config.json");

const { handleXpCommandButton } = require("./xpholder/commands/everyone/xp.js");
const {
  handleRequestXpCommandButton,
} = require("./xpholder/commands/everyone/requestXp.js");

/*
---------------------------
LOADING DISCORD PERMISSIONS
---------------------------
*/

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel],
});
client.commands = new Collection();

/*
----------------
LOADING COMMANDS
----------------
*/

const commandsPath = ["everyone", "mod", "owner"];
for (const path of commandsPath) {
  const commandCollection = fs
    .readdirSync(`./xpholder/commands/${path}`)
    .filter((file) => file.endsWith(".js"));
  for (const file of commandCollection) {
    const command = require(`./xpholder/commands/${path}/${file}`);
    client.commands.set(command.data.name, command);
  }
}

/*
------------
BOT COMMANDS
------------
*/

client.once("ready", () => {
  //clearGuildCache();
  console.log("ready");
  // console.log(client.commands);
});

client.on("interactionCreate", async (interaction) => {
  /*
    -------------------------------------
    VALIDATIONS FOR INTERACTION EXECUTION
    -------------------------------------
    */

  if (!interaction.inGuild()) {
    return;
  }

  if (
    !interaction.isCommand() &&
    !interaction.isAutocomplete() &&
    !interaction.isButton()
  ) {
    return;
  }
  const command = client.commands.get(interaction.commandName);
  const guildId = `${interaction.guildId}`;

  // LOADING GUILD SERVICE
  const gService = new guildService(db, guildId);
  await gService.init();
  if (!(await gService.isRegistered()) && command.data.name != "register") {
    // Try Catch on the reply, because this is a restful call, and errors can be found
    try {
      await interaction.reply({
        content: `Sorry, but your server is not registered, please contact <@${interaction.guild.ownerId}> and ask them todo \`/register\`.`,
        ephemeral: true,
      });
    } catch (error) {
      // ignore
    }
    return;
  }

  /*
    -----------------
    EXECUTING COMMAND
    -----------------
    */

  if (interaction.isCommand()) {
    try {
      logCommand(interaction);
    } catch (error) {
      console.log(error);
    }
    try {
      let is_public = !interaction.options.getBoolean("public");
      await interaction.deferReply({ ephemeral: is_public });
      await command.execute(gService, interaction);
    } catch (error) {
      try {
        logError(interaction, error);
      } catch (error) {
        console.log(error);
      }
      console.log(error);
    }
  }

  /*
    ---------------------
    HANDLING AUTOCOMPLETE
    ---------------------
    */

  if (interaction.isAutocomplete()) {
    try {
      //   console.log(
      //     command.autocomplete,
      //     interaction.client.commands.get(interaction.commandName)
      //   );
      console.log;
      await command.autocomplete(gService, interaction);
    } catch (error) {
      console.error(error);
    }
  }

  /*
    ---------------------
    RESPONDING TO BUTTONS
    ---------------------
    */

  if (interaction.isButton()) {
    if (["request_approve", "request_reject"].includes(interaction.customId)) {
      handleRequestXpCommandButton(gService, interaction);
    } else if (
      ["xp_previous", "xp_next", "xp_set", "xp_freeze", "xp_retire"].includes(
        interaction.customId
      )
    ) {
      handleXpCommandButton(gService, interaction);
    }
  }
});

/*
-----------
XP PER POST
-----------
*/

client.on("messageCreate", async (message) => {
  try {
    /*
        ----------
        VALIDATION
        ----------
        */

    if (!message.inGuild()) {
      return;
    }
    if (message.author.bot) {
      return;
    }
    if (
      message.content.split(/\s+/).length <= 10 &&
      !message.content.startsWith("!")
    ) {
      return;
    }

    /*
        --------------------------------
        LOADING GUILD INTO CACHED GUILDS
        --------------------------------
        */

    const guildId = `${message.guildId}`;

    const gService = new guildService(db, guildId);
    await gService.init();
    if (!(await gService.isRegistered())) {
      return;
    }

    /*
        --------------
        INITALIZATIONS
        --------------
        */

    const wordCount = message.content.split(/\s+/).length;
    const guild = await client.guilds.fetch(guildId);
    const player = await guild.members.fetch(message.author.id);

    const roleBonus = getRoleMultiplier(
      gService.config["roleBonus"],
      gService.roles,
      player._roles
    );

    const characterNumber = getActiveCharacterNumber(
      gService.config,
      player._roles
    );
    const character = await gService.getCharacter(
      `${player.id}-${characterNumber}`
    );
    if (!character) {
      return;
    }

    let channel = await guild.channels.fetch(message.channelId);

    while (channel) {
      if (channel.id in gService.channels) {
        break;
      }
      channel = await guild.channels.fetch(channel.parentId);
    }
    if (!channel) {
      return;
    }

    if (gService.channels[channel.id] == 0) {
      return;
    }

    const xp = getXp(
      wordCount,
      roleBonus,
      gService.channels[channel.id],
      gService.config["xpPerPostDivisor"],
      gService.config["xpPerPostFormula"]
    );

    if (player._roles.includes(gService.config["xpShareRoleId"])) {
      const playerCharacters = await gService.getAllCharacters(player.id);
      for (let subCharacter of playerCharacters) {
        await updateCharacterXpAndMessage(
          guild,
          gService,
          subCharacter,
          xp / playerCharacters.length,
          player
        );
        logRPXP(player, subCharacter["name"], xp / playerCharacters.length, message);
      }
    } else {
      await updateCharacterXpAndMessage(guild, gService, character, xp, player);
      logRPXP(player, character["name"], xp, message);
    }
  } catch (error) {
    console.log(error);
  }
});

async function updateCharacterXpAndMessage(
  guild,
  gService,
  character,
  xp,
  player
) {
  try {
    await gService.updateCharacterXP(character, xp);

    const oldLevelInfo = getLevelInfo(gService.levels, character["xp"]);
    const newLevelInfo = getLevelInfo(gService.levels, character["xp"] + xp);

    if (oldLevelInfo["level"] != newLevelInfo["level"]) {
      const newTier = getTier(newLevelInfo["level"]);

      const tierRoles = [];
      for (let tierIndex = 1; tierIndex <= 4; tierIndex++) {
        if (tierIndex == newTier["tier"]) {
          continue;
        }
        tierRoles.push(
          await guild.roles.fetch(gService.config[`tier${tierIndex}RoleId`])
        );
      }

      const newTierRole = await guild.roles.fetch(
        gService.config[`tier${newTier["tier"]}RoleId`]
      );

      try {
        const updatedPlayer = await player.roles.remove(tierRoles);
        await updatedPlayer.roles.add(newTierRole);
      } catch (error) {
        console.log(error);
      }

      let awardChannel;
      try {
        awardChannel = await guild.channels.fetch(
          gService.config["levelUpChannelId"]
        );
      } catch (error) {
        return;
      }

      let levelUpEmbed = new EmbedBuilder()
        .setTitle(`${character["name"]} Leveled Up`)
        .setFields(
          {
            name: "Level Up!",
            value: `${oldLevelInfo["level"]} --> **${newLevelInfo["level"]}**`,
            inline: true,
          },
          {
            name: "Total Character XP",
            value: `${Math.floor(character["xp"] + xp)}`,
            inline: true,
          },
          {
            name: "Tier",
            value: `<@&${gService.config[`tier${newTier["tier"]}RoleId`]}>`,
            inline: true,
          }
        )
        .setThumbnail(
          character["picture_url"] != "" && character["picture_url"] !== "null"
            ? character["picture_url"]
            : XPHOLDER_ICON_URL
        )
        .setColor(XPHOLDER_COLOUR)
        .setFooter({ text: "You can view your characters with /xp" });

      if (character["sheet_url"] != "") {
        levelUpEmbed.setURL(character["sheet_url"]);
      }

      awardChannel.send({ content: `${player}`, embeds: [levelUpEmbed] });
    }
  } catch (error) {
    console.log(error);
  }
}

/*
---------------------
LOGGING THE BOT ONLINE
---------------------
*/

client.login(process.env.DISCORD_TOKEN);
