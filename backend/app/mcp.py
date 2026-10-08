"""Minimal stateless MCP server (Streamable HTTP, JSON-RPC) for Alexa+. Read-only."""
import time

from . import store

def _tool(name, desc):
    return {"name": name, "description": desc, "inputSchema": {"type": "object", "properties": {}}}


TOOLS = [
    _tool("get_print_status", "Current 3D print: what it is, percent done, elapsed and estimated remaining time. "
          "Use for 'what am I printing', 'how far along', 'how long is left'."),
    {
        "name": "find_print",
        "description": "Look up a past 3D print by (part of) its name, e.g. 'how did the keychain go'.",
        "inputSchema": {"type": "object", "properties": {"name": {"type": "string"}}, "required": ["name"]},
    },
    _tool("get_recent_prints", "The last 5 finished or running 3D prints with their results."),
    _tool("get_temperatures", "Current nozzle and bed temperatures (actual and target) of the 3D printer."),
    _tool("get_last_print", "The most recently finished 3D print: title, result, duration and filament used."),
    _tool("get_print_stats", "Totals: number of parts printed, total print time and filament used."),
    _tool("get_open_issues", "Open or monitored hardware problems on the 3D printer."),
]


def _items(category="print"):
    return [p for p in store.list_prints(include_hidden=False) if p.get("category", "print") == category]


ST = {"completed": "concluída", "failed": "falhou", "cancelled": "cancelada", "printing": "imprimindo", "paused": "pausada", "queued": "na fila"}


def _fmt(seconds: float) -> str:
    m = int(seconds // 60)
    h, m = divmod(m, 60)
    return f"{h}h{m:02d}min" if h else f"{m} min"


def print_status() -> str:
    prints = _items()
    active = [p for p in prints if p.get("status") in ("printing", "paused")]
    if not active:
        last = next((p for p in prints if p.get("status") in ("completed", "failed", "cancelled")), None)
        if not last:
            return "A impressora está parada."
        return f"A impressora está parada. Última impressão: {last['title']}, {ST.get(last['status'], last['status'])}."
    p = active[0]
    pct = float(p.get("progressPercent") or 0)
    out = f"{p['title']} está {'pausada' if p['status'] == 'paused' else 'imprimindo'}, {pct:.0f} por cento concluído."
    started = p.get("startedAt")
    if p.get("printTimeLeft") is not None:
        out += f" Faltam cerca de {_fmt(float(p['printTimeLeft']))}."
    elif started and 0 < pct < 100:
        from datetime import datetime, timedelta, timezone

        try:
            elapsed = time.time() - datetime.fromisoformat(started).replace(tzinfo=timezone(timedelta(hours=-3))).timestamp()  # startedAt is naive BRT
            # ponytail: linear extrapolation from elapsed/progress; store real OctoPrint printTimeLeft if it drifts
            out += f" Faltam cerca de {_fmt(elapsed * (100 - pct) / pct)}."
        except ValueError:
            pass
    return out


def _active():
    return next((p for p in _items() if p.get("status") in ("printing", "paused")), None)


def temperatures() -> str:
    p = store.get_print("printer")
    # ponytail: pi_agent beats every 30s; >2 min silent = printer/Pi off
    if not p or time.time() - float(p["updatedAt"]) > 120 or p.get("nozzleTemp") is None:
        return "Não consigo ler a impressora agora. Ela pode estar desligada ou desconectada."
    f = lambda k: f"{float(p.get(k) or 0):.0f}"  # noqa: E731
    return f"Bico a {f('nozzleTemp')} graus (alvo {f('nozzleTarget')}), mesa a {f('bedTemp')} graus (alvo {f('bedTarget')})."


def last_print() -> str:
    p = next((p for p in _items() if p.get("status") in ("completed", "failed", "cancelled")), None)
    if not p:
        return "Ainda não há impressões finalizadas."
    out = f"{p['title']}: {ST.get(p['status'], p['status'])}."
    if p.get("durationSeconds"):
        out += f" Levou {_fmt(float(p['durationSeconds']))}."
    if p.get("filamentGrams"):
        out += f" Usou {float(p['filamentGrams']):.0f} gramas de {p.get('material') or 'filamento'}."
    return out


def find_print(name: str = "") -> str:
    hits = [p for p in _items() if name.lower() in p["title"].lower()][:3]
    if not hits:
        return f"Não encontrei nenhuma impressão com o nome {name}."
    return " ".join(f"{p['title']}: {ST.get(p['status'], p['status'])}" + (f", {_fmt(float(p['durationSeconds']))}." if p.get("durationSeconds") else ".") for p in hits)


def recent_prints() -> str:
    return "; ".join(f"{p['title']} ({ST.get(p['status'], p['status'])})" for p in _items()[:5]) or "Ainda não há impressões."


def stats() -> str:
    done = [p for p in _items() if p.get("status") == "completed"]
    secs = sum(float(p.get("durationSeconds") or 0) for p in done)
    grams = sum(float(p.get("filamentGrams") or 0) for p in done)
    return f"{len(done)} impressões concluídas, {_fmt(secs)} de impressão, {grams:.0f} gramas de filamento."


def open_issues() -> str:
    iss = [p for p in _items("issue") if p.get("status") in ("open", "monitoring")]
    if not iss:
        return "Nenhum problema de hardware em aberto."
    return f"{len(iss)} em aberto: " + "; ".join(p["title"] for p in iss) + "."


HANDLERS = {
    "find_print": find_print,
    "get_print_status": print_status,
    "get_temperatures": temperatures,
    "get_recent_prints": recent_prints,
    "get_last_print": last_print,
    "get_print_stats": stats,
    "get_open_issues": open_issues,
}


def handle(msg: dict):
    """Returns a JSON-RPC response dict, or None for notifications."""
    method, mid = msg.get("method"), msg.get("id")
    if mid is None:
        return None
    if method == "initialize":
        result = {
            "protocolVersion": msg.get("params", {}).get("protocolVersion", "2025-11-25"),
            "capabilities": {"tools": {}},
            "serverInfo": {"name": "3d-vsoller", "version": "1.0.0"},
        }
    elif method == "tools/list":
        result = {"tools": TOOLS}
    elif method == "tools/call":
        fn = HANDLERS.get(msg["params"]["name"])
        if not fn:
            return {"jsonrpc": "2.0", "id": mid, "error": {"code": -32602, "message": "Unknown tool"}}
        result = {"content": [{"type": "text", "text": fn(**msg["params"].get("arguments", {}))}]}
    elif method == "ping":
        result = {}
    else:
        return {"jsonrpc": "2.0", "id": mid, "error": {"code": -32601, "message": "Method not found"}}
    return {"jsonrpc": "2.0", "id": mid, "result": result}
