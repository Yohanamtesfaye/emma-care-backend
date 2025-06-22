const db = require('./db');

async function monitorDatabase() {
  try {
    console.log('📊 Monitoring database for sensor data...');
    
    // Get latest records
    const [rows] = await db.query(`
      SELECT * FROM sensor_data 
      ORDER BY timestamp DESC 
      LIMIT 10
    `);
    
    console.log(`📈 Found ${rows.length} recent records:`);
    rows.forEach((row, index) => {
      console.log(`  ${index + 1}. HR: ${row.heart_rate}, SpO2: ${row.spo2}, Temp: ${row.temperature}, BP: ${row.blood_pressure}, Time: ${row.timestamp}`);
    });
    
    // Get statistics
    const [stats] = await db.query(`
      SELECT 
        COUNT(*) as total_records,
        AVG(heart_rate) as avg_hr,
        AVG(spo2) as avg_spo2,
        AVG(temperature) as avg_temp,
        MAX(timestamp) as latest_record
      FROM sensor_data
    `);
    
    console.log('📊 Database Statistics:');
    console.log(`  Total Records: ${stats[0].total_records}`);
    console.log(`  Average HR: ${stats[0].avg_hr?.toFixed(1) || 'N/A'}`);
    console.log(`  Average SpO2: ${stats[0].avg_spo2?.toFixed(1) || 'N/A'}`);
    console.log(`  Average Temp: ${stats[0].avg_temp?.toFixed(1) || 'N/A'}`);
    console.log(`  Latest Record: ${stats[0].latest_record || 'N/A'}`);
    
  } catch (error) {
    console.error('❌ Database monitoring error:', error);
  }
}

// Run monitoring every 30 seconds
setInterval(monitorDatabase, 30000);

// Run immediately
monitorDatabase(); 