const { GoogleGenAI } = require('@google/genai');
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_KEY });
const { Client, GatewayIntentBits, ActivityType } = require('discord.js');
const http = require('http');

const PORT = process.env.PORT || 10000;

const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Discord AI Bot is running on Render! 🚀');
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on port ${PORT}`);
});

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

let overloadTimer = null;
let currentCountdown = 0;

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
    if (currentChunk.trim().length > 0) chunks.push(currentChunk.trim());
    return chunks;
}

function cleanResponseText(text) {
    if (!text) return "";
    return text.replace(/\$/g, '`');
}

function handleRateLimit(error) {
    let retrySeconds = 60; 

    if (error.status === 429 || (error.message && error.message.includes('429'))) {
        const match = error.message && error.message.match(/retry(?:after|delay)?[:\s]+(\d+)/i);
        if (match && match[1]) {
            retrySeconds = parseInt(match[1], 10);
        }
    }

    startOverloadCountdown(retrySeconds);
}

function startOverloadCountdown(seconds) {
    if (overloadTimer) clearInterval(overloadTimer);
    currentCountdown = seconds;

    const updateStatus = () => {
        if (currentCountdown > 0) {
            client.user.setActivity(`overload, retry after ${currentCountdown}s`, { type: ActivityType.Custom });
            currentCountdown--;
        } else {
            clearInterval(overloadTimer);
            overloadTimer = null;
            client.user.setPresence({ activities: [], status: 'online' });
            console.log('Overload period ended. Bot presence reset.');
        }
    };

    updateStatus();
    overloadTimer = setInterval(updateStatus, 1000);
}

async function queryAI(prompt) {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3.6-flash',
            contents: prompt,
            config: {
                systemInstruction: "Do not use LaTeX or dollar signs ($) for formatting math formulas. Use backticks (`) for inline code/math formulas instead."
            }
        });
        
        const rawText = response.text || "No response generated.";
        return cleanResponseText(rawText);
    } catch (err) {
        console.error("Gemini API Error:", err);
        
        if (err.status === 429 || (err.message && (err.message.includes('429') || err.message.includes('RESOURCE_EXHAUSTED')))) {
            handleRateLimit(err);
        }
        
        throw new Error(`Gemini Request Failed: ${err.message}`);
    }
}

client.on('messageCreate', async (msg) => {
    if (msg.author.bot || !msg.mentions.has(client.user)) return;

    console.log(`Received command from ${msg.author.tag}: ${msg.content}`);
    try {
        await msg.channel.sendTyping();
        const prompt = msg.content.replace(/<@!?\d+>/, '').trim();

        console.log(`Querying Gemini API...`);
        const aires = await queryAI(prompt);
        console.log(`Gemini response received successfully.`);

        console.log(`Sending response...`);
        const chunks = splitMessage(aires);
        for (const chunk of chunks) {
            await msg.reply(chunk);
        }
    } catch (e) {
        console.error(`Error processing message:`, e);
        msg.reply(`Error: ${e.message}`);
    }
});

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

client.login(process.env.DISCORD_TOKEN); 
