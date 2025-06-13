const express = require('express');
const router = express.Router();
const pool = require('../db');
const authenticateToken = require('../middleware/authMiddleware');

// ✅ 1. Tahmin Ekle veya Güncelle (Maç Başlamadan Önce)
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { match_id, predicted_result } = req.body;
        const user_id = req.user.userId;

        if (!['home_team', 'draw', 'away_team'].includes(predicted_result)) {
            return res.status(400).json({ error: 'Geçersiz tahmin seçeneği' });
        }

        const [matchRows] = await pool.query(
            'SELECT match_date FROM matches WHERE id = ?',
            [match_id]
        );
        if (matchRows.length === 0) return res.status(404).json({ error: 'Maç bulunamadı' });

        const matchDate = new Date(matchRows[0].match_date);
        const now = new Date();
        if (now >= matchDate) {
            return res.status(403).json({ error: 'Maç başladı, tahmin yapılamaz veya değiştirilemez' });
        }

        const [existing] = await pool.query(
            'SELECT id FROM predictions WHERE user_id = ? AND match_id = ?',
            [user_id, match_id]
        );

        if (existing.length > 0) {
            await pool.query(
                'UPDATE predictions SET predicted_result = ?, created_at = NOW() WHERE user_id = ? AND match_id = ?',
                [predicted_result, user_id, match_id]
            );
            return res.json({ success: true, message: 'Tahmin güncellendi' });
        } else {
            await pool.query(
                'INSERT INTO predictions (user_id, match_id, predicted_result) VALUES (?, ?, ?)',
                [user_id, match_id, predicted_result]
            );
            return res.json({ success: true, message: 'Tahmin başarıyla eklendi' });
        }
    } catch (err) {
        console.error('Tahmin hatası:', err);
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});



// ✅ 2. Kullanıcının Tahminlerini Getir
router.get('/:userId', authenticateToken, async (req, res) => {
    const { userId } = req.params;

    try {
        const [predictions] = await pool.query(
            `SELECT p.id, p.match_id, m.home_team, m.away_team, m.match_date,
                    p.predicted_result, p.is_correct
            FROM predictions p
            JOIN matches m ON p.match_id = m.id
            WHERE p.user_id = ?
            ORDER BY m.match_date DESC`,
            [userId]
            );

        res.json(predictions);
    } catch (err) {
        console.error('Tahminleri getirme hatası:', err);
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});


// ✅ 3. Maç Bittikten Sonra Tahmin Başarı Durumlarını Güncelle + Puan Ver
router.put('/check-results', authenticateToken, async (req, res) => {
    try {
        // Ayarları al (ör: doğru tahmine kaç puan?)
        const [settings] = await pool.query(
            'SELECT value FROM system_settings WHERE name = "correct_prediction_point"'
        );
        const predictionPoint = parseInt(settings[0]?.value || '0');

        const [finishedMatches] = await pool.query(
            `SELECT id, home_score, away_score FROM matches WHERE status = 'finished'`
        );

        for (const match of finishedMatches) {
            let actual_result;
            if (match.home_score > match.away_score) actual_result = 'home_team';
            else if (match.home_score < match.away_score) actual_result = 'away_team';
            else actual_result = 'draw';

            // Güncellenmemiş tahminleri al
            const [correctPredictions] = await pool.query(
                `SELECT user_id FROM predictions 
                 WHERE match_id = ? AND is_correct IS NULL AND predicted_result = ?`,
                [match.id, actual_result]
            );

            // Tahmin sonuçlarını güncelle (doğru/yanlış)
            await pool.query(
                `UPDATE predictions
                 SET is_correct = (predicted_result = ?)
                 WHERE match_id = ? AND is_correct IS NULL`,
                [actual_result, match.id]
            );

            // Doğru tahmin yapanlara puan ekle
            for (const row of correctPredictions) {
                const userId = row.user_id;

                // user_scores kaydı yoksa oluştur
                await pool.query(
                    `INSERT INTO user_scores (user_id, prediction_points) 
                     VALUES (?, ?) 
                     ON DUPLICATE KEY UPDATE prediction_points = prediction_points + ?`,
                    [userId, predictionPoint, predictionPoint]
                );
            }
        }

        res.json({ success: true, message: 'Tahmin sonuçları ve puanlar güncellendi' });
    } catch (err) {
        console.error('Tahmin güncelleme hatası:', err);
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

module.exports = router;
