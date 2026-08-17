import json

from . import media, store
from .auth import is_authorized
from .utils import error, response


def lambda_handler(event, context):
    method = event.get("requestContext", {}).get("http", {}).get("method", "GET")
    raw_path = event.get("rawPath", "/")
    path_params = event.get("pathParameters") or {}

    if method == "OPTIONS":
        return response(204)

    try:
        if raw_path == "/prints" and method == "GET":
            return handle_list()

        if raw_path.startswith("/prints/") and raw_path.endswith("/upload-url") and method == "POST":
            return handle_upload_url(event, path_params)

        if raw_path == "/prints" and method == "POST":
            return handle_create(event)

        if raw_path.startswith("/prints/") and method == "GET":
            return handle_get(path_params)

        if raw_path.startswith("/prints/") and method == "PATCH":
            return handle_update(event, path_params)

        if raw_path.startswith("/prints/") and method == "DELETE":
            return handle_delete(event, path_params)

        return error(404, "Not found")
    except Exception as exc:  # noqa: BLE001
        print(f"Unhandled error: {exc!r}")
        return error(500, "Internal error")


def _parse_body(event) -> dict:
    body = event.get("body") or "{}"
    if event.get("isBase64Encoded"):
        import base64

        body = base64.b64decode(body).decode("utf-8")
    return json.loads(body)


def handle_list():
    items = store.list_prints(include_hidden=False)
    return response(200, {"items": items})


def handle_get(path_params):
    print_id = path_params.get("id")
    item = store.get_print(print_id)
    if item is None or item.get("hidden"):
        return error(404, "Print not found")
    return response(200, item)


def handle_create(event):
    if not is_authorized(event):
        return error(401, "Unauthorized")
    data = _parse_body(event)
    if not data.get("title"):
        return error(400, "title is required")
    item = store.new_print(data)
    return response(201, item)


def handle_update(event, path_params):
    if not is_authorized(event):
        return error(401, "Unauthorized")
    print_id = path_params.get("id")
    data = _parse_body(event)
    item = store.update_print(print_id, data)
    if item is None:
        return error(404, "Print not found")
    return response(200, item)


def handle_delete(event, path_params):
    if not is_authorized(event):
        return error(401, "Unauthorized")
    print_id = path_params.get("id")
    ok = store.delete_print(print_id)
    if not ok:
        return error(404, "Print not found")
    return response(204)


def handle_upload_url(event, path_params):
    if not is_authorized(event):
        return error(401, "Unauthorized")
    print_id = path_params.get("id")
    data = _parse_body(event)
    kind = data.get("kind", "photo")
    filename = data.get("filename", "file.bin")
    content_type = data.get("contentType", "application/octet-stream")
    result = media.presigned_upload(print_id, kind, filename, content_type)
    return response(200, result)
