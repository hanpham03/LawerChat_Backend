const db = require('../config/database');

class Messages {
    constructor(message) {
        this.id = message.id;
        this.session_id = message.session_id;
        this.content = message.content;
        this.role = message.role;
        this.create_at = message.create_at;
    }

    static async findById(id) {
        const [rows] = await db.execute(
            'SELECT * FROM Messages WHERE id = ?', 
            [id]
        );
        return rows;
    }

    static async findBySessionId(sessionId) {
        const sql = "SELECT * FROM Messages WHERE session_id = ?";
        const [rows] = await db.execute(sql, [sessionId]);
        return rows; // rows sẽ là một mảng các bản ghi
    }    

    static async create(session_id, role, content) {
        const sql = `
            INSERT INTO Messages (
                session_id, content, 
                role
            ) VALUES (?, ?, ?)
        `;
        const [result] = await db.execute(sql, [
            session_id,
            content,
            role,  // ✅ Đúng với database
        ]);
        return result.insertId;
    }
    

    static async update(id, updateData) {
        const sql = 'UPDATE Messages SET ? WHERE id = ?';
        const [result] = await db.execute(sql, [updateData, id]);
        return result.affectedRows;
    }

    static async delete(id) {
        const sql = 'DELETE FROM Messages WHERE id = ?';
        const [result] = await db.execute(sql, [id]);
        return result.affectedRows;
    }
}

module.exports = Messages;