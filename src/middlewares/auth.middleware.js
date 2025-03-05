const jwt = require('jsonwebtoken');

// Middleware xác thực token người dùng (hiện tại của bạn)
const verifyToken = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];

    if (!token) {
        return res.status(403).json({ message: 'No token provided' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ message: 'Invalid token' });
    }
};

/**
 * Middleware xác thực token Dify
 * Token Dify có payload dạng:
 * {
 *   "user_id": "7d886e29-a9e1-4abd-a059-57e0032ed3c2",
 *   "exp": 1739852502,
 *   "iss": "SELF_HOSTED",
 *   "sub": "Console API Passport"
 * }
 * Sau khi giải mã, hàm sẽ gán giá trị user_id vào req.difyUser
 */
const verifyDifyToken = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    console.log('token 123', token);

    if (!token) {
        return res.status(403).json({ message: 'No Dify token provided' });
    }

    try {
        // Nếu có secret riêng cho token Dify, bạn có thể dùng process.env.DIFY_JWT_SECRET
        const secret = process.env.DIFY_JWT_SECRET || process.env.JWT_SECRET;
        const decoded = jwt.verify(token, secret);

        // Kiểm tra xem payload có chứa user_id không
        if (!decoded.user_id) {
            return res.status(401).json({ message: 'Dify token missing user_id' });
        }

        // Gán thông tin user_id vào một thuộc tính riêng cho token Dify
        req.difyUser = { user_id: decoded.user_id };

        next();
    } catch (error) {
        console.error('Error verifying Dify token:', error);
        return res.status(401).json({ message: 'Invalid Dify token' });
    }
};

module.exports = {
    verifyToken,
    verifyDifyToken
};
