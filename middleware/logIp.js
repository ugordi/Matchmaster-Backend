const pool = require('../db');

const logUserIp = async (userId, req) => {
  try {
    const ip =
      req.headers['x-forwarded-for']?.split(',')[0] || req.connection?.remoteAddress;

    if (userId && ip) {
      await pool.query(
        `INSERT IGNORE INTO user_ips (user_id, ip_address) VALUES (?, ?)`,
        [userId, ip]
      );
    }
  } catch (err) {
    console.error('IP kaydetme hatası:', err);
  }
};

module.exports = logUserIp;
