// ============================================================
// panel_renderer — render do estado actual no painel HUB75
//
// Lida com:
//   • Divisão visual em 1, 2 ou 3 zonas (espelha o painel físico 96×32)
//   • Cor de fundo por estado (verde / amarelo / vermelho)
//   • Texto centrado em cada zona, com tamanho adaptado à largura da zona
//   • Fallback para texto truncado se não couber
// ============================================================
#pragma once
#include <Arduino.h>
#include <ESP32-HUB75-MatrixPanel-I2S-DMA.h>
#include "state_store.h"

namespace PanelRenderer {
    // Inicializa com referência ao display (já configurado e begin'd).
    void begin(MatrixPanel_I2S_DMA* display, int totalWidth, int height);

    // Renderiza o estado. Limpa, desenha zonas, escreve texto.
    void render(const StateStore::State& state);
}
