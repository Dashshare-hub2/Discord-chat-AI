const { GoogleGenAI } = require('@google/genai');
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_KEY });
const { Client, GatewayIntentBits, AttachmentBuilder } = require('discord.js');
const http = require('http');
const PImage = require('pureimage');
const stream = require('stream');

const PORT = process.env.PORT || 10000;
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Bot is active');
});
server.listen(PORT);

const client = new Client({
    intents: [
        GatewayIntentBitsGuilds,
        GatewayIntentBitsGuildMessages,
        GatewayIntentBitsMessageContent
    ]
});

function splitMessage(text, maxLength = 1900) {
    const chunks =;
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

async function drawTableToImage(rawText) {
    const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.startsWith('|') && l.endsWith('|'));
    const tableData = lines.filter(l => !l.includes('---')).map(l => {
        return l.split('|').map(cell => cell.trim()).filter((_, i, arr) => i > 0 && i < arr.length - 1);
    });

    if (tableData.length === 0) return null;

    const colWidths =;
    const cellPadding = 15;
    const lineHeight = 25;
    const tableWidth = colWidths.reduce((a, b) => a + b, 0);
    const rowHeights = tableData.map(() => lineHeight + (cellPadding * 2));
    const tableHeight = rowHeights.reduce((a, b) => a + b, 0);

    const canvas = PImage.make(tableWidth + 40, tableHeight + 40);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;

    let currentY = 20;
    tableData.forEach((row, rIdx) => {
        let currentX = 20;
        row.forEach((cell, cIdx) => {
            ctx.strokeRect(currentX, currentY, colWidths[cIdx], rowHeights[rIdx]);
            ctx.fillStyle = '#000000';
            ctx.fillText(String(cell || ""), currentX + cellPadding, currentY + cellPadding + 15);
            currentX += colWidths[cIdx];
        });
        currentY += rowHeights[rIdx];
    });

    const passThrough = new stream.PassThrough();
    await PImage.encodePNGToStream(canvas, passThrough);
    const buffers =;
    for await (const chunk of passThrough) buffers.push(chunk);
    return Buffer.concat(buffers);
}

async function queryAI(prompt) {
    const response = await ai.models.generateContent({ model: 'gemini-3.6-flash', contents: prompt });
    return response.text;
}

client.on('messageCreate', async (msg) => {
    if (msg.author.bot || !msg.mentions.has(client.user)) return;
    try {
        await msg.channel.sendTyping();
        const prompt = msg.content.replace(/<@!?\d+>/, '').trim();
        const aiText = await queryAI(prompt);

        if (aiText.includes('|')) {
            const img = await drawTableToImage(aiText);
            if (img) {
                return msg.reply({ files: [new AttachmentBuilder(img, { name: 'tablepng' })] });
            }
        }

        const chunks = splitMessage(aiText);
        for (const chunk of chunks) await msg.reply(chunk);
    } catch (e) {
        msg.reply(`Error: ${e.message}`);
    }
});

client.login(process.env.DISCORD_TOKEN);
