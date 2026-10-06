"""Shared UTF-8 loading, schema checks, and semantic story validation."""
from __future__ import annotations

import json
import math
import re
import sys
from collections import Counter
from functools import lru_cache
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator, FormatChecker

ROOT = Path(__file__).resolve().parents[1]
KANA = re.compile(r"^[\u3041-\u3096\u3099-\u309f\u30a1-\u30fa\u30fc-\u30ff]+$")
JAPANESE = re.compile(r"[\u3041-\u3096\u30a1-\u30fa\u3400-\u9fff\U00020000-\U0002fa1f]")


def configure_console() -> None:
    """Windows redirected streams otherwise use a legacy Western encoding."""
    if sys.platform == "win32":
        for stream in (sys.stdout, sys.stderr):
            if hasattr(stream, "reconfigure"):
                stream.reconfigure(encoding="utf-8")


def learning_state_errors(data: Any, path: str = "$") -> list[str]:
    reserved = {"known", "learning", "mastered", "times_seen", "last_seen", "SRS interval", "srs_interval"}
    errors = []
    if isinstance(data, dict):
        for key, value in data.items():
            if key in reserved:
                errors.append(f"{path}.{key}: user learning state belongs in a separate profile/database")
            errors.extend(learning_state_errors(value, f"{path}.{key}"))
    elif isinstance(data, list):
        for index, value in enumerate(data):
            errors.extend(learning_state_errors(value, f"{path}.{index}"))
    return errors


def _pairs_without_duplicates(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f"duplicate JSON key: {key!r}")
        result[key] = value
    return result


def _reject_constant(value: str) -> None:
    raise ValueError(f"non-JSON numeric constant: {value}")


def load_json(path: Path) -> Any:
    """Reject ambiguous duplicate keys and nonstandard NaN/Infinity values."""
    return json.loads(path.read_text(encoding="utf-8-sig"),
                      object_pairs_hook=_pairs_without_duplicates,
                      parse_constant=_reject_constant)


def json_text(data: Any) -> str:
    return json.dumps(data, ensure_ascii=False, indent=2, allow_nan=False) + "\n"


@lru_cache(maxsize=2)
def schema_validator(kind: str = "story") -> Draft202012Validator:
    paths = {"story": ROOT / "schema/yomustory-v1.schema.json",
             "profile": ROOT / "profiles/learner-profile.schema.json"}
    schema = load_json(paths[kind])
    Draft202012Validator.check_schema(schema)
    return Draft202012Validator(schema, format_checker=FormatChecker())


def validate_schema(data: Any, kind: str = "story") -> list[str]:
    errors = sorted(schema_validator(kind).iter_errors(data),
                    key=lambda error: tuple(str(part) for part in error.absolute_path))
    return [f"$.{'.'.join(map(str, error.absolute_path))}: {error.message}" for error in errors]


def sentences(story: dict[str, Any]) -> list[dict[str, Any]]:
    return [sentence for paragraph in story["content"]["paragraphs"]
            for sentence in paragraph["sentences"]]


def duplicate_errors(values: list[str], label: str) -> list[str]:
    return [f"duplicate {label}: {value!r}" for value, count in sorted(Counter(values).items()) if count > 1]


def _span_errors(item: dict[str, Any], text: str, label: str, surface: bool = False) -> list[str]:
    if "start" not in item:
        return []
    start, end = item["start"], item["end"]
    if not 0 <= start < end <= len(text):
        return [f"{label}: offsets must satisfy 0 <= start < end <= {len(text)}"]
    if surface and text[start:end] != item["surface"]:
        return [f"{label}: token offsets do not match surface {item['surface']!r}"]
    return []


def validate_story(story: Any) -> list[str]:
    """Schema first, then semantics; never change the input or trust validated."""
    errors = validate_schema(story)
    if errors:
        return errors
    errors.extend(learning_state_errors(story))
    paragraphs = story["content"]["paragraphs"]
    all_sentences = sentences(story)
    errors.extend(duplicate_errors([p["id"] for p in paragraphs], "paragraph ID"))
    errors.extend(duplicate_errors([s["id"] for s in all_sentences], "sentence ID"))
    target_lemmas = {v["lemma"] for v in story["targets"]["vocabulary"]}
    target_patterns = {g["pattern"] for g in story["targets"]["grammar"]}
    errors.extend(duplicate_errors([v["lemma"] for v in story["targets"]["vocabulary"]], "target lemma"))
    errors.extend(duplicate_errors([g["pattern"] for g in story["targets"]["grammar"]], "target grammar"))
    used_lemmas: set[str] = set()
    used_patterns: set[str] = set()
    for sentence in all_sentences:
        label, text = f"sentence {sentence['id']!r}", sentence["text"]
        if not JAPANESE.search(text):
            errors.append(f"{label}: text must contain Japanese")
        if not sentence.get("translation_es", "").strip():
            errors.append(f"{label}: missing Spanish translation_es")
        cursor = 0
        previous_end = 0
        for index, token in enumerate(sentence["tokens"]):
            token_label = f"{label}, token {index}"
            errors.extend(_span_errors(token, text, token_label, surface=True))
            if "start" in token:
                position = token["start"]
                if position < previous_end:
                    errors.append(f"{token_label}: tokens overlap or are out of order")
                previous_end = token["end"]
            else:
                position = text.find(token["surface"], cursor)
            if position < cursor:
                errors.append(f"{token_label}: surface missing or not in sentence order")
            else:
                cursor = position + len(token["surface"])
            # Punctuation has a non-kana reading and must explicitly disable lookup.
            if not KANA.fullmatch(token["reading"]):
                if JAPANESE.search(token["surface"]) or not token.get("ignore_lookup", False):
                    errors.append(f"{token_label}: reading must be kana for lexical Japanese tokens")
            if "furigana_segments" in token:
                if "".join(segment["text"] for segment in token["furigana_segments"]) != token["surface"]:
                    errors.append(f"{token_label}: furigana segments must reconstruct surface")
            used_lemmas.add(token["lemma"])
            if token.get("target") and token["lemma"] not in target_lemmas:
                errors.append(f"{token_label}: target token lemma is not declared")
        for point in sentence.get("grammar_points", []):
            errors.extend(_span_errors(point, text, f"{label}, grammar {point['pattern']!r}"))
            used_patterns.add(point["pattern"])
            if point.get("target") and point["pattern"] not in target_patterns:
                errors.append(f"{label}: target grammar {point['pattern']!r} is not declared")
    for lemma in sorted(target_lemmas - used_lemmas):
        errors.append(f"unused target vocabulary: {lemma!r} (must match an annotated token lemma)")
    for pattern in sorted(target_patterns - used_patterns):
        errors.append(f"unused target grammar: {pattern!r} (add a sentence grammar annotation)")
    actual = {"paragraph_count": len(paragraphs), "sentence_count": len(all_sentences),
              "character_count": sum(len(s["text"]) for s in all_sentences)}
    for key, expected in actual.items():
        if key in story["metadata"] and story["metadata"][key] != expected:
            errors.append(f"metadata.{key}: expected {expected}, got {story['metadata'][key]}")
    if not math.isfinite(story["metadata"]["estimated_minutes"]):
        errors.append("metadata.estimated_minutes: must be finite")
    questions = story.get("comprehension", {}).get("questions", [])
    errors.extend(duplicate_errors([q["id"] for q in questions], "question ID"))
    for question in questions:
        if question["type"] == "multiple_choice":
            ids = [option["id"] for option in question["options"]]
            errors.extend(duplicate_errors(ids, f"option ID in question {question['id']!r}"))
            if question["answer"] not in ids:
                errors.append(f"question {question['id']!r}: answer must reference an option ID")
    return errors


def discover_stories(directory: Path) -> list[Path]:
    return sorted(directory.rglob("*.json"), key=lambda path: path.as_posix())


def validate_files(paths: list[Path]) -> tuple[dict[Path, dict[str, Any]], dict[Path, list[str]]]:
    valid: dict[Path, dict[str, Any]] = {}
    failures: dict[Path, list[str]] = {}
    owners: dict[str, list[Path]] = {}
    for path in paths:
        try:
            story = load_json(path)
        except (OSError, ValueError) as exc:
            failures[path] = [f"cannot read JSON: {exc}"]
            continue
        if isinstance(story, dict) and isinstance(story.get("id"), str):
            owners.setdefault(story["id"], []).append(path)
        issues = validate_story(story)
        if issues:
            failures[path] = issues
        else:
            valid[path] = story
    for story_id, locations in owners.items():
        if len(locations) > 1:
            for path in locations:
                failures.setdefault(path, []).append(f"duplicate story ID: {story_id!r}")
                valid.pop(path, None)
    return valid, failures


def print_failures(failures: dict[Path, list[str]]) -> None:
    for path, errors in failures.items():
        print(f"FAIL {path}")
        for error in errors:
            print(f"  - {error}")
