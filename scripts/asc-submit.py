#!/usr/bin/env python3
"""
Submit an app version and the speech-model asset pack for App Review, through
the App Store Connect API, with nothing but python3 and openssl.

Why this exists: the first Apple-hosted asset pack has to go through App
Review, and it goes as an item of a review submission — alone, or alongside
an app version. App Store Connect allows one submission in flight per
platform, so this runs only once the version in review has been decided.

    scripts/asc-submit.py status
        What App Store Connect knows: versions, the review submission in
        flight, asset packs and their release states.

    scripts/asc-submit.py plan --version 1.0.1 --build 24
        Says exactly which calls a submission would make. Changes nothing.

    scripts/asc-submit.py submit --version 1.0.1 --build 24 [--no-asset-pack]
        Creates the App Store version if it does not exist, attaches the
        build, opens a review submission with the version and the newest
        COMPLETE asset pack version, and submits it. Asks once before the
        submit call.

The key is read from ~/Downloads/AuthKey_5BG7U522M9.p8 (ASC_KEY_PATH to
override). The key id and issuer id are not secrets; the key file is.
"""
from __future__ import annotations

import argparse
import base64
import json
import os
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request

APP_ID = "6806530807"
BUNDLE_ID = "com.vidlun.journal"
KEY_ID = "5BG7U522M9"
ISSUER_ID = "1ce855b7-86e2-46f6-856e-eb74ff5b37b9"
KEY_PATH = os.environ.get("ASC_KEY_PATH", os.path.expanduser("~/Downloads/AuthKey_5BG7U522M9.p8"))
API = "https://api.appstoreconnect.apple.com"


def b64url(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


def der_to_raw(der: bytes) -> bytes:
    """ECDSA DER signature -> the 64-byte r||s form JWTs use."""
    assert der[0] == 0x30
    at = 2 if der[1] < 0x80 else 2 + (der[1] & 0x7F)
    out = b""
    for _ in range(2):
        assert der[at] == 0x02
        length = der[at + 1]
        out += der[at + 2 : at + 2 + length][-32:].rjust(32, b"\x00")
        at += 2 + length
    return out


def token() -> str:
    now = int(time.time())
    header = b64url(json.dumps({"alg": "ES256", "kid": KEY_ID, "typ": "JWT"}, separators=(",", ":")).encode())
    claims = b64url(
        json.dumps({"iss": ISSUER_ID, "iat": now, "exp": now + 900, "aud": "appstoreconnect-v1"}, separators=(",", ":")).encode()
    )
    signing_input = f"{header}.{claims}"
    with tempfile.NamedTemporaryFile(delete=False) as handle:
        handle.write(signing_input.encode())
        path = handle.name
    try:
        der = subprocess.check_output(["openssl", "dgst", "-sha256", "-sign", KEY_PATH, path])
    finally:
        os.unlink(path)
    return f"{signing_input}.{b64url(der_to_raw(der))}"


def call(method: str, path: str, body: dict | None = None) -> dict:
    data = json.dumps(body).encode() if body is not None else None
    request = urllib.request.Request(API + path, data=data, method=method)
    request.add_header("Authorization", f"Bearer {token()}")
    if data is not None:
        request.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            raw = response.read()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as error:
        detail = error.read().decode()
        raise SystemExit(f"{method} {path} -> HTTP {error.code}\n{detail[:2000]}") from None


def get(path: str) -> dict:
    return call("GET", path)


# --- reading ----------------------------------------------------------------


def versions() -> list[dict]:
    return get(f"/v1/apps/{APP_ID}/appStoreVersions?fields[appStoreVersions]=versionString,appVersionState,platform,createdDate&limit=10")["data"]


def builds() -> list[dict]:
    return get(f"/v1/builds?filter[app]={APP_ID}&sort=-uploadedDate&limit=10&fields[builds]=version,processingState,uploadedDate,expired")["data"]


def submissions_in_flight() -> list[dict]:
    rows = get(f"/v1/reviewSubmissions?filter[app]={APP_ID}&filter[platform]=IOS&fields[reviewSubmissions]=state,submittedDate&limit=10")["data"]
    return [row for row in rows if row["attributes"]["state"] in ("READY_FOR_REVIEW", "WAITING_FOR_REVIEW", "IN_REVIEW", "UNRESOLVED_ISSUES")]


def asset_packs() -> list[dict]:
    packs = get(f"/v1/apps/{APP_ID}/backgroundAssets?fields[backgroundAssets]=assetPackIdentifier,archived,usedBytes,createdDate")["data"]
    for pack in packs:
        pack["versions"] = get(
            f"/v1/backgroundAssets/{pack['id']}/versions?fields[backgroundAssetVersions]=version,state,platforms,createdDate,internalBetaRelease,externalBetaRelease,appStoreRelease&include=internalBetaRelease,externalBetaRelease,appStoreRelease"
        )
    return packs


def newest_complete_pack_version(packs: list[dict]) -> dict | None:
    candidates = []
    for pack in packs:
        if pack["attributes"]["archived"]:
            continue
        for version in pack["versions"]["data"]:
            if version["attributes"]["state"] == "COMPLETE":
                candidates.append((pack["attributes"]["assetPackIdentifier"], version))
    if not candidates:
        return None
    candidates.sort(key=lambda pair: int(pair[1]["attributes"]["version"]))
    identifier, version = candidates[-1]
    version["assetPackIdentifier"] = identifier
    return version


def status() -> None:
    print("App Store versions:")
    for row in versions():
        a = row["attributes"]
        print(f"  {a['versionString']:>8}  {a['appVersionState']}  ({row['id']})")
    print("Builds:")
    for row in builds()[:6]:
        a = row["attributes"]
        print(f"  build {a['version']:>3}  {a['processingState']}  {a['uploadedDate']}")
    print("Review submissions in flight:")
    rows = submissions_in_flight()
    for row in rows:
        print(f"  {row['attributes']['state']}  submitted {row['attributes']['submittedDate']}  ({row['id']})")
    if not rows:
        print("  none")
    print("Asset packs:")
    for pack in asset_packs():
        a = pack["attributes"]
        print(f"  {a['assetPackIdentifier']}  {a['usedBytes'] / 1e6:.0f} MB  archived={a['archived']}")
        included = {item["id"]: item for item in pack["versions"].get("included", [])}
        for version in pack["versions"]["data"]:
            v = version["attributes"]
            releases = []
            for name, rel in version.get("relationships", {}).items():
                data = rel.get("data")
                if data and data["id"] in included:
                    releases.append(f"{name}={included[data['id']]['attributes'].get('state')}")
            print(f"    version {v['version']}  {v['state']}  {' '.join(releases)}")


# --- writing ----------------------------------------------------------------


def find_version(version_string: str) -> dict | None:
    return next((row for row in versions() if row["attributes"]["versionString"] == version_string), None)


def find_build(build_number: str) -> dict:
    for row in builds():
        if row["attributes"]["version"] == build_number:
            if row["attributes"]["processingState"] != "VALID":
                raise SystemExit(f"build {build_number} is {row['attributes']['processingState']}, not VALID")
            return row
    raise SystemExit(f"build {build_number} is not among the last ten uploads")


def ensure_version(version_string: str, build: dict, dry: bool) -> str | None:
    existing = find_version(version_string)
    if existing is None:
        print(f"create App Store version {version_string} with build {build['attributes']['version']}")
        if dry:
            return None
        created = call(
            "POST",
            "/v1/appStoreVersions",
            {
                "data": {
                    "type": "appStoreVersions",
                    "attributes": {"platform": "IOS", "versionString": version_string},
                    "relationships": {
                        "app": {"data": {"type": "apps", "id": APP_ID}},
                        "build": {"data": {"type": "builds", "id": build["id"]}},
                    },
                }
            },
        )
        return created["data"]["id"]
    print(f"version {version_string} exists ({existing['attributes']['appVersionState']}); attach build {build['attributes']['version']}")
    if dry:
        return existing["id"]
    call(
        "PATCH",
        f"/v1/appStoreVersions/{existing['id']}",
        {"data": {"type": "appStoreVersions", "id": existing["id"], "relationships": {"build": {"data": {"type": "builds", "id": build["id"]}}}}},
    )
    return existing["id"]


def submit(version_string: str, build_number: str, with_asset_pack: bool, dry: bool) -> None:
    in_flight = submissions_in_flight()
    if in_flight:
        raise SystemExit(
            f"a review submission is already in flight ({in_flight[0]['attributes']['state']}); "
            "App Store Connect takes one per platform at a time — wait for it to be decided."
        )
    build = find_build(build_number)
    pack_version = newest_complete_pack_version(asset_packs()) if with_asset_pack else None
    if with_asset_pack and pack_version is None:
        raise SystemExit("no COMPLETE asset pack version to submit")

    version_id = ensure_version(version_string, build, dry)
    print("open a review submission (IOS)")
    print(f"  add item: appStoreVersion {version_string}")
    if pack_version is not None:
        print(f"  add item: backgroundAssetVersion {pack_version['assetPackIdentifier']} v{pack_version['attributes']['version']} ({pack_version['id']})")
    print("  submit")
    if dry:
        print("dry run: nothing was sent")
        return

    submission = call(
        "POST",
        "/v1/reviewSubmissions",
        {"data": {"type": "reviewSubmissions", "attributes": {"platform": "IOS"}, "relationships": {"app": {"data": {"type": "apps", "id": APP_ID}}}}},
    )["data"]["id"]
    items = [("appStoreVersion", "appStoreVersions", version_id)]
    if pack_version is not None:
        items.append(("backgroundAssetVersion", "backgroundAssetVersions", pack_version["id"]))
    for relationship, kind, identifier in items:
        call(
            "POST",
            "/v1/reviewSubmissionItems",
            {
                "data": {
                    "type": "reviewSubmissionItems",
                    "relationships": {
                        "reviewSubmission": {"data": {"type": "reviewSubmissions", "id": submission}},
                        relationship: {"data": {"type": kind, "id": identifier}},
                    },
                }
            },
        )
    answer = input(f"Submit review submission {submission} for {version_string} now? [y/N] ").strip().lower()
    if answer != "y":
        print("left unsubmitted; it can be finished or deleted in App Store Connect")
        return
    call("PATCH", f"/v1/reviewSubmissions/{submission}", {"data": {"type": "reviewSubmissions", "id": submission, "attributes": {"submitted": True}}})
    print("submitted")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("status")
    for name in ("plan", "submit"):
        p = sub.add_parser(name)
        p.add_argument("--version", required=True, help="marketing version, e.g. 1.0.1")
        p.add_argument("--build", required=True, help="build number already uploaded and VALID")
        p.add_argument("--no-asset-pack", action="store_true", help="submit the version without the asset pack")
    args = parser.parse_args()
    if args.command == "status":
        status()
    else:
        submit(args.version, args.build, not args.no_asset_pack, dry=args.command == "plan")


if __name__ == "__main__":
    main()
