const Chatbots = require('../models/chatbot.model');
// const axios = require('axios');
const chat_default_id = "500505a5-0f8d-4c23-972d-ce0a06647513";
const jwt = require('jsonwebtoken');

class ChatbotController {
    // tạo mới chatbot
    async createChatbot(req, res) {
        try {
            const { user_id, name, description, dify_chatbot_id, status, configuration } = req.body;
            const chatbotId = await Chatbots.createChatbot(
                user_id, name, description, dify_chatbot_id, status, configuration
            );
            res.status(201).json({ message: 'Chatbot created successfully', chatbotId });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    // Lấy thông tin chatbot theo ID
    async getChatbot(req, res) {
        try {
            const chatbot = await Chatbots.getChatbotById(req.params.id);
            if (!chatbot) {
                return res.status(404).json({ message: 'Chatbot not found' });
            }
            res.json(chatbot);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    // Lấy danh sách chatbot của một người dùng
    async getChatbotsByUser(req, res) {
        try {
            const chatbots = await Chatbots.getChatbotsByUser(req.params.user_id);
            res.json(chatbots);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    // Cập nhật thông tin chatbot
    async updateChatbot(req, res) {
        try {
            const updateData = req.body; // Dữ liệu cập nhật
            const affectedRows = await Chatbots.updateChatbot(req.params.id, updateData);
            if (!affectedRows) {
                return res.status(404).json({ message: 'Chatbot not found' });
            }
            res.json({ message: 'Chatbot updated successfully' });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    // Xóa chatbot theo ID
    async deleteChatbot(req, res) {
        try {
            const affectedRows = await Chatbots.deleteChatbot(req.params.id);
            if (!affectedRows) {
                return res.status(404).json({ message: 'Chatbot not found' });
            }
            res.json({ message: 'Chatbot deleted successfully' });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

  /**
   * Gọi API Dify để chat (streaming).
   * Body gửi lên cần có: { query: "Câu hỏi" }
   */
  async chatWithDify(req, res) {
    try {
      // 1) Lấy token từ header Authorization
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: "Missing Dify Token" });
      }
      const dify_token = authHeader.split(' ')[1];
      console.log('dify_token', dify_token);

      // 2) Lấy query từ body
      const { query } = req.body;
      if (!query) {
        return res.status(400).json({ message: 'Missing "query" in request body' });
      }

      // 3) Giải mã token để lấy user_id (inner try/catch)
      try {
        const decoded = jwt.decode(dify_token); // Giải mã JWT không cần secret
        console.log('Decoded token:', decoded);

        const userId = decoded.user_id || decoded.sub;
        console.log('Extracted userId:', userId);
        if (!userId) {
          return res.status(401).json({ message: 'Unauthorized: User ID not found in token' });
        }

        // 4) Gọi API Dify ở chế độ streaming
        const response = await fetch(
          `http://localhost/console/api/apps/${chat_default_id}/advanced-chat/workflows/draft/run`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${dify_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              inputs: '',
              model_config: {},
              query,
              response_mode: 'streaming', // quan trọng: streaming
            }),
          }
        );

        // 5) Kiểm tra phản hồi từ Dify
        if (!response.ok || !response.body) {
          const errorData = await response.json().catch(() => ({
            message: `HTTP error! status: ${response.status}`,
          }));
          throw { response: { status: response.status, data: errorData } };
        }

        // 6) Đọc luồng streaming, lấy event workflow_finished
        // Đọc luồng streaming từ Dify
        // Đọc luồng streaming từ Dify
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let done = false;
        let finalAnswer = '';

        while (!done) {
        const { value, done: doneReading } = await reader.read();
        if (doneReading) break;

        const chunk = decoder.decode(value, { stream: true });

        // Tách theo dòng (mỗi dòng 1 event JSON)
        const lines = chunk.split('\n');
        for (let line of lines) {
            let trimmed = line.trim();
            if (!trimmed) continue; // bỏ dòng trống

            // Nếu dòng bắt đầu bằng "data:", loại bỏ phần đó
            if (trimmed.startsWith("data:")) {
            trimmed = trimmed.substring("data:".length).trim();
            }

            try {
            const event = JSON.parse(trimmed);
            console.log('Event received:', event); // Debug: in ra event nhận được
            if (event.event === 'workflow_finished') {
                finalAnswer = event.data?.outputs?.answer || '';
                done = true;
                break;
            }
            } catch (err) {
            console.error('Parse error for line:', trimmed, err);
            }
        }
        }

        return res.json({ answer: finalAnswer });



        // 7) Trả về cho frontend câu trả lời cuối
        return res.json({ answer: finalAnswer });

      } catch (jwtError) {
        // Lỗi giải mã JWT
        console.error('JWT Decode Error:', jwtError);
        return res.status(401).json({ message: 'Unauthorized: Invalid token format' });
      }

    } catch (error) {
      // Lỗi tổng quát (gọi API, đọc stream, ... )
      console.error('Error calling Dify:', error?.response?.data || error.message);
      const statusCode = error?.response?.status || 500;
      const errorData = error?.response?.data || { message: error.message };
      return res.status(statusCode).json(errorData);
    }
  }
}

module.exports = new ChatbotController();
