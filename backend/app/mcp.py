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
            return "The printer is idle."
        return f"The printer is idle. Last print: {last['title']}, {last['status']}."
    p = active[0]
    pct = float(p.get("progressPercent") or 0)
    out = f"{p['title']} is {'paused' if p['status'] == 'paused' else 'printing'}, {pct:.0f} percent done."
    started = p.get("startedAt")
    if p.get("printTimeLeft") is not None:
        out += f" About {_fmt(float(p['printTimeLeft']))} remaining."
    elif started and 0 < pct < 100:
        from datetime import datetime, timedelta, timezone

        try:
            elapsed = time.time() - datetime.fromisoformat(started).replace(tzinfo=timezone(timedelta(hours=-3))).timestamp()  # startedAt is naive BRT
            # ponytail: linear extrapolation from elapsed/progress; store real OctoPrint printTimeLeft if it drifts
            out += f" About {_fmt(elapsed * (100 - pct) / pct)} remaining."
        except ValueError:
            pass
    return out


def _active():
    return next((p for p in _items() if p.get("status") in ("printing", "paused")), None)


def temperatures() -> str:
    p = _active()
    if not p or p.get("nozzleTemp") is None:
        return "No print is running, so I have no live temperatures."
    f = lambda k: f"{float(p.get(k) or 0):.0f}"  # noqa: E731
    return f"Nozzle {f('nozzleTemp')} of {f('nozzleTarget')} degrees, bed {f('bedTemp')} of {f('bedTarget')}."


def last_print() -> str:
    p = next((p for p in _items() if p.get("status") in ("completed", "failed", "cancelled")), None)
    if not p:
        return "No finished prints yet."
    out = f"{p['title']}: {p['status']}."
    if p.get("durationSeconds"):
        out += f" Took {_fmt(float(p['durationSeconds']))}."
    if p.get("filamentGrams"):
        out += f" Used {float(p['filamentGrams']):.0f} grams of {p.get('material') or 'filament'}."
    return out


def find_print(name: str = "") -> str:
    hits = [p for p in _items() if name.lower() in p["title"].lower()][:3]
    if not hits:
        return f"I found no print matching {name}."
    return " ".join(f"{p['title']}: {p['status']}" + (f", {_fmt(float(p['durationSeconds']))}." if p.get("durationSeconds") else ".") for p in hits)


def recent_prints() -> str:
    return "; ".join(f"{p['title']} ({p['status']})" for p in _items()[:5]) or "No prints yet."


def stats() -> str:
    done = [p for p in _items() if p.get("status") == "completed"]
    secs = sum(float(p.get("durationSeconds") or 0) for p in done)
    grams = sum(float(p.get("filamentGrams") or 0) for p in done)
    return f"{len(done)} prints completed, {_fmt(secs)} of printing, {grams:.0f} grams of filament."


def open_issues() -> str:
    iss = [p for p in _items("issue") if p.get("status") in ("open", "monitoring")]
    if not iss:
        return "No open hardware issues."
    return f"{len(iss)} open: " + "; ".join(p["title"] for p in iss) + "."


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
