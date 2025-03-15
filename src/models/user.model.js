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
        const sql = `
            INSERT INTO Users (email, password_hash, full_name, is_active, created_at) 
            VALUES (?, ?, ?, ?, NOW())
        `;
    
        const [result] = await db.execute(sql, [
            this.email || "",          // Đảm bảo email không undefined
            this.password_hash || "",  // Đảm bảo password không undefined
            this.full_name || "",      // Đảm bảo full_name không undefined
            this.is_active || 1,       // Mặc định active = 1
        ]);
    
        return result.insertId;
    }    

    // async create() {
    //     const sql = 'INSERT INTO Users (email, password_hash, full_name, is_active, created_at) VALUES (?, ?, ?, ?, NOW())';
    //     const [result] = await db.execute(sql, [
    //         this.email,
    //         this.password_hash,
    //         this.full_name,
    //         this.is_active
    //     ]);
    //     return result.insertId;
    // }

    static async update(id, updateData) {
        try {
            // Chuyển đổi object updateData thành danh sách `column = ?`
            const updates = Object.keys(updateData).map((key) => `${key} = ?`).join(", ");
            const values = Object.values(updateData);
    
            // Thêm id vào cuối mảng giá trị
            values.push(id);
    
            // Thực thi câu lệnh SQL hợp lệ
            const sql = `UPDATE Users SET ${updates} WHERE id = ?`;
            console.log("🔹 SQL Query:", sql, "Values:", values);
    
            const [result] = await db.execute(sql, values);
            return result.affectedRows;
        } catch (error) {
            console.error("❌ Lỗi update user:", error);
            throw error;
        }
    }    

    static async delete(id) {
        const sql = 'DELETE FROM Users WHERE id = ?';
        const [result] = await db.execute(sql, [id]);
        return result.affectedRows;
    }

    // xử lý otp
    static async saveOtp(user_id, otp, expires_in_seconds) {
        try {
            await db.execute(
                `INSERT INTO user_otps (user_id, otp, expires_at) 
                 VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? SECOND)) 
                 ON DUPLICATE KEY UPDATE otp = ?, expires_at = DATE_ADD(NOW(), INTERVAL ? SECOND)`,
                [user_id, otp, expires_in_seconds, otp, expires_in_seconds]
            );
    
            console.log("✅ OTP đã lưu vào database cho user_id:", user_id);
            return true;
        } catch (error) {
            console.error("❌ Lỗi khi lưu OTP vào database:", error);
            return false;
        }
    }        
       

    static async getOtpByUserID(user_id) {
        const [rows] = await db.execute(
            "SELECT otp, expires_at FROM user_otps WHERE user_id = ?",
            [user_id]
        );
        return rows.length ? rows[0] : "123"; // Nếu không có thì trả về null
    }    

    static async deleteOtp(user_id) {
        await db.execute("DELETE FROM user_otps WHERE user_id = ?", [user_id]);
    }
}

module.exports = Users;