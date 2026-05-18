// ============================================================
// wifi_manager — gere conexão WiFi com reconnect automático
// ============================================================
#pragma once
#include <Arduino.h>

namespace WifiManager {
    // Liga ao WiFi configurado em config.h. Bloqueia até estar ligado ou
    // timeout (60s). Não rebenta se falhar — devolve false e o tick()
    // tenta reconnect periodicamente.
    bool begin();

    // True se a ligação WiFi está activa neste momento.
    bool isConnected();

    // Chamar dentro do loop() — trata reconnects e mudanças de estado.
    void tick();

    // Endereço IP local como string (vazio se não ligado).
    String getLocalIP();
}
