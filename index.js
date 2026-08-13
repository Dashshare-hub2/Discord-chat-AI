const { GoogleGenAI } = require('@google/genai');

const ai = new GoogleGenAI({ apikey: process.env.GEMINI_KEY });
const { Client, GatewayIntentBits } = require('discord.js');
const http = require('http');

const PORT = process.env.PORT || 10000;
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Bot Discord AI runningg on Render! 🚀');
});
server.listen(PORT, () => {
    console.log(`🌐 Bot is ready ${PORT}`);
});

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;


async function queryPuterAI(prompt) {
    if (!PUTER_AUTH_TOKEN) {
        throw new Error("Missing auth token!");
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    try {
        const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
  });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`AI API Error: ${response.status} - ${errorText}`);
        }
        
 
        if (response.text) {
            return response.text
            }
        
        return "Don't get the text from AI.";
    } catch (err) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
            throw new Error("AI Timeout.");
        }
        throw err;
    }
}

client.once('ready', () => {
    console.log(`🤖 SUCCESS! Bot Online with name: ${client.user.username}`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.mentions.has(client.user)) return;

    try {
        await message.channel.sendTyping();

        const mentionRegex = new RegExp(`<@!?${client.user.id}>`);
        const prompt = message.content.replace(mentionRegex, '').trim();

        if (!prompt) {
            return message.channel.send(`<@${message.author.id}> You must tag me after question!`);
        }

        const aiResponse = await queryPuterAI(prompt);
        await message.channel.send(`<@${message.author.id}> ${aiResponse}`);

    } catch (error) {
        console.error("Lỗi xử lý tin nhắn:", error.message);
        await message.channel.send(`<@${message.author.id}> Error: \`${error.message}\``);
    }
});

client.login(DISCORD_TOKEN);
