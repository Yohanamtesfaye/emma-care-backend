const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const { spawn } = require('child_process');
const db = require('./db');
require('dotenv').config();

// Verify DB connection (using promises)
db.query('SELECT 1 + 1 AS solution')
  .then(([rows]) => {
    console.log('✅ DB Connection Test Passed. Result:', rows[0].solution);
    // Test prediction after DB connection is verified
    testPrediction();
  })
  .catch(err => {
    console.error('🛑 DB Connection Test Failed:', err);
  });

const port = new SerialPort({
  path: process.env.SERIAL_PORT || '/dev/ttyUSB0',
  baudRate: 115200
});

port.on('error', (err) => {
  console.error('🛑 Serial Port Error:', err.message);
});

port.on('open', () => {
  console.log('✅ Serial port opened');
});

const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));

parser.on('data', async (line) => {
  const cleanLine = line.trim();
  console.log('📡 Raw Serial Line:', cleanLine);

  const match = cleanLine.match(
    /HR:\s*([\d.]+)\s*bpm\s*\|\s*SpO2:\s*([\d.]+)\s*%\s*\|\s*Temp:\s*([\d.]+)\s*C/i
  );

  if (!match) {
    console.log('❌ Format mismatch. Skipping line.');
    return;
  }

  const heart_rate = parseFloat(match[1]);
  const spo2 = parseFloat(match[2]);
  const temperature = parseFloat(match[3]);

  if (heart_rate <= 0 || spo2 <= 0 || spo2 > 100) {
    console.log('❌ Skipping invalid values:', { heart_rate, spo2, temperature });
    return;
  }

  console.log('📊 Valid Reading:', { heart_rate, spo2, temperature });

  try {
    const bp = await predictBP(heart_rate, spo2);
    console.log('🩸 Predicted BP:', bp);

    const [result] = await db.query(
      `INSERT INTO sensor_data 
       (heart_rate, spo2, temperature, blood_pressure) 
       VALUES (?, ?, ?, ?)`,
      [heart_rate, spo2, temperature, bp]
    );
    
    console.log('✅ Saved to DB. ID:', result.insertId);

  } catch (err) {
    console.error('⚠️ Error in processing:', err.message);
    
    // Calculate simple BP as fallback
    const fallbackBP = calculateSimpleBP(heart_rate, spo2);
    console.log('🩸 Fallback BP:', fallbackBP);
    
    try {
      const [result] = await db.query(
        `INSERT INTO sensor_data 
         (heart_rate, spo2, temperature, blood_pressure) 
         VALUES (?, ?, ?, ?)`,
        [heart_rate, spo2, temperature, fallbackBP]
      );
      console.log('✅ Saved with fallback BP. ID:', result.insertId);
    } catch (fallbackErr) {
      console.error('🛑 Fallback Insert Failed:', fallbackErr);
      
      // Last resort - save without BP
      try {
        const [result] = await db.query(
          `INSERT INTO sensor_data 
           (heart_rate, spo2, temperature) 
           VALUES (?, ?, ?)`,
          [heart_rate, spo2, temperature]
        );
        console.log('⚠️ Saved without BP. ID:', result.insertId);
      } catch (finalErr) {
        console.error('🛑 Final Insert Failed:', finalErr);
      }
    }
  }
});

// Simple BP calculation as fallback
function calculateSimpleBP(hr, spo2) {
  let baseBP = 120; // Normal baseline
  
  // Adjust based on heart rate
  if (hr > 100) {
    baseBP += (hr - 100) * 0.8; // Higher HR = higher BP
  } else if (hr < 60) {
    baseBP -= (60 - hr) * 0.5;  // Lower HR = lower BP
  }
  
  // Adjust based on SpO2
  if (spo2 < 95) {
    baseBP += (95 - spo2) * 2; // Lower SpO2 = higher BP
  }
  
  // Ensure reasonable range
  baseBP = Math.max(80, Math.min(180, baseBP));
  
  return Math.round(baseBP);
}

async function predictBP(hr, spo2) {
  return new Promise((resolve, reject) => {
    console.log('🔍 Predicting BP for HR:', hr, 'SpO2:', spo2);
    
    const pythonProcess = spawn(
      '/home/yohi/dev/EmmaCare/.venv/bin/python', 
      ['-u', `${__dirname}/ml/predict_bp.py`, hr.toString(), spo2.toString()],
      { timeout: 10000 } // Increased timeout
    );

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        console.error('🐍 Python Error:', stderr);
        return reject(new Error(`Python script exited with code ${code}`));
      }

      try {
        // Find the JSON line in case there are warnings
        const jsonLine = stdout.split('\n').find(line => line.startsWith('{'));
        if (!jsonLine) {
          throw new Error('No JSON output found');
        }

        const parsed = JSON.parse(jsonLine);
        if (parsed.error) {
          throw new Error(parsed.error);
        }
        if (parsed.bp === undefined) {
          throw new Error('No BP value returned');
        }

        console.log('✅ Prediction Success:', parsed.bp);
        resolve(parsed.bp);
      } catch (e) {
        console.error('📋 Parse Error:', e);
        console.error('Python Output:', stdout);
        console.error('Python Errors:', stderr);
        reject(new Error('Failed to parse Python output'));
      }
    });

    pythonProcess.on('error', (err) => {
      console.error('🐍 Process Error:', err);
      reject(err);
    });
  });
}

async function testPrediction() {
  try {
    console.log('🧪 Running test prediction...');
    const bp = await predictBP(72, 98);
    console.log('✅ TEST PREDICTION RESULT:', bp);
  } catch (err) {
    console.error('❌ TEST PREDICTION FAILED:', err.message);
  }
}