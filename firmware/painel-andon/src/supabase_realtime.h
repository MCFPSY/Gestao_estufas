// ============================================================
// supabase_realtime — cliente Phoenix Channels para Supabase Realtime
//
// Liga via WSS, faz join ao canal de postgres_changes filtrado pelo
// PANEL_ID, e invoca callback sempre que recebe UPDATE da linha deste
// painel. Heartbeat cada 30s (requisito Phoenix). Reconnect automático.
// ============================================================
#pragma once
#include <Arduino.h>
#include "state_store.h"

namespace SupabaseRealtime {

    // Callback invocado quando chega UPDATE para o painel deste device.
    // O firmware deve guardar em NVS e renderizar.
    typedef void (*StateUpdateCallback)(const StateStore::State& newState);

    // Inicializa o cliente WSS. Não bloqueia — abre ligação em background.
    // Chamar APÓS WifiManager::begin() ter resultado em ligação WiFi.
    void begin(StateUpdateCallback cb);

    // Chamar dentro do loop() — trata eventos WS, heartbeat, reconnects.
    void tick();

    // True se WS está ligado E o canal foi joinado com sucesso.
    bool isReady();

    // Para debug: força reconnect.
    void reconnect();
}
