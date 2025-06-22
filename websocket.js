const WebSocket = require('ws');
const http = require('http');
const db = require('./db');

// Create HTTP server
const server = http.createServer();

// Create WebSocket server
const wss = new WebSocket.Server({ server });

console.log('🚀 Starting WebSocket server...');

// Store connected clients
const clients = new Set();

// WebSocket connection handler
wss.on('connection', (ws) => {
  console.log('✅ New WebSocket client connected');
  clients.add(ws);

  // Send initial connection message
  ws.send(JSON.stringify({
    type: 'connection',
    message: 'Connected to EmmaCare WebSocket server',
    timestamp: new Date().toISOString()
  }));

  // Handle client disconnect
  ws.on('close', () => {
    console.log('❌ WebSocket client disconnected');
    clients.delete(ws);
  });

  // Handle client errors
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    clients.delete(ws);
  });
});

// Function to get latest vital signs from database
async function getLatestVitals() {
  try {
    const [rows] = await db.query(`
      SELECT * FROM sensor_data 
      ORDER BY timestamp DESC 
      LIMIT 1
    `);
    
    if (rows.length > 0) {
      const latest = rows[0];
      return {
        heart_rate: latest.heart_rate,
        spo2: latest.spo2,
        temperature: latest.temperature,
        systolic: latest.blood_pressure,
        diastolic: null
      };
    }
    return null;
  } catch (error) {
    console.error('Error fetching latest vitals:', error);
    return null;
  }
}

// Broadcast latest vitals every 5 seconds
setInterval(async () => {
  const vitals = await getLatestVitals();
  if (vitals) {
    const message = JSON.stringify({
      type: 'vital_signs',
      data: vitals,
      timestamp: new Date().toISOString()
    });

    clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }
}, 5000);

// Start server
const PORT = process.env.WS_PORT || 8080;
server.listen(PORT, () => {
  console.log(`🌐 WebSocket server running on port ${PORT}`);
});

// Initialize database
db.initialize(); 