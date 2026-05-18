#!/usr/bin/env python3
"""
mock_panel.py — simulador do painel sem hardware.

Subscreve o Supabase Realtime exactamente como o firmware C++ faria,
e imprime no terminal o que o painel REAL mostraria. Permite testar
todo o fluxo (app → BD → Realtime) antes do painel chegar.

Uso:
    pip install supabase
    PANEL_ID=psy-posto-01 python mock_panel.py

Variáveis de ambiente:
    PANEL_ID         (obrigatório) — id da linha em paineis_andon
    SUPABASE_URL     (default já apontado para sawmdixlevjghlikvakv)
    SUPABASE_ANON_KEY (default já hardcoded para a app PSY)

Ctrl+C para sair.
"""
import os
import sys
import time
import signal

try:
    from supabase import create_client, Client
except ImportError:
    print("❌ Falta a lib supabase. Instala com: pip install supabase")
    sys.exit(1)

# === CONFIG ===
PANEL_ID = os.environ.get("PANEL_ID", "psy-posto-01")
SUPABASE_URL = os.environ.get(
    "SUPABASE_URL",
    "https://sawmdixlevjghlikvakv.supabase.co",
)
SUPABASE_ANON_KEY = os.environ.get(
    "SUPABASE_ANON_KEY",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNhd21kaXhsZXZqZ2hsaWt2YWt2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxMTc4OTYsImV4cCI6MjA4NzY5Mzg5Nn0.-DX0cJHbnv51sxpbAjnvgLcR8vP6VVrAuQmgfeFp85w",
)

# === ANSI cores para output bonito no terminal ===
COLOR = {
    "verde":    "\033[42m\033[97m",  # bg verde, fg branco
    "amarelo":  "\033[43m\033[30m",  # bg amarelo, fg preto
    "vermelho": "\033[41m\033[97m",  # bg vermelho, fg branco
}
RESET = "\033[0m"
DIM   = "\033[90m"
BOLD  = "\033[1m"


def render_state(layout: int, zonas: list) -> None:
    """Imprime uma representação ASCII do que o painel mostraria."""
    print(f"\n{BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━{RESET}")
    print(f"{BOLD}🖥️  Painel {PANEL_ID} (mock){RESET}")
    print(f"{BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━{RESET}")

    # Pinta 3 linhas (96 chars de largura simulando 96 px)
    total_w = 96
    zone_w = total_w // layout

    for line in range(3):
        out = ""
        for i in range(layout):
            z = zonas[i] if i < len(zonas) else {"estado": "verde", "mensagem": "OK"}
            est = z.get("estado", "verde")
            msg = z.get("mensagem", "")
            colors = COLOR.get(est, "\033[47m\033[30m")
            # No meio mostra a mensagem, nas outras linhas espaço
            if line == 1:
                content = f" {msg} ".center(zone_w)[:zone_w]
            else:
                content = " " * zone_w
            out += colors + content + RESET
        print(out)
    print(f"{DIM}layout={layout} · {' | '.join(f'Z{i+1}={z.get(\"estado\")}/{z.get(\"mensagem\")}' for i, z in enumerate(zonas[:layout]))}{RESET}\n")


def on_postgres_change(payload):
    """Callback do Realtime — equivalente a handlePostgresChange no firmware."""
    try:
        data = payload.get("data", {})
        if data.get("type") != "UPDATE":
            return
        record = data.get("record", {})
        if record.get("id") != PANEL_ID:
            return

        layout = record.get("layout", 1)
        zonas  = record.get("zonas", [{"estado": "verde", "mensagem": "OK"}])
        print(f"{DIM}[Realtime] 📨 UPDATE recebido — layout={layout}{RESET}")
        render_state(layout, zonas)
    except Exception as e:
        print(f"❌ Erro a processar payload: {e}")


def main():
    print(f"{BOLD}🚀 mock_panel arrancando — PANEL_ID={PANEL_ID}{RESET}")
    print(f"{DIM}Supabase: {SUPABASE_URL}{RESET}")

    sb: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)

    # Render inicial: lê o estado actual da BD
    try:
        res = sb.table("paineis_andon").select("layout,zonas,nome").eq("id", PANEL_ID).single().execute()
        if res.data:
            print(f"{DIM}Estado inicial da BD para '{res.data.get('nome', PANEL_ID)}':{RESET}")
            render_state(res.data.get("layout", 1),
                         res.data.get("zonas", [{"estado": "verde", "mensagem": "OK"}]))
        else:
            print(f"⚠️  Painel '{PANEL_ID}' não existe na BD")
    except Exception as e:
        print(f"⚠️  Não consegui ler estado inicial: {e}")

    # Subscribe Realtime filtrado por id=eq.<PANEL_ID>
    channel = sb.channel(f"realtime:public:paineis_andon")
    channel.on_postgres_changes(
        event="UPDATE",
        schema="public",
        table="paineis_andon",
        filter=f"id=eq.{PANEL_ID}",
        callback=on_postgres_change,
    ).subscribe()

    print(f"{DIM}🟢 Subscrito a Realtime. À espera de updates...{RESET}")
    print(f"{DIM}(faz alterações ao painel '{PANEL_ID}' na app web e vê aqui){RESET}\n")

    # Loop infinito
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print(f"\n{DIM}👋 Ctrl+C — a sair{RESET}")


if __name__ == "__main__":
    signal.signal(signal.SIGINT, signal.default_int_handler)
    main()
