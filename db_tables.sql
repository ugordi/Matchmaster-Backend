CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(50),
    last_name VARCHAR(50),
    favorite_teams TEXT,
    favorite_news TEXT,
    role ENUM('user', 'admin') DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE users
  ADD COLUMN username VARCHAR(50) UNIQUE,
  ADD COLUMN profile_photo_url VARCHAR(255);

CREATE TABLE user_favorite_teams (
    user_id INT,
    team_id INT,
    PRIMARY KEY (user_id, team_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
);

CREATE TABLE user_favorite_news (
    user_id INT,
    news_id INT,
    PRIMARY KEY (user_id, news_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (news_id) REFERENCES news(id) ON DELETE CASCADE
);





CREATE TABLE matches (
    id INT AUTO_INCREMENT PRIMARY KEY,
    home_team VARCHAR(100) NOT NULL,
    away_team VARCHAR(100) NOT NULL,
    match_date DATETIME NOT NULL,
    home_score INT,
    away_score INT,
    status ENUM('upcoming', 'finished') DEFAULT 'upcoming'
);


CREATE TABLE predictions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    match_id INT NOT NULL,
    predicted_result ENUM('home_team', 'draw', 'away_team') NOT NULL,
    is_correct BOOLEAN,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, match_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE
);


CREATE TABLE quizzes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    question TEXT NOT NULL,
    option_a VARCHAR(255),
    option_b VARCHAR(255),
    option_c VARCHAR(255),
    option_d VARCHAR(255),
    correct_option CHAR(1)
);
ALTER TABLE quizzes ADD COLUMN image_url VARCHAR(255) DEFAULT NULL;

CREATE TABLE user_scores (
    user_id INT PRIMARY KEY,
    monthly_points INT DEFAULT 0,
    seasonal_points INT DEFAULT 0,
    total_points INT AS (monthly_points + seasonal_points) STORED,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);


CREATE TABLE user_score_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    source ENUM('quiz', 'prediction') NOT NULL,
    points INT NOT NULL,
    earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    month INT,         -- 1–12
    year INT,          -- 2024 vs 2025 vs 2026
    season_year INT,   -- 2024–2025 sezonu için 2024 yazılır
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);


CREATE TABLE system_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) UNIQUE,
    value VARCHAR(255)
);

INSERT INTO system_settings (name, value)
VALUES ('correct_prediction_point', '10');
INSERT INTO system_settings (name, value) VALUES ('correct_quiz_point', '10');




CREATE TABLE quiz_answers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    quiz_id INT,
    selected_option CHAR(1),
    is_correct BOOLEAN,
    answered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, quiz_id),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
);
ALTER TABLE quiz_answers ADD COLUMN quiz_week INT;


CREATE TABLE news (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE news ADD COLUMN league_id INT;
ALTER TABLE news ADD FOREIGN KEY (league_id) REFERENCES leagues(id) ON DELETE SET NULL;



CREATE TABLE teams (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    logo_url VARCHAR(255),
    coach VARCHAR(100),
    stadium VARCHAR(100),
    info TEXT
);


CREATE TABLE standings_external (
    id INT AUTO_INCREMENT PRIMARY KEY,
    team_name VARCHAR(100),
    matches_played INT,
    wins INT,
    draws INT,
    losses INT,
    points INT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);




CREATE TABLE match_predictions_system (
    id INT AUTO_INCREMENT PRIMARY KEY,
    match_id INT NOT NULL,
    home_win_probability DECIMAL(5,2),   
    draw_probability DECIMAL(5,2),       
    away_win_probability DECIMAL(5,2),  
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE
);

CREATE TABLE user_ips (
    user_id INT,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, ip_address),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE banned_ips (
    ip_address VARCHAR(45) PRIMARY KEY,
    reason TEXT,
    banned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



-- Maç tablosuna hafta numarası eklenmeli:
ALTER TABLE matches ADD COLUMN match_week INT;

-- Lig tablosu oluşturulmalı:
CREATE TABLE leagues (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    logo_url VARCHAR(255),
    country VARCHAR(100),
    info TEXT
);

-- Maç tablosuna lig ID eklenmeli:
ALTER TABLE matches ADD COLUMN league_id INT;
ALTER TABLE matches ADD FOREIGN KEY (league_id) REFERENCES leagues(id) ON DELETE SET NULL;

-- Haber tablosuna lig sütunu eklenebilir:
ALTER TABLE news ADD COLUMN league_id INT;
ALTER TABLE news ADD FOREIGN KEY (league_id) REFERENCES leagues(id) ON DELETE SET NULL;

ALTER TABLE teams
ADD COLUMN league_id INT;

ALTER TABLE teams
ADD CONSTRAINT fk_teams_league
FOREIGN KEY (league_id) REFERENCES leagues(id)
ON DELETE SET NULL;


CREATE TABLE user_ips (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    ip_address VARCHAR(45) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

ALTER TABLE news
ADD COLUMN image_url VARCHAR(500);

ALTER TABLE user_scores ADD COLUMN quiz_points INT DEFAULT 0;
