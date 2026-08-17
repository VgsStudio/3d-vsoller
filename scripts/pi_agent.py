#!/usr/bin/env python3
"""Runs ON the Raspberry Pi (not on the OctoPrint venv, plain system
python3 — stdlib only). Polls OctoPrint locally every few seconds and
keeps 3d.vsoller.com.br's live print status (progress + nozzle/bed temps)
in sync on its own, independent of any Claude session.

Contract with the rest of the pipeline (see project_vsoller_3d_platform.md
/ reference_vsoller_3d_api.md in Claude's memory):
- If a print entry with status "printing" already exists on the site
  (created ahead of time via scripts/update_print.py, with a nice title/
  STL/description), this agent ADOPTS it and just keeps progress+temps
  fresh.
- If no such entry exists when a print starts (e.g. started straight from
  OctoPrint's own UI, bypassing the usual flow), the agent creates a bare
  one from the gcode filename so nothing goes untracked.
- On completion/cancel/failure, the agent closes the entry out (status +
  duration + finishedAt) and goes back to idle.

Runs forever; install via a `pi` user crontab (@reboot + a keepalive
check), not systemd, since this account has no passwordless sudo. See
`scripts/pi_agent_install.sh`.
"""

import json
import os
import re
import sys
import time
import traceback
import urllib.error
import urllib.request

# Secrets are NEVER hardcoded here (this file is committed to a *public*
# repo) — they're loaded from ~/.vsoller3d_agent.env on the Pi at runtime,
# a file that never leaves the Pi and is chmod 600. See
# pi_agent_install.sh / README for how that file gets created.
def _load_env_file(path):
    values = {}
    if os.path.exists(path):
        with open(path) as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, _, value = line.partition("=")
                values[key.strip()] = value.strip()
    return values


_ENV_FILE = os.path.expanduser("~/.vsoller3d_agent.env")
_env = {**_load_env_file(_ENV_FILE), **os.environ}

OCTOPRINT_BASE = "http://localhost"
OCTOPRINT_API_KEY = _env.get("OCTOPRINT_API_KEY")
SITE_API_BASE = _env.get("VSOLLER_3D_API_BASE", "https://api.3d.vsoller.com.br")
SITE_API_KEY = _env.get("VSOLLER_3D_API_KEY")

if not OCTOPRINT_API_KEY or not SITE_API_KEY:
    sys.exit(
        f"Missing OCTOPRINT_API_KEY / VSOLLER_3D_API_KEY. "
        f"Create {_ENV_FILE} (chmod 600) with both, see pi_agent_install.sh."
    )

STATE_FILE = os.path.expanduser("~/.vsoller3d_agent_state.json")
POLL_INTERVAL = 5  # seconds
PHOTO_INTERVAL = 60  # seconds between webcam snapshots while printing


def log(msg):
    # stdout is already redirected into LOG_FILE by the cron/nohup wrapper —
    # just print, don't also append here (that duplicated every line).
    print(f"{time.strftime('%Y-%m-%d %H:%M:%S')} {msg}", flush=True)


def octoprint_get(path):
    req = urllib.request.Request(f"{OCTOPRINT_BASE}{path}")
    req.add_header("X-Api-Key", OCTOPRINT_API_KEY)
    with urllib.request.urlopen(req, timeout=8) as resp:
        return json.loads(resp.read())


def octoprint_get_binary(path):
    req = urllib.request.Request(f"{OCTOPRINT_BASE}{path}")
    req.add_header("X-Api-Key", OCTOPRINT_API_KEY)
    with urllib.request.urlopen(req, timeout=8) as resp:
        return resp.read()


def site_request(method, path, payload=None):
    url = f"{SITE_API_BASE}{path}"
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    if payload is not None:
        req.add_header("Content-Type", "application/json")
    req.add_header("x-api-key", SITE_API_KEY)
    with urllib.request.urlopen(req, timeout=10) as resp:
        body = resp.read()
        return json.loads(body) if body else None


def load_state():
    if os.path.exists(STATE_FILE):
        try:
            with open(STATE_FILE) as f:
                return json.load(f)
        except Exception:
            pass
    return {"site_id": None, "job_name": None, "last_photo": 0}


def save_state(state):
    with open(STATE_FILE, "w") as f:
        json.dump(state, f)


def clean_title(filename):
    name = re.sub(r"\.gco(de)?$", "", filename or "Impressao", flags=re.IGNORECASE)
    name = name.replace("_", " ").replace("-", " ").strip()
    return name.title() or "Impressao"


def find_existing_printing_entry():
    try:
        items = site_request("GET", "/prints")["items"]
    except Exception:
        return None
    printing = [i for i in items if i.get("status") == "printing"]
    if not printing:
        return None
    printing.sort(key=lambda i: i.get("updatedAt", 0), reverse=True)
    return printing[0]["id"]


def upload_photo(site_id):
    img = octoprint_get_binary("/webcam/?action=snapshot")
    created = site_request(
        "POST",
        f"/prints/{site_id}/upload-url",
        {"kind": "photo", "filename": "live.jpg", "contentType": "image/jpeg"},
    )
    put_req = urllib.request.Request(created["uploadUrl"], data=img, method="PUT")
    put_req.add_header("Content-Type", "image/jpeg")
    with urllib.request.urlopen(put_req, timeout=15):
        pass
    current = site_request("GET", f"/prints/{site_id}")
    photos = (current.get("photos") or []) + [created["key"]]
    site_request("PATCH", f"/prints/{site_id}", {"photos": photos})


def now_iso():
    return time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime())


def tick(state):
    job = octoprint_get("/api/job")
    printer = octoprint_get("/api/printer")

    job_state = job.get("state", "")
    is_active = job_state in ("Printing", "Paused")
    job_name = (job.get("job", {}) or {}).get("file", {}).get("name")
    progress = job.get("progress", {}) or {}
    completion = progress.get("completion") or 0

    temps = printer.get("temperature", {}) or {}
    nozzle = temps.get("tool0", {}) or {}
    bed = temps.get("bed", {}) or {}
    temp_payload = {
        "nozzleTemp": round(nozzle.get("actual") or 0, 1),
        "nozzleTarget": round(nozzle.get("target") or 0, 1),
        "bedTemp": round(bed.get("actual") or 0, 1),
        "bedTarget": round(bed.get("target") or 0, 1),
    }

    if is_active:
        if state["site_id"] is None or state["job_name"] != job_name:
            existing = find_existing_printing_entry()
            if existing:
                site_id = existing
                log(f"adopting existing entry {site_id} for {job_name}")
            else:
                created = site_request(
                    "POST",
                    "/prints",
                    {"title": clean_title(job_name), "status": "printing", "startedAt": now_iso()},
                )
                site_id = created["id"]
                log(f"created new entry {site_id} for {job_name}")
            state.update({"site_id": site_id, "job_name": job_name, "last_photo": 0})
            save_state(state)

        payload = {
            "progressPercent": round(completion, 1),
            "status": "printing" if job_state == "Printing" else "paused",
            **temp_payload,
        }
        site_request("PATCH", f"/prints/{state['site_id']}", payload)

        now = time.time()
        if now - state.get("last_photo", 0) >= PHOTO_INTERVAL:
            try:
                upload_photo(state["site_id"])
                state["last_photo"] = now
                save_state(state)
            except Exception:
                log("photo upload failed:")
                log(traceback.format_exc())
    else:
        if state["site_id"] is not None:
            print_time = progress.get("printTime")
            if "error" in job_state.lower():
                end_status = "failed"
            elif job_state == "Operational" and print_time and completion >= 95:
                end_status = "completed"
            else:
                end_status = "cancelled"

            payload = {"status": end_status, "finishedAt": now_iso(), **temp_payload}
            if print_time:
                payload["durationSeconds"] = int(print_time)
            if end_status == "completed":
                payload["progressPercent"] = 100
            site_request("PATCH", f"/prints/{state['site_id']}", payload)
            log(f"print ended ({end_status}): {state['site_id']}")
            state.update({"site_id": None, "job_name": None, "last_photo": 0})
            save_state(state)


def main():
    state = load_state()
    log(f"agent starting, state={state}")
    while True:
        try:
            tick(state)
        except urllib.error.URLError as exc:
            log(f"network error: {exc}")
        except Exception:
            log("error in tick:")
            log(traceback.format_exc())
        time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    main()
