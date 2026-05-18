#include "panel_renderer.h"
#include <string.h>

namespace PanelRenderer {

static MatrixPanel_I2S_DMA* g_display = nullptr;
static int g_totalWidth = 96;
static int g_height     = 32;

// Bitmap font default da Adafruit GFX:
//   size 1 = 6×8 px por char
//   size 2 = 12×16 px por char
// Para zonas largas usamos size 2; para zonas estreitas (3 zonas) size 1.
static const int CHAR_W_SIZE1 = 6;
static const int CHAR_H_SIZE1 = 8;
static const int CHAR_W_SIZE2 = 12;
static const int CHAR_H_SIZE2 = 16;

static uint16_t bgForEstado(const char* estado) {
    if (!estado) return g_display->color565(120, 120, 120);
    if (strcmp(estado, "verde") == 0)    return g_display->color565(0,   200, 0);
    if (strcmp(estado, "amarelo") == 0)  return g_display->color565(255, 165, 0);
    if (strcmp(estado, "vermelho") == 0) return g_display->color565(220, 0,   0);
    return g_display->color565(120, 120, 120);
}

static uint16_t fgForEstado(const char* estado) {
    // Amarelo + texto preto contrasta melhor
    if (estado && strcmp(estado, "amarelo") == 0) return g_display->color565(0, 0, 0);
    return g_display->color565(255, 255, 255);
}

// Calcula maior textSize (1 ou 2) que cabe na zona.
// Devolve 2 se cabe a size 2, senão 1.
static int pickTextSize(const char* msg, int zoneW, int zoneH) {
    int len = strlen(msg);
    if (len == 0) return 1;
    int needW2 = len * CHAR_W_SIZE2;
    if (needW2 <= zoneW - 2 && CHAR_H_SIZE2 <= zoneH - 2) return 2;
    return 1;
}

// Desenha texto centrado dentro de uma zona, com truncamento se preciso.
static void drawCentered(const char* msg, int x0, int zoneW, int zoneH,
                          uint16_t fg) {
    if (!g_display || !msg || !*msg) return;
    int textSize = pickTextSize(msg, zoneW, zoneH);
    int charW = (textSize == 2) ? CHAR_W_SIZE2 : CHAR_W_SIZE1;
    int charH = (textSize == 2) ? CHAR_H_SIZE2 : CHAR_H_SIZE1;

    int len = strlen(msg);
    int maxChars = (zoneW - 2) / charW;
    if (maxChars < 1) maxChars = 1;

    char buf[48];
    if (len > maxChars) {
        // Trunca com "…" se tem espaço para >=2 chars
        if (maxChars >= 2) {
            strncpy(buf, msg, maxChars - 1);
            buf[maxChars - 1] = '.';
            buf[maxChars] = '\0';
            // Tentar "..."  curto
            if (maxChars >= 3) {
                strncpy(buf, msg, maxChars - 1);
                buf[maxChars - 1] = '.';
                buf[maxChars] = '\0';
            }
            msg = buf;
            len = maxChars;
        } else {
            strncpy(buf, msg, 1);
            buf[1] = '\0';
            msg = buf;
            len = 1;
        }
    }

    int textW = len * charW;
    int x = x0 + (zoneW - textW) / 2;
    int y = (zoneH - charH) / 2;
    if (x < x0 + 1) x = x0 + 1;
    if (y < 1) y = 1;

    g_display->setTextSize(textSize);
    g_display->setTextColor(fg);
    g_display->setCursor(x, y);
    g_display->print(msg);
}

void begin(MatrixPanel_I2S_DMA* display, int totalWidth, int height) {
    g_display    = display;
    g_totalWidth = totalWidth;
    g_height     = height;
}

void render(const StateStore::State& state) {
    if (!g_display) return;
    int layout = state.layout;
    if (layout < 1) layout = 1;
    if (layout > 3) layout = 3;
    int zoneW = g_totalWidth / layout;
    int leftover = g_totalWidth - (zoneW * layout); // dá os pixels extras à última zona

    g_display->clearScreen();
    int x = 0;
    for (int i = 0; i < layout; i++) {
        const auto& z = state.zonas[i];
        int w = zoneW + ((i == layout - 1) ? leftover : 0);
        g_display->fillRect(x, 0, w, g_height, bgForEstado(z.estado));
        drawCentered(z.mensagem, x, w, g_height, fgForEstado(z.estado));
        x += w;
    }

    Serial.print("[Render] layout=");
    Serial.print(layout);
    for (int i = 0; i < layout; i++) {
        Serial.printf(" | Z%d=%s \"%s\"", i + 1, state.zonas[i].estado,
                      state.zonas[i].mensagem);
    }
    Serial.println();
}

} // namespace PanelRenderer
