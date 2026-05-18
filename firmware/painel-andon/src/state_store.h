// ============================================================
// state_store — persistência do último estado do painel em NVS (flash)
//
// Permite que o painel mostre o último estado conhecido após um reboot
// (mesmo sem WiFi). Quando o Realtime entregar uma actualização, gravamos
// no NVS antes de re-renderizar.
// ============================================================
#pragma once
#include <Arduino.h>

namespace StateStore {

    struct Zone {
        char estado[12];     // "verde" | "amarelo" | "vermelho"
        char mensagem[40];   // texto da zona (máx 39 chars + null)
    };

    struct State {
        uint8_t  layout;     // 1, 2 ou 3 — número de zonas activas
        Zone     zonas[3];   // só layout primeiros são significativos
        uint32_t version;    // monotonic, +1 em cada save (debugging)
    };

    // Carrega último estado do NVS. Se nunca foi gravado, devolve default:
    // 1 zona verde "OK".
    State load();

    // Grava estado novo em NVS. Devolve true se a escrita correu OK.
    bool save(const State& s);

    // Limpa NVS. Útil para factory reset (não chamado em fluxo normal).
    void clear();

    // Helper: cria default state (1 zona verde "OK").
    State defaultState();
}
