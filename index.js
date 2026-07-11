const { Client, GatewayIntentBits } = require('discord.js');
const http = require('http');

const PORT = process.env.PORT || 10000; // Render thường cấp cổng mặc định là 10000 hoặc ngẫu nhiên
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Bot Discord Puter AI đang chạy mượt mà trên Render! 🚀');
});

server.listen(PORT, () => {
    console.log(`🌐 HTTP Server phục vụ Health Check đã mở tại cổng ${PORT}`);
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
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000); // Mặc định chờ tối đa 20 giây

    try {
        const response = await fetch('https://api.puter.com/v1/ai/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: [{ role: 'user', content: prompt }]
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`Puter API Error: ${response.statusText}`);
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
            return message.channel.send(`<@${message.author.id}> Bạn cần nhập tin nhắn sau tên bot nhé! Ví dụ: \`@${botName} Xin chào\``);
        }

        const aiResponse = await queryPuterAI(prompt);


        await message.channel.send(`<@${message.author.id}> ${aiResponse}`);

    } catch (error) {
        console.error("Lỗi xử lý:", error);
        await message.channel.send(`<@${message.author.id}> Gặp sự cố khi kết nối với AI. Thử lại sau nhé!`);
    }
});

// Tiến hành kết nối
client.login(DISCORD_TOKEN);
