"""Validate a story library or explicitly supplied story files."""
from __future__ import annotations

import argparse
from pathlib import Path

if __package__:
    from .story_utils import ROOT, configure_console, discover_stories, print_failures, validate_files
else:
    from story_utils import ROOT, configure_console, discover_stories, print_failures, validate_files


def main() -> int:
    configure_console()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("files", nargs="*", type=Path)
    parser.add_argument("--stories-dir", type=Path, default=ROOT / "stories")
    args = parser.parse_args()
    if not args.files and not args.stories_dir.is_dir():
        print(f"FAIL story directory does not exist: {args.stories_dir}")
        return 1
    paths = list(dict.fromkeys(path.resolve() for path in (args.files or discover_stories(args.stories_dir))))
    if not paths:
        print("FAIL no story JSON files found")
        return 1
    valid, failures = validate_files(paths)
    print_failures(failures)
    print(f"Validated {len(paths)} stories: {len(valid)} passed, {len(failures)} failed.")
    return int(bool(failures))


if __name__ == "__main__":
    raise SystemExit(main())
