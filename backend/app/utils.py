import json
from decimal import Decimal


def _default(obj):
    if isinstance(obj, Decimal):
        if obj % 1 == 0:
            return int(obj)
        return float(obj)
    raise TypeError(f"Object of type {type(obj)} is not JSON serializable")


CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,x-api-key",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
}


def response(status_code: int, body=None, headers=None):
    final_headers = {"Content-Type": "application/json", **CORS_HEADERS}
    if headers:
        final_headers.update(headers)
    return {
        "statusCode": status_code,
        "headers": final_headers,
        "body": json.dumps(body, default=_default, ensure_ascii=False) if body is not None else "",
    }


def error(status_code: int, message: str):
    return response(status_code, {"error": message})
