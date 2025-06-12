// routes/public.js
const express = require("express");
const pool = require("../db");
const router = express.Router();

// ✅ Tüm haberleri getir (lig ismi, lig id ve görsel URL ile birlikte)
router.get("/news", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT n.id, n.title, n.content, n.created_at,
              n.image_url,            -- ✅ Görsel URL'yi ekledik
              n.league_id,            -- ✅ Lig ID'sini doğrudan aldık
              l.name AS league_name   -- ✅ Lig ismi
       FROM news n
       LEFT JOIN leagues l ON n.league_id = l.id
       ORDER BY n.created_at DESC`
    );
    res.json({ success: true, news: rows });
  } catch (err) {
    console.error("Haberler getirme hatası:", err);
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// ✅ Belirli bir lige ait haberleri getir
router.get("/news/league/:leagueId", async (req, res) => {
  const { leagueId } = req.params;

  try {
    const [rows] = await pool.query(
      `SELECT n.id, n.title, n.content, n.created_at,
              l.name AS league_name
       FROM news n
       LEFT JOIN leagues l ON n.league_id = l.id
       WHERE n.league_id = ?
       ORDER BY n.created_at DESC`,
      [leagueId]
    );
    res.json({ success: true, news: rows });
  } catch (err) {
    console.error("Lige göre haber getirme hatası:", err);
    res.status(500).json({ error: "Sunucu hatası" });
  }
});


// ✅ 2. Lig ve Takım Bilgileri
router.get("/teams", async (req, res) => {
  try {
    const [teams] = await pool.query(
      `SELECT id, name, logo_url, coach, stadium FROM teams ORDER BY name`
    );
    res.json({ success: true, teams });
  } catch (err) {
    console.error("Takım verileri hatası:", err);
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// ✅ 3. Yaklaşan Maçlar
router.get("/matches/upcoming", async (req, res) => {
  try {
    const [matches] = await pool.query(
      `SELECT id, home_team, away_team, match_date 
       FROM matches 
       WHERE status = 'upcoming' 
       ORDER BY match_date ASC`
    );
    res.json({ success: true, matches });
  } catch (err) {
    console.error("Maç listesi hatası:", err);
    res.status(500).json({ error: "Sunucu hatası" });
  }
});


// ✅ 4. Sitenin Genel Tahmin Performansı (match_predictions_system tablosuna göre)
router.get("/site-statistics", async (req, res) => {
  try {
    // 1. Kaç maç analiz edilmiş?
    const [totalResult] = await pool.query(`
      SELECT COUNT(DISTINCT match_id) AS total_predictions 
      FROM match_predictions_system
    `);

    const total = totalResult[0].total_predictions || 0;

    // 2. Doğru tahminler: botun en yüksek verdiği olasılık ile maç sonucu uyuşmalı
    const [correctResult] = await pool.query(`
      SELECT COUNT(*) AS correct_predictions
      FROM match_predictions_system mps
      JOIN matches m ON mps.match_id = m.id
      WHERE m.status = 'finished'
        AND (
          (GREATEST(mps.home_win_probability, mps.draw_probability, mps.away_win_probability) = mps.home_win_probability AND m.home_score > m.away_score)
          OR
          (GREATEST(mps.home_win_probability, mps.draw_probability, mps.away_win_probability) = mps.draw_probability AND m.home_score = m.away_score)
          OR
          (GREATEST(mps.home_win_probability, mps.draw_probability, mps.away_win_probability) = mps.away_win_probability AND m.home_score < m.away_score)
        )
    `);

    const correct = correctResult[0].correct_predictions || 0;
    const successRate = total > 0 ? ((correct / total) * 100).toFixed(2) : "0.00";

    res.json({
      success: true,
      total_predictions: total,
      correct_predictions: correct,
      success_rate: `${successRate}%`
    });
  } catch (err) {
    console.error("Sistem istatistik hatası:", err);
    res.status(500).json({ error: "Sunucu hatası" });
  }
});


// ✅ Son 7 gün içerisindeki haberleri getir
router.get("/news/recent", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT n.id, n.title, n.content, n.created_at,
              n.image_url,
              n.league_id,
              l.name AS league_name
       FROM news n
       LEFT JOIN leagues l ON n.league_id = l.id
       WHERE n.created_at >= NOW() - INTERVAL 7 DAY
       ORDER BY n.created_at DESC`
    );
    res.json({ success: true, news: rows });
  } catch (err) {
    console.error("Son 7 günlük haberler hatası:", err);
    res.status(500).json({ error: "Sunucu hatası" });
  }
});



module.exports = router;
