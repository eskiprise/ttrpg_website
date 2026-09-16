#!/usr/bin/env python3
"""
Copy the game systems (names, descriptions, aliases, cover images) from one environment
to another — in practice dev → prod, once they're set up and checked on dev.

Two things have to move, which is why this isn't just a table copy:
  * the rows in <env>_game_systems, and
  * the cover images, which live in the avatars bucket under systems/ and are served by
    that environment's own CloudFront distribution — so imageUrl has to be rewritten to
    the target's domain, or prod would hotlink dev's CDN.

Systems are matched by name (case-insensitive): an existing target system keeps its id
and gets the source's description, aliases and cover; a missing one is created with the
source's id. Nothing is ever deleted — a system that exists only in the target is
reported, so you can remove it in the admin if it's a leftover.

Reads the source through its public API (no credentials for that part) and writes the
target with the AWS CLI, so there's nothing to pip install. Dry-run by default.

Usage:
    python scripts/copy_game_systems.py \
        --source-api https://25s7b365sj.execute-api.eu-west-2.amazonaws.com \
        --target-table ttrpg_club_prod_game_systems \
        --source-bucket ttrpg-club-avatars-dev \
        --target-bucket ttrpg-club-avatars-prod \
        --target-cdn https://d25o8ictblmv3u.cloudfront.net \
        [--profile default] [--region eu-west-2] [--apply]
"""
from __future__ import annotations

import argparse
import json
import subprocess
import urllib.request
from urllib.parse import urlparse

COPIED_FIELDS = ("name", "description", "displayIndex", "aliases", "imageUrl")


def aws(args: list[str], profile: str | None, region: str) -> dict:
    """One AWS CLI call returning parsed JSON. The single seam the tests replace."""
    command = ["aws", *args, "--region", region, "--output", "json"]
    if profile:
        command += ["--profile", profile]
    result = subprocess.run(command, capture_output=True, text=True)
    if result.returncode != 0:
        raise SystemExit(f"AWS CLI failed: {' '.join(args[:2])}\n{result.stderr.strip()}")
    return json.loads(result.stdout) if result.stdout.strip() else {}


def fetch_source_systems(api_base: str) -> list[dict]:
    with urllib.request.urlopen(f"{api_base.rstrip('/')}/game-systems", timeout=30) as response:
        payload = json.load(response)
    # sessionCount is computed per environment from its own polls — never copied.
    return [
        {k: s[k] for k in ("systemId", *COPIED_FIELDS) if k in s}
        for s in payload.get("systems", [])
    ]


def object_key(image_url: str) -> str:
    """https://<cdn>/systems/abc.jpg -> systems/abc.jpg"""
    return urlparse(image_url).path.lstrip("/")


def to_dynamo(value):
    """Plain JSON -> DynamoDB's typed JSON, for the handful of shapes a system uses."""
    if isinstance(value, bool):
        return {"BOOL": value}
    if isinstance(value, (int, float)):
        return {"N": str(value)}
    if isinstance(value, list):
        return {"L": [to_dynamo(v) for v in value]}
    return {"S": str(value)}


def plan(source: list[dict], target_items: list[dict], target_cdn: str):
    """What would be written, which covers to copy, and what only exists in the target."""
    existing = {item["name"].strip().lower(): item for item in target_items}
    writes, covers = [], []

    for system in source:
        match = existing.get(system["name"].strip().lower())
        item = {k: v for k, v in system.items() if k in COPIED_FIELDS and v not in (None, "")}
        item["systemId"] = match["systemId"] if match else system["systemId"]
        item.setdefault("description", "")
        item.setdefault("displayIndex", 0)
        if system.get("imageUrl"):
            key = object_key(system["imageUrl"])
            covers.append(key)
            item["imageUrl"] = f"{target_cdn.rstrip('/')}/{key}"
        writes.append(("оновити" if match else "створити", item))

    source_names = {s["name"].strip().lower() for s in source}
    extra = [item["name"] for name, item in existing.items() if name not in source_names]
    return writes, covers, extra


def run(args, aws_call=aws) -> None:
    source = fetch_source_systems(args.source_api)
    print(f"У джерелі систем: {len(source)}")

    scanned = aws_call(["dynamodb", "scan", "--table-name", args.target_table], args.profile, args.region)
    target_items = [
        {"systemId": row["systemId"]["S"], "name": row["name"]["S"]} for row in scanned.get("Items", [])
    ]
    writes, covers, extra = plan(source, target_items, args.target_cdn)

    for action, item in writes:
        cover = "з обкладинкою" if item.get("imageUrl") else "без обкладинки"
        print(f"  {action:9} {item['name']:26} синонімів: {len(item.get('aliases') or []):2}  {cover}")
    if extra:
        print("\nЄ лише в цільовому середовищі (не чіпаю — видаліть в адмінці, якщо це залишок):")
        for name in extra:
            print(f"  {name}")
    print(f"\nОбкладинок скопіювати: {len(covers)}  ({args.source_bucket} → {args.target_bucket})")

    if not args.apply:
        print("\nПробний запуск — нічого не записано. Додайте --apply, щоб виконати.")
        return

    for key in covers:
        aws_call(
            ["s3api", "copy-object", "--bucket", args.target_bucket, "--key", key,
             "--copy-source", f"{args.source_bucket}/{key}"],
            args.profile, args.region,
        )
    print(f"Скопійовано обкладинок: {len(covers)}")

    for _, item in writes:
        aws_call(
            ["dynamodb", "put-item", "--table-name", args.target_table,
             "--item", json.dumps({k: to_dynamo(v) for k, v in item.items()}, ensure_ascii=False)],
            args.profile, args.region,
        )
    print(f"Записано систем: {len(writes)}")
    print("Готово. Перевірте сторінку «Ігри» у цільовому середовищі.")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--source-api", required=True, help="Base URL of the source environment's API")
    parser.add_argument("--target-table", required=True)
    parser.add_argument("--source-bucket", required=True)
    parser.add_argument("--target-bucket", required=True)
    parser.add_argument("--target-cdn", required=True, help="https://<distribution>.cloudfront.net of the target's avatars CDN")
    parser.add_argument("--profile", default=None, help="AWS profile to write with")
    parser.add_argument("--region", default="eu-west-2")
    parser.add_argument("--apply", action="store_true", help="Actually write (default is a dry run)")
    run(parser.parse_args())


if __name__ == "__main__":
    main()
