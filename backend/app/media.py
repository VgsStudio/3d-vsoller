import os
import re
import uuid

import boto3

_s3 = boto3.client("s3")
_BUCKET = os.environ["MEDIA_BUCKET"]

_SAFE_NAME = re.compile(r"[^a-zA-Z0-9_.-]+")

_KIND_PREFIX = {
    "photo": "photos",
    "stl": "stl",
    "gcode": "gcode",
    "bed": "bed",
    "render": "renders",
}


def presigned_upload(print_id: str, kind: str, filename: str, content_type: str):
    prefix = _KIND_PREFIX.get(kind, "misc")
    safe_name = _SAFE_NAME.sub("-", filename) or "file"
    key = f"media/{print_id}/{prefix}/{uuid.uuid4().hex[:8]}-{safe_name}"

    url = _s3.generate_presigned_url(
        ClientMethod="put_object",
        Params={"Bucket": _BUCKET, "Key": key, "ContentType": content_type},
        ExpiresIn=300,
    )
    return {"uploadUrl": url, "key": key}
