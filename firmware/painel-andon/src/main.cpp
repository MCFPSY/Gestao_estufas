// ============================================================
// PSY/MCF Painel Andon — firmware v2.52.58 (commit 1/5)
//
// Smoke test do painel HUB75. Este sketch ainda NÃO liga ao WiFi
// nem ao Supabase. Serve apenas para:
//   1) Confirmar que o painel acende com o pinout HD-WF2
//   2) Confirmar que conseguimos compilar + flashar
//   3) Confirmar que o driver do chip do painel está bem escolhido
//
// Hardware: Huidu HD-WF2 (ESP32-S3, 8MB)
// Painel:   96×32 pixels (3 módulos P10 RGB de 32×32 em série)
//
// Próximos passos:
//   v2.52.59 → WiFi manager + persistência NVS
//   v2.52.60 → cliente Supabase Realtime (Phoenix Channels)
//   v2.52.61 → render real de 3 zonas a partir do estado da BD
//   v2.52.62 → mock client Python + OTA
// ============================================================

#include <Arduino.h>
#include <ESP32-HUB75-MatrixPanel-I2S-DMA.h>

// === CONFIGURAÇÃO FÍSICA DO PAINEL ===
// 96x32 = 3 módulos de 32x32 em série
static const int PANEL_RES_X = 32;
static const int PANEL_RES_Y = 32;
static const int PANEL_CHAIN = 3;

// === PINOUT HD-WF2 (ESP32-S3) ===
// Mapeamento documentado pela Huidu para a controladora HD-WF2.
// Referência: https://github.com/mrcodetastic/HD-WF1-WF2-LED-MatrixPanel-DMA
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

void setup() {
    Serial.begin(115200);
    delay(500);
    Serial.println();
    Serial.println("======================================");
    Serial.print(" PSY/MCF Painel Andon — fw ");
    Serial.println(PAINEL_FW_VERSION);
    Serial.println(" Smoke test do painel HUB75");
    Serial.println("======================================");
    Serial.printf("Configuração: %dx%d (chain=%d) → total %d px\n",
                  PANEL_RES_X, PANEL_RES_Y, PANEL_CHAIN,
                  PANEL_RES_X * PANEL_CHAIN * PANEL_RES_Y);

    HUB75_I2S_CFG::i2s_pins pins = {
        R1_PIN, G1_PIN, B1_PIN,
        R2_PIN, G2_PIN, B2_PIN,
        A_PIN, B_PIN, C_PIN, D_PIN, E_PIN,
        LAT_PIN, OE_PIN, CLK_PIN
    };

    HUB75_I2S_CFG mxconfig(PANEL_RES_X, PANEL_RES_Y, PANEL_CHAIN, pins);
    mxconfig.clkphase = false;
    // Chip driver do painel: se os pixels saírem corridos ou trocados,
    // tentar SHIFT ou ICN2038S em vez de FM6126A.
    mxconfig.driver = HUB75_I2S_CFG::FM6126A;

    display = new MatrixPanel_I2S_DMA(mxconfig);
    if (!display->begin()) {
        Serial.println("❌ Falhou inicializar o painel — verifica pinout e alimentação");
        return;
    }
    display->setBrightness8(180); // 0-255
    display->clearScreen();

    Serial.println("✅ Painel inicializado");

    // Quadro de arranque
    display->fillScreen(display->color565(0, 80, 0));
    display->setTextColor(display->color565(255, 255, 255));
    display->setTextSize(1);
    display->setCursor(8, 12);
    display->print("PSY Andon");
    delay(2000);
}

// === Smoke test: ciclo verde → amarelo → vermelho ===
uint32_t lastChange = 0;
int      colorStep  = 0;

void loop() {
    if (millis() - lastChange < 1500) return;
    lastChange = millis();

    display->clearScreen();
    switch (colorStep % 3) {
        case 0:
            Serial.println("→ 🟢 Verde / OK");
            display->fillScreen(display->color565(0, 200, 0));
            display->setTextColor(display->color565(255, 255, 255));
            display->setCursor(40, 12);
            display->print("OK");
            break;
        case 1:
            Serial.println("→ 🟡 Amarelo / ATENCAO");
            display->fillScreen(display->color565(255, 165, 0));
            display->setTextColor(display->color565(0, 0, 0));
            display->setCursor(22, 12);
            display->print("ATENCAO");
            break;
        case 2:
            Serial.println("→ 🔴 Vermelho / AVARIA");
            display->fillScreen(display->color565(255, 0, 0));
            display->setTextColor(display->color565(255, 255, 255));
            display->setCursor(28, 12);
            display->print("AVARIA");
            break;
    }
    colorStep++;
}
