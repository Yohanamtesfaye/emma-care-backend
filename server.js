require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./db');
const UserInteraction = require('./models/UserInteraction');
const { spawn } = require('child_process');

const app = express();
app.use(cors());
app.use(express.json());

// Start serial reader
require('./serialReader');

// Initialize user interactions table
UserInteraction.createTable();

// Enhanced API endpoint
app.get('/api/data', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT * FROM sensor_data 
      ORDER BY timestamp DESC 
      LIMIT 20
    `);
    console.log(`📤 Sending ${rows.length} records to client`);
    res.json(rows);
  } catch (err) {
    console.error('🛑 API Error:', err);
    res.status(500).json({ error: 'Database query failed' });
  }
});

// Simple BP calculation (same as fallback in Python)
function simpleBpPrediction(hr, spo2) {
  let base_bp = 120;
  let bp_adjustment = 0;
  let spo2_adjustment = 0;
  if (hr > 100) bp_adjustment = (hr - 100) * 0.8;
  else if (hr < 60) bp_adjustment = (60 - hr) * 0.5;
  if (spo2 < 95) spo2_adjustment = (95 - spo2) * 2;
  let systolic_bp = base_bp + bp_adjustment + spo2_adjustment;
  systolic_bp = Math.max(80, Math.min(180, systolic_bp));
  return Math.round(systolic_bp * 10) / 10;
}

// Predict BP using Python ML script
function predictBP_ML(hr, spo2) {
  return new Promise((resolve, reject) => {
    const pythonProcess = spawn(
      process.env.PYTHON_PATH || 'python3',
      [__dirname + '/ml/predict_bp.py', hr.toString(), spo2.toString()],
      { timeout: 10000 }
    );
    let stdout = '';
    let stderr = '';
    pythonProcess.stdout.on('data', (data) => { stdout += data.toString(); });
    pythonProcess.stderr.on('data', (data) => { stderr += data.toString(); });
    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(stderr || 'Python script failed'));
      }
      try {
        const jsonLine = stdout.split('\n').find(line => line.startsWith('{'));
        if (!jsonLine) throw new Error('No JSON output from Python');
        const parsed = JSON.parse(jsonLine);
        if (parsed.error) throw new Error(parsed.error);
        if (parsed.bp === undefined) throw new Error('No BP value returned');
        resolve(parsed.bp);
      } catch (e) {
        reject(e);
      }
    });
    pythonProcess.on('error', (err) => { reject(err); });
  });
}

// POST endpoint to receive sensor data from ESP32
app.post('/api/data', async (req, res) => {
  try {
    let { heart_rate, spo2, temperature, blood_pressure } = req.body;
    if (
      typeof heart_rate !== 'number' ||
      typeof spo2 !== 'number' ||
      typeof temperature !== 'number'
    ) {
      return res.status(400).json({ error: 'Missing or invalid vital sign values' });
    }
    // Predict BP using ML if not provided
    if (blood_pressure === undefined) {
      try {
        blood_pressure = await predictBP_ML(heart_rate, spo2);
      } catch (err) {
        console.error('ML BP prediction failed, using fallback:', err.message);
        blood_pressure = simpleBpPrediction(heart_rate, spo2);
      }
    }
    const query = `INSERT INTO sensor_data (heart_rate, spo2, temperature, blood_pressure) VALUES (?, ?, ?, ?)`;
    const params = [heart_rate, spo2, temperature, blood_pressure];
    const [result] = await db.query(query, params);
    res.json({ success: true, id: result.insertId, blood_pressure });
  } catch (err) {
    console.error('🛑 POST /api/data Error:', err);
    res.status(500).json({ error: 'Failed to save sensor data' });
  }
});

// Get user interactions
app.get('/api/interactions', async (req, res) => {
  try {
    const { userId, limit = 1000 } = req.query;
    
    if (userId) {
      const interactions = await UserInteraction.getInteractionsByUser(userId, limit);
      res.json(interactions);
    } else {
      const interactions = await UserInteraction.getAllInteractions(limit);
      res.json(interactions);
    }
  } catch (err) {
    console.error('🛑 Interactions API Error:', err);
    res.status(500).json({ error: 'Failed to fetch interactions' });
  }
});

// Save user interaction
app.post('/api/interactions', async (req, res) => {
  try {
    const interactionId = await UserInteraction.saveInteraction(req.body);
    res.json({ success: true, id: interactionId });
  } catch (err) {
    console.error('🛑 Save Interaction Error:', err);
    res.status(500).json({ error: 'Failed to save interaction' });
  }
});

// Get AI training statistics
app.get('/api/ai-stats', async (req, res) => {
  try {
    const stats = await UserInteraction.getFeedbackStats();
    res.json(stats);
  } catch (err) {
    console.error('🛑 AI Stats Error:', err);
    res.status(500).json({ error: 'Failed to fetch AI stats' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});