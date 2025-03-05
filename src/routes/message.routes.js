const express = require('express');
const router = express.Router();
const messageController = require('../controllers/message.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { body } = require('express-validator');

// Validation middleware cho tạo và cập nhật message
const validateMessage = [
    body('session_id').notEmpty().withMessage('Session ID is required'),
    body('sender').notEmpty().withMessage('Sender is required'),
    body('content').notEmpty().withMessage('Content is required')
];

// Routes
// Lấy danh sách message theo session nên đặt trước route get theo id để tránh conflict
router.get('/session/:session_id', authMiddleware.verifyToken, messageController.getMessagesBySession);

// Tạo message mới
router.post('/', authMiddleware.verifyToken, validateMessage, messageController.createMessage);

// Lấy thông tin message theo ID
router.get('/:id', authMiddleware.verifyToken, messageController.getMessage);

// Cập nhật message theo ID
router.put('/:id', authMiddleware.verifyToken, validateMessage, messageController.updateMessage);

// Xóa message theo ID
router.delete('/:id', authMiddleware.verifyToken, messageController.deleteMessage);

module.exports = router;
