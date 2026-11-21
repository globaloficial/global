const { Client, GatewayIntentBits, Partials, ActivityType } = require('discord.js');

const discordClient = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.User],
  allowedMentions: { parse: [], repliedUser: false },
  presence: {
    status: 'online',
    activities: [{ name: 'Globalmente conversando', type: ActivityType.Custom }]
  }
});

module.exports = { discordClient };
