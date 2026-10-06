"""Enrich a draft with optional local Sudachi tokens and validate before saving."""
from __future__ import annotations

import argparse
import copy
from pathlib import Path
from typing import Any

if __package__:
    from .story_utils import JAPANESE, KANA, configure_console, json_text, load_json, sentences, validate_story
else:
    from story_utils import JAPANESE, KANA, configure_console, json_text, load_json, sentences, validate_story


def make_tokenizer() -> Any:
    try:
        from sudachipy import dictionary
    except ImportError as exc:
        raise ValueError('install tokenizer dependencies: python -m pip install -e ".[tokenizer]"') from exc
    return dictionary.Dictionary(dict="core").create()


def tokenize_text(text: str, tokenizer: Any, targets: set[str] | None = None) -> list[dict[str, Any]]:
    from sudachipy import tokenizer as sudachi

    tokens = []
    cursor = 0
    for morpheme in tokenizer.tokenize(text, sudachi.Tokenizer.SplitMode.C):
        surface = morpheme.surface()
        if text[cursor:cursor + len(surface)] != surface:
            raise ValueError("tokenizer surfaces do not reconstruct original text")
        pos = morpheme.part_of_speech()[0]
        reading = morpheme.reading_form()
        ignore = pos in {"補助記号", "記号", "空白"} or not JAPANESE.search(surface)
        if not reading:
            if not ignore:
                raise ValueError(f"tokenizer has no reading for {surface!r}; annotate manually")
            reading = surface
        token = {"surface": surface, "lemma": morpheme.dictionary_form(), "reading": reading,
                 "start": cursor, "end": cursor + len(surface)}
        if ignore:
            token["ignore_lookup"] = True
        types = {"助詞": "particle", "助動詞": "auxiliary", "動詞": "verb", "名詞": "noun",
                 "形容詞": "adjective", "副詞": "adverb", "補助記号": "punctuation"}
        if pos in types:
            token["type"] = types[pos]
        if token["lemma"] in (targets or set()):
            token["target"] = True
        if JAPANESE.search(surface) and not KANA.fullmatch(reading):
            raise ValueError(f"tokenizer reading for {surface!r} needs manual review")
        if not surface.isspace():
            tokens.append(token)
        cursor += len(surface)
    if cursor != len(text):
        raise ValueError("tokenizer did not consume complete text")
    return tokens


def enrich_story(story: dict[str, Any], tokenizer: Any) -> dict[str, Any]:
    result = copy.deepcopy(story)
    targets = {item["lemma"] for item in result["targets"]["vocabulary"]}
    for sentence in sentences(result):
        sentence["tokens"] = tokenize_text(sentence["text"], tokenizer, targets)
    result["generation"]["validated"] = False
    return result


def main() -> int:
    configure_console()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path)
    parser.add_argument("--output", type=Path, required=True, help="new file; existing files are never overwritten")
    args = parser.parse_args()
    try:
        if args.output.exists():
            raise ValueError(f"output already exists: {args.output}")
        story = enrich_story(load_json(args.input), make_tokenizer())
        errors = validate_story(story)
        if errors:
            raise ValueError("\n".join(errors))
        args.output.parent.mkdir(parents=True, exist_ok=True)
        with args.output.open("x", encoding="utf-8", newline="\n") as handle:
            handle.write(json_text(story))
    except (ValueError, OSError, KeyError, TypeError) as exc:
        print(f"FAIL {exc}")
        return 1
    print(f"Tokenized and validated: {args.output}; review linguistic accuracy before publication.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
