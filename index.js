const { GoogleGenAI } = require('@google/genai');
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_KEY });
const { Client, GatewayIntentBits, AttachmentBuilder } = require('discord.js');
const http = require('http');
const { createCanvas } = require('@napi-rs/canvas');

const PORT = process.env.PORT || 10000;
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Discord AI Bot is running on Render! 🚀');
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

function drawTableToImage(rawText) {
    const lines = rawText.split('\n')
        .map(l => l.trim())
        .filter(l => l.startsWith('|') && l.endsWith('|'));
    
    const tableData = lines.filter(l => !l.includes('---')).map(l => {
        return l.split('|').map(cell => cell.trim()).filter((_, i, arr) => i > 0 && i < arr.length - 1);
    });

    if (tableData.length === 0) return null;

    const cellPadding = 15;
    const lineHeight = 24;
    
    const colWidths = [180, 250, 250];
    const tableWidth = colWidths.reduce((a, b) => a + b, 0);
    
    const rowHeights = tableData.map(row => {
        let maxLines = 1;
        row.forEach((cell, colIdx) => {
            const cleanCell = cell.replace(/<br\s*\/?>/gi, '\n');
            const words = cleanCell.split(/[\s\n]+/);
            let currentLine = "";
            let textLines = 1;
            
            words.forEach(word => {
                if ((currentLine + " " + word).length * 7 > colWidths[colIdx] - cellPadding * 2) {
                    textLines++;
                    currentLine = word;
                } else {
                    currentLine += " " + word;
                }
            });
            const manualLines = cleanCell.split('\n').length;
            const finalLines = Math.max(textLines, manualLines);
            if (finalLines > maxLines) maxLines = finalLines;
        });
        return maxLines * lineHeight + cellPadding * 2;
    });

    const tableHeight = rowHeights.reduce((a, b) => a + b, 0);

    const canvas = createCanvas(tableWidth + 40, tableHeight + 40);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.5;
    ctx.fillStyle = '#000000';
    ctx.font = '14px Arial';

    let currentY = 20;

    tableData.forEach((row, rowIdx) => {
        const rHeight = rowHeights[rowIdx];
        let currentX = 20;

        row.forEach((cell, colIdx) => {
            const cWidth = colWidths[colIdx];
            
            ctx.strokeRect(currentX, currentY, cWidth, rHeight);

            if (rowIdx === 0) {
                ctx.fillStyle = '#F2F2F2';
                ctx.fillRect(currentX + 1, currentY + 1, cWidth - 2, rHeight - 2);
                ctx.fillStyle = '#000000';
                ctx.font = 'bold 14px Arial';
            } else {
                ctx.font = '14px Arial';
            }

            const cleanCell = cell.replace(/<br\s*\/?>/gi, '\n');
            const linesToDraw = cleanCell.split('\n');
            let textY = currentY + cellPadding + 12;

            linesToDraw.forEach(lineText => {
                const words = lineText.split(' ');
                let textLine = "";
                
                words.forEach(word => {
                    if ((textLine + " " + word).length * 7 > cWidth - cellPadding * 2) {
                        ctx.fillText(textLine.trim(), currentX + cellPadding, textY);
                        textY += lineHeight;
                        textLine = word;
                    } else {
                        textLine += " " + word;
                    }
                });
                ctx.fillText(textLine.trim(), currentX + cellPadding, textY);
                textY += lineHeight;
            });

            currentX += cWidth;
        });
        currentY += rHeight;
    });

    return canvas.toBuffer();
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
        return "Error connecting to AI";
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
            return message.channel.send(`<@${message.author.id}> You must tag me before a prompt.`);
        }

        const aiResponse = await queryPuterAI(prompt);

        if (aiResponse.includes('|') && aiResponse.split('\n').filter(l => l.trim().startsWith('|')).length > 1) {
            const imageBuffer = drawTableToImage(aiResponse);
            
            if (imageBuffer) {
                const attachment = new AttachmentBuilder(imageBuffer, { name: 'table_result.png' });
                return await message.channel.send({
                    content: `<@${message.author.id}> Here is the requested data table generated as a black and white image:`,
                    files: [attachment]
                });
            }
        }

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
