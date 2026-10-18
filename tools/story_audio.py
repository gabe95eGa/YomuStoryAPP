"""Prepare paragraph narration locally; synthesize only on a protected Azure F0 trial.

Speech keys are never accepted in arguments or written to files. Azure CLI
manages its own local login cache in the authoring environment. Playback uses
committed static MP3 files.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from xml.sax.saxutils import escape

try:
    from .story_utils import ROOT, configure_console, json_text, load_json
except ImportError:
    from story_utils import ROOT, configure_console, json_text, load_json

FORMAT = "audio-24khz-48kbitrate-mono-mp3"
VOICES = ("ja-JP-NanamiNeural", "ja-JP-KeitaNeural")
RESOURCE = re.compile(r"^/subscriptions/([0-9a-f-]{36})/resourceGroups/([\w().-]+)/providers/Microsoft\.CognitiveServices/accounts/([\w-]+)$", re.I)


def source(story: dict) -> list[dict]:
    return [{"id": p["id"], "sentences": [{"id": s["id"], "text": s["text"]} for s in p["sentences"]]}
            for p in story["content"]["paragraphs"]]


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def fingerprint(paragraphs: list[dict]) -> str:
    return digest(json.dumps(paragraphs, ensure_ascii=False, separators=(",", ":")).encode("utf-8"))


def find_story(story_id: str, root: Path = ROOT) -> dict:
    manifest = load_json(root / "manifest.json")
    entry = next((s for s in manifest["stories"] if s["id"] == story_id), None)
    if entry is None:
        raise ValueError("Story is not published in manifest.json")
    path = (root / entry["path"]).resolve()
    if not path.is_relative_to((root / "stories").resolve()):
        raise ValueError("Unsafe story path")
    return load_json(path)


def prepare(story: dict, voice: str) -> dict:
    paragraphs = source(story)
    return {"story_id": story["id"], "voice": voice, "source_sha256": fingerprint(paragraphs),
            "paragraphs": paragraphs, "format": FORMAT}


def ssml(paragraph: dict, voice: str) -> bytes:
    text = "".join(s["text"] for s in paragraph["sentences"])
    return (f'<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="ja-JP"><voice name="{voice}">'
            f'{escape(text)}</voice></speak>').encode("utf-8")


def az_json(args: list[str]) -> dict:
    executable = shutil.which("az")
    command = [executable] if executable else None
    if command is None:
        try:
            available = importlib.util.find_spec("azure.cli") is not None
        except ModuleNotFoundError:
            available = False
        if not available:
            raise ValueError("Install the official Azure CLI and run az login first.")
        command = [sys.executable, "-m", "azure.cli"]
    # Never emit CLI stdout/stderr: listKeys returns credentials and errors can
    # contain account details. Disable implicit extension installs and telemetry.
    result = subprocess.run([*command, *args, "--output", "json", "--only-show-errors"],
                            capture_output=True, check=False, encoding="utf-8",
                            env={**os.environ, "AZURE_EXTENSION_USE_DYNAMIC_INSTALL": "no",
                                 "AZURE_CORE_COLLECT_TELEMETRY": "no"})
    if result.returncode:
        raise ValueError("Azure CLI request failed. Check your login and resource access locally.")
    return json.loads(result.stdout)


def free_resource(resource_id: str, query=az_json) -> tuple[str, str]:
    match = RESOURCE.fullmatch(resource_id)
    if not match:
        raise ValueError("Expected the ARM resource ID of a Speech resource.")
    subscription = query(["rest", "--method", "get", "--url",
                          f"https://management.azure.com/subscriptions/{match[1]}?api-version=2022-12-01"])
    if subscription.get("state") != "Enabled" or subscription.get("subscriptionPolicies", {}).get("spendingLimit") != "On":
        raise ValueError("Refusing synthesis: an enabled subscription with spending limit On is required. Do not upgrade to pay-as-you-go.")
    endpoint = f"https://management.azure.com{resource_id}"
    resource = query(["rest", "--method", "get", "--url", endpoint + "?api-version=2023-05-01"])
    if resource.get("sku", {}).get("name") != "F0" or resource.get("kind") != "SpeechServices":
        raise ValueError("Refusing synthesis: resource must be SpeechServices F0 (never S0).")
    region = resource.get("location", "")
    if not re.fullmatch(r"[a-z]+[0-9]*", region):
        raise ValueError("Unexpected Azure region")
    # Keys are retrieved only after both subscription and SKU checks succeed.
    keys = query(["rest", "--method", "post", "--url", endpoint + "/listKeys?api-version=2023-05-01"])
    return region, keys["key1"]


def validate_audio(data: bytes) -> None:
    # Accept an ID3 header or an MPEG frame; reject JSON/HTML error responses.
    if len(data) < 256 or not (data.startswith(b"ID3") or (data[0] == 255 and data[1] & 224 == 224)):
        raise ValueError("Response is not a plausible MP3 file")


def generate(plan: dict, folder: Path, resource_id: str) -> None:
    region, key = free_resource(resource_id)
    for number, paragraph in enumerate(plan["paragraphs"], 1):
        target = folder / f"{number:02d}.mp3"
        if target.exists():
            validate_audio(target.read_bytes())
            continue
        # Re-check billing protection before each new synthesis request.
        region, key = free_resource(resource_id)
        request = Request(f"https://{region}.tts.speech.microsoft.com/cognitiveservices/v1",
                          data=ssml(paragraph, plan["voice"]), method="POST", headers={
                              "Ocp-Apim-Subscription-Key": key, "Content-Type": "application/ssml+xml",
                              "X-Microsoft-OutputFormat": FORMAT, "User-Agent": "YomuStoryAuthoring/1"})
        try:
            with urlopen(request, timeout=60) as response:
                data = response.read(10_000_001)
        except HTTPError as error:
            raise ValueError(f"Azure synthesis stopped (HTTP {error.code}); no automatic retry or paid fallback.") from None
        if len(data) > 10_000_000:
            raise ValueError("Unexpectedly large audio response")
        validate_audio(data)
        target.write_bytes(data)
    print(f"Draft audio ready: {len(plan['paragraphs'])} paragraphs. Listen before publishing.")


def check_catalog(root: Path = ROOT) -> int:
    catalog = load_json(root / "audio/catalog.json")
    if catalog.get("version") != 1 or not isinstance(catalog.get("stories"), dict):
        raise ValueError("Invalid audio catalog")
    for story_id, entry in catalog["stories"].items():
        story = find_story(story_id, root)
        if entry["paragraphs"] != source(story) or entry["source_sha256"] != fingerprint(source(story)):
            raise ValueError(f"Stale narration: {story_id}")
        if entry.get("voice") not in VOICES or entry.get("review") != "playback-checked" or entry.get("provider") != "azure-speech-f0":
            raise ValueError("Unreviewed or unsupported narration")
        if len(entry["files"]) != len(entry["paragraphs"]):
            raise ValueError("Missing paragraph recording")
        for i, item in enumerate(entry["files"], 1):
            if item["path"] != f"audio/{story_id}/{i:02d}.mp3" or not re.fullmatch(r"[a-z0-9_]+", story_id):
                raise ValueError("Unsafe audio path")
            path = (root / item["path"]).resolve()
            if not path.is_relative_to((root / "audio").resolve()):
                raise ValueError("Audio is outside repository")
            data = path.read_bytes()
            validate_audio(data)
            if item["sha256"] != digest(data) or item["bytes"] != len(data):
                raise ValueError("Audio checksum mismatch")
    return len(catalog["stories"])


def publish(plan: dict, folder: Path, root: Path = ROOT) -> None:
    story_id = plan["story_id"]
    if prepare(find_story(story_id, root), plan["voice"]) != plan:
        raise ValueError("Draft no longer matches published text; prepare it again")
    files = []
    recordings = [(folder / f"{i:02d}.mp3").read_bytes() for i in range(1, len(plan["paragraphs"]) + 1)]
    for data in recordings:
        validate_audio(data)
    catalog = load_json(root / "audio/catalog.json")
    if story_id in catalog["stories"]:
        raise ValueError("Narration already published; review changes explicitly before replacing it")
    for i, data in enumerate(recordings, 1):
        relative = f"audio/{story_id}/{i:02d}.mp3"
        path = root / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        files.append({"path": relative, "sha256": digest(data), "bytes": len(data)})
    catalog["stories"][story_id] = {**plan, "provider": "azure-speech-f0", "review": "playback-checked", "files": files}
    (root / "audio/catalog.json").write_text(json_text(catalog), encoding="utf-8")
    check_catalog(root)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=["prepare", "generate", "publish", "check"])
    parser.add_argument("story", nargs="?")
    parser.add_argument("--voice", choices=VOICES, default=VOICES[0])
    parser.add_argument("--resource-id")
    parser.add_argument("--playback-checked", action="store_true", help="Confirm every draft MP3 was played and checked")
    args = parser.parse_args()
    if args.action == "check":
        print(f"Validated {check_catalog()} published narrations.")
        return
    if not args.story or not re.fullmatch(r"[a-z0-9_]+", args.story):
        parser.error("Specify a published story ID")
    folder = ROOT / ".tmp/audio-drafts" / args.story
    plan = prepare(find_story(args.story), args.voice)
    plan_path = folder / "plan.json"
    if args.action == "prepare":
        if plan_path.exists() and load_json(plan_path) != plan:
            raise ValueError("Existing draft differs; move it aside before preparing a new voice/text")
        folder.mkdir(parents=True, exist_ok=True)
        plan_path.write_text(json_text(plan), encoding="utf-8")
        for i, paragraph in enumerate(plan["paragraphs"], 1):
            (folder / f"{i:02d}.ssml").write_bytes(ssml(paragraph, args.voice))
        print(f"Prepared {args.story}: {len(plan['paragraphs'])} paragraphs, "
              f"{sum(len(s['text']) for p in plan['paragraphs'] for s in p['sentences'])} characters.")
        return
    if load_json(plan_path) != plan:
        raise ValueError("Prepare a matching draft first")
    if args.action == "generate":
        if not args.resource_id:
            parser.error("--resource-id is required")
        generate(plan, folder, args.resource_id)
    elif args.playback_checked:
        publish(plan, folder)
        print(f"Published paragraph narration for {args.story}.")
    else:
        parser.error("Listen to every paragraph, then use --playback-checked")


if __name__ == "__main__":
    configure_console()
    try:
        main()
    except Exception as error:
        # Network/CLI errors must never dump request headers, keys or credentials.
        print(str(error) if isinstance(error, (ValueError, FileNotFoundError)) else "Audio operation failed; check local setup.", file=sys.stderr)
        sys.exit(1)
