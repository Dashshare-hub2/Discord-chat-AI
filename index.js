const { GoogleGenAI } = require('@google/genai');
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_KEY });
const { Client, GatewayIntentBits, AttachmentBuilder } = require('discord.js');
const http = require('http');
const PImage = require('pureimage');
const stream = require('stream');
const fs = require('fs');
const path = require('path');
const https = require('https');

const PORT = process.env.PORT || 10000;
const FONT_PATH = path.join(__dirname, 'Roboto-Regular.ttf');
const FONT_URL = 'https://github.com/google/fonts/raw/main/ofl/roboto/Roboto-Regular.ttf';

const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Discord AI Bot is running on Render! 🚀');
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is listening on port ${PORT}`);
});

function downloadFont(url, dest) {
    return new Promise((resolve, reject) => {
        if (fs.existsSync(dest)) return resolve();
        console.log('Downloading font for PureImage...');
        const file = fs.createWriteStream(dest);
        https.get(url, (response) => {
            if (response.statusCode === 302 || response.statusCode === 301) {
                return downloadFont(response.headers.location, dest).then(resolve).catch(reject);
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close(() => {
                    console.log('Font downloaded successfully.');
                    resolve();
                });
            });
        }).on('error', (err) => {
            fs.unlink(dest, () => {});
            reject(err);
        });
    });
}

let isFontLoaded = false;
async function initFont() {
    try {
        await downloadFont(FONT_URL, FONT_PATH);
        const font = PImage.registerFont(FONT_PATH, 'CustomFont');
        font.loadSync();
        isFontLoaded = true;
        console.log('Font loaded into PureImage.');
    } catch (err) {
        console.error('Failed to initialize font:', err.message);
    }
}
initFont();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

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

async function drawTableToImage(rawText) {
    const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.startsWith('|') && l.endsWith('|'));
    const tableData = lines.filter(l => !l.includes('---')).map(l => {
        return l.split('|').map(cell => cell.trim()).filter((_, i, arr) => i > 0 && i < arr.length - 1);
    });

    if (tableData.length === 0) return null;

    const maxCols = Math.max(...tableData.map(row => row.length));
    const colWidths = Array(maxCols).fill(120);
    
    tableData.forEach(row => {
        row.forEach((cell, i) => {
            const calculatedWidth = (cell.length * 9) + 30;
            if (calculatedWidth > colWidths[i]) {
                colWidths[i] = Math.min(calculatedWidth, 400);
            }
        });
    });

    const cellPadding = 12;
    const lineHeight = 24;
    const tableWidth = colWidths.reduce((a, b) => a + b, 0);
    const tableHeight = tableData.length * (lineHeight + cellPadding * 2);

    const canvas = PImage.make(tableWidth + 40, tableHeight + 40);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (isFontLoaded) {
        ctx.setFont('CustomFont', 14);
    }

    let currentY = 20;
    tableData.forEach((row, rowIndex) => {
        let currentX = 20;

        if (rowIndex === 0) {
            ctx.fillStyle = '#EAEAEA';
            ctx.fillRect(20, currentY, tableWidth, lineHeight + cellPadding * 2);
        }

        row.forEach((cell, cIdx) => {
            const colWidth = colWidths[cIdx] || 120;

            ctx.strokeStyle = '#CCCCCC';
            ctx.lineWidth = 1;
            ctx.strokeRect(currentX, currentY, colWidth, lineHeight + cellPadding * 2);

            ctx.fillStyle = '#000000';
            ctx.fillText(String(cell || ""), currentX + cellPadding, currentY + cellPadding + 16);

            currentX += colWidth;
        });
        currentY += lineHeight + cellPadding * 2;
    });

    const passThrough = new stream.PassThrough();
    await PImage.encodePNGToStream(canvas, passThrough);
    const buffers = [];
    for await (const chunk of passThrough) buffers.push(chunk);
    return Buffer.concat(buffers);
}

async function queryAI(prompt) {
    const response = await ai.models.generateContent({ 
        model: 'gemini-2.5-flash', 
        contents: prompt 
    });
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
                return msg.reply({ files: [new AttachmentBuilder(img, { name: 'table.png' })] });
            }
        }

        const chunks = splitMessage(aiText);
        for (const chunk of chunks) await msg.reply(chunk);
    } catch (e) {
        msg.reply(`Error: ${e.message}`);
    }
});

client.login(process.env.DISCORD_TOKEN);
