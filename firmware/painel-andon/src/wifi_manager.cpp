#include "wifi_manager.h"
#include <WiFi.h>
#include "config.h"

namespace WifiManager {

static const uint32_t RECONNECT_INTERVAL_MS = 5000;
static const uint32_t CONNECT_TIMEOUT_MS    = 60000;
static uint32_t lastReconnectAttempt = 0;
static bool     lastReportedConnected = false;

static void onWiFiEvent(arduino_event_id_t event) {
    switch (event) {
        case ARDUINO_EVENT_WIFI_STA_CONNECTED:
            Serial.println("[WiFi] STA_CONNECTED");
            break;
        case ARDUINO_EVENT_WIFI_STA_GOT_IP:
            Serial.printf("[WiFi] GOT_IP: %s | RSSI %d dBm\n",
                          WiFi.localIP().toString().c_str(), WiFi.RSSI());
            break;
        case ARDUINO_EVENT_WIFI_STA_DISCONNECTED:
            Serial.println("[WiFi] STA_DISCONNECTED");
            break;
        default:
            break;
    }
}

bool begin() {
    Serial.printf("[WiFi] A ligar a SSID '%s'...\n", WIFI_SSID);
    WiFi.onEvent(onWiFiEvent);
    WiFi.mode(WIFI_STA);
    WiFi.setAutoReconnect(true);
    WiFi.persistent(false);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

    uint32_t startedAt = millis();
    while (WiFi.status() != WL_CONNECTED) {
        if (millis() - startedAt > CONNECT_TIMEOUT_MS) {
            Serial.println("\n[WiFi] ⏱️ Timeout de 60s — seguimos; tick() vai tentar reconnect");
            return false;
        }
        delay(250);
        Serial.print(".");
    }
    Serial.printf("\n[WiFi] ✅ Ligado: %s\n", WiFi.localIP().toString().c_str());
    lastReportedConnected = true;
    return true;
}

bool isConnected() {
    return WiFi.status() == WL_CONNECTED;
}

void tick() {
    bool nowConnected = isConnected();
    if (nowConnected != lastReportedConnected) {
        Serial.printf("[WiFi] Estado mudou: %s\n", nowConnected ? "🟢 ligado" : "🔴 desligado");
        lastReportedConnected = nowConnected;
    }
    if (!nowConnected) {
        if (millis() - lastReconnectAttempt > RECONNECT_INTERVAL_MS) {
            lastReconnectAttempt = millis();
            Serial.println("[WiFi] A tentar reconnect...");
            WiFi.reconnect();
        }
    }
}

String getLocalIP() {
    return isConnected() ? WiFi.localIP().toString() : String("");
}

} // namespace WifiManager
