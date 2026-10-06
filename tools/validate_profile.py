"""Check a separately stored learner profile."""
from __future__ import annotations

import argparse
from pathlib import Path

if __package__:
    from .story_utils import ROOT, configure_console, load_json, validate_schema
else:
    from story_utils import ROOT, configure_console, load_json, validate_schema


def main() -> int:
    configure_console()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("file", nargs="?", type=Path, default=ROOT / "profiles/learner-profile.example.json")
    args = parser.parse_args()
    try:
        errors = validate_schema(load_json(args.file), "profile")
    except (ValueError, OSError) as exc:
        errors = [str(exc)]
    for error in errors:
        print(f"FAIL {error}")
    if not errors:
        print(f"Profile valid: {args.file}")
    return int(bool(errors))


if __name__ == "__main__":
    raise SystemExit(main())
