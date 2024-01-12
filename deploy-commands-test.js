const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const fs = require('fs');

const dotenv = require('dotenv');
dotenv.config();

// XPHolder TEST bot user ID
const CLIENT_ID = "1187964800114901093";
// Enter Ravenloft TEST server ID
const TESTING_SERVER_ID = "1068243670391857192";

const commands = [];
let commandsPath = [
    "everyone",
    "owner",
	"mod"
];
let commandCollection = [];

for (const path  of commandsPath) {
    commandCollection = fs.readdirSync(`./xpholder/commands/${path}`).filter(file => file.endsWith('.js'));
    for(const file of commandCollection){
        const command = require(`./xpholder/commands/${path}/${file}`);
        console.log(command);
        commands.push(command.data.toJSON());
    }
}

const rest = new REST({ version: '9' }).setToken(process.env.DISCORD_TOKEN_TEST);

(async () => {
	try {
		console.log('Started refreshing application (/) commands.');

		await rest.put(
			Routes.applicationGuildCommands(CLIENT_ID, TESTING_SERVER_ID),
			{ body: commands },
		);

		console.log('Successfully reloaded application (/) commands.');
	} catch (error) {
		console.log(error);
	}
})();
