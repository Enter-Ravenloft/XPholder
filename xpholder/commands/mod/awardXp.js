const { SlashCommandBuilder } = require("@discordjs/builders");
const { ActionRowBuilder, ButtonBuilder, EmbedBuilder } = require("discord.js");

const {
  XPHOLDER_COLOUR,
  XPHOLDER_ICON_URL,
  DEV_SERVER_URL,
  XPHOLDER_LEVEL_UP_COLOUR,
  XPHOLDER_RETIRE_COLOUR,
} = require("../../config.json");
const {
  getLevelInfo,
  getProgressionBar,
  calculateXp,
  setCharacterXP,
  getEmbedLevelSettings,
  buildXPEmbed,
  logAwardXP,
  logUndoAwardXP,
} = require("../../utils");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("award_xp")
    .setDescription("Rewards The Player With XP! [ MOD ]")

    .addUserOption((option) =>
      option
        .setName("player")
        .setDescription("The Player You Wish To Edit")
        .setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName("character")
        .setDescription("Which Character To Award XP To ( 1 -> 10 )")
        .setMinValue(1)
        .setMaxValue(10)
        .setAutocomplete(true)
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("award_type")
        .setDescription("The Field That You Want To Manage Of A User")
        .addChoices(
          { name: "Set Level", value: "set_level" },
          { name: "Set XP", value: "set_xp" },
          { name: "Give XP", value: "give_xp" },
          // { name: "Set CXP", value: "set_cxp" },
          // { name: "Give CXP", value: "give_cxp" }
        )
        .setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName("value")
        .setDescription("The Value For What Is Being Managed")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("memo")
        .setDescription("A Small Note On Why The Reward")
        .setRequired(false)
    )

    .addBooleanOption((option) =>
      option
        .setName("public")
        .setDescription("Show This Command To Everyone?")
        .setRequired(false)
    ),
  async execute(guildService, interaction) {
    /*
        ----------
        VALIDATION
        ----------
        */

    if (
      !guildService.isMod(interaction.member._roles) &&
      interaction.user.id != interaction.guild.ownerId &&
      !guildService.isDev(interaction.member._roles)
    ) {
      await interaction.editReply(
        "Sorry, you do not have the right role to use this command."
      );
      return;
    }

    /*
        --------------
        INITALIZATIONS
        --------------
        */
    const player = interaction.options.getUser("player");
    const characterId = interaction.options.getInteger("character");
    const awardType = interaction.options.getString("award_type");
    const value = interaction.options.getInteger("value");
    const memo = interaction.options.getString("memo");

    const guild = interaction.member.guild;
    let character = await guildService.getCharacter(
      `${player.id}-${characterId}`
    );
    const member = await guild.members.fetch(player.id);
    let awardChannel;
    /*
        -------------
        VALIDATION X2
        -------------
        */
    try {
      awardChannel = await guild.channels.fetch(
        guildService.config["levelUpChannelId"]
      );
    } catch (error) {
      const owner = await guild.members.fetch(guild.ownerId);
      await interaction.editReply(
        `Sorry, but I can't find the **level_up_channel**.\nPlease contact ${owner} and ask them to set a new **level_up_channel** with : \`/edit_config\``
      );
      return;
    }

    if (!character) {
      await interaction.editReply("Sorry, but that character does not exist");
      return;
    }

    // some more inits
    const oldXp = character["xp"];
    const oldLevelInfo = getLevelInfo(guildService.levels, oldXp);

    character["xp"] = calculateXp(
      awardType,
      character,
      guildService.levels,
      value
    );
    const fullPlayerObj = await guild.members.fetch(player.id);
    await setCharacterXP(fullPlayerObj, character, guildService);
    await logAwardXP(interaction.member, member, character["name"], oldXp, character["xp"]);

    /*
        -------------
        AWARD XP POST
        -------------
        */
    // useful inits
    const newXp = character["xp"];
    const newLevelInfo = getLevelInfo(guildService.levels, newXp);
    const progressBar = getProgressionBar(
      newLevelInfo["levelXp"],
      newLevelInfo["xpToNext"]
    );

    let { levelField, color } = getEmbedLevelSettings(
      newLevelInfo,
      oldLevelInfo
    );
    let title = "",
      fields = [];
    switch (awardType) {
      case "set_level":
        title = `${character["name"]}'s Level Was Set`;
        fields = [
          {
            inline: true,
            name: "Delta",
            value: `${Math.floor(oldXp)} -> **${Math.floor(newXp)}**`,
          },
          { inline: true, name: "Level", value: newLevelInfo["level"] },
          { inline: true, name: "Set By", value: `${interaction.user}` },
        ];
        break;
      case "set_xp":
        title = `${character["name"]}'s XP Was Set`;
        fields = [
          {
            inline: true,
            name: "Delta",
            value: `${Math.floor(oldXp)} -> **${Math.floor(newXp)}**`,
          },
          { inline: true, name: "Level", value: newLevelInfo["level"] },
          { inline: true, name: "Total XP", value: `${value}` },
          { inline: true, name: "Set By", value: `${interaction.user}` },
          { inline: false, name: "Progress", value: progressBar },
        ];
        break;
      case "give_xp":
        title = `${character["name"]} Was Awarded XP`;
        fields = [
          {
            inline: true,
            name: "Delta",
            value: `${Math.floor(oldXp)} -> **${Math.floor(newXp)}**`,
          },
          levelField,
          { inline: true, name: "XP Received", value: `${value}` },
          { inline: true, name: "Set By", value: `${interaction.user}` },
          { inline: false, name: "Progress", value: progressBar },
        ];
        break;
      // case "set_cxp":
      //   title = `${character["name"]}'s CXP Was Set`;
      //   fielfs = [
      //     {
      //       inline: true,
      //       name: "Delta",
      //       value: `${Math.floor(oldXp)} -> **${Math.floor(newXp)}**`,
      //     },
      //     { inline: true, name: "Level", value: newLevelInfo["level"] },
      //     { inline: true, name: "Total CXP", value: `${value}` },
      //     { inline: true, name: "Set By", value: `${interaction.user}` },
      //     { inline: false, name: "Progress", value: progressBar },
      //   ];
      //   break;
      // case "give_cxp":
      //   title = `${character["name"]}'s Was Awarded CXP`;
      //   fielfs = [
      //     {
      //       inline: true,
      //       name: "Delta",
      //       value: `${Math.floor(oldXp)} -> **${Math.floor(newXp)}**`,
      //     },
      //     levelField,
      //     { inline: true, name: "CXP Received", value: `${value}` },
      //     { inline: true, name: "Set By", value: `${interaction.user}` },
      //     { inline: false, name: "Progress", value: progressBar },
      //   ];
      //   break;
    }
    const awardEmbed = buildXPEmbed(title, character, fields, color, memo);
    /*
        ----------------
        BUILDING BUTTONS
        ----------------
        */
    const awardButtons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("awardxp_undo")
        .setLabel("Undo")
        .setStyle("Danger")
    );

    // Recording the action in #xp-holder-ledger
    const awardMessage = await awardChannel.send({
      content: `${player}`,
      embeds: [awardEmbed],
      components: [awardButtons],
    });

    // Notifying the user that they've been awarded XP
    try {
      await player.send({ embeds: [awardEmbed] });
      await interaction.editReply("Success!");
    } catch (error) {
      console.log(error);
      await interaction.editReply(
        "XP awarded, but user could not be notified via DM."
      );
    } finally {
      createButtonEvents(
        guildService,
        interaction,
        fullPlayerObj,
        awardMessage,
        character,
        oldXp
      );
    }

    await interaction.editReply("Success!");
  },
  async autocomplete(guildService, interaction) {
    const focusedValue = interaction.options.getFocused();

    if (!interaction.options.get("player")) {
      return;
    }

    const targetUserId = interaction.options.get("player").value;
    const characters = await guildService.getAllCharacters(targetUserId);
    const choices = [];
    characters.forEach((character) =>
      choices.push([character.name, character.character_index])
    );

    const filtered = choices.filter((choice) =>
      choice[0].toLowerCase().startsWith(focusedValue.toLowerCase())
    );
    await interaction.respond(
      filtered.map((choice) => ({ name: choice[0], value: choice[1] }))
    );
  },
};

// FIXME 2025-02-22: The Undo button is not currently working. Getting 'This interaction failed' from Discord, but no apps logs/exceptions.
function createButtonEvents(
  guildService,
  interaction,
  player,
  replyMessage,
  character,
  oldXp
) {
  /*
    -------------
    INITALIZATION
    -------------
    */
  const updatingCharacter = { ...character, xp: oldXp };
  let undoAwardEmbed = new EmbedBuilder()
    .setDescription("XP Reward Undone")
    .setFooter({
      text: `Like the bot? Click the title to visit the dev server!`,
    })
    .setThumbnail(
      character["picture_url"] != "" && character["picture_url"] !== "null"
        ? character["picture_url"]
        : XPHOLDER_ICON_URL
    )
    .setURL(DEV_SERVER_URL)
    .setColor(XPHOLDER_RETIRE_COLOUR);
  undoAwardEmbed.setFields(
    { inline: true, name: "XP", value: `${Math.floor(oldXp)}` },
    { inline: true, name: "Undone By", value: `${interaction.user}` }
  );
  /*
    ------------------
    CREATING COLLECTOR
    ------------------
    */
  const filter = (btnInteraction) =>
    ["awardxp_undo"].includes(btnInteraction.customId) &&
    replyMessage.id == btnInteraction.message.id &&
    interaction.user.id == btnInteraction.user.id;
  const collectorChannel = interaction.channel;
  if (!collectorChannel) {
    return;
  }
  const collector = collectorChannel.createMessageComponentCollector({
    filter,
    time: 3_600_000,
  });

  collector.on("collect", async (btnInteraction) => {
    try {
      switch (btnInteraction.customId) {
        case "awardxp_undo":
          await setCharacterXP(player, updatingCharacter, guildService);
          await logUndoAwardXP(btnInteraction.user, player, character["name"], character["xp"], oldXp);

          await btnInteraction.update({
            embeds: [undoAwardEmbed],
            components: [],
          });
          break;
      }
    } catch (error) {
      console.log(error);
    }
  });
}
