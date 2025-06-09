const express = require('express');
const router = express.Router();
const pool = require('../db');

// Belirli tarih aralığındaki maçları tahmin oranlarıyla birlikte getir
router.get('/', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    if (!start_date || !end_date) {
      return res.status(400).json({ error: 'start_date ve end_date zorunludur' });
    }

    const [matches] = await pool.query(
      `SELECT 
          m.id AS match_id,
          m.home_team,
          m.away_team,
          m.match_date,
          m.home_score,
          m.away_score,
          m.status,
          s.home_win_probability,
          s.draw_probability,
          s.away_win_probability
       FROM matches m
       LEFT JOIN match_predictions_system s ON m.id = s.match_id
       WHERE m.match_date BETWEEN ? AND ?
       ORDER BY m.match_date ASC`,
      [start_date, end_date]
    );

    res.json({ success: true, matches });
  } catch (err) {
    console.error('Maçları tahminlerle çekerken hata:', err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// Haftaya ve lige göre maçları getir
router.get("/week/:weekNumber", async (req, res) => {
  const { weekNumber } = req.params;
  const { league_id } = req.query;
  try {
    const [matches] = await pool.query(
      `SELECT m.*, s.home_win_probability, s.draw_probability, s.away_win_probability,
              ht.logo_url AS home_logo, at.logo_url AS away_logo
       FROM matches m
       LEFT JOIN match_predictions_system s ON m.id = s.match_id
       LEFT JOIN teams ht ON m.home_team = ht.name
       LEFT JOIN teams at ON m.away_team = at.name
       WHERE m.match_week = ? AND (? IS NULL OR m.league_id = ?)
       ORDER BY m.match_date ASC`,
      [weekNumber, league_id, league_id]
    );
    res.json({ success: true, matches });
  } catch (err) {
    console.error("Maçları çekerken hata:", err);
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// Tüm ligleri getir
router.get("/leagues", async (req, res) => {
  try {
    const [leagues] = await pool.query("SELECT * FROM leagues ORDER BY FIELD(name, 'Süper Lig') DESC, name ASC");
    res.json({ success: true, leagues });
  } catch (err) {
    console.error("Ligleri çekerken hata:", err);
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// Belirli ligin son haftasını getir
router.get("/last-week/:league_id", async (req, res) => {
  const { league_id } = req.params;
  try {
    const [result] = await pool.query(
      `SELECT MAX(match_week) as last_week FROM matches WHERE league_id = ?`,
      [league_id]
    );
    res.json({ success: true, last_week: result[0].last_week });
  } catch (err) {
    console.error("Son hafta çekilirken hata:", err);
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

module.exports = router;
