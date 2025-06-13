const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: process.env.EMAIL_SECURE === "true", // false for TLS
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

const sendVerificationEmail = async (to, code) => {
  const info = await transporter.sendMail({
    from: `"MatchMaster" <${process.env.EMAIL_USER}>`,
    to,
    subject: "Doğrulama Kodunuz",
    html: `<p>Doğrulama kodunuz: <strong>${code}</strong></p>`
  });

  console.log("Mail gönderildi:", info.messageId);
};

module.exports = { sendVerificationEmail };
