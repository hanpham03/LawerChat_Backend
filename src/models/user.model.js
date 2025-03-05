const db = require('../config/database');

class Users {
    constructor(user) {
        this.email = user.email;
        this.password_hash = user.password_hash;
        this.full_name = user.full_name;
        this.created_at = user.created_at;
        this.is_active = user.is_active;
    }
    static async findAll() {
        const [rows] = await db.execute('SELECT * FROM Users');
        return rows;
    }

    static async findByEmail(email) {
        const [rows] = await db.execute('SELECT * FROM Users WHERE email = ?', [email]);
        return rows[0];
    }

    static async findById(id) {
        const [rows] = await db.execute('SELECT * FROM Users WHERE id = ?', [id]);
        return rows[0];
    }

    async create() {
        const sql = 'INSERT INTO Users (email, password_hash, full_name, is_active, created_at) VALUES (?, ?, ?, ?, NOW())';
        const [result] = await db.execute(sql, [
            this.email,
            this.password_hash,
            this.full_name,
            this.is_active
        ]);
        return result.insertId;
    }

    static async update(id, updateData) {
        const sql = 'UPDATE Users SET ? WHERE id = ?';
        const [result] = await db.execute(sql, [updateData, id]);
        return result.affectedRows;
    }

    static async delete(id) {
        const sql = 'DELETE FROM Users WHERE id = ?';
        const [result] = await db.execute(sql, [id]);
        return result.affectedRows;
    }
}

module.exports = Users;