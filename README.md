# LINE Bot 使用 Google Generative AI 處理訊息與圖片

## 簡介

這是一個使用 Node.js 搭建的 LINE Bot 應用程式，能夠處理來自用戶的文字訊息與圖片訊息，並透過 Google Generative AI 生成回應。本專案利用 Express 作為伺服器框架，並透過 Axios 與 LINE API 進行互動。

## 功能

- 處理文字訊息
- 處理圖片訊息並生成回應
- 支援多種事件類型（如 Follow、Join、Member Joined）

## 安裝

1. 請先確保您的環境中已安裝 [Node.js](https://nodejs.org/) 及 [npm](https://www.npmjs.com/)。

2. 克隆此專案到本地端：
    ```sh
    git clone https://github.com/oh001738/GeminiLinebot.git
    cd your-repo-name
    ```

3. 安裝所需的 npm 套件：
    ```sh
    npm install
    ```

4. 新增 `.env` 檔案並填入以下環境變數：
    ```
    PORT=3000
    CHANNEL_ACCESS_TOKEN=YOUR_CHANNEL_ACCESS_TOKEN
    GGAI_API_KEY=YOUR_GOOGLE_GENERATIVE_AI_API_KEY
    GGAI_API_MODEL=YOUR_GOOGLE_GENERATIVE_AI_MODEL_NAME
    GGAI_temperature=YOUR_GGAI_TEMPERATURE
    GGAI_topK=YOUR_GGAI_TOPK
    GGAI_topP=YOUR_GGAI_TOPP
    GGAI_maxOutputTokens=YOUR_GGAI_MAX_OUTPUT_TOKENS
    callSign=YOUR_CALL_SIGN
    processImageMsg=true
    ```

## 使用

1. 啟動伺服器：
    ```sh
    npm start
    ```

2. 伺服器啟動後，您應該會看到如下訊息：
    ```
    Server is running on port 3000
    ```

3. 將您的 LINE Bot Webhook 設定指向您的伺服器 URL（例如：https://your-domain.com/webhook）。

## 環境變數

| 變數名稱               | 描述                                      |
|----------------------|-------------------------------------------|
| `PORT`               | 伺服器監聽的埠號。                          |
| `CHANNEL_ACCESS_TOKEN`| LINE Bot 頻道存取權杖。                     |
| `GGAI_API_KEY`       | Google Generative AI 的 API 金鑰。           |
| `GGAI_API_MODEL`     | Google Generative AI 使用的模型名稱。       |
| `GGAI_temperature`   | Google Generative AI 生成文本的溫度設定。   |
| `GGAI_topK`          | Google Generative AI 生成文本的 topK 設定。 |
| `GGAI_topP`          | Google Generative AI 生成文本的 topP 設定。 |
| `GGAI_maxOutputTokens`| Google Generative AI 生成文本的最大輸出字數。|
| `callSign`           | Bot 呼叫的前綴詞。                          |
| `processImageMsg`    | 是否處理圖片訊息，設為 `true` 或 `false`。 |

## 目錄結構

├── .env # 環境變數設定檔
├── package.json # 專案依賴與腳本
├── server.js # 主伺服器檔案
└── README.md # 專案說明文件


## 貢獻

歡迎提交 Issue 和 Pull Request 來改善本專案。如有任何問題或建議，請隨時聯繫我們。

## 授權

本專案採用 MIT 授權條款，詳情請參閱 [LICENSE](LICENSE) 文件。
