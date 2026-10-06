"""Prepare local JMdict assets; network access occurs only with --download.

The pinned jmdict-simplified ZIP is read without extracting archive paths.
Only Spanish/English glosses are retained. No stories or profiles are read.
"""
from __future__ import annotations

import argparse
import gzip
import hashlib
import json
from pathlib import Path
import re
import shutil
import sys
from urllib.request import Request, urlopen
import zipfile

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / ".dictionary/source/jmdict-all.json.zip"
OUTPUT = ROOT / "reader/public/dictionary"
FORMAT = 1
CHUNK_SIZE = 1000
LANGUAGES = {"spa": "es", "eng": "en"}


def json_bytes(value: object) -> bytes:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode("utf-8")


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def convert_entry(word: dict, tags: dict[str, str]) -> dict | None:
    def labels(codes: list[str]) -> list[str]:
        # Retain every upstream label, including rare grammatical categories.
        return [tags[code] for code in codes]

    senses = []
    for sense in word["sense"]:
        glosses = []
        for gloss in sense["gloss"]:
            # A few upstream translations are blank placeholders. They are not
            # definitions; omit them so a usable English sense remains fallback.
            if gloss["lang"] not in LANGUAGES or not gloss["text"].strip():
                continue
            item = {"language": LANGUAGES[gloss["lang"]], "text": gloss["text"]}
            if gloss.get("type"):
                item["type"] = gloss["type"]
            if gloss.get("gender"):
                item["gender"] = gloss["gender"]
            glosses.append(item)
        if not glosses:
            continue
        senses.append({
            "glosses": glosses,
            "partsOfSpeech": labels(sense["partOfSpeech"]),
            "fields": labels(sense["field"]),
            "misc": labels(sense["misc"]),
            "dialects": labels(sense["dialect"]),
            "notes": sense["info"],
            "appliesToSpellings": sense["appliesToKanji"],
            "appliesToReadings": sense["appliesToKana"],
        })
    if not senses:
        return None
    spellings = [{"text": form["text"], "common": form["common"], "labels": labels(form["tags"])}
                 for form in word["kanji"]]
    readings = [{"text": form["text"], "common": form["common"], "labels": labels(form["tags"]),
                 "appliesToSpellings": form["appliesToKanji"]} for form in word["kana"]]
    if not readings or not word["id"].isdigit():
        raise ValueError("Invalid dictionary entry")
    return {"id": word["id"], "provider": "jmdict", "spellings": spellings,
            "readings": readings, "senses": senses}


def build_assets(data: dict, output: Path, provenance: dict, chunk_size: int = CHUNK_SIZE) -> dict:
    if data.get("version") != "3.6.2" or not isinstance(data.get("words"), list):
        raise ValueError("Unsupported jmdict-simplified source format")
    # Publish manifest last, so a failed build preserves the previous working version.
    source_digest = provenance["sha256"]
    version = sha256(json_bytes({"source": source_digest, "format": FORMAT, "chunk": chunk_size,
                                "encoding": "gzip-binary", "transform": 2}))[:24]
    version_dir = output / version
    version_dir.mkdir(parents=True, exist_ok=True)
    chunks, batch, ids = [], [], set()
    count, spanish_count, expanded_bytes = 0, 0, 0

    def flush() -> None:
        nonlocal expanded_bytes
        raw = json_bytes(batch)
        packed = gzip.compress(raw, compresslevel=9, mtime=0)
        # A binary extension prevents static servers from automatically decoding
        # .gz responses before the browser can verify their compressed checksum.
        name = f"entries-{len(chunks):04d}.json.gz.bin"
        (version_dir / name).write_bytes(packed)
        chunks.append({"path": f"{version}/{name}", "sha256": sha256(packed),
                       "entries": len(batch), "bytes": len(packed)})
        expanded_bytes += len(raw)
        batch.clear()

    for word in data["words"]:
        entry = convert_entry(word, data["tags"])
        if entry is None:
            continue
        if entry["id"] in ids:
            raise ValueError(f"Duplicate entry ID: {entry['id']}")
        ids.add(entry["id"])
        count += 1
        spanish_count += any(g["language"] == "es" for s in entry["senses"] for g in s["glosses"])
        batch.append(entry)
        if len(batch) == chunk_size:
            flush()
    if batch:
        flush()
    if count == 0:
        raise ValueError("Dictionary contains no Spanish or English entries")
    notice = (ROOT / "dictionary/NOTICE.md").read_bytes()
    (output / "NOTICE.md").write_bytes(notice)
    manifest = {"format": FORMAT, "version": version, "entryCount": count,
                "spanishEntryCount": spanish_count, "source": provenance,
                "dictionaryDate": data["dictDate"], "languages": ["es", "en"],
                "expandedBytes": expanded_bytes, "compressedBytes": sum(c["bytes"] for c in chunks),
                "chunks": chunks}
    temporary = output / "manifest.json.tmp"
    temporary.write_bytes(json_bytes(manifest))
    temporary.replace(output / "manifest.json")
    for directory in output.iterdir():
        if directory.is_dir() and directory.name != version and re.fullmatch(r"[a-f0-9]{24}", directory.name):
            # Only our generated version directories, confined to the output root.
            if directory.resolve().parent != output.resolve():
                raise ValueError("Generated directory resolved outside output root")
            shutil.rmtree(directory)
    return manifest


def download_source(lock: dict, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_suffix(".download")
    request = Request(lock["url"], headers={"User-Agent": "YomuStory dictionary preparation"})
    with urlopen(request, timeout=120) as response, temporary.open("wb") as target:
        while block := response.read(1024 * 1024):
            target.write(block)
    if sha256(temporary.read_bytes()) != lock["sha256"]:
        temporary.unlink()
        raise ValueError("Source checksum mismatch; archive was not installed")
    temporary.replace(destination)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--download", action="store_true", help="Download the pinned archive before building")
    args = parser.parse_args()
    try:
        lock = json.loads((ROOT / "dictionary/source.lock.json").read_text(encoding="utf-8"))
        if args.download:
            download_source(lock, SOURCE)
        if not SOURCE.exists():
            raise ValueError("Dictionary source absent. Run with --download once.")
        if sha256(SOURCE.read_bytes()) != lock["sha256"]:
            raise ValueError("Source checksum mismatch. Restore the pinned archive with --download.")
        with zipfile.ZipFile(SOURCE) as archive:
            names = [name for name in archive.namelist() if name.endswith(".json")]
            if len(names) != 1:
                raise ValueError("Expected a single JSON dictionary in the archive")
            with archive.open(names[0]) as stream:
                data = json.load(stream)
        if data["dictDate"] != lock["date"]:
            raise ValueError("Source date does not match lock file")
        result = build_assets(data, OUTPUT, lock)
        print(f"Prepared {result['entryCount']:,} entries ({result['spanishEntryCount']:,} with Spanish), "
              f"{result['compressedBytes'] / 1024**2:.1f} MiB compressed / "
              f"{result['expandedBytes'] / 1024**2:.1f} MiB JSON, version {result['version']}.")
        return 0
    except (OSError, ValueError, KeyError, zipfile.BadZipFile) as error:
        print(f"Dictionary build failed: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
