const mysql = require('mysql2/promise');  // Using promises for better handling

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'emmacare',
  password: process.env.DB_PASS || '#Yohana23',
  database: process.env.DB_NAME || 'EmmaCare',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});
// Verify table exists on startup
async function initialize() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sensor_data (
        id INT AUTO_INCREMENT PRIMARY KEY,
        heart_rate FLOAT NOT NULL,
        spo2 FLOAT NOT NULL,
        temperature FLOAT NOT NULL,
        blood_pressure FLOAT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX (timestamp)
      )
    `);
    console.log('✅ Verified sensor_data table exists');
  } catch (err) {
    console.error('🛑 Table creation failed:', err);
    process.exit(1);
  }
}

initialize();

module.exports = pool;