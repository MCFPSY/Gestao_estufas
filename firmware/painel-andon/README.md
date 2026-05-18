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

**v2.52.58 (commit 1/5)**: Smoke test do painel — sem WiFi, sem Supabase
ainda. Apenas confirma que o painel acende e cicla cores. Próximos:

| Commit | Versão | Conteúdo |
|---|---|---|
| 1 | v2.52.58 | ✅ Setup PlatformIO + smoke test (este) |
| 2 | v2.52.59 | WiFi manager + persistência NVS |
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

```bash
cd firmware/painel-andon

# Compila
pio run

# Flash (primeira vez via USB, ESP32-S3 entra em modo flash sozinho)
pio run -t upload

# Ver logs em tempo real (Ctrl+C para sair)
pio device monitor
```

No painel deves ver um ciclo **Verde "OK" → Amarelo "ATENCAO" → Vermelho
"AVARIA"** que muda a cada 1.5 segundos. No monitor série aparece o mesmo.

Se isto correr → confirmado que o painel está bem ligado, o pinout é o
correcto, e o firmware compila para a tua placa. Podemos avançar para
WiFi+Supabase.

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
├── platformio.ini       # config de build
├── README.md            # este ficheiro
└── src/
    └── main.cpp         # entrypoint (será modularizado em src/*.cpp nos próximos commits)
```

A partir do commit 2, vai aparecer também `include/config.h` (não
versionado em git — copiado de `include/config.h.example`) onde cada
painel guarda o seu próprio WiFi SSID, Supabase URL/key, e Panel ID.
