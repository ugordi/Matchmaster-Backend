const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const logUserIp = require('../middleware/logIp');
require('dotenv').config();

const router = express.Router();
const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET;

const { sendVerificationEmail } = require('../middleware/mail');


// ✅ Kullanıcı Kaydı
router.post('/signup', async (req, res) => {
  try {
    const { email, password, first_name, last_name, username } = req.body;
    const { sendVerificationEmail } = require('../middleware/mail');
    const verificationCode = Math.floor(1000 + Math.random() * 9000).toString();


    const [existingUsers] = await pool.query(
      'SELECT id FROM users WHERE email = ? OR username = ?',
      [email, username]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({ error: 'Bu email veya kullanıcı adı zaten kayıtlı!' });
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const [result] = await pool.query(
      'INSERT INTO users (email, password_hash, first_name, last_name, username, verification_code) VALUES (?, ?, ?, ?, ?, ?)',
      [email, hashedPassword, first_name, last_name, username, verificationCode]
    );

    // IP adresini logla
    await logUserIp(result.insertId, req);
    
    await sendVerificationEmail(email, verificationCode);
    await logUserIp(result.insertId, req);

    res.status(201).json({
      success: true,
      message: 'Kayıt başarılı! Lütfen email adresine gönderilen doğrulama kodunu girin.',
      userId: result.insertId
    });
  } catch (error) {
    console.error('Kayıt hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// ✅ Kullanıcı Girişi
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const [users] = await pool.query(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json({ error: 'Geçersiz email veya şifre' });
    }

    const user = users[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.status(401).json({ error: 'Geçersiz email veya şifre' });
    }

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // IP adresini logla
    await logUserIp(user.id, req);

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        first_name: user.first_name,
        last_name: user.last_name,
        username: user.username,
        isAdmin: user.role === 'admin'
      }
    });
  } catch (error) {
    console.error('Login hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

router.post('/verify', async (req, res) => {
  const { email, code } = req.body;

  try {
    const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);

    if (users.length === 0) {
      return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
    }

    const user = users[0];

    if (user.verification_code !== code) {
      return res.status(400).json({ error: 'Doğrulama kodu hatalı' });
    }

    await pool.query('UPDATE users SET is_verified = 1 WHERE id = ?', [user.id]);

    // ✅ JWT Token üret ve dön
    const token = jwt.sign(
      { userId: user.id, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Doğrulama hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

module.exports = router;
