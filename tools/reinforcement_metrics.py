"""Read-only reinforcement audit; no generation API or learner-state writes.

Counts distinct content lemmas in the reading body and title, not quiz distractors.
This is an explicit editorial vocabulary budget, not a measured mastery/frequency
model. Closed-class grammar words are omitted; basic unlisted content words count.
"""
from __future__ import annotations

import argparse
from collections import Counter
from datetime import datetime
from pathlib import Path
import unicodedata

from jsonschema import Draft202012Validator, FormatChecker

from tools.story_utils import ROOT, configure_console, json_text, load_json, sentences, validate_schema, validate_story

CONTEXT_SCHEMA = ROOT / "schema/yomustory-learner-context-v1.schema.json"
# Reviewed grammatical nominals/deictics, never inferred Known vocabulary.
GRAMMATICAL = {"こと", "とき", "よう", "そう", "この", "その", "これ", "それ", "ここ", "そこ", "どう", "ない"}
INFLECTIONS = {"行ける": "行く", "戻れる": "戻る"}


def normalized(value: str) -> str:
    return unicodedata.normalize("NFKC", value)


def generation_input(root: Path, profile: Path | None = None) -> tuple[dict, dict]:
    """Newest schema-valid context by snapshot timestamp; read-only profile fallback.

    No browser access or search outside the supplied workspace. Context text is
    returned as data; never executed. Invalid files do not mask valid older ones.
    """
    validator = Draft202012Validator(load_json(CONTEXT_SCHEMA), format_checker=FormatChecker())
    candidates = []
    for path in root.rglob("yomustory-learner-context-*.json"):
        if any(part in {"node_modules", ".venv", ".git", "dist"} for part in path.relative_to(root).parts):
            continue
        if path.resolve() == CONTEXT_SCHEMA.resolve():
            continue
        try:
            data = load_json(path)
            if list(validator.iter_errors(data)):
                continue
            stamp = datetime.fromisoformat(data["generated_at"].replace("Z", "+00:00"))
            candidates.append((stamp, path.as_posix(), data))
        except (OSError, ValueError, TypeError, KeyError):
            continue
    if candidates:
        _, path, data = max(candidates, key=lambda item: (item[0], item[1]))
        return data, {"kind": "learner_context", "path": path}
    profile = profile or (ROOT / "profiles/learner-profile.local.json" if (ROOT / "profiles/learner-profile.local.json").exists()
                          else ROOT / "profiles/learner-profile.example.json")
    data = load_json(profile)
    errors = validate_schema(data, "profile")
    if errors:
        raise ValueError("Invalid generation profile: " + "; ".join(errors))
    context = {"language": {key: data[key] for key in ("native_language", "target_language", "current_level", "target_level")},
               **{key: data[key] for key in ("known_vocabulary", "learning_vocabulary", "known_grammar", "learning_grammar")},
               "preferences": {key: data[key] for key in ("interests", "preferred_topics", "avoid_topics", "generation_preferences")}}
    return context, {"kind": "profile_only", "path": profile.as_posix()}


def lexical_counts(tokens: list[dict]) -> Counter:
    result = Counter()
    for i, token in enumerate(tokens):
        lemma = normalized(token["lemma"])
        if token.get("ignore_lookup") or token.get("type") in {"particle", "auxiliary", "punctuation"} or lemma in GRAMMATICAL:
            continue
        previous = tokens[i - 1] if i else {}
        # Aspect, benefactive/request, preparatory auxiliaries after connective te/de.
        if lemma in {"いる", "くる", "くれる", "くださる", "おく"} and previous.get("surface") in {"て", "で"}:
            continue
        # Light suru and state-change naru support the lexical noun/adjective or
        # declared grammar. Literal placement 置く and arrival 来る remain lexical.
        if lemma in {"する", "なる"}:
            continue
        result[INFLECTIONS.get(lemma, lemma)] += 1
    return result


def batch_metrics(stories: list[dict], context: dict, title_tokens: dict[str, list[dict]] | None = None) -> dict:
    known = {normalized(word["lemma"]) for word in context["known_vocabulary"]}
    learning = {normalized(word["lemma"]) for word in context["learning_vocabulary"]}
    grammar = {point["pattern"] for point in context["learning_grammar"]}
    reports, used, reused, new, grammar_counts = [], set(), Counter(), set(), Counter()
    for story in sorted(stories, key=lambda item: item["id"]):
        errors = validate_story(story)
        if errors:
            raise ValueError(story["id"] + ": " + "; ".join(errors))
        ss = sentences(story)
        counts = sum((lexical_counts(s["tokens"]) for s in ss), Counter())
        title = lexical_counts((title_tokens or {}).get(story["id"], []))
        new_words = sorted((counts.keys() | title.keys()) - known - learning)
        target_counts = {t["lemma"]: sum(x["lemma"] == t["lemma"] for s in ss for x in s["tokens"])
                         for t in story["targets"]["vocabulary"]}
        learning_targets = sorted(set(target_counts) & learning)
        used_here = counts.keys() & learning
        used.update(used_here); reused.update(used_here); new.update(new_words)
        annotated = Counter(g["pattern"] for s in ss for g in s.get("grammar_points", []) if g.get("target"))
        grammar_counts.update({g: count for g, count in annotated.items() if g in grammar})
        reports.append({"id": story["id"], "title": story["metadata"]["title"], "characters": sum(len(s["text"]) for s in ss),
                        "learning_targets": learning_targets, "target_occurrences": target_counts,
                        "learning_grammar_occurrences": {g: annotated[g] for g in sorted(grammar) if annotated[g]},
                        "known_words_used": sorted(counts.keys() & known), "new_lexical_items": new_words,
                        "new_lexical_count": len(new_words)})
    return {"learning_vocabulary_available": len(learning), "learning_vocabulary_used": len(used),
            "learning_vocabulary_in_multiple_stories": sum(count > 1 for count in reused.values()),
            "new_lexical_items_in_batch": len(new), "learning_grammar_occurrences": dict(sorted(grammar_counts.items())), "stories": reports}


def main() -> int:
    configure_console()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("stories", type=Path, nargs="+", help="published stories or reviewed drafts")
    parser.add_argument("--root", type=Path, default=ROOT, help="workspace searched for exported context")
    parser.add_argument("--profile", type=Path, help="existing-format fallback profile")
    args = parser.parse_args()
    try:
        context, source = generation_input(args.root, args.profile)
        stories = [load_json(path) for path in args.stories]
        # Existing pinned local tokenizer also accounts for title vocabulary.
        from tools.tokenize_story import make_tokenizer, tokenize_text
        tokenizer = make_tokenizer()
        titles = {s["id"]: tokenize_text(s["metadata"]["title"], tokenizer) for s in stories}
        print(json_text({"source": source, "language": context["language"], **batch_metrics(stories, context, titles)}), end="")
    except (OSError, ValueError, TypeError, KeyError) as exc:
        print(f"FAIL {exc}")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
