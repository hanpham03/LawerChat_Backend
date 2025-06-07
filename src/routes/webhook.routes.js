const express = require("express");
const router = express.Router();
const axios = require("axios");

// Lấy biến môi trường
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "chatbot_fb_token_2025";
const PAGE_ACCESS_TOKEN =
  "EAAIw8ZCH1uZA0BO9CkoVVFP9ZBSZCWdKJao3V8ZAZBVEvlkxLt4TNJwAfgVX3nBOixW3mn2ofFehCFdbOCiwn6WovTjrnbhHDIZCwMjNJvldZAfc4SnDbvNVkgDb4mOHfpmYkl1rZAB4HVK8jUSUsr7WwGGmHvopzbqrc1qHNIeULZC8coo03wHb3mEzBv10fU9CTpdQZDZD";
const DIFY_API_KEY = process.env.DIFY_API_KEY || "app-Y4xWP5vos8N9Ut1DcujkWbUz";
const DIFY_API_URL =
  process.env.DIFY_API_URL || "http://localhost/v1/chat-messages";

// Kiểm tra biến môi trường
if (!PAGE_ACCESS_TOKEN || !DIFY_API_KEY) {
  console.error("Missing PAGE_ACCESS_TOKEN or DIFY_API_KEY");
  process.exit(1);
}

// Lưu trữ tạm thời các message ID đã xử lý để tránh trùng lặp
const processedMessages = new Set();
// Thời gian hết hạn cho các message ID (30 phút)
const MESSAGE_EXPIRY = 30 * 60 * 1000;

// Cài đặt retry và timeouts
const DIFY_TIMEOUT = 30000; // 25 giây timeout cho Dify API
const FB_TIMEOUT = 15000; // 15 giây timeout cho Facebook API
const MAX_RETRIES = 2; // Số lần thử lại tối đa
const RETRY_DELAY = 1000; // Chờ 1 giây trước khi thử lại

// Giới hạn số lượng tin nhắn xử lý đồng thời
const MAX_CONCURRENT_REQUESTS = 5;
let currentRequests = 0;
const messageQueue = [];

// GET: Xác minh webhook từ Facebook
router.get("/", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  console.log("Webhook GET:", { mode, token, challenge });
  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("WEBHOOK_VERIFIED");
    return res.status(200).send(challenge);
  }
  console.log("Invalid token or mode");
  return res.sendStatus(403);
});

// Gửi tin nhắn đến Facebook Messenger với cơ chế retry
async function sendFacebookMessage(senderId, text, retryCount = 0) {
  try {
    await axios.post(
      "https://graph.facebook.com/v21.0/me/messages",
      {
        recipient: { id: senderId },
        message: { text },
      },
      {
        headers: {
          Authorization: `Bearer ${PAGE_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        timeout: FB_TIMEOUT,
      }
    );
    console.log(`Sent message to ${senderId}: ${text}`);
    return true;
  } catch (err) {
    console.error(
      `Error sending message (attempt ${retryCount + 1}/${MAX_RETRIES + 1}):`,
      err.response?.data || err.message
    );

    // Thử lại nếu chưa vượt quá số lần thử
    if (retryCount < MAX_RETRIES) {
      console.log(`Retrying in ${RETRY_DELAY}ms...`);
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
      return sendFacebookMessage(senderId, text, retryCount + 1);
    }

    return false;
  }
}

// Gọi Dify API với cơ chế retry
async function callDifyAPI(payload, retryCount = 0) {
  try {
    const response = await axios.post(DIFY_API_URL, payload, {
      headers: {
        Authorization: `Bearer ${DIFY_API_KEY}`,
        "Content-Type": "application/json",
      },
      timeout: DIFY_TIMEOUT,
    });
    return response.data;
  } catch (err) {
    console.error(
      `Error calling Dify API (attempt ${retryCount + 1}/${MAX_RETRIES + 1}):`,
      err.response?.data || err.message
    );

    // Thử lại nếu chưa vượt quá số lần thử
    if (retryCount < MAX_RETRIES) {
      console.log(`Retrying Dify API in ${RETRY_DELAY}ms...`);
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
      return callDifyAPI(payload, retryCount + 1);
    }

    throw err; // Ném lỗi nếu đã thử hết số lần
  }
}

// Xử lý hàng đợi tin nhắn
function processNextInQueue() {
  if (messageQueue.length === 0 || currentRequests >= MAX_CONCURRENT_REQUESTS) {
    return;
  }

  const nextMessage = messageQueue.shift();
  processMessageNow(
    nextMessage.senderId,
    nextMessage.messageId,
    nextMessage.messageText
  ).finally(() => {
    currentRequests--;
    // Xử lý tin nhắn tiếp theo trong hàng đợi
    processNextInQueue();
  });
}

// Xử lý tin nhắn bất đồng bộ
async function processMessage(senderId, messageId, messageText) {
  // Kiểm tra nếu tin nhắn đã được xử lý
  if (processedMessages.has(messageId)) {
    console.log(`Skipping duplicate message: ${messageId}`);
    return;
  }

  // Đánh dấu tin nhắn đã xử lý
  processedMessages.add(messageId);

  // Tự động xóa message ID sau thời gian hết hạn
  setTimeout(() => {
    processedMessages.delete(messageId);
  }, MESSAGE_EXPIRY);

  // Thêm vào hàng đợi nếu đã đạt giới hạn xử lý đồng thời
  if (currentRequests >= MAX_CONCURRENT_REQUESTS) {
    console.log(`Queuing message from ${senderId} (${messageId})`);
    messageQueue.push({ senderId, messageId, messageText });
    return;
  }

  // Tăng biến đếm tin nhắn đang xử lý
  currentRequests++;

  // Xử lý tin nhắn
  processMessageNow(senderId, messageId, messageText).finally(() => {
    // Giảm biến đếm và xử lý tin nhắn tiếp theo
    currentRequests--;
    processNextInQueue();
  });
}

// Hàm thực hiện xử lý tin nhắn
async function processMessageNow(senderId, messageId, messageText) {
  console.log(
    `Processing message from ${senderId} (${messageId}): ${messageText}`
  );

  // Chuẩn bị payload cho Dify
  const difyPayload = {
    inputs: {},
    query: messageText,
    response_mode: "blocking",
    conversation_id: "", // Có thể lưu conversation_id theo senderId để duy trì context
    user: senderId,
    files: [],
  };

  try {
    // Gửi thông báo đang xử lý cho người dùng (tùy chọn)
    // await sendFacebookMessage(senderId, "Tôi đang xử lý tin nhắn của bạn...");

    // Gọi API Dify với retry
    const difyResponse = await callDifyAPI(difyPayload);
    const reply = difyResponse.answer || "Xin lỗi, tôi không hiểu.";

    // Gửi phản hồi về Messenger
    await sendFacebookMessage(senderId, reply);
  } catch (err) {
    console.error(
      `Failed to process message ${messageId} after all retries:`,
      err.message
    );

    // Gửi fallback message
    await sendFacebookMessage(
      senderId,
      "Đã có lỗi, vui lòng thử lại sau vài phút."
    );
  }
}

// POST: Nhận và xử lý tin nhắn
router.post("/", (req, res) => {
  const body = req.body;

  // Trả về 200 ngay lập tức để Facebook không gửi lại webhook
  res.status(200).send("EVENT_RECEIVED");

  // Kiểm tra nếu webhook hợp lệ
  if (body.object !== "page") {
    console.log("Invalid webhook event");
    return;
  }

  // Log thông tin (có thể xóa trong production để tránh logs quá lớn)
  // console.log("Webhook POST:", JSON.stringify(body, null, 2));
  console.log("Received webhook from Facebook");

  // Xử lý các tin nhắn
  body.entry.forEach((entry) => {
    if (!entry.messaging || !entry.messaging[0]) return;

    const webhookEvent = entry.messaging[0];
    const senderId = webhookEvent.sender.id;
    const message = webhookEvent.message;

    if (message && message.text) {
      const messageId = message.mid;
      const messageText = message.text;

      console.log(
        `Received message ${messageId} from ${senderId}: ${messageText}`
      );

      // Xử lý tin nhắn không đồng bộ với hàng đợi và giới hạn đồng thời
      processMessage(senderId, messageId, messageText).catch((err) =>
        console.error("Uncaught error in message queue:", err)
      );
    }
  });
});

module.exports = router;
