const { SlashCommandBuilder } = require("@discordjs/builders");
const { ActionRowBuilder, ButtonBuilder, EmbedBuilder } = require("discord.js");

const {
  XPHOLDER_COLOUR,
  XPHOLDER_ICON_URL,
  DEV_SERVER_URL,
  XPHOLDER_LEVEL_UP_COLOUR,
  XPHOLDER_RETIRE_COLOUR,
  XPHOLDER_APPROVE_COLOUR,
} = require("../../config.json");
const {
  getLevelInfo,
  getProgressionBar,
  calculateXp,
  buildXPEmbed,
  setCharacterXP,
  updateCharacterXP,
  getEmbedLevelSettings,
} = require("../../utils");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("request_xp")
    .setDescription("Rewards The Player With XP / CXP!")

    .addIntegerOption((option) =>
      option
        .setName("character")
        .setDescription("Which Character To Request XP For ( 1 -> 10 )")
        .setMinValue(1)
        .setMaxValue(10)
        .setAutocomplete(true)
        .setRequired(true)
    )
    // Only 'Get XP' is used by Enter Ravenloft
    // .addStringOption(option => option
    //     .setName("award_type")
    //     .setDescription("The Field That You Want To Manage Of A User")
    //     .addChoices(
    //         { name: "Set Level", value: "set_level" },
    //         { name: "Set XP", value: "set_xp" },
    //         { name: "Get XP", value: "give_xp" },
    //         { name: "Set CXP", value: "set_cxp" },
    //         { name: "Get CXP", value: "give_cxp" }
    //     )
    //     .setRequired(true))
    .addIntegerOption((option) =>
      option
        .setName("value")
        .setDescription("The XP Value Requested")
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
        --------------
        INITALIZATIONS
        --------------
        */
    const characterId = interaction.options.getInteger("character");
    const awardType = "give_xp";
    const value = interaction.options.getInteger("value");
    let memo = interaction.options.getString("memo");

    const guild = interaction.member.guild;
    const user = interaction.user;
    const player = await guild.members.fetch(user.id);

    let character = await guildService.getCharacter(
      `${player.id}-${characterId}`
    );
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

    // giving useful information
    if (!memo) {
      memo = `Command Requested In <#${interaction.channelId}>`;
    }

    // embed inits

    const title = `${character["name"]}'s XP Request`;
    let { levelField, color } = getEmbedLevelSettings(
      newLevelInfo,
      oldLevelInfo
    );
    const fields = [
      levelField,
      { inline: true, name: "XP Received", value: `${value}` },
      { inline: true, name: "Requested By", value: `${interaction.user}` },
      { inline: false, name: "Progress", value: progressBar },
      { inline: true, name: "Character ID", value: character.character_id },
      { inline: true, name: "Player ID", value: interaction.user.id },
    ];
    const awardEmbed = buildXPEmbed(title, character, fields, color, memo);

    /*
        ---------------
        POSTING REQUEST
        ---------------
        */
    if (guildService.config["allowPlayerManageXp"] == "on") {
      await awardChannel.send({
        content: `${player} <@&${guildService.config["moderationRoleId"]}>`,
        embeds: [awardEmbed],
      });
      await setCharacterXP(player, character, guildService);
    } else {
      const requestButtons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("request_approve")
          .setLabel("Approve")
          .setStyle("Success"),
        new ButtonBuilder()
          .setCustomId("request_reject")
          .setLabel("Reject")
          .setStyle("Danger")
      );

      await awardChannel.send({
        embeds: [awardEmbed],
        components: [requestButtons],
      });
    }

    await interaction.editReply(
      "Your XP request has been received - you will receive a DM when it is approved."
    );
  },
  async autocomplete(guildService, interaction) {
    const focusedValue = interaction.options.getFocused();

    const characters = await guildService.getAllCharacters(interaction.user.id);
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
  async handleRequestXpCommandButton(guildService, interaction) {
    if (!interaction.isButton()) {
      return;
    }

    if (
      ["request_approve", "request_reject"].includes(interaction.customId) &&
      (interaction.member._roles.includes(
        guildService.config["moderationRoleId"]
      ) ||
        interaction.member.id == interaction.member.guild.ownerId)
    ) {
      // The Approve / Reject buttons for request_xp submissions
      try {
        const originalEmbed = interaction.message.embeds[0];

        const characterId = originalEmbed.fields.filter(
          (field) => field.name === "Character ID"
        )[0].value;
        const character = { character_id: characterId };
        const deltaXp = parseInt(
          originalEmbed.fields.filter(
            (field) => field.name === "XP Received"
          )[0].value
        );
        const playerId = originalEmbed.fields.filter(
          (field) => field.name === "Player ID"
        )[0].value;
        const player = await interaction.guild.members.fetch(playerId);
        const updatedEmbed = EmbedBuilder.from(originalEmbed);

        switch (interaction.customId) {
          case "request_approve":
            updatedEmbed.addFields({
              inline: false,
              name: "Approved By",
              value: `${interaction.user}`,
            });
            updatedEmbed.setColor(XPHOLDER_APPROVE_COLOUR);
            await updateCharacterXP(player, character, deltaXp, guildService);
            break;
          case "request_reject":
            updatedEmbed.addFields({
              inline: false,
              name: "Rejected By",
              value: `${interaction.user}`,
            });
            updatedEmbed.setColor(XPHOLDER_RETIRE_COLOUR);
            break;
        }

        await interaction.update({ embeds: [updatedEmbed], components: [] });
        try {
          await player.send({ embeds: [updatedEmbed] });
        } catch (error) {
          // This can happen if the user has DMs disabled - send() will throw a Forbidden exception.
          console.log(error);
        }
        return;
      } catch (error) {
        console.log(error);
      }
    }
  },
};
