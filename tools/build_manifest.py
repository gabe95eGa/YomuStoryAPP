"""Build a deterministic manifest; fail without replacing output on any error."""
from __future__ import annotations

import argparse
import os
import tempfile
from pathlib import Path
from typing import Any

if __package__:
    from .story_utils import ROOT, configure_console, discover_stories, json_text, print_failures, validate_files
else:
    from story_utils import ROOT, configure_console, discover_stories, json_text, print_failures, validate_files


def build_manifest(root: Path = ROOT) -> dict[str, Any]:
    root = root.resolve()
    paths = discover_stories(root / "stories")
    if not paths:
        raise ValueError("no story JSON files found")
    valid, failures = validate_files(paths)
    if failures:
        print_failures(failures)
        raise ValueError(f"{len(failures)} invalid stories; manifest was not written")
    items = []
    for path, story in valid.items():
        # Resolve symlinks before accepting any file outside the library root.
        relative = path.resolve().relative_to(root)
        item = {"id": story["id"]}
        for key in ("title", "title_es", "level", "difficulty", "estimated_minutes", "topics"):
            item[key] = story["metadata"][key]
        item["path"] = relative.as_posix()
        items.append(item)
    return {"schema_version": "1.0",
            "generated_at": max(story["generation"]["created_at"] for story in valid.values()),
            "stories": sorted(items, key=lambda item: item["id"])}


def write_manifest(manifest: dict[str, Any], output: Path) -> None:
    """Atomic replacement; interrupted writing leaves the previous manifest intact."""
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", newline="\n",
                                         dir=output.parent, suffix=".tmp", delete=False) as handle:
            temporary = Path(handle.name)
            handle.write(json_text(manifest))
        os.replace(temporary, output)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def main() -> int:
    configure_console()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=ROOT)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--check", action="store_true", help="fail if saved manifest is stale; do not write")
    args = parser.parse_args()
    output = args.output or args.root / "manifest.json"
    try:
        manifest = build_manifest(args.root)
        if args.check:
            if not output.exists() or output.read_text(encoding="utf-8") != json_text(manifest):
                raise ValueError("manifest is missing or stale; run tools/build_manifest.py")
        else:
            write_manifest(manifest, output)
    except (ValueError, OSError) as exc:
        print(f"FAIL {exc}")
        return 1
    print(f"Manifest {'verified' if args.check else 'built'}: {len(manifest['stories'])} stories.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
