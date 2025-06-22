const mysql = require('mysql2/promise');
const db = require('../db');

class UserInteraction {
  static async createTable() {
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS user_interactions (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id VARCHAR(255) NOT NULL,
          user_role ENUM('patient', 'doctor') NOT NULL,
          question TEXT NOT NULL,
          response TEXT NOT NULL,
          vitals_data JSON,
          pregnancy_week INT,
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          feedback_rating INT,
          feedback_comment TEXT,
          INDEX (user_id),
          INDEX (timestamp)
        )
      `);
      console.log('✅ User interactions table created');
    } catch (err) {
      console.error('❌ Failed to create user interactions table:', err);
    }
  }

  static async saveInteraction(interaction) {
    try {
      const [result] = await db.query(`
        INSERT INTO user_interactions 
        (user_id, user_role, question, response, vitals_data, pregnancy_week, feedback_rating, feedback_comment)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        interaction.userId,
        interaction.userRole,
        interaction.question,
        interaction.response,
        JSON.stringify(interaction.vitalsData),
        interaction.pregnancyWeek,
        interaction.feedbackRating,
        interaction.feedbackComment
      ]);
      
      console.log('✅ Interaction saved:', result.insertId);
      return result.insertId;
    } catch (err) {
      console.error('❌ Failed to save interaction:', err);
      throw err;
    }
  }

  static async getInteractionsByUser(userId, limit = 50) {
    try {
      const [rows] = await db.query(`
        SELECT * FROM user_interactions 
        WHERE user_id = ? 
        ORDER BY timestamp DESC 
        LIMIT ?
      `, [userId, limit]);
      
      return rows;
    } catch (err) {
      console.error('❌ Failed to get user interactions:', err);
      return [];
    }
  }

  static async getAllInteractions(limit = 1000) {
    try {
      const [rows] = await db.query(`
        SELECT * FROM user_interactions 
        ORDER BY timestamp DESC 
        LIMIT ?
      `, [limit]);
      
      return rows;
    } catch (err) {
      console.error('❌ Failed to get all interactions:', err);
      return [];
    }
  }

  static async getFeedbackStats() {
    try {
      const [rows] = await db.query(`
        SELECT 
          AVG(feedback_rating) as avg_rating,
          COUNT(*) as total_interactions,
          COUNT(feedback_rating) as rated_interactions
        FROM user_interactions 
        WHERE feedback_rating IS NOT NULL
      `);
      
      return rows[0];
    } catch (err) {
      console.error('❌ Failed to get feedback stats:', err);
      return { avg_rating: 0, total_interactions: 0, rated_interactions: 0 };
    }
  }
}

module.exports = UserInteraction; 