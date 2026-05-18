#include "state_store.h"
#include <Preferences.h>
#include <string.h>

namespace StateStore {

static const char* NS  = "andon";   // NVS namespace
static const char* KEY = "state";   // single blob key

State defaultState() {
    State s = {};
    s.layout = 1;
    strncpy(s.zonas[0].estado,   "verde", sizeof(s.zonas[0].estado) - 1);
    strncpy(s.zonas[0].mensagem, "OK",    sizeof(s.zonas[0].mensagem) - 1);
    s.version = 0;
    return s;
}

State load() {
    Preferences prefs;
    if (!prefs.begin(NS, /* readOnly */ true)) {
        Serial.println("[State] NVS namespace inexistente — devolvo default");
        return defaultState();
    }
    size_t actual = prefs.getBytesLength(KEY);
    if (actual != sizeof(State)) {
        if (actual > 0) {
            Serial.printf("[State] Tamanho NVS %u != esperado %u — devolvo default\n",
                          (unsigned)actual, (unsigned)sizeof(State));
        }
        prefs.end();
        return defaultState();
    }
    State s;
    prefs.getBytes(KEY, &s, sizeof(State));
    prefs.end();
    Serial.printf("[State] ✅ Carregado do NVS: layout=%u version=%u\n",
                  (unsigned)s.layout, (unsigned)s.version);
    return s;
}

bool save(const State& s) {
    Preferences prefs;
    if (!prefs.begin(NS, /* readOnly */ false)) {
        Serial.println("[State] ❌ Falhou abrir NVS para escrita");
        return false;
    }
    size_t written = prefs.putBytes(KEY, &s, sizeof(State));
    prefs.end();
    bool ok = (written == sizeof(State));
    Serial.printf("[State] %s: layout=%u version=%u (%u bytes)\n",
                  ok ? "💾 Gravado" : "❌ Falhou",
                  (unsigned)s.layout, (unsigned)s.version, (unsigned)written);
    return ok;
}

void clear() {
    Preferences prefs;
    if (prefs.begin(NS, false)) {
        prefs.clear();
        prefs.end();
        Serial.println("[State] 🧹 NVS limpo");
    }
}

} // namespace StateStore
