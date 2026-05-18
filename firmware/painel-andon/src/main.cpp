// ============================================================
// PSY/MCF Painel Andon — firmware v2.52.59 (commit 2/5)
//
// Acrescenta sobre o v2.52.58:
//   - WiFi manager com reconnect (módulo wifi_manager)
//   - Persistência do último estado em NVS (módulo state_store)
//   - Renderização inicial a partir do que está em NVS
//
// Ainda NÃO liga ao Supabase Realtime — vem no v2.52.60.
// Por enquanto o painel mostra o último estado guardado em flash, ou
// "verde / OK" se nunca foi gravado.
// ============================================================

#include <Arduino.h>
#include <ESP32-HUB75-MatrixPanel-I2S-DMA.h>
#include "config.h"          // gerado por cada utilizador a partir do .example
#include "wifi_manager.h"
#include "state_store.h"

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

// --- Helpers de cor / render ---

static uint16_t bgForEstado(const char* estado) {
    if (!estado) return display->color565(120, 120, 120);
    if (strcmp(estado, "verde") == 0)    return display->color565(0,   200, 0);
    if (strcmp(estado, "amarelo") == 0)  return display->color565(255, 165, 0);
    if (strcmp(estado, "vermelho") == 0) return display->color565(255, 0,   0);
    return display->color565(120, 120, 120);
}

static uint16_t fgForEstado(const char* estado) {
    // Amarelo + texto escuro lê-se melhor
    if (estado && strcmp(estado, "amarelo") == 0) return display->color565(0, 0, 0);
    return display->color565(255, 255, 255);
}

// Renderiza no painel o currentState. Texto centrado em cada zona.
void renderState() {
    if (!display) return;
    const int TOTAL_W = PANEL_RES_X * PANEL_CHAIN;
    const int H       = PANEL_RES_Y;
    int layout = currentState.layout;
    if (layout < 1) layout = 1;
    if (layout > 3) layout = 3;
    const int zoneW = TOTAL_W / layout;

    display->clearScreen();
    for (int i = 0; i < layout; i++) {
        const auto& z = currentState.zonas[i];
        int x0 = i * zoneW;
        display->fillRect(x0, 0, zoneW, H, bgForEstado(z.estado));
        display->setTextColor(fgForEstado(z.estado));
        display->setTextSize(1);
        // Bitmap font default: 6x8 px por caractere
        int textW = (int)strlen(z.mensagem) * 6;
        int x = x0 + (zoneW - textW) / 2;
        int y = (H - 8) / 2;
        if (x < x0 + 1) x = x0 + 1; // se não cabe, alinha à esquerda
        display->setCursor(x, y);
        display->print(z.mensagem);
    }

    Serial.print("[Render] layout=");
    Serial.print(layout);
    for (int i = 0; i < layout; i++) {
        Serial.printf(" | Z%d=%s \"%s\"", i + 1,
                      currentState.zonas[i].estado,
                      currentState.zonas[i].mensagem);
    }
    Serial.println();
}

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

    // 2. Carregar último estado do NVS e mostrar imediatamente
    currentState = StateStore::load();
    renderState();

    // 3. Iniciar WiFi (não bloqueia se falhar — tick() trata reconnect)
    WifiManager::begin();

    Serial.println("[Setup] ✅ Pronto. Próximo: v2.52.60 vai ligar ao Supabase.");
}

// --- Loop ---

uint32_t lastStatusReport = 0;

void loop() {
    WifiManager::tick();

    // Status de debug cada 30s (sai na v2.52.62 quando estiver estável)
    if (millis() - lastStatusReport > 30000) {
        lastStatusReport = millis();
        Serial.printf("[Loop] WiFi=%s IP=%s layout=%u v=%u\n",
                      WifiManager::isConnected() ? "🟢" : "🔴",
                      WifiManager::getLocalIP().c_str(),
                      (unsigned)currentState.layout,
                      (unsigned)currentState.version);
    }
}
