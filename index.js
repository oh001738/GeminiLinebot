require('dotenv').config();
const express = require('express');
const http = require('http');
const axios = require('axios');
const {
    GoogleGenerativeAI,
    HarmCategory,
    HarmBlockThreshold
} = require("@google/generative-ai");

const app = express();
const port = process.env.PORT || 3000;
let processImageMsg = (process.env.processImageMsg === 'true');
let callSign = process.env.callSign;
app.use(express.json());

// 在應用程式的全域範圍內定義一個用於存儲使用者請求的 Map 或 Object
const userRequests = new Map();
const userImages = new Map();
const userTimeouts = new Map();

// LINE Bot Webhook 處理收到的事件的程式碼
app.post('/webhook', async (req, res) => {
    const events = req.body.events;
    // 處理收到的事件
    for (const event of events) {
        if (event.type === 'message') {
            const message = event.message;

            if (message.type === 'text') {
                // 處理文字訊息
                const text = message.text;
                const replyToken = event.replyToken;

                if (text.startsWith(callSign)) {
                    // 文字訊息以「魚酥」開頭，處理文字訊息...
                    const escapedCallSign = callSign.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                    const userInput = text.replace(new RegExp('^' + escapedCallSign + '\\s*'), '').trim();
					const userId = event.source.userId; // 取得使用者的 ID
                    // 判斷使用者輸入是否為空
                    if (userInput === '') {
						console.log(`Event.UserInput: [${replyToken}] No input after callSign.`);
                        return; // 不進行後續處理
                    }

                    console.log(`Event.Start --- UserInput: [${replyToken}] ${userInput}`);
                    try {
						await startLoadingAnimation(userId, 10); //Loading Animation
                        const processedText = await processText(userInput);
                        await replyMessage(replyToken, processedText);
						console.log(`Event.End --- Response: [${replyToken}] ${processedText}`);
                    } catch (error) {
                        await replyMessage(replyToken, '對不起，處理消息時出錯。錯誤訊息：' + error.toString());
                        console.error('Error replying message:', error);
                    }
                } else if (text.startsWith("我想問")) {
					const userId = event.source.userId; // 取得使用者的 ID
					const userRequestText = text.replace(/^我想問\s*/, '').trim(); // 移除開頭的 "我想問" 字串

					// 判斷使用者輸入是否為空
					if (userRequestText === '') {
						console.log(`Event.UserRequest: [${userId}][${replyToken}] No input after "我想問".`);
						return; // 不進行後續處理
					}

					userRequests.set(userId, userRequestText); // 將使用者的請求存儲在 Map 中
					console.log(`Event.Start --- UserRequest: [${userId}][${replyToken}] ${userRequestText}`);

					// 啟動超時計時器
					const timeoutDuration = 5 * 60 * 1000; // 5 分鐘，以毫秒為單位
					const timeoutId = setTimeout(async () => {
						// 如果超時，清除使用者請求，並向使用者發送提示訊息
						userRequests.delete(userId);
						await replyMessage(replyToken, '對不起，您的請求已超時，請重新提出您的問題。');
						console.log(`Event.Timeout --- UserRequest: [${userId}] 時間已超過 ${timeoutDuration / 1000} 秒`);
					}, timeoutDuration);

					// 將 timeoutId 存儲在 Map 中，以便後續取消計時器使用
					userTimeouts.set(userId, timeoutId);

					// 發送提示訊息要求使用者在5分鐘內上傳圖片
					await replyMessage(replyToken, '請您在5分鐘內上傳一張圖片給我');
				}
            } else if (message.type === 'image' && processImageMsg) {
                // 處理圖片訊息
                const replyToken = event.replyToken;
                const imageMessageId = message.id;
                const userId = event.source.userId; // 取得使用者的 ID
                const userRequest = userRequests.get(userId); // 從 Map 中獲取使用者的請求
                const imageBinary = await getImageBinary(imageMessageId); // 取得圖片二進制資料
                if (!userRequest) {
                    // 如果尚未收到使用者的文字請求，則回覆提醒訊息
					console.log(`Event.UserInput: [${replyToken}] 請先使用 "我想問" 指令來觸發圖片訊息的處理。`);
                    return;
                }

                try {
					await startLoadingAnimation(userId, 10); //Loading Animation
                    console.log(`Event.UserInput: [${userId}][${replyToken}] 使用者上傳一張圖片`);
                    if (userRequest && imageBinary) {
                        // 如果已經收到了使用者的請求和圖片二進制資料，則處理圖片和請求
                        const processedText = await processImageAndRequest(userRequest, userId, imageBinary, replyToken);
                        //await replyMessage(replyToken, processedText);
                        console.log(`Event.End --- Response: [${userId}][${replyToken}] ${processedText}`);
                    } else {
                        await replyMessage(replyToken, '對不起，處理圖片時出錯。');
						console.error('Event.Error processing image and user request: No user request or image binary.');
                    }
                } catch (error) {
                    await replyMessage(replyToken, '對不起，處理圖片時出錯。' + error.toString());
					console.error('Event.Error processing image:', error);
                }
            }
        } else if (event.type === 'follow') {
            // 處理 Follow event
            const replyToken = event.replyToken;
            const userId = event.source.userId;

            try {
                // 在這裡處理 Follow event，例如發送歡迎訊息等
                await replyMessage(replyToken, `感謝您追蹤我！邀請您體驗AI服務\n文字AI:\n輸入：${callSign}+文字 （如：魚酥請問台灣有幾個鄉鎮）\n\n圖像識別AI:\n輸入：我想問+描述（如：我想問照片中的食物熱量可能是多少），然後再上傳一張圖片即可`);
                console.log(`New user followed the bot: ${userId}`);
            } catch (error) {
                console.error('Error handling follow event:', error);
            }
		} else if (event.type === 'join') {
            // 處理 Join event
            const replyToken = event.replyToken;
            const groupId = event.source.groupId;
            try {
                await replyMessage(replyToken, `感謝您把我加入群組！邀請您體驗AI服務\n文字AI:\n輸入：${callSign}+文字 （如：魚酥請問台灣有幾個鄉鎮）\n\n圖像識別AI:\n輸入：我想問+描述（如：我想問照片中的食物熱量可能是多少），然後再上傳一張圖片即可`);
                console.log(`Bot joined the group: ${groupId}`);
            } catch (error) {
                console.error('Error handling join event:', error);
            }
		} else if (event.type === 'memberJoined') {
            // 處理 Member join event
            const replyToken = event.replyToken;
            const groupId = event.source.groupId;
            const userId = event.joined.members[0].userId; // 第一個加入的成員的 userId
            try {
                await replyMessage(replyToken, `歡迎新成員加入！邀請您體驗AI服務\n文字AI:\n輸入：${callSign}+文字 （如：魚酥請問台灣有幾個鄉鎮）\n\n圖像識別AI:\n輸入：我想問+描述（如：我想問照片中的食物熱量可能是多少），然後再上傳一張圖片即可`);
                console.log(`New member joined the group: ${userId}`);
            } catch (error) {
                console.error('Error handling member join event:', error);
            }
        }
    }

    // 回覆 LINE 伺服器，表示訊息已成功接收
    res.sendStatus(200);
});

// 使用 Google Generative AI 處理文字訊息
async function processText(userInput) {
    try {
        const MODEL_NAME = "gemini-1.0-pro";
        const API_KEY = process.env.GGAI_API_KEY;

        const genAI = new GoogleGenerativeAI(API_KEY);
        const model = genAI.getGenerativeModel({
            model: MODEL_NAME
        });

        const generationConfig = {
            temperature: 0.5,
            topK: 1,
            topP: 1,
            maxOutputTokens: 2048,
            stopSequences: [
                "bbu",
            ],
        };

        const safetySettings = [{
                "category": "HARM_CATEGORY_HARASSMENT",
                "threshold": "BLOCK_NONE"
            },
            {
                "category": "HARM_CATEGORY_HATE_SPEECH",
                "threshold": "BLOCK_NONE"
            },
            {
                "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                "threshold": "BLOCK_NONE"
            },
            {
                "category": "HARM_CATEGORY_DANGEROUS_CONTENT",
                "threshold": "BLOCK_NONE"
            },
        ];

        const chat = model.startChat({
            generationConfig,
            safetySettings,
            history: [],
        });

        const result = await chat.sendMessage(userInput);
        const response = result.response;

        // 返回回覆給使用者的訊息
        return response.text();
    } catch (error) {
        console.error('processText.Error processing text:', error);
        throw error; // 可以選擇是重新拋出錯誤或返回一個預設的錯誤訊息
    }
}

// 處理圖片訊息的函式
async function processImageAndRequest(userRequest, userId, imageBinary, replyToken) {
    try {
        // 在這裡添加您對圖片訊息的處理邏輯
        // 例如：使用 Google Generative AI 進行圖像識別、圖像生成等
        // 返回處理後的文字訊息
        const genAI = new GoogleGenerativeAI(process.env.GGAI_API_KEY);
        const model = genAI.getGenerativeModel({
            model: "gemini-pro-vision"
        });
        const prompt = userRequest;
        const mimeType = "image/png";

        // 將圖片轉換成 GoogleGenerativeAI.Part 物件
        const imageParts = [{
            inlineData: {
                data: Buffer.from(imageBinary, "binary").toString("base64"),
                mimeType
            }
        }];

        // 將使用者的圖片數據存儲在全域的 Map 中
        userImages.set(userId, imageParts);

        // 設定安全性設定
        const safetySettings = [{
                category: HarmCategory.HARM_CATEGORY_HARASSMENT,
                threshold: HarmBlockThreshold.BLOCK_NONE,
            },
            {
                category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                threshold: HarmBlockThreshold.BLOCK_NONE,
            },
            {
                category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
                threshold: HarmBlockThreshold.BLOCK_NONE,
            },
            {
                category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                threshold: HarmBlockThreshold.BLOCK_NONE,
            },
        ];

        // 使用 Google Generative AI 處理圖片
        const result = await model.generateContent([prompt, ...imageParts], safetySettings);
        const text = result.response.text();
        await replyMessage(replyToken, text); // 將回覆訊息的函式呼叫移到 try 塊中
        return text;
    } catch (error) {
        console.error('Error processing image and user request:', error);
		await replyMessage(replyToken, '對不起，處理圖片時出錯。');
    } finally {
        console.log("Before clearing:");
        console.log("userRequests:", userRequests);
        console.log("userImages:", userImages);
        // 不論是否出現異常，都會執行清空操作
        userRequests.delete(userId);
        userImages.delete(userId);
        console.log("After clearing:");
        console.log("userRequests:", userRequests);
        console.log("userImages:", userImages);
    }
}

// 回覆訊息的函式
async function replyMessage(replyToken, text) {
    try {
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

        await axios.post(url, data, {
            headers: headers
        });
    } catch (error) {
        // 可以回覆一個錯誤訊息給用戶，或者進行其他處理
		console.error('Error processing image and user request:', error);
    }
}

// Loading Animation
async function startLoadingAnimation(userId, loadingSeconds) {
    const loadingData = {
        "chatId": userId,
        "loadingSeconds": loadingSeconds
    };

    const loadingHeaders = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.CHANNEL_ACCESS_TOKEN}`
    };

    await axios.post('https://api.line.me/v2/bot/chat/loading/start', loadingData, {
        headers: loadingHeaders
    });
}

// 取得圖片二進制資料
async function getImageBinary(messageId) {
    try {
        const LINE_HEADER = {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.CHANNEL_ACCESS_TOKEN}`
        };

        const originalImage = await axios({
            method: "get",
            headers: LINE_HEADER,
            url: `https://api-data.line.me/v2/bot/message/${messageId}/content`,
            responseType: "arraybuffer"
        });

        return originalImage.data;
    } catch (error) {
        console.error('getImageBinary.Error fetching image binary:', error);
        throw new Error('無法取得圖片二進制資料'); // 返回一個預設的錯誤訊息
    }
}

// 啟動伺服器
const server = http.createServer(app);
server.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
