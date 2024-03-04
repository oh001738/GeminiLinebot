require('dotenv').config();
const express = require('express');
const http = require('http');
const axios = require('axios');
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require("@google/generative-ai");

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// LINE Bot Webhook
app.post('/webhook', async (req, res) => {
    const events = req.body.events;
    
    // 處理收到的事件
    for (const event of events) {
        if (event.type === 'message' && event.message.type === 'text') {
            const message = event.message.text;
            const replyToken = event.replyToken;

            // 使用 Google Generative AI 處理文字訊息
            try {
                const processedText = await processText(message);
                await replyMessage(replyToken, processedText);
            } catch (error) {
                console.error('Error replying message:', error);
                await replyMessage(replyToken, 'Sorry, there was an error processing the message.');
            }
        }
    }

    // 回覆 LINE 伺服器，表示訊息已成功接收
    res.sendStatus(200);
});

// 使用 Google Generative AI 處理文字訊息
async function processText(userInput) {
    const MODEL_NAME = "gemini-1.0-pro";
    const API_KEY = process.env.GGAI_API_KEY;
    
    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });

    const generationConfig = {
        temperature: 0.9,
        topK: 1,
        topP: 1,
        maxOutputTokens: 2048,
    };

    const safetySettings = [
        {
            category: HarmCategory.HARM_CATEGORY_HARASSMENT,
            threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
            category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
            threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
            category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
            threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
            category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
            threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
    ];

    const chat = model.startChat({
        generationConfig,
        safetySettings,
        history: [],
    });

    const result = await chat.sendMessage(userInput);
    const response = result.response;
    return response.text();
}

// 回覆訊息的函數
async function replyMessage(replyToken, text) {
    const accessToken = process.env.CHANNEL_ACCESS_TOKEN;
    const url = 'https://api.line.me/v2/bot/message/reply';
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
    };
    const data = {
        replyToken: replyToken,
        messages: [{
            type: 'text',
            text: text
        }]
    };

    await axios.post(url, data, { headers: headers });
}

// 啟動伺服器
const server = http.createServer(app);
server.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
