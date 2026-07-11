const { Client, GatewayIntentBits } = require('discord.js');
const http = require('http');

// --------------------------------------------------
// 1. KHỞI TẠO HTTP SERVER (HEALTH CHECK RENDER)
// --------------------------------------------------
const PORT = process.env.PORT || 10000;
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Bot Discord Puter AI đang chạy trên Render! 🚀');
});

server.listen(PORT, () => {
    console.log(`🌐 HTTP Server phục vụ Health Check đã mở tại cổng ${PORT}`);
});

// --------------------------------------------------
// 2. KHỞI TẠO BOT DISCORD
// --------------------------------------------------
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const PUTER_AUTH_TOKEN = process.env.PUTER_AUTH_TOKEN; 

// --------------------------------------------------
// 3. LOGIC GỌI PUTER AI API (CÓ AUTHENTICATION)
// --------------------------------------------------
async function queryPuterAI(prompt) {
    if (!PUTER_AUTH_TOKEN) {
        throw new Error("Thiếu biến môi trường PUTER_AUTH_TOKEN!");
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    try {
        const response = await fetch('https://api.puter.com/v1/ai/chat', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${PUTER_AUTH_TOKEN}` // Gửi kèm token để tránh bị chặn
            },
            body: JSON.stringify({
                messages: [{ role: 'user', content: prompt }]
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`Puter API Error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return data.message?.content || data.response?.text || data.reply || "Không có câu trả lời.";
    } catch (err) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
            throw new Error("Kết nối tới Puter AI bị quá hạn.");
        }
        throw err;
    }
}

// --------------------------------------------------
// 4. XỬ LÝ SỰ KIỆN BOT
// --------------------------------------------------
client.once('ready', () => {
    console.log(`🤖 SUCCESS! Bot đã chính thức ONLINE trên Render với tên: ${client.user.username}`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const botName = client.user.username;
    const contentText = message.content.trim();

    if (!contentText.toLowerCase().startsWith(`@${botName.toLowerCase()}`)) return;

    try {
        await message.channel.sendTyping();
        const prompt = contentText.substring(`@${botName}`.length).trim();

        if (!prompt) {
            return message.channel.send(`<@${message.author.id}> Bạn cần nhập tin nhắn sau tên bot nhé!`);
        }

        const aiResponse = await queryPuterAI(prompt);
        await message.channel.send(`<@${message.author.id}> ${aiResponse}`);

    } catch (error) {
        console.error("Lỗi xử lý tin nhắn:", error.message);
        await message.channel.send(`<@${message.author.id}> Gặp sự cố kết nối AI: ${error.message}`);
    }
});

client.login(DISCORD_TOKEN);
