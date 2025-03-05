const db = require('../config/database');

class Chatbots {
    constructor(chatbots) {
        this.id = chatbots.id;
        this.user_id = chatbots.user_id;
        this.name = chatbots.name;
        this.description = chatbots.description;
        this.dify_chatbot_id = chatbots.dify_chatbot_id;
        this.status = chatbots.status;
        this.configuration = chatbots.configuration;
        this.create_at = chatbots.create_at;
        this.update_at = chatbots.update_at;
    }

    // Tạo chatbot mới
    static async createChatbot(user_id, name, description, dify_chatbot_id, status, configuration) {
        const query = `
            INSERT INTO chatbots (user_id, name, description, dify_chatbot_id, status, configuration, create_at, update_at)
            VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
        `;
        const [result] = await db.execute(query, [user_id, name, description, dify_chatbot_id, status, configuration]);
        return result.insertId;
    }

    // Lấy thông tin một chatbot theo ID
    static async getChatbotById(id) {
        const query = 'SELECT * FROM chatbots WHERE id = ?';
        const [rows] = await db.execute(query, [id]);
        return rows.length ? rows[0] : null;
    }

    // Lấy tất cả chatbot của một người dùng
    static async getChatbotsByUser(user_id) {
        const query = 'SELECT * FROM chatbots WHERE user_id = ? ORDER BY create_at DESC';
        const [rows] = await db.execute(query, [user_id]);
        return rows;
    }

    // Cập nhật thông tin chatbot
    static async updateChatbot(id, updateData) {
        const query = 'UPDATE chatbots SET ? WHERE id = ?';
        const [result] = await db.execute(query, [updateData, id]);
        return result.affectedRows;
    }

    // Xóa một chatbot theo ID
    static async deleteChatbot(id) {
        const query = 'DELETE FROM chatbots WHERE id = ?';
        const [result] = await db.execute(query, [id]);
        return result.affectedRows;
    }
}

module.exports = Chatbots;
