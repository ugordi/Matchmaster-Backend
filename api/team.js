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
             WHERE name LIKE ? 
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

module.exports = router;
