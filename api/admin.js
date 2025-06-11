const express = require('express');
const router = express.Router();
const pool = require('../db');
const authenticateToken = require('../middleware/authMiddleware');

// 🔒 Admin kontrol middleware
function checkAdmin(req, res, next) {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Yetkisiz erişim' });
    }
    next();
}



// Quiz Ekle
router.post('/quiz', authenticateToken, checkAdmin, async (req, res) => {
    const { question, option_a, option_b, option_c, option_d, correct_option, image_url } = req.body;

    await pool.query(
        `INSERT INTO quizzes (question, option_a, option_b, option_c, option_d, correct_option, image_url)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [question, option_a, option_b, option_c, option_d, correct_option, image_url || null]
    );
    res.json({ success: true, message: 'Soru eklendi' });
});

// Quiz Sil
router.delete('/quiz/:id', authenticateToken, checkAdmin, async (req, res) => {
    await pool.query('DELETE FROM quizzes WHERE id = ?', [req.params.id]);
    res.json({ success: true });
});


router.post('/news', authenticateToken, checkAdmin, async (req, res) => {
  const { title, content, league_id, image_url } = req.body;

  await pool.query(
    `INSERT INTO news (title, content, league_id, image_url) VALUES (?, ?, ?, ?)`,
    [title, content, league_id || null, image_url || null]
  );

  res.json({ success: true });
});


router.delete('/news/:id', authenticateToken, checkAdmin, async (req, res) => {
    await pool.query('DELETE FROM news WHERE id = ?', [req.params.id]);
    res.json({ success: true });
});


// Tüm kullanıcıları getir
router.get('/users', authenticateToken, checkAdmin, async (req, res) => {
  const [users] = await pool.query(`
    SELECT id, email, username, first_name, last_name, role, created_at
    FROM users
    ORDER BY created_at DESC
  `);
  res.json({ users });
});


// Belirli kullanıcıyı sil
router.delete('/users/:id', authenticateToken, checkAdmin, async (req, res) => {
    await pool.query('DELETE FROM users WHERE id = ?', [req.params.id]);
    res.json({ success: true });
});

router.get('/users/:id/details', authenticateToken, checkAdmin, async (req, res) => {
  const { id } = req.params;

  const [[user]] = await pool.query(
    `SELECT email, username, first_name, last_name, role FROM users WHERE id = ?`, [id]
  );

  const [ips] = await pool.query(
    `SELECT ip_address, created_at FROM user_ips WHERE user_id = ?`, [id]
  );

  const [[pred]] = await pool.query(`
    SELECT COUNT(*) AS total, SUM(is_correct = 1) AS correct 
    FROM predictions WHERE user_id = ?`, [id]);

  const [[quiz]] = await pool.query(`
    SELECT COUNT(*) AS total, SUM(is_correct = 1) AS correct 
    FROM quiz_answers WHERE user_id = ?`, [id]);

  res.json({
    user,
    ips,
    prediction: {
      total: pred.total,
      correct: pred.correct,
      successRate: pred.total > 0 ? ((pred.correct / pred.total) * 100).toFixed(1) : '0.0'
    },
    quiz: {
      total: quiz.total,
      correct: quiz.correct,
      successRate: quiz.total > 0 ? ((quiz.correct / quiz.total) * 100).toFixed(1) : '0.0'
    }
  });
});

router.put('/users/:id/role', authenticateToken, checkAdmin, async (req, res) => {
  const { role } = req.body;
  if (!['admin', 'user'].includes(role)) {
    return res.status(400).json({ error: 'Geçersiz rol' });
  }

  await pool.query(`UPDATE users SET role = ? WHERE id = ?`, [role, req.params.id]);
  res.json({ success: true, message: "Kullanıcı rolü güncellendi." });
});





// IP Banla
router.post('/ban-ip', authenticateToken, checkAdmin, async (req, res) => {
    const { ip_address, reason } = req.body;
    await pool.query(
        `INSERT IGNORE INTO banned_ips (ip_address, reason) VALUES (?, ?)`,
        [ip_address, reason || null]
    );
    res.json({ success: true });
});

router.get('/matches', authenticateToken, checkAdmin, async (req, res) => {
  const [matches] = await pool.query(`
    SELECT m.*, 
           l.name AS league_name 
    FROM matches m
    LEFT JOIN leagues l ON m.league_id = l.id
    ORDER BY m.match_date DESC
  `);
  res.json({ matches });
});

router.put('/matches/:id', authenticateToken, checkAdmin, async (req, res) => {
  const { home_team, away_team, match_date, home_score, away_score, status, match_week, league_id } = req.body;

  await pool.query(`
    UPDATE matches SET
      home_team = ?, 
      away_team = ?, 
      match_date = ?, 
      home_score = ?, 
      away_score = ?, 
      status = ?, 
      match_week = ?, 
      league_id = ?
    WHERE id = ?
  `, [
    home_team, away_team, match_date,
    home_score || null, away_score || null,
    status || 'upcoming', match_week || null,
    league_id || null, req.params.id
  ]);

  res.json({ success: true, message: "Maç bilgisi güncellendi." });
});

router.post('/users/:id/ban', authenticateToken, checkAdmin, async (req, res) => {
  const { id } = req.params;

  const [ips] = await pool.query(
    `SELECT DISTINCT ip_address FROM user_ips WHERE user_id = ?`, [id]
  );

  for (const ip of ips) {
    await pool.query(
      `INSERT IGNORE INTO banned_ips (ip_address, reason) VALUES (?, ?)`,
      [ip.ip_address, `Kullanıcı ID ${id} banlandı`]
    );
  }

  res.json({ success: true, message: `${ips.length} IP banlandı.` });
});



router.delete('/matches/:id', authenticateToken, checkAdmin, async (req, res) => {
  await pool.query('DELETE FROM matches WHERE id = ?', [req.params.id]);
  res.json({ success: true, message: "Maç silindi." });
});

router.get('/leagues', authenticateToken, checkAdmin, async (req, res) => {
  const [leagues] = await pool.query(`
    SELECT id, name, country, logo_url, info
    FROM leagues
    ORDER BY name
  `);
  res.json({ leagues });
});

router.put('/leagues/:id', authenticateToken, checkAdmin, async (req, res) => {
  const { name, country, logo_url, info } = req.body;

  if (!name || !country) {
    return res.status(400).json({ error: "Lig adı ve ülke zorunludur." });
  }

  await pool.query(`
    UPDATE leagues SET
      name = ?, 
      country = ?, 
      logo_url = ?, 
      info = ?
    WHERE id = ?
  `, [name, country, logo_url || null, info || null, req.params.id]);

  res.json({ success: true, message: "Lig güncellendi." });
});


router.delete('/leagues/:id', authenticateToken, checkAdmin, async (req, res) => {
  await pool.query(`DELETE FROM leagues WHERE id = ?`, [req.params.id]);
  res.json({ success: true, message: "Lig silindi." });
});



router.put('/points', authenticateToken, checkAdmin, async (req, res) => {
    const { setting, value } = req.body;

    await pool.query(
        `INSERT INTO system_settings (name, value)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE value = ?`,
        [setting, value, value]
    );

    res.json({ success: true, message: `${setting} değeri güncellendi` });
});

router.get('/dashboard-stats', authenticateToken, checkAdmin, async (req, res) => {
  try {
    const [[{ total_users }]] = await pool.query(`SELECT COUNT(*) AS total_users FROM users`);
    const [[{ total_quizzes }]] = await pool.query(`SELECT COUNT(*) AS total_quizzes FROM quizzes`);
    const [[{ total_matches }]] = await pool.query(`SELECT COUNT(*) AS total_matches FROM matches`);
    const [[{ total_news }]] = await pool.query(`SELECT COUNT(*) AS total_news FROM news`);
    const [[{ total_teams }]] = await pool.query(`SELECT COUNT(*) AS total_teams FROM teams`);
    const [[{ total_leagues }]] = await pool.query(`SELECT COUNT(*) AS total_leagues FROM leagues`);
    const [[{ total_predictions }]] = await pool.query(`SELECT COUNT(*) AS total_predictions FROM predictions`);
    const [[{ total_quiz_answers }]] = await pool.query(`SELECT COUNT(*) AS total_quiz_answers FROM quiz_answers`);

    res.json({
      success: true,
      stats: {
        total_users,
        total_quizzes,
        total_matches,
        total_news,
        total_teams,
        total_leagues,
        total_predictions,
        total_quiz_answers
      }
    });
  } catch (err) {
    console.error("Dashboard istatistik hatası:", err.message);
    res.status(500).json({ error: "Sunucu hatası" });
  }
});


// Takım Ekle
// Takım Ekle (güncellenmiş hali)
router.post('/teams', authenticateToken, checkAdmin, async (req, res) => {
  const { name, logo_url, coach, stadium, info, league_id } = req.body;
  await pool.query(
    `INSERT INTO teams (name, logo_url, coach, stadium, info, league_id) VALUES (?, ?, ?, ?, ?, ?)`,
    [name, logo_url, coach, stadium, info, league_id || null]
  );
  res.json({ success: true });
});

router.get('/teams', authenticateToken, checkAdmin, async (req, res) => {
  const [teams] = await pool.query(`
    SELECT teams.*, leagues.name AS league_name
    FROM teams
    LEFT JOIN leagues ON teams.league_id = leagues.id
    ORDER BY teams.name ASC
  `);
  res.json({ teams });
});

router.put('/teams/:id', authenticateToken, checkAdmin, async (req, res) => {
  const { name, logo_url, coach, stadium, info, league_id } = req.body;

  await pool.query(`
    UPDATE teams
    SET name = ?, logo_url = ?, coach = ?, stadium = ?, info = ?, league_id = ?
    WHERE id = ?
  `, [name, logo_url || null, coach || null, stadium || null, info || null, league_id || null, req.params.id]);

  res.json({ success: true, message: "Takım güncellendi." });
});



// ✅ Tüm quiz sorularını getir
router.get('/quiz', authenticateToken, checkAdmin, async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT id, question, option_a, option_b, option_c, option_d, correct_option, image_url FROM quizzes ORDER BY id DESC`
        );
        res.json({ success: true, quizzes: rows });
    } catch (err) {
        console.error("Quiz listeleme hatası:", err);
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

// ✅ Quiz güncelle (PUT)
router.put('/quiz/:id', authenticateToken, checkAdmin, async (req, res) => {
    const { question, option_a, option_b, option_c, option_d, correct_option, image_url } = req.body;

    try {
        await pool.query(
            `UPDATE quizzes SET question = ?, option_a = ?, option_b = ?, option_c = ?, option_d = ?, correct_option = ?, image_url = ? WHERE id = ?`,
            [question, option_a, option_b, option_c, option_d, correct_option, image_url || null, req.params.id]
        );
        res.json({ success: true, message: "Quiz güncellendi" });
    } catch (err) {
        console.error("Quiz güncelleme hatası:", err);
        res.status(500).json({ error: "Quiz güncellenemedi." });
    }
});




// Maç Ekle
router.post('/matches', authenticateToken, checkAdmin, async (req, res) => {
    const { home_team, away_team, match_date } = req.body;
    await pool.query(
        `INSERT INTO matches (home_team, away_team, match_date) VALUES (?, ?, ?)`,
        [home_team, away_team, match_date]
    );
    res.json({ success: true });
});

// Sistem Tahmini Ekle
router.post('/match-predictions', authenticateToken, checkAdmin, async (req, res) => {
    const { match_id, home_win_probability, draw_probability, away_win_probability } = req.body;
    await pool.query(
        `INSERT INTO match_predictions_system (match_id, home_win_probability, draw_probability, away_win_probability)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE 
            home_win_probability = ?, 
            draw_probability = ?, 
            away_win_probability = ?`,
        [
            match_id, home_win_probability, draw_probability, away_win_probability,
            home_win_probability, draw_probability, away_win_probability
        ]
    );
    res.json({ success: true });
});

// Lig Ekle
router.post('/leagues', authenticateToken, checkAdmin, async (req, res) => {
    const { name, logo_url, country, info } = req.body;

    if (!name || !country) {
        return res.status(400).json({ error: 'İsim ve ülke zorunludur.' });
    }

    try {
        await pool.query(
            `INSERT INTO leagues (name, logo_url, country, info) VALUES (?, ?, ?, ?)`,
            [name, logo_url || null, country, info || null]
        );
        res.json({ success: true, message: "Lig başarıyla eklendi." });
    } catch (err) {
        console.error("Lig ekleme hatası:", err.message);
        res.status(500).json({ error: "Lig eklenemedi." });
    }
});

// Lig sil
router.delete('/leagues/:id', authenticateToken, checkAdmin, async (req, res) => {
    await pool.query(`DELETE FROM leagues WHERE id = ?`, [req.params.id]);
    res.json({ success: true });
});

router.get('/news', authenticateToken, checkAdmin, async (req, res) => {
  const [rows] = await pool.query(`
    SELECT 
      news.id,
      news.title,
      news.content,
      news.league_id,
      news.image_url,
      news.created_at,
      leagues.name AS league_name
    FROM news
    LEFT JOIN leagues ON news.league_id = leagues.id
    ORDER BY news.created_at DESC
  `);

  res.json({ news: rows });
});

router.put('/news/:id', authenticateToken, checkAdmin, async (req, res) => {
  const { title, content, league_id, image_url } = req.body;

  await pool.query(`
    UPDATE news
    SET title = ?, content = ?, league_id = ?, image_url = ?
    WHERE id = ?
  `, [title, content, league_id || null, image_url || null, req.params.id]);

  res.json({ success: true, message: "Haber güncellendi." });
});

router.delete('/teams/:id', authenticateToken, checkAdmin, async (req, res) => {
  await pool.query('DELETE FROM teams WHERE id = ?', [req.params.id]);
  res.json({ success: true, message: "Takım silindi." });
});

router.get('/settings', authenticateToken, checkAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query(`SELECT name, value FROM system_settings`);
    const settings = {};
    for (const row of rows) {
      settings[row.name] = row.value;
    }
    res.json({ success: true, settings });
  } catch (err) {
    console.error("Ayarlar alınamadı:", err.message);
    res.status(500).json({ error: "Sunucu hatası" });
  }
});


// ✅ Maçı bitir, skorları gir, sonucu güncelle, doğru tahmincilere puan ver
router.post('/finish-match', authenticateToken, async (req, res) => {
    try {
        const { match_id, home_score, away_score } = req.body;

        if (home_score === undefined || away_score === undefined) {
            return res.status(400).json({ error: 'Skorlar eksik' });
        }

        // Maçı bitmiş olarak güncelle
        await pool.query(
            `UPDATE matches SET home_score = ?, away_score = ?, status = 'finished' WHERE id = ?`,
            [home_score, away_score, match_id]
        );

        // Gerçek sonucu belirle
        let actual_result;
        if (home_score > away_score) actual_result = 'home_team';
        else if (home_score < away_score) actual_result = 'away_team';
        else actual_result = 'draw';

        // Ayarlardan puanı çek
        const [settings] = await pool.query(
            `SELECT value FROM system_settings WHERE name = 'correct_prediction_point'`
        );
        const predictionPoint = parseInt(settings[0]?.value || '0');

        // Doğru tahmin yapan kullanıcıları bul
        const [correctPredictions] = await pool.query(
            `SELECT user_id FROM predictions WHERE match_id = ? AND predicted_result = ? AND is_correct IS NULL`,
            [match_id, actual_result]
        );

        // Tahmin sonuçlarını güncelle (doğru/yanlış)
        await pool.query(
            `UPDATE predictions SET is_correct = (predicted_result = ?) WHERE match_id = ? AND is_correct IS NULL`,
            [actual_result, match_id]
        );

        const now = new Date();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();
        const season_year = month >= 8 ? year : year - 1;

        // Her doğru tahminciye puan ver
        for (const { user_id } of correctPredictions) {
            const userId = user_id;

            // user_scores güncelle (monthly + seasonal)
            await pool.query(
                `INSERT INTO user_scores (user_id, monthly_points, seasonal_points)
                 VALUES (?, ?, ?)
                 ON DUPLICATE KEY UPDATE
                    monthly_points = monthly_points + VALUES(monthly_points),
                    seasonal_points = seasonal_points + VALUES(seasonal_points)`,
                [userId, predictionPoint, predictionPoint]
            );

            // Geçmişe kaydet
            await pool.query(
                `INSERT INTO user_score_history (user_id, source, points, month, year, season_year)
                 VALUES (?, 'prediction', ?, ?, ?, ?)`,
                [userId, predictionPoint, month, year, season_year]
            );
        }

        res.json({ success: true, message: 'Maç bitirildi, puanlar dağıtıldı' });
    } catch (err) {
        console.error('Maçı bitirme hatası:', err);
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});


module.exports = router;


