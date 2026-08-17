"""CLI helper to publish/update print jobs on 3d.vsoller.com.br.

Zero third-party dependencies (stdlib only) so it runs with any Python 3.10+
without a venv. Reads the admin API key from the VSOLLER_3D_API_KEY env var,
or from --api-key.

IMPORTANT (Windows/Git Bash gotcha): accented text (á, ç, ã, ...) passed as a
CLI argument through Git Bash to the native Windows python.exe can get mangled
before Python ever sees it (argv encoding mismatch between MSYS2 and the
Windows console). If title/description have accents, don't risk it — write a
small JSON file (e.g. via a text editor, guaranteed real UTF-8) and pass
--json-file payload.json instead; its fields are merged into the request.

Examples
--------
Create a print:
    python update_print.py create --title "Chaveiro AWS 30mm" \\
        --material PLA --printer "Ender 3 V3" --status printing \\
        --started-at 2026-08-17T11:46:00

Update progress while printing:
    python update_print.py update <id> --progress 42 --status printing

Mark as finished and attach stats:
    python update_print.py update <id> --status completed \\
        --duration 4888 --grams 38 --finished-at 2026-08-17T13:08:00

Upload a photo/STL/gcode (uploads directly to S3 via a presigned URL):
    python update_print.py upload <id> --kind photo --file bed_final.jpg
    python update_print.py upload <id> --kind stl --file model.stl
"""

import argparse
import json
import mimetypes
import os
import subprocess
import sys
import tempfile
import urllib.request

API_BASE = os.environ.get("VSOLLER_3D_API_BASE", "https://api.3d.vsoller.com.br")


def _api_key(args) -> str:
    key = args.api_key or os.environ.get("VSOLLER_3D_API_KEY")
    if not key:
        sys.exit("Missing API key. Set VSOLLER_3D_API_KEY or pass --api-key.")
    return key


def _request(method: str, path: str, api_key: str, payload: dict | None = None):
    # Shells out to curl (with the JSON body written to a temp file) instead of
    # using urllib.request directly. On this Windows/Git-Bash setup, urllib was
    # observed to intermittently corrupt non-ASCII (accented) bytes somewhere
    # between the client and API Gateway — reproducible, byte-verified via
    # DynamoDB, but never root-caused (the bytes handed to urlopen() and the
    # immediate response were both provably correct; only a later independent
    # GET showed corruption). curl with --data-binary @file never reproduced
    # it across many repeated tests, so it's the pragmatic fix here.
    url = f"{API_BASE}{path}"
    body_path = None
    try:
        cmd = ["curl", "-s", "-X", method, url, "-H", f"x-api-key: {api_key}"]
        if payload is not None:
            fd, body_path = tempfile.mkstemp(suffix=".json")
            with os.fdopen(fd, "w", encoding="utf-8") as fh:
                json.dump(payload, fh)
            cmd += ["-H", "Content-Type: application/json", "--data-binary", f"@{body_path}"]
        result = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8")
        if result.returncode != 0:
            sys.exit(f"curl failed calling {method} {path}: {result.stderr}")
        if not result.stdout:
            return None
        parsed = json.loads(result.stdout)
        if isinstance(parsed, dict) and "error" in parsed and len(parsed) == 1:
            sys.exit(f"API error calling {method} {path}: {parsed['error']}")
        return parsed
    finally:
        if body_path:
            os.unlink(body_path)


def _load_json_file(path: str | None) -> dict:
    if not path:
        return {}
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def cmd_create(args):
    api_key = _api_key(args)
    payload = {
        "title": args.title,
        "description": args.description or "",
        "status": args.status,
        "material": args.material or "",
        "dimensions": args.dimensions or "",
        "printer": args.printer or "Ender 3 V3",
        "filamentGrams": args.grams,
        "progressPercent": args.progress,
        "startedAt": args.started_at,
        "hidden": args.hidden,
    }
    if args.id:
        payload["id"] = args.id
    payload.update(_load_json_file(args.json_file))
    result = _request("POST", "/prints", api_key, payload)
    print(json.dumps(result, indent=2, ensure_ascii=True))


def cmd_update(args):
    api_key = _api_key(args)
    payload = {}
    if args.status is not None:
        payload["status"] = args.status
    if args.progress is not None:
        payload["progressPercent"] = args.progress
    if args.grams is not None:
        payload["filamentGrams"] = args.grams
    if args.dimensions is not None:
        payload["dimensions"] = args.dimensions
    if args.duration is not None:
        payload["durationSeconds"] = args.duration
    if args.finished_at is not None:
        payload["finishedAt"] = args.finished_at
    if args.started_at is not None:
        payload["startedAt"] = args.started_at
    if args.title is not None:
        payload["title"] = args.title
    if args.description is not None:
        payload["description"] = args.description
    if args.hidden is not None:
        payload["hidden"] = args.hidden
    payload.update(_load_json_file(args.json_file))
    if not payload:
        sys.exit("Nothing to update — pass at least one field.")
    result = _request("PATCH", f"/prints/{args.id}", api_key, payload)
    print(json.dumps(result, indent=2, ensure_ascii=True))


def cmd_upload(args):
    api_key = _api_key(args)
    filename = os.path.basename(args.file)
    content_type = mimetypes.guess_type(filename)[0] or "application/octet-stream"

    result = _request(
        "POST",
        f"/prints/{args.id}/upload-url",
        api_key,
        {"kind": args.kind, "filename": filename, "contentType": content_type},
    )
    upload_url = result["uploadUrl"]
    key = result["key"]

    with open(args.file, "rb") as fh:
        data = fh.read()

    put_req = urllib.request.Request(upload_url, data=data, method="PUT")
    put_req.add_header("Content-Type", content_type)
    with urllib.request.urlopen(put_req):
        pass

    print(json.dumps({"key": key}, indent=2))

    if args.attach:
        field_map = {"photo": "photos", "stl": "stlKey", "gcode": "gcodeKey", "bed": "bedPhotoKey", "render": "renderKey"}
        field = field_map[args.kind]
        if field == "photos":
            _append_photo(args.id, api_key, key)
        else:
            _request("PATCH", f"/prints/{args.id}", api_key, {field: key})


def _append_photo(print_id: str, api_key: str, key: str):
    req = urllib.request.Request(f"{API_BASE}/prints/{print_id}", method="GET")
    with urllib.request.urlopen(req) as resp:
        current = json.loads(resp.read())
    photos = current.get("photos") or []
    photos.append(key)
    _request("PATCH", f"/prints/{print_id}", api_key, {"photos": photos})


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--api-key", help="Admin API key (defaults to VSOLLER_3D_API_KEY env var)")
    sub = parser.add_subparsers(dest="command", required=True)

    p_create = sub.add_parser("create", help="Create a new print entry")
    p_create.add_argument("--id", help="Custom id/slug (default: random)")
    p_create.add_argument("--title", required=True)
    p_create.add_argument("--description")
    p_create.add_argument("--status", default="queued", choices=["queued", "printing", "paused", "completed", "failed", "cancelled", "open", "monitoring", "resolved"])
    p_create.add_argument("--material")
    p_create.add_argument("--printer")
    p_create.add_argument("--grams", type=float)
    p_create.add_argument("--dimensions", help="e.g. '120x80x30mm'")
    p_create.add_argument("--progress", type=float, default=0)
    p_create.add_argument("--started-at")
    p_create.add_argument("--hidden", action="store_true", default=False)
    p_create.add_argument("--json-file", help="JSON file with extra/overriding fields (safe for accented text)")
    p_create.set_defaults(func=cmd_create)

    p_update = sub.add_parser("update", help="Update an existing print entry")
    p_update.add_argument("id")
    p_update.add_argument("--status", choices=["queued", "printing", "paused", "completed", "failed", "cancelled", "open", "monitoring", "resolved"])
    p_update.add_argument("--progress", type=float)
    p_update.add_argument("--grams", type=float)
    p_update.add_argument("--dimensions", help="e.g. '120x80x30mm'")
    p_update.add_argument("--duration", type=int, help="Seconds")
    p_update.add_argument("--started-at")
    p_update.add_argument("--finished-at")
    p_update.add_argument("--title")
    p_update.add_argument("--description")
    p_update.add_argument("--hidden", type=lambda s: s.lower() == "true")
    p_update.add_argument("--json-file", help="JSON file with extra/overriding fields (safe for accented text)")
    p_update.set_defaults(func=cmd_update)

    p_upload = sub.add_parser("upload", help="Upload a photo/STL/gcode via presigned URL")
    p_upload.add_argument("id")
    p_upload.add_argument("--kind", required=True, choices=["photo", "stl", "gcode", "bed", "render"])
    p_upload.add_argument("--file", required=True)
    p_upload.add_argument("--attach", action="store_true", default=True, help="Also PATCH the print record with the resulting key (default: on)")
    p_upload.set_defaults(func=cmd_upload)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
