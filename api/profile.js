const express = require('express');
const router = express.Router();
const pool = require('../db');
const authenticateToken = require('../middleware/authMiddleware');
const multer = require('multer');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');


const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/profiles'),
    filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}_${file.originalname}`;
        cb(null, uniqueName);
    }
});
const upload = multer({ storage });


router.get('/', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    const now = new Date();
    const currentWeek = Math.ceil(((now - new Date(now.getFullYear(), 0, 1)) / 86400000 + 1) / 7);
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    const seasonYear = month >= 8 ? year : year - 1;

    try {
        const [[user]] = await pool.query(
            'SELECT email, first_name, last_name, username, profile_photo_url FROM users WHERE id = ?',
            [userId]
        );

        const [[scores]] = await pool.query(
            'SELECT monthly_points, seasonal_points, total_points FROM user_scores WHERE user_id = ?',
            [userId]
        );

        const [[quizStatus]] = await pool.query(
            'SELECT COUNT(*) AS count FROM quiz_answers WHERE user_id = ? AND quiz_week = ?',
            [userId, currentWeek]
        );

        const [[predStats]] = await pool.query(
            `SELECT COUNT(*) AS total, SUM(is_correct = 1) AS correct
             FROM predictions WHERE user_id = ?`,
            [userId]
        );

        const [[quizStats]] = await pool.query(
            `SELECT COUNT(*) AS total, SUM(is_correct = 1) AS correct
             FROM quiz_answers WHERE user_id = ?`,
            [userId]
        );

        const [monthlyRank] = await pool.query(
            `SELECT user_id FROM user_scores ORDER BY monthly_points DESC`
        );
        const [seasonalRank] = await pool.query(
            `SELECT user_id FROM user_scores ORDER BY seasonal_points DESC`
        );

        const rankIndex = (list) =>
            list.findIndex(u => u.user_id === userId) + 1 || null;

        const [favTeams] = await pool.query(
            `SELECT t.* FROM user_favorite_teams f
             JOIN teams t ON t.id = f.team_id WHERE f.user_id = ?`,
            [userId]
        );

        const [favNews] = await pool.query(
            `SELECT n.* FROM user_favorite_news f
             JOIN news n ON n.id = f.news_id WHERE f.user_id = ?`,
            [userId]
        );

        res.json({
            user,
            scores,
            quizAvailable: quizStatus.count === 0,
            predictionStats: {
                total: predStats.total,
                correct: predStats.correct,
                successRate: predStats.total > 0 ? ((predStats.correct / predStats.total) * 100).toFixed(1) : '0.0'
            },
            quizStats: {
                total: quizStats.total,
                correct: quizStats.correct,
                successRate: quizStats.total > 0 ? ((quizStats.correct / quizStats.total) * 100).toFixed(1) : '0.0'
            },
            rankings: {
                monthly: rankIndex(monthlyRank),
                seasonal: rankIndex(seasonalRank)
            },
            favorites: {
                teams: favTeams,
                news: favNews
            }
        });
    } catch (err) {
        console.error('Profil çekme hatası:', err);
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});


router.put('/change-password', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    const { currentPassword, newPassword } = req.body;

    const [[user]] = await pool.query('SELECT password_hash FROM users WHERE id = ?', [userId]);

    const match = await bcrypt.compare(currentPassword, user.password_hash);
    if (!match) return res.status(401).json({ error: 'Mevcut şifre yanlış' });

    const newHash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, userId]);

    res.json({ success: true, message: 'Şifre güncellendi' });
});


router.post('/upload-photo', authenticateToken, upload.single('photo'), async (req, res) => {
    const userId = req.user.userId;
    const filePath = `/uploads/profiles/${req.file.filename}`;
    await pool.query('UPDATE users SET profile_photo_url = ? WHERE id = ?', [filePath, userId]);
    res.json({ success: true, photo_url: filePath });
});

router.delete('/delete-photo', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    const [[{ profile_photo_url }]] = await pool.query(
        'SELECT profile_photo_url FROM users WHERE id = ?', [userId]
    );

    if (profile_photo_url) {
        const fullPath = path.join(__dirname, '..', profile_photo_url);
        if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    }

    await pool.query('UPDATE users SET profile_photo_url = NULL WHERE id = ?', [userId]);
    res.json({ success: true });
});


router.post('/favorite-team/:team_id', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    const { team_id } = req.params;
    await pool.query(`INSERT IGNORE INTO user_favorite_teams (user_id, team_id) VALUES (?, ?)`, [userId, team_id]);
    res.json({ success: true });
});

router.delete('/favorite-team/:team_id', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    const { team_id } = req.params;
    await pool.query(`DELETE FROM user_favorite_teams WHERE user_id = ? AND team_id = ?`, [userId, team_id]);
    res.json({ success: true });
});


router.post('/favorite-news/:news_id', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    const { news_id } = req.params;
    await pool.query(`INSERT IGNORE INTO user_favorite_news (user_id, news_id) VALUES (?, ?)`, [userId, news_id]);
    res.json({ success: true });
});

router.delete('/favorite-news/:news_id', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    const { news_id } = req.params;
    await pool.query(`DELETE FROM user_favorite_news WHERE user_id = ? AND news_id = ?`, [userId, news_id]);
    res.json({ success: true });
});


module.exports = router;
