const { Client, GatewayIntentBits } = require('discord.js');
const http = require('http');

const PORT = process.env.PORT || 10000;
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Bot Discord AI đang chạy trên Render! 🚀');
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
const PUTER_AUTH_TOKEN = process.env.PUTER_AUTH_TOKEN; 


async function queryPuterAI(prompt) {
    if (!PUTER_AUTH_TOKEN) {
        throw new Error("Missing auth token!");
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${PUTER_AUTH_TOKEN}`
            },
            body: JSON.stringify({
                model: 'google/gemini-2.5-flash-lite',
                messages: [{ role: 'user', content: prompt }]
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`AI API Error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        
 
        if (data.choices && data.choices[0] && data.choices[0].message) {
            return data.choices[0].message.content;
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
