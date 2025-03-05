const db = require('../config/database');

class ChatSessions {
    constructor(Sessions) {
        this.id = Sessions.id;
        this.user_id = Sessions.user_id;
        this.chatbot_id = Sessions.chatbot_id;
        this.start_time = Sessions.start_time;
        this.end_time = Sessions.end_time;
    }

    // Tạo một phiên trò chuyện mới
    static async createSession(user_id, chatbot_id) {
        const query = 'INSERT INTO chatsessions (user_id, chatbot_id, start_time) VALUES (?, ?, NOW())';
        const [result] = await db.execute(query, [user_id, chatbot_id]);
        return result.insertId;
    }

    // Lấy thông tin một phiên trò chuyện theo ID
    static async getSessionById(session_id) {
        const query = 'SELECT * FROM chatsessions WHERE id = ?';
        const [rows] = await db.execute(query, [session_id]);
        return rows.length ? rows[0] : null;
    }

    // Lấy tất cả phiên trò chuyện của một người dùng
    static async getSessionsByUser(user_id) {
        const query = 'SELECT * FROM chatsessions WHERE user_id = ? ORDER BY start_time DESC';
        const [rows] = await db.execute(query, [user_id]);
        return rows;
    }

    // Cập nhật thời gian kết thúc của phiên trò chuyện
    static async endSession(session_id) {
        const query = 'UPDATE chatsessions SET end_time = NOW() WHERE id = ?';
        await db.execute(query, [session_id]);
    }

    // Cập nhật thông tin phiên trò chuyện
    static async updateSession(session_id, updateData) {
        const query = 'UPDATE chatsessions SET ? WHERE id = ?';
        const [result] = await db.execute(query, [updateData, session_id]);
        return result.affectedRows;
    }

    // Xóa một phiên trò chuyện theo ID
    static async deleteSession(session_id) {
        const deleteMessagesQuery = 'DELETE FROM messages WHERE session_id = ?';
        const deleteSessionQuery = 'DELETE FROM chatsessions WHERE id = ?';
    
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();
            await connection.execute(deleteMessagesQuery, [session_id]); // Xóa tin nhắn trước
            const [result] = await connection.execute(deleteSessionQuery, [session_id]); // Xóa phiên chat
            await connection.commit();
            return result.affectedRows;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }    
}

module.exports = ChatSessions;
