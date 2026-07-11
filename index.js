const { Client, GatewayIntentBits } = require('discord.js');
const http = require('http');


const PORT = process.env.PORT || 7860;
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Bot Discord Puter AI đang chạy qua Reverse Proxy ổn định! 🚀');
});
server.listen(PORT, () => {
    console.log(`🌐 HTTP Server ảo đang chạy tại cổng ${PORT}`);
});

const PROXY_REST = 'https://discord.com/api/v10'; 

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ],
    rest: {
        api: PROXY_REST,
        timeout: 60000,
        retries: 5
    }
});

client.rest.getGateway = async function() {
    return {
        url: 'wss://gateway.discord.gg', 
        shards: 1,
        session_start_limit: { total: 1000, remaining: 999, reset_after: 0, max_concurrency: 1 }
    };
};


const originalConnect = client.ws.connect.bind(client.ws);
client.ws.connect = async function() {

    this.gateway = 'wss://gateway.discord.gg/?v=10&encoding=json';
    return originalConnect();
};

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;


async function queryPuterAI(prompt) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

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
    console.log(`🤖 SUCCESS! Bot đã trực tuyến (ONLINE) thành công với tên: ${client.user.username}`);
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
        console.error("Lỗi xử lý:", error);
        await message.channel.send(`<@${message.author.id}> Đã xảy ra lỗi kết nối. Vui lòng thử lại sau!`);
    }
});

client.login(DISCORD_TOKEN);
