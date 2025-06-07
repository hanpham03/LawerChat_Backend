const express = require("express");
const router = express.Router();
const chatbotController = require("../controllers/chatbot.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const { body } = require("express-validator");

// Validation middleware cho tạo chatbot
const validateChatbot = [
  body("user_id").notEmpty().withMessage("User ID is required"),
  body("name").notEmpty().withMessage("Name is required"),
  body("dify_chatbot_id").notEmpty().withMessage("Dify Chatbot ID is required"),
  body("status").notEmpty().withMessage("Status is required"),
  body("configuration").notEmpty().withMessage("Configuration is required"),
];

// 🚀 **Đúng thứ tự route**

// 🔹 Lấy danh sách chatbot của một người dùng (cụ thể)
router.get(
  "/user/:user_id",
  authMiddleware.verifyToken,
  chatbotController.getChatbotsByUser
);

// 🔹 Lấy tất cả chatbot có trạng thái từ Dify
router.get("/getAllChatbotDify", chatbotController.getChatbotsByUserAndStatus);

// 🔹 Lấy thông tin chatbot theo ID (cụ thể)
router.get("/:id", authMiddleware.verifyToken, chatbotController.getChatbot);

// 🔹 Tạo chatbot mới
router.post(
  "/",
  authMiddleware.verifyToken,
  validateChatbot,
  chatbotController.createChatbot
);

// 🔹 Cập nhật thông tin chatbot theo ID
router.put("/:id", chatbotController.updateChatbot);

// 🔹 Xóa chatbot theo ID
router.delete("/:id", chatbotController.deleteChatbot);

// 🔹 Endpoint proxy gọi API Dify
router.post("/chat", chatbotController.chatWithDify);

// (Tùy chọn) Nếu bạn muốn giữ "/create-chatbot", hãy đảm bảo nó có chức năng khác biệt
router.post("/create-chatbot", chatbotController.createChatbot);

// 🔹 Lấy tất cả chatbot (TỔNG QUAN - để cuối cùng)
router.get("/", chatbotController.getAllChatbots);

module.exports = router;
