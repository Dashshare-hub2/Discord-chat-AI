const { GoogleGenAI } = require('@google/genai');
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_KEY });
const { Client, GatewayIntentBits } = require('discord.js');
const http = require('http');

const PORT = process.env.PORT || 10000;
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Bot Discord AI running on Render! 🚀');
});
server.listen(PORT, () => {
    console.log(`🌐 Web Server running on port ${PORT}`);
});

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;

function splitMessage(text, maxLength = 1900) {
    const chunks = [];
    let currentChunk = "";
    const lines = text.split("\n");

    for (const line of lines) {
        if ((currentChunk + line).length > maxLength) {
            chunks.push(currentChunk.trim());
            currentChunk = "";
        }
        currentChunk += line + "\n";
    }

    if (currentChunk.trim().length > 0) {
        chunks.push(currentChunk.trim());
    }
    return chunks;
}

async function queryPuterAI(prompt) {
    if (!process.env.GEMINI_KEY) {
        throw new Error("Missing auth token (GEMINI_KEY)!");
    }

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3.6-flash',
            contents: prompt,
        });

        let rawText = response.text;

        if (rawText) {
            rawText = rawText.replace(/\$\$([^\$]+)\$\$/g, '```math\n\$1\n```');
            rawText = rawText.replace(/\$([^\$]+)\$/g, '`$1`');

            return rawText;
        }

        return "Error to Connecting to AI";
    } catch (err) {
        throw err;
    }
}


client.once('ready', () => {
    console.log(`🤖 SUCCESS! Bot: ${client.user.username}`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.mentions.has(client.user)) return;

    try {
        await message.channel.sendTyping();

        const mentionRegex = new RegExp(`<@!?${client.user.id}>`);
        const prompt = message.content.replace(mentionRegex, '').trim();

        if (!prompt) {
            return message.channel.send(`<@${message.author.id}> You must tag me before prompt`);
        }

        const aiResponse = await queryPuterAI(prompt);

        const messageChunks = splitMessage(aiResponse);

        for (let i = 0; i < messageChunks.length; i++) {
            if (i === 0) {
                await message.channel.send(`<@${message.author.id}> ${messageChunks[i]}`);
            } else {
                await message.channel.send(messageChunks[i]);
            }
        }

    } catch (error) {
        console.error("Error Message:", error.message);
        await message.channel.send(`<@${message.author.id}> System Error: \`${error.message}\``);
    }
});

client.login(DISCORD_TOKEN);
