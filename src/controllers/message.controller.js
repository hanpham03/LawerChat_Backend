const Message = require("../models/message.model");

class MessageController {
  // Tạo message mới cho một phiên chat
  async createMessage(req, res) {
    try {
      const { session_id, content, role } = req.body;

      // Kiểm tra nếu thiếu dữ liệu
      if (!session_id || !content || !role) {
        return res.status(400).json({ message: "Thiếu dữ liệu bắt buộc" });
      }

      // Kiểm tra role hợp lệ
      if (role !== "user" && role !== "assistant") {
        return res.status(400).json({ message: "Giá trị role không hợp lệ!" });
      }

      // Gọi model để lưu vào DB
      const messageId = await Message.create(session_id, role, content);
      res
        .status(201)
        .json({ message: "Message created successfully", messageId });
    } catch (error) {
      console.error("❌ Lỗi khi tạo tin nhắn:", error);
      res.status(500).json({ message: error.message });
    }
  }

  // Lấy thông tin message theo ID
  async getMessage(req, res) {
    try {
      const message = await Message.findBySessionId(req.params.id);
      if (!message) {
        return res.status(404).json({ message: "Message not found" });
      }
      res.json(message);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

  // Lấy tất cả message cho lawer chat
  async getMessagesByLawer(req, res) {
    try {
      const messages = await Message.findBySessionId(req.params.session_id);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

  // lấy tat ca message theo session_id
  async getMessagesBySession(req, res) {
    try {
      // Lấy session_id từ req.params
      const { session_id } = req.params;
      if (!session_id) {
        return res.status(400).json({ message: "Thiếu session_id" });
      }

      const messages = await Message.findBySessionId(session_id);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

  // Cập nhật nội dung message
  async updateMessage(req, res) {
    try {
      const { content } = req.body;
      const updateData = { content };

      const affectedRows = await Message.update(req.params.id, updateData);
      if (!affectedRows) {
        return res.status(404).json({ message: "Message not found" });
      }
      res.json({ message: "Message updated successfully" });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

  // Xóa message theo ID
  async deleteMessage(req, res) {
    try {
      const affectedRows = await Message.delete(req.params.id);
      if (!affectedRows) {
        return res.status(404).json({ message: "Message not found" });
      }
      res.json({ message: "Message deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
}

module.exports = new MessageController();
