require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const pool = require('./db');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const bcrypt = require('bcrypt');
require('dotenv').config();
const app = express();
const port = 3000;

// Middleware
app.use(express.static(__dirname));
app.use(express.json());
app.use(cors());

// Statik dosyaları sunmak için middleware ekle
app.use('/static', express.static('static'));


const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET;

const quizRoutes = require('./api/quiz');
const scoreboardRoutes = require('./api/scoreboard');
const matchRoutes = require('./api/matches');
const predictionRoutes = require('./api/predictions');
const authRoutes = require('./api/auth');
const profileRoutes = require('./api/profile');
const teamRoutes = require('./api/team');
const adminRoutes = require('./api/admin');
const publicRoutes = require('./api/public');




// Route'ları bağla
app.use('/api/auth', authRoutes);
app.use('/api/predictions', predictionRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/quiz', quizRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/team', teamRoutes);
app.use('/api/scoreboard', scoreboardRoutes);
app.use('/api/public', publicRoutes);


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Sunucu ${PORT} portunda çalışıyor.`);
});