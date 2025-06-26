#include <Wire.h>
#include "MAX30100_PulseOximeter.h"
#include <OneWire.h>
#include <DallasTemperature.h>
#include <HardwareSerial.h>
#include <WiFi.h>
#include <HTTPClient.h>

// ========== WiFi Credentials ==========
const char* ssid = "Yo";
const char* password = "yohana23";
const char* serverUrl = "https://hulumoya.zapto.org/api/data"; 


// ========== MAX30100 Setup ==========
PulseOximeter pox;

// ========== DS18B20 Temperature Sensor ==========
#define ONE_WIRE_BUS 4
OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature tempSensor(&oneWire);

// ========== SIM800L Module ==========
#define SIM_TX 17
#define SIM_RX 16
HardwareSerial sim800(2);

// ========== Shared Data ==========
portMUX_TYPE mux = portMUX_INITIALIZER_UNLOCKED;
float sharedHR = 0;
float sharedSpO2 = 0;
float sharedTemp = 0;
bool criticalCondition = false;
unsigned long lastSMSTime = 0;
const long SMSTimeout = 60000; // 1 minute between SMS alerts

// ========== Send Data to Server ==========
void sendDataToServer(float hr, float spo2, float temp) {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(serverUrl);
    http.addHeader("Content-Type", "application/json");

    String json = "{";
    json += "\"heart_rate\":" + String(hr, 1) + ",";
    json += "\"spo2\":" + String(spo2, 1) + ",";
    json += "\"temperature\":" + String(temp, 1);
    json += "}";

    int httpResponseCode = http.POST(json);
    Serial.print("HTTP Response code: ");
    Serial.println(httpResponseCode);

    http.end();
  } else {
    Serial.println("WiFi not connected!");
  }
}

// ========== Core 1 Task: MAX30100 Reader ==========
void TaskMAX30100(void* pvParameters) {
  (void) pvParameters;
  unsigned long lastReport = 0;

  for (;;) {
    pox.update();

    if (millis() - lastReport > 1000) {
      float hr = pox.getHeartRate();
      float spo2 = pox.getSpO2();

      portENTER_CRITICAL(&mux);
      sharedHR = hr;
      sharedSpO2 = spo2;
      // Check for critical conditions
      if ((hr < 50 || hr > 120) || (spo2 < 90)) {
        criticalCondition = true;
      } else {
        criticalCondition = false;
      }
      portEXIT_CRITICAL(&mux);

      lastReport = millis();
    }

    vTaskDelay(10 / portTICK_PERIOD_MS);
  }
}

// ========== Core 0 Task: Temp + SMS + Output + HTTP ==========
void TaskMain(void* pvParameters) {
  (void) pvParameters;
  unsigned long lastPrint = 0;
  unsigned long lastTempRequest = 0;
  float temp = 0;

  // Initialize temperature sensor
  tempSensor.setWaitForConversion(false);
  tempSensor.requestTemperatures();

  for (;;) {
    float hr, spo2;
    unsigned long now = millis();

    // Get shared data safely
    portENTER_CRITICAL(&mux);
    hr = sharedHR;
    spo2 = sharedSpO2;
    bool critical = criticalCondition;
    portEXIT_CRITICAL(&mux);

    // Handle temperature readings (non-blocking)
    if (now - lastTempRequest >= 1000) {
      temp = tempSensor.getTempCByIndex(0);
      tempSensor.requestTemperatures();
      lastTempRequest = now;
      portENTER_CRITICAL(&mux);
      sharedTemp = temp;
      portEXIT_CRITICAL(&mux);
    }

    // Print and send HTTP POST every 1 second
    if (now - lastPrint >= 1000) {
      Serial.printf("HR: %.1f bpm | SpO2: %.1f %% | Temp: %.1f C\n", hr, spo2, temp);
      sendDataToServer(hr, spo2, temp); // <-- Send to server
      lastPrint = now;
    }

    // Handle SMS alerts for critical conditions
    if (critical && (now - lastSMSTime >= SMSTimeout)) {
      String message = "CRITICAL ALERT!\n";
      message += "HR: " + String(hr, 1) + " bpm\n";
      message += "SpO2: " + String(spo2, 1) + "%\n";
    
      sendSMS("+251900118533", message); // Replace with recipient number
      lastSMSTime = now;
    }

    vTaskDelay(100 / portTICK_PERIOD_MS);
  }
}

// ========== SMS Function ==========
void sendSMS(String number, String message) {
  Serial.println("Sending SMS...");
  sim800.println("AT"); // Check if module is ready
  delay(500);
  sim800.println("AT+CMGF=1"); // Set SMS text mode
  delay(500);
  sim800.print("AT+CMGS=\"");
  sim800.print(number);
  sim800.println("\"");
  delay(500);
  sim800.print(message);
  delay(500);
  sim800.write(26); // Ctrl+Z to send
  delay(5000); // Give time to send
  Serial.println("SMS sent!");
}

// ========== Setup ==========
void setup() {
  Serial.begin(115200);
  Wire.begin();
  tempSensor.begin();

  // WiFi connection
  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("Connected!");

  // Init SIM800
  sim800.begin(9600, SERIAL_8N1, SIM_RX, SIM_TX);
  delay(1000); // Give time for module to initialize

  // Init MAX30100
  if (!pox.begin()) {
    Serial.println("MAX30100 FAILED");
    while (1);
  }
  Serial.println("MAX30100 OK");
  pox.setIRLedCurrent(MAX30100_LED_CURR_7_6MA);

  // Task for Core 1 (Sensor - Higher Priority)
  xTaskCreatePinnedToCore(
    TaskMAX30100,
    "MAX30100 Task",
    4096,
    NULL,
    2,  // Higher priority
    NULL,
    1
  );

  // Task for Core 0 (Main - Lower Priority)
  xTaskCreatePinnedToCore(
    TaskMain,
    "Main Task",
    4096,
    NULL,
    1,  // Lower priority
    NULL,
    0
  );
}

void loop() {
  // Empty - everything handled in tasks
}