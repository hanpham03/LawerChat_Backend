const User = require('../models/user.model');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');

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
            { id: user.id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
          );
      
          // Set cookie "token" vào response, sử dụng các tùy chọn bảo mật:
          res.cookie('token', token, {
            httpOnly: true, // Không cho phép truy cập từ JavaScript trên client
            secure: process.env.NODE_ENV === 'production', // Chỉ gửi cookie qua HTTPS trong production
            maxAge: 24 * 60 * 60 * 1000, // 24 giờ (tính theo ms)
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
}

module.exports = new AuthController();