"""Dictionary preparation tests use a small credited upstream extract, offline."""
import gzip
import json
from pathlib import Path

import pytest

from tools.build_dictionary import build_assets, convert_entry, sha256

ROOT = Path(__file__).resolve().parents[1]
SOURCE = json.loads((ROOT / "tests/fixtures/jmdict-source.json").read_text(encoding="utf-8"))
PROVENANCE = {"sha256": "f" * 64, "provider": "JMdict test extract"}


def test_transformed_fixture_matches_real_source():
    expected = json.loads((ROOT / "reader/src/test/dictionary-entries.json").read_text(encoding="utf-8"))
    assert [convert_entry(word, SOURCE["tags"]) for word in SOURCE["words"]] == expected
    assert all(g["language"] in {"es", "en"} for e in expected for s in e["senses"] for g in s["glosses"])


def test_build_is_deterministic_and_keeps_variants_restrictions_and_labels(tmp_path):
    result = build_assets(SOURCE, tmp_path, PROVENANCE, chunk_size=4)
    first = {p.relative_to(tmp_path): p.read_bytes() for p in tmp_path.rglob("*") if p.is_file()}
    assert build_assets(SOURCE, tmp_path, PROVENANCE, chunk_size=4) == result
    assert first == {p.relative_to(tmp_path): p.read_bytes() for p in tmp_path.rglob("*") if p.is_file()}
    entries = []
    for chunk in result["chunks"]:
        packed = (tmp_path / chunk["path"]).read_bytes()
        assert sha256(packed) == chunk["sha256"]
        assert len(packed) == chunk["bytes"]
        entries.extend(json.loads(gzip.decompress(packed)))
    nareru = next(e for e in entries if e["id"] == "1212670")
    assert [s["text"] for s in nareru["spellings"]] == ["慣れる", "馴れる"]
    assert any("Ichidan verb" in s["partsOfSpeech"] for s in nareru["senses"])
    assert nareru["readings"][0]["appliesToSpellings"] == ["*"]
    assert result["entryCount"] == len(entries) == 12
    assert (tmp_path / "NOTICE.md").exists()


def test_invalid_source_does_not_replace_manifest(tmp_path):
    previous = build_assets(SOURCE, tmp_path, PROVENANCE)
    with pytest.raises(ValueError, match="Unsupported"):
        build_assets({"version": "99", "words": []}, tmp_path, PROVENANCE)
    assert json.loads((tmp_path / "manifest.json").read_text(encoding="utf-8")) == previous


def test_duplicate_ids_are_rejected(tmp_path):
    with pytest.raises(ValueError, match="Duplicate"):
        build_assets({**SOURCE, "words": [SOURCE["words"][0]] * 2}, tmp_path, PROVENANCE)


def test_entries_with_other_languages_only_are_omitted():
    word = {**SOURCE["words"][0], "sense": [{**SOURCE["words"][0]["sense"][0],
            "gloss": [{"lang": "ger", "text": "fixture"}]}]}
    assert convert_entry(word, SOURCE["tags"]) is None


def test_blank_upstream_translations_are_omitted_for_english_fallback():
    sense = SOURCE["words"][0]["sense"][0]
    word = {**SOURCE["words"][0], "sense": [{**sense, "gloss": [
        {"lang": "spa", "text": ""}, {"lang": "spa", "text": "   "},
        {"lang": "eng", "text": "actual definition"}]}]}
    entry = convert_entry(word, SOURCE["tags"])
    assert entry["senses"][0]["glosses"] == [{"language": "en", "text": "actual definition"}]
    word["sense"][0]["gloss"] = [{"lang": "spa", "text": ""}]
    assert convert_entry(word, SOURCE["tags"]) is None
