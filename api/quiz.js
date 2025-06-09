const express = require('express');
const router = express.Router();
const pool = require('../db');
const authenticateToken = require('../middleware/authMiddleware');

// ✅ Yardımcı: Şu anki hafta numarasını döner
function getCurrentWeekNumber() {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), 0, 1);
    const pastDays = (now - firstDay) / (24 * 60 * 60 * 1000);
    return Math.ceil((pastDays + firstDay.getDay() + 1) / 7);
}


router.get('/user-status', authenticateToken, async (req, res) => {
    const user_id = req.user.userId;
    const currentWeek = getCurrentWeekNumber();

    const [rows] = await pool.query(
        'SELECT COUNT(*) AS count FROM quiz_answers WHERE user_id = ? AND quiz_week = ?',
        [user_id, currentWeek]
    );

    res.json({ canTakeQuiz: rows[0].count === 0 });
});


router.get('/available', authenticateToken, async (req, res) => {
    const user_id = req.user.userId;

    const [questions] = await pool.query(
        `SELECT q.id, q.question, q.option_a, q.option_b, q.option_c, q.option_d, q.image_url
         FROM quizzes q
         WHERE q.id NOT IN (
            SELECT quiz_id FROM quiz_answers WHERE user_id = ?
         )
         ORDER BY RAND()
         LIMIT 10`,
        [user_id]
    );

    res.json({ questions });
});


router.post('/submit', authenticateToken, async (req, res) => {
    const user_id = req.user.userId;
    const answers = req.body.answers; // [{quiz_id, selected_option}]
    const currentWeek = getCurrentWeekNumber();

    if (!Array.isArray(answers) || answers.length !== 10) {
        return res.status(400).json({ error: '10 adet cevap gönderilmelidir' });
    }

    // Puan ayarı
    const [setting] = await pool.query(
        `SELECT value FROM system_settings WHERE name = 'correct_quiz_point'`
    );
    const pointPerCorrect = parseInt(setting[0]?.value || '0');

    let correctCount = 0;

    for (const answer of answers) {
        const { quiz_id, selected_option } = answer;

        const [quiz] = await pool.query(
            `SELECT correct_option FROM quizzes WHERE id = ?`,
            [quiz_id]
        );
        if (quiz.length === 0) continue;

        const is_correct = (quiz[0].correct_option === selected_option);
        if (is_correct) correctCount++;

        await pool.query(
            `INSERT INTO quiz_answers (user_id, quiz_id, selected_option, is_correct, quiz_week)
             VALUES (?, ?, ?, ?, ?)`,
            [user_id, quiz_id, selected_option, is_correct, currentWeek]
        );
    }

    // user_scores tablosuna ekle/güncelle
    await pool.query(
        `INSERT INTO user_scores (user_id, quiz_points)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE quiz_points = quiz_points + ?`,
        [user_id, correctCount * pointPerCorrect, correctCount * pointPerCorrect]
    );

    res.json({
        success: true,
        message: 'Quiz tamamlandı',
        correct: correctCount,
        wrong: 10 - correctCount,
        earned: correctCount * pointPerCorrect
    });
});



module.exports = router;

