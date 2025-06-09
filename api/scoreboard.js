const express = require('express');
const router = express.Router();
const pool = require('../db');
const authenticateToken = require('../middleware/authMiddleware');

// Ay ve sezon hesaplama
function getCurrentPeriod() {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    const seasonYear = month >= 8 ? year : year - 1;
    return { month, year, seasonYear };
}


router.get('/monthly', async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT u.id AS user_id, u.first_name, u.last_name, s.monthly_points
             FROM user_scores s
             JOIN users u ON u.id = s.user_id
             ORDER BY s.monthly_points DESC
             LIMIT 30`
        );
        res.json({ success: true, list: rows });
    } catch (err) {
        console.error('Aylık sıralama hatası:', err);
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});



router.get('/seasonal', async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT u.id AS user_id, u.first_name, u.last_name, s.seasonal_points
             FROM user_scores s
             JOIN users u ON u.id = s.user_id
             ORDER BY s.seasonal_points DESC
             LIMIT 30`
        );
        res.json({ success: true, list: rows });
    } catch (err) {
        console.error('Sezonluk sıralama hatası:', err);
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});



router.get('/my-rank', authenticateToken, async (req, res) => {
    const userId = req.user.userId;

    try {
        // Aylık sıralama
        const [monthly] = await pool.query(
            `SELECT user_id FROM user_scores ORDER BY monthly_points DESC`
        );
        const monthlyRank = monthly.findIndex(u => u.user_id === userId) + 1 || null;

        // Sezonluk sıralama
        const [seasonal] = await pool.query(
            `SELECT user_id FROM user_scores ORDER BY seasonal_points DESC`
        );
        const seasonalRank = seasonal.findIndex(u => u.user_id === userId) + 1 || null;

        res.json({
            success: true,
            ranks: {
                monthly: monthlyRank,
                seasonal: seasonalRank
            }
        });
    } catch (err) {
        console.error('Sıralama hatası:', err);
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});


module.exports = router;
