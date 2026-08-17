import os
import time
import uuid
from decimal import Decimal

import boto3
from boto3.dynamodb.conditions import Attr

_dynamodb = boto3.resource("dynamodb")
_table = _dynamodb.Table(os.environ["TABLE_NAME"])

ALLOWED_FIELDS = {
    "title",
    "description",
    "category",
    "status",
    "progressPercent",
    "material",
    "filamentGrams",
    "printer",
    "startedAt",
    "finishedAt",
    "durationSeconds",
    "hidden",
    "stlKey",
    "gcodeKey",
    "photos",
    "bedPhotoKey",
    "renderKey",
    "tags",
}

CATEGORIES = {"print", "issue", "maintenance"}
STATUSES = {"queued", "printing", "paused", "completed", "failed", "cancelled", "open", "resolved", "monitoring"}


def _to_decimal(value):
    if isinstance(value, float):
        return Decimal(str(value))
    if isinstance(value, list):
        return [_to_decimal(v) for v in value]
    if isinstance(value, dict):
        return {k: _to_decimal(v) for k, v in value.items()}
    return value


def new_print(data: dict) -> dict:
    now = int(time.time())
    item = {
        "id": data.get("id") or str(uuid.uuid4())[:8],
        "title": data.get("title", "Sem titulo"),
        "description": data.get("description", ""),
        "category": data.get("category", "print"),
        "status": data.get("status", "queued"),
        "progressPercent": _to_decimal(data.get("progressPercent", 0)),
        "material": data.get("material", ""),
        "filamentGrams": _to_decimal(data.get("filamentGrams", 0)),
        "printer": data.get("printer", "Ender 3 V3"),
        "startedAt": data.get("startedAt"),
        "finishedAt": data.get("finishedAt"),
        "durationSeconds": _to_decimal(data.get("durationSeconds")),
        "hidden": bool(data.get("hidden", False)),
        "stlKey": data.get("stlKey"),
        "gcodeKey": data.get("gcodeKey"),
        "photos": data.get("photos", []),
        "bedPhotoKey": data.get("bedPhotoKey"),
        "renderKey": data.get("renderKey"),
        "tags": data.get("tags", []),
        "createdAt": now,
        "updatedAt": now,
    }
    _table.put_item(Item=item)
    return item


def update_print(print_id: str, data: dict) -> dict | None:
    existing = get_print(print_id)
    if existing is None:
        return None

    updates = {k: v for k, v in data.items() if k in ALLOWED_FIELDS}
    if not updates:
        return existing

    expr_names = {}
    expr_values = {":updatedAt": int(time.time())}
    set_clauses = ["updatedAt = :updatedAt"]
    for key, value in updates.items():
        name_placeholder = f"#{key}"
        value_placeholder = f":{key}"
        expr_names[name_placeholder] = key
        expr_values[value_placeholder] = _to_decimal(value)
        set_clauses.append(f"{name_placeholder} = {value_placeholder}")

    _table.update_item(
        Key={"id": print_id},
        UpdateExpression="SET " + ", ".join(set_clauses),
        ExpressionAttributeNames=expr_names,
        ExpressionAttributeValues=expr_values,
    )
    return get_print(print_id)


def delete_print(print_id: str) -> bool:
    existing = get_print(print_id)
    if existing is None:
        return False
    _table.delete_item(Key={"id": print_id})
    return True


def get_print(print_id: str) -> dict | None:
    result = _table.get_item(Key={"id": print_id})
    return result.get("Item")


def list_prints(include_hidden: bool = False) -> list[dict]:
    scan_kwargs = {}
    if not include_hidden:
        scan_kwargs["FilterExpression"] = Attr("hidden").ne(True)

    items = []
    while True:
        resp = _table.scan(**scan_kwargs)
        items.extend(resp.get("Items", []))
        if "LastEvaluatedKey" not in resp:
            break
        scan_kwargs["ExclusiveStartKey"] = resp["LastEvaluatedKey"]

    items.sort(key=lambda i: i.get("createdAt", 0), reverse=True)
    return items
