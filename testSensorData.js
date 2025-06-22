const { updateSensorData } = require('./websocket');

console.log('🧪 Starting sensor data simulation...');

// Simulate sensor data every 2 seconds
setInterval(() => {
  const simulatedData = {
    heart_rate: Math.floor(Math.random() * 40) + 70, // 70-110 BPM
    spo2: Math.floor(Math.random() * 10) + 90, // 90-100%
    temperature: (Math.random() * 2) + 36.5, // 36.5-38.5°C
    systolic: Math.floor(Math.random() * 40) + 100, // 100-140 mmHg
    diastolic: Math.floor(Math.random() * 20) + 60 // 60-80 mmHg
  };

  console.log('📊 Simulated sensor data:', simulatedData);
  updateSensorData(simulatedData);
}, 2000); 