const { Client, GatewayIntentBits } = require('discord.js');
const http = require('http');

// 1. KHỞI TẠO HTTP SERVER (HEALTH CHECK RENDER)
const PORT = process.env.PORT || 10000;
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Bot Discord AI đang chạy trên Render! 🚀');
});
server.listen(PORT, () => {
    console.log(`🌐 HTTP Server phục vụ Health Check đã mở tại cổng ${PORT}`);
});

// 2. KHỞI TẠO BOT DISCORD
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const PUTER_AUTH_TOKEN = process.env.PUTER_AUTH_TOKEN; // Đây sẽ là OpenRouter API Key của bạn

// 3. LOGIC GỌI AI VIA OPENROUTER (DÙNG GEMMA MIỄN PHÍ)
async function queryPuterAI(prompt) {
    if (!PUTER_AUTH_TOKEN) {
        throw new Error("Thiếu biến môi trường PUTER_AUTH_TOKEN (OpenRouter API Key)!");
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    try {
        // Chuyển sang endpoint của OpenRouter để dùng model miễn phí tùy chọn
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${PUTER_AUTH_TOKEN}`
            },
            body: JSON.stringify({
                model: 'google/gemma-3n-e2b-it:free', // Model miễn phí bạn yêu cầu
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
        
        // Cấu trúc bóc tách chuẩn theo OpenAI/OpenRouter format
        if (data.choices && data.choices[0] && data.choices[0].message) {
            return data.choices[0].message.content;
        }
        
        return "Không lấy được cấu trúc văn bản từ AI.";
    } catch (err) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
            throw new Error("Kết nối tới AI bị quá hạn (Timeout).");
        }
        throw err;
    }
}

// 4. XỬ LÝ SỰ KIỆN BOT LẮNG NGHE
client.once('ready', () => {
    console.log(`🤖 SUCCESS! Bot đã chính thức ONLINE trên Render với tên: ${client.user.username}`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.mentions.has(client.user)) return;

    try {
        await message.channel.sendTyping();

        const mentionRegex = new RegExp(`<@!?${client.user.id}>`);
        const prompt = message.content.replace(mentionRegex, '').trim();

        if (!prompt) {
            return message.channel.send(`<@${message.author.id}> Bạn cần nhập tin nhắn sau khi tag tôi nhé!`);
        }

        const aiResponse = await queryPuterAI(prompt);
        await message.channel.send(`<@${message.author.id}> ${aiResponse}`);

    } catch (error) {
        console.error("Lỗi xử lý tin nhắn:", error.message);
        await message.channel.send(`<@${message.author.id}> Gặp sự cố kết nối AI: \`${error.message}\``);
    }
});

client.login(DISCORD_TOKEN);
