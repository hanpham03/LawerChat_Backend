const Chatbots = require('../models/chatbot.model');
// const axios = require('axios');
const chat_default_id = "4504b133-a802-4722-b0b9-495ece7dfb16";
const jwt = require('jsonwebtoken');

class ChatbotController {
  
  // tạo mới chatbot
  async createChatbot(req, res) {
    try {
      // 1) Lấy token từ header Authorization
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ message: "Missing Dify Token" });
      }
      const dify_token = authHeader.split(" ")[1];
  
      // 2) Lấy dữ liệu từ request body
      const { user_id, name, description, prompt, icon, mode } = req.body;
  
      if (!name) {
        return res.status(400).json({ message: "Missing name required fields" });
      }
  
      // 3) Gửi request tạo chatbot trên Dify
      const apiResponse = await fetch("http://localhost/console/api/apps", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${dify_token}`,
        },
        body: JSON.stringify({
          name,
          description,
          icon: icon || "", // Nếu không có icon, gửi chuỗi rỗng
          mode,
        }),
      });
  
      // Chuyển response thành JSON
      const data = await apiResponse.json();
  
      // 4) Kiểm tra phản hồi từ API Dify
      if (!apiResponse.ok) {
        console.error("Dify API Error:", data);
        return res.status(apiResponse.status).json({ message: "Failed to create chatbot on Dify", error: data });
      }
  
      // 5) Lưu chatbot vào database
      const chatbotId = data.id; // ✅ Lấy ID từ phản hồi Dify
      await Chatbots.createChatbot(user_id, name, description, prompt, chatbotId); // ✅ Lưu chatbot vào DB
  
      // 6) update prompt cho chatbot vừa tạo lên dify
      const updatePrompt = await fetch(`http://localhost/console/api/apps/${chatbotId}/model-config`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${dify_token}`,
        },
        body: JSON.stringify({
          pre_prompt: prompt,
          prompt_type: "simple",
          retriever_resource: {
            enabled: true
          },
          model: {
              provider: "openrouter",
              name: "openai/gpt-3.5-turbo",
              mode: "chat",
              completion_params: {}
          }
        }),
      });

      // 6) Trả về kết quả thành công
      return res.status(201).json({ message: "Chatbot created successfully", chatbotId });
  
    } catch (error) {
      console.error("Server Error:", error);
      return res.status(500).json({ message: "Internal Server Error", error: error.message });
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
        // 1) Lấy token từ header Authorization
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({ message: "Missing Dify Token" });
        }
        const dify_token = authHeader.split(" ")[1];

        // 2) Lấy chatbotId từ params và dify_chatbot_id từ body
        const chatbotId = req.params.id;
        const { dify_chatbot_id } = req.body;

        if (!dify_chatbot_id) {
            return res.status(400).json({ message: "Missing dify_chatbot_id" });
        }

        // 3) Xóa chatbot trong database
        const affectedRows = await Chatbots.deleteChatbot(chatbotId);
        if (!affectedRows) {
            return res.status(404).json({ message: "Chatbot not found" });
        }

        // 4) Gọi API Dify để xóa chatbot trên hệ thống Dify
        const response = await fetch(`http://localhost/console/api/apps/${dify_chatbot_id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${dify_token}` },
        });

        res.json({ message: "Chatbot deleted successfully" });
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

      // 2) Lấy query từ body
      const { query } = req.body;
      if (!query) {
        return res.status(400).json({ message: 'Missing "query" in request body' });
      }

      // 3) Giải mã token để lấy user_id (inner try/catch)
      try {
        const decoded = jwt.decode(dify_token); // Giải mã JWT không cần secret

        const userId = decoded.user_id || decoded.sub;
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

  /**
   * lấy danh sách tất cả chatbot còn tồn tại trong dify của một người dùng
   */
  
  async getChatbotsByUserAndStatus(req, res) {
    try {
      // 1) Lấy token từ header Authorization
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: "Missing Dify Token" });
      }
      const dify_token = authHeader.split(' ')[1];

      const response = await fetch('http://localhost/console/api/apps?page=1&limit=100&name=&is_created_by_me=false', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${dify_token}`,
        }
      });
      const result = await response.json();

      // Lọc dữ liệu chỉ lấy id và name
      const chatbots = result.data.map(bot => ({
          id: bot.id,
          name: bot.name
      }));

      // Trả về JSON cho frontend
      res.status(200).json(chatbots);
    } catch (error) {
        console.error('Lỗi gọi API:', error);
        res.status(500).json({ error: 'Token dify hết hạn' });
    }  
  }
}

module.exports = new ChatbotController();
