const express = require('express');
const router = express.Router();
const pool = require('../db');
const authenticateToken = require('../middleware/authMiddleware');

function getCurrentWeekNumber() {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), 0, 1);
  const pastDays = (now - firstDay) / (24 * 60 * 60 * 1000);
  return Math.ceil((pastDays + firstDay.getDay() + 1) / 7);
}

router.get('/user-status', authenticateToken, async (req, res) => {
  const user_id = req.user.userId;
  const currentWeek = getCurrentWeekNumber();

  const [attemptedRows] = await pool.query(
    'SELECT COUNT(*) AS count FROM quiz_answers WHERE user_id = ? AND quiz_week = ?',
    [user_id, currentWeek]
  );

  const [submitCheck] = await pool.query(
    'SELECT COUNT(*) AS count FROM quiz_answers WHERE user_id = ? AND quiz_week = ? AND selected_option IS NOT NULL',
    [user_id, currentWeek]
  );

  const canTakeQuiz = (attemptedRows[0].count === 0 || submitCheck[0].count === 0);
  res.json({ canTakeQuiz });
});

router.get('/available', authenticateToken, async (req, res) => {
  const user_id = req.user.userId;
  const currentWeek = getCurrentWeekNumber();

  const [solved] = await pool.query(
    `SELECT quiz_id FROM quiz_answers WHERE user_id = ? AND quiz_week = ? AND selected_option IS NOT NULL`,
    [user_id, currentWeek]
    );
  const solvedIds = solved.map(row => row.quiz_id);

  let query = `
    SELECT q.id, q.question, q.option_a, q.option_b, q.option_c, q.option_d, q.image_url
    FROM quizzes q
  `;
  let params = [];

  if (solvedIds.length > 0) {
    const placeholders = solvedIds.map(() => '?').join(',');
    query += `WHERE q.id NOT IN (${placeholders}) `;
    params.push(...solvedIds);
  }

  query += `ORDER BY RAND() LIMIT 10`;

  const [questions] = await pool.query(query, params);

  if (questions.length === 0) {
    return res.json({ questions: [] });
  }

  for (const q of questions) {
    await pool.query(
      `INSERT IGNORE INTO quiz_answers (user_id, quiz_id, selected_option, is_correct, quiz_week)
       VALUES (?, ?, NULL, false, ?)`,
      [user_id, q.id, currentWeek]
    );
  }

  res.json({ questions });
});



router.post('/submit', authenticateToken, async (req, res) => {
  const user_id = req.user.userId;
  const answers = req.body.answers;
  const currentWeek = getCurrentWeekNumber();

  if (!Array.isArray(answers) || answers.length === 0) {
    return res.status(400).json({ error: 'Cevaplar eksik veya hatalı' });
  }

  // Ay, yıl, sezon bilgileri
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const seasonYear = month >= 8 ? year : year - 1;

  // Quiz puanı değeri
  const [setting] = await pool.query(
    `SELECT value FROM system_settings WHERE name = 'correct_quiz_point'`
  );
  const pointPerCorrect = parseInt(setting[0]?.value || '0');

  const quizIds = answers.map(ans => ans.quiz_id);
  const placeholders = quizIds.map(() => '?').join(',');

  const [correctAnswers] = await pool.query(
    `SELECT id, correct_option FROM quizzes WHERE id IN (${placeholders})`,
    quizIds
  );

  const correctMap = {};
  correctAnswers.forEach(q => {
    correctMap[q.id] = q.correct_option;
  });

  let correctCount = 0;

  for (const answer of answers) {
    const { quiz_id, selected_option } = answer;
    const correct_option = correctMap[quiz_id];
    if (!correct_option) continue;

    const selected_option_clean = selected_option?.toUpperCase?.();
    const correct_option_clean = correct_option?.toUpperCase?.();
    const is_correct = (selected_option_clean === correct_option_clean);

    await pool.query(
      `UPDATE quiz_answers
       SET selected_option = ?, is_correct = ?
       WHERE user_id = ? AND quiz_id = ? AND quiz_week = ?`,
      [selected_option_clean, is_correct, user_id, quiz_id, currentWeek]
    );

    if (is_correct) correctCount++;
  }

  const earnedPoints = correctCount * pointPerCorrect;

  // user_scores tablosunu güncelle
  await pool.query(
    `INSERT INTO user_scores (user_id, quiz_points, monthly_points, seasonal_points)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       quiz_points = quiz_points + ?,
       monthly_points = monthly_points + ?,
       seasonal_points = seasonal_points + ?`,
    [
      user_id,
      earnedPoints, earnedPoints, earnedPoints,
      earnedPoints, earnedPoints, earnedPoints
    ]
  );

  // user_score_history tablosuna kayıt at
  await pool.query(
    `INSERT INTO user_score_history (user_id, source, points, month, year, season_year)
     VALUES (?, 'quiz', ?, ?, ?, ?)`,
    [user_id, earnedPoints, month, year, seasonYear]
  );

  res.json({
    success: true,
    message: 'Quiz tamamlandı',
    correct: correctCount,
    wrong: answers.length - correctCount,
    earned: earnedPoints
  });
});



module.exports = router;
