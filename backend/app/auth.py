import hmac
import os


def is_authorized(event) -> bool:
    expected = os.environ.get("ADMIN_API_KEY", "")
    if not expected:
        return False
    headers = event.get("headers") or {}
    provided = headers.get("x-api-key") or headers.get("X-Api-Key") or ""
    return hmac.compare_digest(provided, expected)
