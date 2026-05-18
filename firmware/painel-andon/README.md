# Firmware Painel Andon — PSY/MCF

Firmware custom em C++ (PlatformIO + Arduino framework) para painéis LED
P10 RGB de sinalização visual nas fábricas PSY e MCF.

Substitui o firmware stock da Huidu (HD2020), que é fechado e só fala
com a app oficial deles. Este firmware liga directamente ao Supabase
Realtime e actualiza o painel em ~1-2 segundos quando o estado muda na
app web.

## Hardware

- **Controladora**: Huidu HD-WF2 (ESP32-S3, 8MB flash, WiFi b/g/n)
- **Painel**: 96×32 pixels (3 módulos P10 RGB de 32×32 em série) = 3072 LEDs

## Estado actual

**v2.52.59 (commit 2/5)**: WiFi manager com reconnect + persistência do
último estado em NVS (flash do ESP32). Painel mostra o último estado
gravado ao arrancar — sobrevive a reboots/power-cuts. Ainda sem Supabase
(vem no v2.52.60).

| Commit | Versão | Conteúdo |
|---|---|---|
| 1 | v2.52.58 | ✅ Setup PlatformIO + smoke test |
| 2 | v2.52.59 | ✅ WiFi manager + persistência NVS (este) |
| 3 | v2.52.60 | Cliente Supabase Realtime (Phoenix Channels) |
| 4 | v2.52.61 | Render real de 3 zonas a partir da BD |
| 5 | v2.52.62 | Mock client Python + OTA + docs finais |

## Instalação (uma vez)

### 1. PlatformIO

**Opção A — VSCode (recomendado)**:
1. Instala [VSCode](https://code.visualstudio.com/)
2. Extensões (Ctrl+Shift+X) → procura "PlatformIO IDE" → Install
3. Espera ~5 min pela instalação completa

**Opção B — CLI** (sem VSCode):
```bash
pip install platformio
```

### 2. Drivers USB

Windows precisa do driver de série USB da placa Huidu. Tenta um destes:

- **CP210x** (Silicon Labs): https://www.silabs.com/developers/usb-to-uart-bridge-vcp-drivers
- **CH340/CH341** (WCH): http://www.wch-ic.com/downloads/CH341SER_ZIP.html

No Linux/Mac geralmente já existe driver no kernel.

## Compilar e flashar

### Passo 1 — Configurar este painel

Cada painel precisa do seu `include/config.h` com WiFi e ID próprios.
O ficheiro **NÃO** é commitado ao git (contém password) — copia do
template:

```bash
cd firmware/painel-andon
cp include/config.h.example include/config.h
```

Abre `include/config.h` e edita:
- `WIFI_SSID` e `WIFI_PASSWORD` da fábrica
- `PANEL_ID` (ex: `"psy-posto-01"` — tem de coincidir com o id na BD)

### Passo 2 — Build + flash

```bash
# Compila
pio run

# Flash (primeira vez via USB)
pio run -t upload

# Ver logs em tempo real (Ctrl+C para sair)
pio device monitor
```

No monitor série deves ver:
1. Banner "PSY/MCF Painel Andon — fw v2.52.59" + Panel ID
2. `[Panel] ✅ Inicializado`
3. `[State] ... devolvo default` (primeiro boot) ou `Carregado do NVS` (boots seguintes)
4. `[Render] layout=1 | Z1=verde "OK"`
5. `[WiFi] A ligar a SSID '...'`
6. `[WiFi] ✅ Ligado: 192.168.x.x` (se SSID/password no `config.h` estão correctos)
7. A cada 30s: `[Loop] WiFi=🟢 IP=... layout=1 v=0`

No painel: o último estado gravado em flash. Primeiro boot = "OK" verde
a toda a largura (1 zona, 96×32).

A partir do v2.52.60, este último estado vai ser actualizado quando a
app web mexer no Supabase.

## Troubleshooting

| Sintoma | Tentar |
|---|---|
| Painel não acende, monitor série diz "Falhou inicializar" | Verificar PSU 5V dedicada (ESP32 não dá corrente suficiente) e cabo HUB75 no `IN` (não `OUT`) |
| Painel acende mas pixels corridos / colunas em vez de letras | Mudar `mxconfig.driver` para `HUB75_I2S_CFG::SHIFT` ou `HUB75_I2S_CFG::ICN2038S` |
| Cores trocadas (verde ↔ vermelho) | Trocar pinos `R1_PIN`/`B1_PIN` e `R2_PIN`/`B2_PIN` no `main.cpp` |
| `pio run -t upload` não encontra a placa | Carregar e segurar `BOOT` antes de carregar `RESET`, depois libertar |
| Conflito de COM port | Especificar `upload_port = COMx` no `platformio.ini` |

## Estrutura

```
firmware/painel-andon/
├── platformio.ini             # config de build (env huidu-wf2)
├── README.md                  # este ficheiro
├── .gitignore                 # ignora .pio/, include/config.h, etc.
├── include/
│   ├── config.h.example       # template versionado
│   └── config.h               # criado por ti, gitignored (tem WiFi password)
└── src/
    ├── main.cpp               # boot + render + loop principal
    ├── wifi_manager.cpp/.h    # ligar/reconnect WiFi
    └── state_store.cpp/.h     # persistência do último estado em NVS
```
