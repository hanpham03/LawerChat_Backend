const User = require('../models/user.model');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { sendOtpEmail } = require("../utils/emailService");

class AuthController {
    // Register new user
    async register(req, res) {
        try {
            // Check validation results
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { email, password, full_name } = req.body;

            // Check if user already exists
            const existingUser = await User.findByEmail(email);
            if (existingUser) {
                return res.status(400).json({ 
                    message: 'Email người dùng đã tồn tại!' 
                });
            }

            // Hash password
            const salt = await bcrypt.genSalt(10);
            const password_hash = await bcrypt.hash(password, salt);

            // Create new user
            const user = new User({
                email,
                password_hash,
                full_name,
                is_active: true
            });

            const userId = await user.create();

            res.status(201).json({
                message: 'User registered successfully',
                user: {
                    id: userId,
                    email,
                    full_name
                }
            });
        } catch (error) {
            console.error('Registration error:', error);
            res.status(500).json({ message: 'Error registering user' });
        }
    }

    // Login user
    async login(req, res) {
        try {
          // Kiểm tra kết quả validate
          const errors = validationResult(req);
          if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
          }
      
          const { email, password } = req.body;
      
          // Tìm user theo email
          const user = await User.findByEmail(email);
          if (!user) {
            return res.status(401).json({ 
              message: 'email hoặc mật khẩu không hợp lệ' 
            });
          }
      
          // Kiểm tra trạng thái active của user
          if (!user.is_active) {
            return res.status(401).json({ 
              message: 'Tài khoản bị khóa!' 
            });
          }
      
          // Xác thực mật khẩu
          const isValidPassword = await bcrypt.compare(password, user.password_hash);
          if (!isValidPassword) {
            return res.status(401).json({ 
              message: 'email hoặc mật khẩu không hợp lệ' 
            });
          }
      
          // Tạo JWT token với thời hạn 24 giờ
          const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '3h' }
          );
      
          // Set cookie "token" vào response, sử dụng các tùy chọn bảo mật:
          res.cookie('token', token, {
            httpOnly: true, // Không cho phép truy cập từ JavaScript trên client
            secure: process.env.NODE_ENV === 'production', // Chỉ gửi cookie qua HTTPS trong production
            maxAge: 3 * 60 * 60 * 1000, // 24 giờ (tính theo ms)
            sameSite: 'Strict', // Ngăn chặn CSRF
            path: '/',
          });
      
          // Trả về response thành công
          return res.json({
            message: 'Login successful',
            token, 
            user: {
              id: user.id,
              email: user.email,
              full_name: user.full_name
            }
          });
        } catch (error) {
          console.error('Login error:', error);
          return res.status(500).json({ message: 'Error logging in' });
        }
      }
    
      // logout current user
    async logout(req, res) {
    // Xóa cookie 'token'
    res.clearCookie('token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        path: '/',
    });
    return res.json({ message: 'Logout successful' });
    }

    // Get current user profile
    async getProfile(req, res) {
        try {
            const user = await User.findById(req.user.id);
            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

            // Remove sensitive data
            delete user.password_hash;

            res.json(user);
        } catch (error) {
            console.error('Get profile error:', error);
            res.status(500).json({ message: 'Error fetching profile' });
        }
    }

    // Change password
    async changePassword(req, res) {
        try {
            const { currentPassword, newPassword } = req.body;

            // Find user
            const user = await User.findById(req.user.id);
            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

            // Verify current password
            const isValidPassword = await bcrypt.compare(
                currentPassword, 
                user.password_hash
            );
            if (!isValidPassword) {
                return res.status(401).json({ 
                    message: 'Current password is incorrect' 
                });
            }

            if (newPassword.length < 8) {
                return res.status(400).json({ message: 'Mật khẩu mới phải có ít nhất 8 ký tự' });
            }

            // Hash new password
            const salt = await bcrypt.genSalt(10);
            const newPasswordHash = await bcrypt.hash(newPassword, salt);

            // Update password
            await User.update(user.id, { password_hash: newPasswordHash });

            res.json({ message: 'Password changed successfully' });
        } catch (error) {
            console.error('Change password error:', error);
            res.status(500).json({ message: 'Error changing password' });
        }
    }

    // send OTP
    async sendOtp(req, res) {
        try {
            const { email, full_name } = req.body;
    
            // 🔹 Kiểm tra xem user có tồn tại không
            let user = await User.findByEmail(email);
            if (!user) {
                console.log("⚠️ Email chưa tồn tại, tạo mới user...");
                const tempPassword = crypto.randomBytes(8).toString("hex"); // Tạo mật khẩu tạm
                const passwordHash = await bcrypt.hash(tempPassword, 10);
                user = new User({ email, password_hash: passwordHash, full_name: full_name });
                user.id = await user.create(); // Lưu vào DB
            }
    
            // 🔹 Tạo OTP
            const otp = crypto.randomInt(100000, 999999).toString();
            await User.saveOtp(user.id, otp, 300); // Lưu OTP vào DB
    
            // 🔹 Gửi OTP qua email
            await sendOtpEmail(email, otp);
    
            return res.json({ message: "OTP đã được gửi đến email của bạn" });
        } catch (error) {
            console.error("❌ Lỗi gửi OTP:", error);
            res.status(500).json({ message: "Lỗi khi gửi OTP" });
        }
    }
  
    // Hàm gửi email OTP (dùng Gmail hoặc dịch vụ khác)
    async sendOtpEmail(email, otp) {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USERNAME, 
                pass: process.env.EMAIL_PASSWORD  
            }
        });
    
        await transporter.sendMail({
            from: process.env.EMAIL_USERNAME,
            to: email,
            subject: 'Mã OTP xác thực của bạn',
            text: `Mã OTP của bạn là: ${otp}. Mã này sẽ hết hạn sau 5 phút.`,
        });
    }

    // Verify OTP
    async VerifyOTP(req, res) {
        try {
            const { email, otp, password, full_name } = req.body;
            console.log("📧 Xác thực OTP:", email, otp, password, full_name);
    
            // 🔥 Lấy `user_id` từ bảng `users`
            let user = await User.findByEmail(email);
            let isNewUser = false;
    
            if (!user) {
                console.log("🆕 Email chưa tồn tại, tạo mới user...");
                isNewUser = true;
            }
    
            // 🔥 Lấy OTP từ bảng `user_otps` bằng `user_id`
            const storedOtp = await User.getOtpByUserID(user?.id); // Tránh lỗi nếu user chưa tồn tại
            console.log("🔐 OTP lưu trong DB:", storedOtp);
            if (!storedOtp || storedOtp.otp !== otp) {
                return res.status(400).json({ message: "Mã OTP không hợp lệ hoặc đã hết hạn." });
            }
    
            // Kiểm tra thời gian hết hạn OTP
            const currentTime = new Date().getTime();
            if (currentTime > new Date(storedOtp.expires_at).getTime()) {
                return res.status(400).json({ message: "Mã OTP đã hết hạn." });
            }
    
            // Hash mật khẩu
            const salt = await bcrypt.genSalt(10);
            const password_hash = await bcrypt.hash(password, salt);
    
            if (isNewUser) {
                // 🔥 Nếu user chưa tồn tại, tạo mới
                const newUser = new User({ email, password_hash, full_name, is_active: true });
                const userId = await newUser.create();
                user = { id: userId, email, full_name }; // Cập nhật user để sử dụng tiếp
            } else {
                // 🔥 Nếu user đã tồn tại, cập nhật mật khẩu
                // Cập nhật thông tin user sau khi xác minh OTP thành công
                await User.update(user.id, { password_hash: password_hash });
            }
    
            // Xóa OTP sau khi xác nhận thành công
            await User.deleteOtp(user.id);
    
            return res.status(201).json({
                message: isNewUser ? "Đăng ký thành công!" : "Mật khẩu đã được cập nhật!",
                user: { id: user.id, email, full_name },
            });
        } catch (error) {
            console.error("❌ Lỗi xác nhận OTP:", error);
            res.status(500).json({ message: "Lỗi khi xác nhận OTP." });
        }
    }    
    
}

module.exports = new AuthController();