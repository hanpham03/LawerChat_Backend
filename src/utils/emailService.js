const nodemailer = require("nodemailer");

// Cấu hình SMTP với Gmail
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false, // false = STARTTLS, true = SSL (SSL dùng port 465)
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Gửi email OTP cho người dùng
 * @param {string} email - Email người nhận
 * @param {string} otp - Mã OTP
 */
async function sendOtpEmail(email, otp) {
  try {
    const mailOptions = {
      from: `"Your App" <${process.env.SMTP_USER}>`,
      to: email,
      subject: "Mã xác thực OTP của bạn",
      text: `Mã OTP của bạn là: ${otp}. Mã có hiệu lực trong 5 phút.`,
      html: `<p>Mã OTP của bạn là: <strong>${otp}</strong>. Mã có hiệu lực trong <strong>5 phút</strong>.</p>`,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("✅ Email sent: " + info.response);
    return true;
  } catch (error) {
    console.error("❌ Lỗi gửi email:", error);
    return false;
  }
}

module.exports = { sendOtpEmail };
