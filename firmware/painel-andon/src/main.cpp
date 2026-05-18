// ============================================================
// PSY/MCF Painel Andon — firmware v2.52.62 (commit 5/5) — FINAL
//
// Acrescenta sobre v2.52.61:
//   - ArduinoOTA: actualizações de firmware via WiFi (sem desmontar
//     o painel da parede). Hostname = PANEL_ID.
//   - Comentários finais e estrutura limpa.
//
// Sistema completo. Próximos commits no firmware devem ser bug fixes
// ou novas features (ex: brightness scheduling, festive modes).
// ============================================================

#include <Arduino.h>
#include <ArduinoOTA.h>
#include <ESP32-HUB75-MatrixPanel-I2S-DMA.h>
#include "config.h"
#include "wifi_manager.h"
#include "state_store.h"
#include "supabase_realtime.h"
#include "panel_renderer.h"

// Setup do OTA — chamável após WiFi estar ligado
static void setupOTA() {
    ArduinoOTA.setHostname(PANEL_ID);
    // Sem password por defeito. Adicionar OTA_PASSWORD em config.h se quiseres:
    #ifdef OTA_PASSWORD
        ArduinoOTA.setPassword(OTA_PASSWORD);
    #endif
    ArduinoOTA.onStart([]() {
        Serial.println("[OTA] ⏬ A receber novo firmware...");
    });
    ArduinoOTA.onProgress([](unsigned int p, unsigned int t) {
        static uint8_t lastPct = 255;
        uint8_t pct = (p * 100) / t;
        if (pct != lastPct) {
            lastPct = pct;
            Serial.printf("[OTA] %u%%\r", pct);
        }
    });
    ArduinoOTA.onEnd([]() {
        Serial.println("\n[OTA] ✅ Concluído — vai reiniciar");
    });
    ArduinoOTA.onError([](ota_error_t e) {
        Serial.printf("[OTA] ❌ Erro %u\n", e);
    });
    ArduinoOTA.begin();
    Serial.printf("[OTA] Hostname=%s. Para actualizar via WiFi:\n", PANEL_ID);
    Serial.println("       pio run -t upload --upload-port " + WiFi.localIP().toString());
}

// === CONFIGURAÇÃO FÍSICA DO PAINEL ===
static const int PANEL_RES_X = 32;
static const int PANEL_RES_Y = 32;
static const int PANEL_CHAIN = 3;  // 96x32 total

// === PINOUT HD-WF2 (ESP32-S3) ===
static const int R1_PIN  = 2;
static const int G1_PIN  = 6;
static const int B1_PIN  = 10;
static const int R2_PIN  = 3;
static const int G2_PIN  = 7;
static const int B2_PIN  = 11;
static const int A_PIN   = 39;
static const int B_PIN   = 38;
static const int C_PIN   = 37;
static const int D_PIN   = 36;
static const int E_PIN   = 21;
static const int LAT_PIN = 33;
static const int OE_PIN  = 35;
static const int CLK_PIN = 34;

MatrixPanel_I2S_DMA *display = nullptr;
StateStore::State    currentState;

// Wrapper para manter API existente — delega ao PanelRenderer
static inline void renderState() {
    PanelRenderer::render(currentState);
}

// --- Callback de novo estado recebido do Supabase ---
// Forward-declared antes do setup() para uso em SupabaseRealtime::begin().
void onStateUpdate(const StateStore::State& newState);

// --- Boot ---

void setup() {
    Serial.begin(115200);
    delay(500);
    Serial.println();
    Serial.println("======================================");
    Serial.print(" PSY/MCF Painel Andon — fw ");
    Serial.println(PAINEL_FW_VERSION);
    Serial.print(" Panel ID: "); Serial.println(PANEL_ID);
    Serial.println("======================================");

    // 1. Iniciar painel HUB75
    HUB75_I2S_CFG::i2s_pins pins = {
        R1_PIN, G1_PIN, B1_PIN,
        R2_PIN, G2_PIN, B2_PIN,
        A_PIN, B_PIN, C_PIN, D_PIN, E_PIN,
        LAT_PIN, OE_PIN, CLK_PIN
    };
    HUB75_I2S_CFG mxconfig(PANEL_RES_X, PANEL_RES_Y, PANEL_CHAIN, pins);
    mxconfig.clkphase = false;
    mxconfig.driver   = HUB75_I2S_CFG::FM6126A;

    display = new MatrixPanel_I2S_DMA(mxconfig);
    if (!display->begin()) {
        Serial.println("[Panel] ❌ Falhou inicializar — verifica hardware");
    } else {
        display->setBrightness8(180);
        display->clearScreen();
        Serial.println("[Panel] ✅ Inicializado");
    }

    // 🆕 v2.52.61: registar display no renderer
    PanelRenderer::begin(display, PANEL_RES_X * PANEL_CHAIN, PANEL_RES_Y);

    // 2. Carregar último estado do NVS e mostrar imediatamente
    currentState = StateStore::load();
    renderState();

    // 3. Iniciar WiFi (não bloqueia se falhar — tick() trata reconnect)
    bool wifiOk = WifiManager::begin();

    // 4. 🆕 v2.52.62: OTA via WiFi (só se WiFi ok agora)
    if (wifiOk) setupOTA();

    // 5. Iniciar cliente Realtime APÓS WiFi ter sido tentado.
    SupabaseRealtime::begin(onStateUpdate);

    Serial.printf("[Setup] ✅ Pronto. WiFi=%s. Aguardo updates do Supabase.\n",
                  wifiOk ? "🟢" : "🔴 (retry no loop)");
}

// --- Implementação da callback ---
void onStateUpdate(const StateStore::State& newState) {
    Serial.printf("[Update] Recebido layout=%u\n", (unsigned)newState.layout);
    currentState = newState;
    // Grava NVS antes de renderizar — se houver crash entre os 2 passos,
    // no próximo boot mostra-se o estado correcto.
    StateStore::save(currentState);
    renderState();
}

// --- Loop ---

uint32_t lastStatusReport = 0;

void loop() {
    WifiManager::tick();
    if (WifiManager::isConnected()) {
        ArduinoOTA.handle();           // 🆕 v2.52.62: OTA listener
        SupabaseRealtime::tick();
    }

    // Status de debug cada 30s (sai na v2.52.62 quando estiver estável)
    if (millis() - lastStatusReport > 30000) {
        lastStatusReport = millis();
        Serial.printf("[Loop] WiFi=%s IP=%s Realtime=%s layout=%u v=%u\n",
                      WifiManager::isConnected() ? "🟢" : "🔴",
                      WifiManager::getLocalIP().c_str(),
                      SupabaseRealtime::isReady() ? "🟢" : "🔴",
                      (unsigned)currentState.layout,
                      (unsigned)currentState.version);
    }
}
