const express = require('express');
const router = express.Router();
const pool = require('../db');


router.get('/search', async (req, res) => {
    const { q } = req.query;

    if (!q || q.trim() === '') {
        return res.status(400).json({ error: 'Arama terimi boş olamaz' });
    }

    try {
        const [teams] = await pool.query(
            `SELECT id, name, logo_url 
             FROM teams 
             WHERE LOWER(name) LIKE LOWER(?) 
             ORDER BY name ASC
             LIMIT 10`,
            [`%${q}%`]
        );

        res.json({ success: true, results: teams });
    } catch (err) {
        console.error('Takım arama hatası:', err);
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});


router.get('/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const [[team]] = await pool.query(
            `SELECT * FROM teams WHERE id = ?`,
            [id]
        );

        if (!team) {
            return res.status(404).json({ error: 'Takım bulunamadı' });
        }

        const [[standing]] = await pool.query(
            `SELECT * FROM standings_external WHERE team_name = ?`,
            [team.name]
        );

        res.json({
            success: true,
            team: {
                ...team,
                standing: standing || null
            }
        });
    } catch (err) {
        console.error('Takım detay hatası:', err);
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

// Takıma ait tüm maçları getir
router.get('/:teamId/matches', async (req, res) => {
  const { teamId } = req.params;

  try {
    const [matches] = await pool.query(`
        SELECT 
        m.id,
        m.match_date,
        m.status,
        m.home_score,
        m.away_score,
        ht.name AS home_team,
        at.name AS away_team,
        ht.logo_url AS home_logo,
        at.logo_url AS away_logo
        FROM matches m
        JOIN teams ht ON m.home_team = ht.name
        JOIN teams at ON m.away_team = at.name
        WHERE ht.id = ? OR at.id = ?
        ORDER BY m.match_date DESC
    `, [teamId, teamId]);

    res.json({ matches });
  } catch (err) {
    console.error('Takım maçları alınamadı:', err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});


module.exports = router;
