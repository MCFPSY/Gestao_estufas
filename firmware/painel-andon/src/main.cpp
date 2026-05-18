// ============================================================
// PSY/MCF Painel Andon — firmware v2.52.61 (commit 4/5)
//
// Acrescenta sobre v2.52.60:
//   - Módulo panel_renderer dedicado, com:
//       • Fonte size 2 (12×16 px) quando texto cabe — muito mais legível
//       • Fallback automático para size 1 quando não cabe
//       • Truncamento com "." se mensagem é maior que a zona
//       • Pixels extras dados à última zona (96/3 = 32×3, 96/2 = 48×2, OK)
//   - main.cpp simplificado: delega ao panel_renderer.render()
//
// Próximo (v2.52.62): mock client Python + OTA + docs finais.
// ============================================================

#include <Arduino.h>
#include <ESP32-HUB75-MatrixPanel-I2S-DMA.h>
#include "config.h"
#include "wifi_manager.h"
#include "state_store.h"
#include "supabase_realtime.h"
#include "panel_renderer.h"

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

    // 4. 🆕 v2.52.60: iniciar cliente Realtime APÓS WiFi ter sido tentado.
    // Mesmo se WiFi falhar agora, o tick do WS vai tentar e reconnect
    // automático trata da retoma quando WiFi voltar.
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
    // 🆕 v2.52.60: ticks do WSS Phoenix (eventos, heartbeat, reconnect)
    if (WifiManager::isConnected()) {
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
