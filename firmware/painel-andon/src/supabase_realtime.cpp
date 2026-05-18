// ============================================================
// Cliente Phoenix Channels para Supabase Realtime.
//
// Protocolo:
//   1. Abrir WSS: wss://<project>.supabase.co/realtime/v1/websocket?apikey=...&vsn=2.0.0
//   2. Heartbeat cada 30s — { topic:"phoenix", event:"heartbeat", payload:{}, ref:"hb-N" }
//   3. Join ao canal "realtime:paineis_andon:id=eq.<PANEL_ID>" — mas a sintaxe correcta
//      é fazer phx_join no topic "realtime:public:paineis_andon:id=eq.X" com payload
//      { config: { postgres_changes: [{ event:"UPDATE", schema:"public", table:"paineis_andon",
//        filter:"id=eq.<PANEL_ID>" }] } }
//   4. Receber phx_reply (ok) → estamos subscritos
//   5. Receber postgres_changes events → parse → callback
//
// Referência: https://supabase.com/docs/guides/realtime/protocol
// ============================================================
#include "supabase_realtime.h"
#include "config.h"
#include <WebSocketsClient.h>
#include <ArduinoJson.h>
#include <WiFi.h>

namespace SupabaseRealtime {

static WebSocketsClient   ws;
static StateUpdateCallback callback = nullptr;

static bool     wsConnected   = false;
static bool     channelJoined = false;
static uint32_t lastHeartbeat = 0;
static uint32_t lastJoinAttempt = 0;
static uint32_t refCounter    = 1;

static const char* TOPIC = "realtime:public:paineis_andon";

// Helper: extrai host e path da URL Supabase
static String supabaseHost() {
    String url = SUPABASE_URL;
    url.replace("https://", "");
    url.replace("http://", "");
    int slash = url.indexOf('/');
    if (slash >= 0) url = url.substring(0, slash);
    return url;
}

// Constrói a URL completa do endpoint Realtime
static String realtimePath() {
    String path = "/realtime/v1/websocket?apikey=";
    path += SUPABASE_ANON_KEY;
    path += "&vsn=1.0.0";
    return path;
}

// Envia mensagem JSON Phoenix
static void sendPhoenixMessage(const char* topic, const char* event,
                                JsonObject payload, const String& ref) {
    StaticJsonDocument<2048> doc;
    doc["topic"]   = topic;
    doc["event"]   = event;
    doc["payload"] = payload;
    doc["ref"]     = ref;
    String out;
    serializeJson(doc, out);
    ws.sendTXT(out);
    Serial.printf("[Realtime] → %s/%s ref=%s\n", topic, event, ref.c_str());
}

// Faz join ao canal com filtro pelo PANEL_ID
static void joinChannel() {
    StaticJsonDocument<1024> doc;
    JsonObject payload = doc.to<JsonObject>();
    JsonObject config = payload.createNestedObject("config");

    JsonArray pgChanges = config.createNestedArray("postgres_changes");
    JsonObject filter1 = pgChanges.createNestedObject();
    filter1["event"]  = "UPDATE";
    filter1["schema"] = "public";
    filter1["table"]  = "paineis_andon";
    filter1["filter"] = String("id=eq.") + PANEL_ID;

    String ref = String("join-") + refCounter++;
    sendPhoenixMessage(TOPIC, "phx_join", payload, ref);
    lastJoinAttempt = millis();
}

// Envia heartbeat Phoenix
static void sendHeartbeat() {
    StaticJsonDocument<256> doc;
    JsonObject payload = doc.to<JsonObject>();
    String ref = String("hb-") + refCounter++;
    sendPhoenixMessage("phoenix", "heartbeat", payload, ref);
    lastHeartbeat = millis();
}

// Parse de uma mensagem postgres_changes vinda do canal
static void handlePostgresChange(JsonObject payload) {
    JsonObject data = payload["data"];
    if (data.isNull()) return;
    const char* eventType = data["type"];
    if (!eventType || strcmp(eventType, "UPDATE") != 0) return;

    JsonObject rec = data["record"];
    if (rec.isNull()) {
        Serial.println("[Realtime] ⚠️ UPDATE sem record");
        return;
    }

    // Verifica que é mesmo este painel (defensivo)
    const char* recId = rec["id"];
    if (recId && strcmp(recId, PANEL_ID) != 0) {
        Serial.printf("[Realtime] ⚠️ UPDATE para outro painel (%s), ignoro\n", recId);
        return;
    }

    StateStore::State s = StateStore::defaultState();
    s.layout  = rec["layout"] | 1;
    if (s.layout < 1) s.layout = 1;
    if (s.layout > 3) s.layout = 3;
    s.version = rec["atualizado_em"].as<unsigned long>(); // best effort

    JsonArray zonas = rec["zonas"];
    if (!zonas.isNull()) {
        for (int i = 0; i < s.layout && i < (int)zonas.size() && i < 3; i++) {
            JsonObject z = zonas[i];
            const char* estado   = z["estado"]   | "verde";
            const char* mensagem = z["mensagem"] | "OK";
            strncpy(s.zonas[i].estado,   estado,   sizeof(s.zonas[i].estado) - 1);
            s.zonas[i].estado[sizeof(s.zonas[i].estado) - 1] = '\0';
            strncpy(s.zonas[i].mensagem, mensagem, sizeof(s.zonas[i].mensagem) - 1);
            s.zonas[i].mensagem[sizeof(s.zonas[i].mensagem) - 1] = '\0';
        }
    }

    if (callback) callback(s);
}

// Handler de eventos do WebSocket (links2004/WebSockets)
static void onWsEvent(WStype_t type, uint8_t* payload, size_t length) {
    switch (type) {
        case WStype_DISCONNECTED:
            Serial.println("[Realtime] 🔴 WS desligado");
            wsConnected = false;
            channelJoined = false;
            break;
        case WStype_CONNECTED:
            Serial.printf("[Realtime] 🟢 WS ligado, host=%s\n", payload);
            wsConnected = true;
            joinChannel();
            break;
        case WStype_TEXT: {
            StaticJsonDocument<3072> doc;
            DeserializationError err = deserializeJson(doc, payload, length);
            if (err) {
                Serial.printf("[Realtime] ⚠️ JSON parse: %s\n", err.c_str());
                return;
            }
            const char* event = doc["event"];
            const char* topic = doc["topic"];
            if (!event) return;

            if (strcmp(event, "phx_reply") == 0) {
                const char* status = doc["payload"]["status"] | "?";
                Serial.printf("[Realtime] phx_reply status=%s topic=%s\n", status, topic);
                if (strcmp(status, "ok") == 0 && topic && strstr(topic, "paineis_andon")) {
                    channelJoined = true;
                    Serial.println("[Realtime] ✅ Canal subscrito");
                }
            } else if (strcmp(event, "postgres_changes") == 0) {
                Serial.println("[Realtime] 📨 postgres_changes recebido");
                JsonObject payloadObj = doc["payload"];
                handlePostgresChange(payloadObj);
            } else if (strcmp(event, "phx_error") == 0) {
                Serial.println("[Realtime] ❌ phx_error");
                channelJoined = false;
            } else if (strcmp(event, "phx_close") == 0) {
                Serial.println("[Realtime] phx_close");
                channelJoined = false;
            }
            break;
        }
        case WStype_ERROR:
            Serial.println("[Realtime] ❌ WStype_ERROR");
            break;
        default:
            break;
    }
}

void begin(StateUpdateCallback cb) {
    callback = cb;
    String host = supabaseHost();
    String path = realtimePath();
    Serial.printf("[Realtime] A ligar a wss://%s%s\n", host.c_str(), path.c_str());
    ws.beginSSL(host.c_str(), 443, path.c_str());
    ws.onEvent(onWsEvent);
    ws.setReconnectInterval(5000);
    ws.enableHeartbeat(15000, 3000, 2);
}

void tick() {
    ws.loop();
    if (wsConnected) {
        // Phoenix heartbeat cada 30s (requisito do servidor)
        if (millis() - lastHeartbeat > 30000) {
            sendHeartbeat();
        }
        // Se ainda não joinámos passados 5s, tenta de novo
        if (!channelJoined && (millis() - lastJoinAttempt > 5000)) {
            joinChannel();
        }
    }
}

bool isReady() {
    return wsConnected && channelJoined;
}

void reconnect() {
    Serial.println("[Realtime] 🔁 reconnect forçado");
    ws.disconnect();
    wsConnected = false;
    channelJoined = false;
}

} // namespace SupabaseRealtime
