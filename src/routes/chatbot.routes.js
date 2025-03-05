const express = require('express');
const router = express.Router();
const chatbotController = require('../controllers/chatbot.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { body } = require('express-validator');

// Validation middleware cho tạo chatbot
const validateChatbot = [
    body('user_id').notEmpty().withMessage('User ID is required'),
    body('name').notEmpty().withMessage('Name is required'),
    // body('description').optional().trim(), // description có thể là optional
    body('dify_chatbot_id').notEmpty().withMessage('Dify Chatbot ID is required'),
    body('status').notEmpty().withMessage('Status is required'),
    body('configuration').notEmpty().withMessage('Configuration is required')
];

// Routes
// Lấy danh sách chatbot của một người dùng
router.get('/user/:user_id', authMiddleware.verifyToken, chatbotController.getChatbotsByUser);

// Tạo chatbot mới
router.post('/', authMiddleware.verifyToken, validateChatbot, chatbotController.createChatbot);

// Lấy thông tin chatbot theo ID
router.get('/:id', authMiddleware.verifyToken, chatbotController.getChatbot);

// Cập nhật thông tin chatbot theo ID
router.put('/:id', authMiddleware.verifyToken, chatbotController.updateChatbot);

// Xóa chatbot theo ID
router.delete('/:id', authMiddleware.verifyToken, chatbotController.deleteChatbot);

// **Endpoint proxy gọi API Dify**
router.post('/chat', chatbotController.chatWithDify);
router.post('/create-chatbot', chatbotController.createChatbot);

module.exports = router;
