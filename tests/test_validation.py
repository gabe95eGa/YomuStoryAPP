import copy
import os
import subprocess
import sys

import pytest

from tools.story_utils import ROOT, json_text, load_json, sentences, validate_files, validate_schema, validate_story


def first_sentence(story):
    return story["content"]["paragraphs"][0]["sentences"][0]


def assert_rejected(story, phrase):
    assert any(phrase in error for error in validate_story(story))


def test_valid_story_accepted_without_mutation(story):
    original = copy.deepcopy(story)
    assert validate_story(story) == []
    assert story == original


@pytest.mark.parametrize("field", ["schema_version", "id", "metadata", "targets", "content", "generation"])
def test_missing_required_top_level_field(story, field):
    del story[field]
    assert_rejected(story, "required")


@pytest.mark.parametrize("difficulty", [0, 6, 2.5, "2", True])
def test_invalid_difficulty(story, difficulty):
    story["metadata"]["difficulty"] = difficulty
    assert validate_story(story)


def test_duplicate_sentence_id(story):
    story["content"]["paragraphs"][0]["sentences"].append(copy.deepcopy(first_sentence(story)))
    assert_rejected(story, "duplicate sentence ID")


def test_duplicate_paragraph_id(story):
    story["content"]["paragraphs"].append(copy.deepcopy(story["content"]["paragraphs"][0]))
    assert_rejected(story, "duplicate paragraph ID")


def test_unused_vocabulary(story):
    story["targets"]["vocabulary"].append({"lemma": "旅行", "reading": "りょこう"})
    assert_rejected(story, "unused target vocabulary")


def test_unused_grammar(story):
    story["targets"]["grammar"].append({"pattern": "〜ておく"})
    assert_rejected(story, "unused target grammar")


@pytest.mark.parametrize("start,end", [(1, 3), (0, 99), (3, 3), (-1, 2)])
def test_bad_token_offsets(story, start, end):
    first_sentence(story)["tokens"][0].update(start=start, end=end)
    assert validate_story(story)


def test_offset_pair_required(story):
    del first_sentence(story)["tokens"][0]["end"]
    assert_rejected(story, "dependency")


def test_code_point_offsets_with_supplementary_character(story):
    sentence = first_sentence(story)
    sentence["text"] = "😀" + sentence["text"]
    for item in sentence["tokens"] + sentence["grammar_points"]:
        item["start"] += 1
        item["end"] += 1
    assert validate_story(story) == []


def test_missing_surface_even_without_offsets(story):
    token = first_sentence(story)["tokens"][0]
    token.pop("start")
    token.pop("end")
    token["surface"] = "学校"
    assert_rejected(story, "surface missing")


def test_repeated_surfaces_must_occur_distinctly(story):
    sentence = first_sentence(story)
    token = {"surface": "仕事", "lemma": "仕事", "reading": "しごと"}
    sentence["tokens"] = [token, copy.deepcopy(token), sentence["tokens"][1]]
    assert_rejected(story, "surface missing")


def test_overlapping_tokens(story):
    first_sentence(story)["tokens"].insert(1, copy.deepcopy(first_sentence(story)["tokens"][0]))
    assert_rejected(story, "overlap")


def test_bad_grammar_span(story):
    first_sentence(story)["grammar_points"][0]["end"] = 99
    assert_rejected(story, "offsets")


def test_invalid_comprehension_answer(story):
    story["comprehension"]["questions"][0]["answer"] = "missing"
    assert_rejected(story, "answer must reference")


def test_duplicate_question_and_option_ids(story):
    question = story["comprehension"]["questions"][0]
    question["options"][1]["id"] = "a"
    story["comprehension"]["questions"].append(copy.deepcopy(question))
    assert_rejected(story, "duplicate question ID")
    assert_rejected(story, "duplicate option ID")


@pytest.mark.parametrize("kind,answer", [("true_false", True), ("short_answer", "仕事"), ("short_answer", ["仕事", "新しい仕事"])])
def test_other_question_types(story, kind, answer):
    question = story["comprehension"]["questions"][0]
    question.update(type=kind, answer=answer)
    question.pop("options")
    assert validate_story(story) == []


@pytest.mark.parametrize("kind,answer", [("true_false", "true"), ("short_answer", ""), ("short_answer", []), ("essay", "仕事")])
def test_bad_question_type_or_answer_type(story, kind, answer):
    question = story["comprehension"]["questions"][0]
    question.update(type=kind, answer=answer)
    question.pop("options")
    assert validate_story(story)


@pytest.mark.parametrize("field,value", [("text", "   "), ("text", "only English"), ("translation_es", " ")])
def test_empty_or_non_japanese_text_and_empty_translation(story, field, value):
    first_sentence(story)[field] = value
    assert validate_story(story)


def test_missing_translation(story):
    del first_sentence(story)["translation_es"]
    assert_rejected(story, "missing Spanish")


@pytest.mark.parametrize("field", ["surface", "lemma", "reading"])
def test_missing_token_fields(story, field):
    del first_sentence(story)["tokens"][0][field]
    assert validate_story(story)


def test_invalid_reading_cannot_be_bypassed_with_ignore_lookup(story):
    first_sentence(story)["tokens"][0].update(reading="shigoto", ignore_lookup=True)
    assert_rejected(story, "reading must be kana")


def test_furigana_segments_reconstruct_surface(story):
    first_sentence(story)["tokens"][0]["furigana_segments"] = [{"text": "学", "reading": "がく"}]
    assert_rejected(story, "furigana segments")


@pytest.mark.parametrize("field", ["character_count", "sentence_count", "paragraph_count"])
def test_wrong_counts(story, field):
    story["metadata"][field] = 99
    assert_rejected(story, field)


def test_valid_counts_and_unknown_extension(story):
    story["metadata"].update(character_count=len(first_sentence(story)["text"]), sentence_count=1, paragraph_count=1)
    story["future_extension"] = {"example": True}
    assert validate_story(story) == []


def test_invalid_level_and_date(story):
    story["metadata"]["level"] = "N6"
    story["generation"]["created_at"] = "2026-02-30"
    errors = validate_story(story)
    assert any("N6" in error for error in errors)
    assert any("date" in error for error in errors)


def test_validated_flag_does_not_bypass_checks(story):
    story["generation"]["validated"] = True
    story["metadata"]["difficulty"] = 9
    assert validate_story(story)


def test_user_learning_state_kept_separate(story):
    first_sentence(story)["tokens"][0]["times_seen"] = 4
    assert_rejected(story, "user learning state")


def test_invalid_target_item_and_undeclared_annotations(story):
    first_sentence(story)["tokens"][0]["target"] = True
    assert_rejected(story, "not declared")
    story["targets"]["vocabulary"][0]["reading"] = "nareru"
    assert_rejected(story, "reading")


def test_cli_diagnostics_without_python_utf8_env(story, tmp_path):
    story["targets"]["vocabulary"].append({"lemma": "旅行", "reading": "りょこう"})
    path = tmp_path / "story.json"
    path.write_text(json_text(story), encoding="utf-8")
    env = {key: value for key, value in os.environ.items() if key not in {"PYTHONUTF8", "PYTHONIOENCODING"}}
    result = subprocess.run([sys.executable, str(ROOT / "tools/validate_stories.py"), str(path)], capture_output=True, text=True, encoding="utf-8", env=env)
    assert result.returncode == 1
    assert "unused target vocabulary: '旅行'" in result.stdout
    assert "Traceback" not in result.stderr


def test_duplicate_story_ids_include_invalid_owner(story, tmp_path):
    one, two = tmp_path / "one.json", tmp_path / "two.json"
    one.write_text(json_text(story), encoding="utf-8")
    story["metadata"]["difficulty"] = 9
    two.write_text(json_text(story), encoding="utf-8")
    valid, errors = validate_files([one, two])
    assert not valid
    assert all(any("duplicate story ID" in error for error in errors[path]) for path in [one, two])


@pytest.mark.parametrize("content", ['{"id":"a", "id":"b"}', '{"number":NaN}', '{broken'])
def test_reject_ambiguous_and_broken_json(tmp_path, content):
    path = tmp_path / "broken.json"
    path.write_text(content, encoding="utf-8")
    valid, errors = validate_files([path])
    assert not valid
    assert "cannot read JSON" in errors[path][0]


def test_cli_success_and_failure(story, tmp_path):
    path = tmp_path / "story.json"
    path.write_text(json_text(story), encoding="utf-8")
    env = {**os.environ, "PYTHONUTF8": "1"}
    result = subprocess.run([sys.executable, str(ROOT / "tools/validate_stories.py"), str(path)], capture_output=True, text=True, encoding="utf-8", env=env)
    assert result.returncode == 0
    assert "1 passed" in result.stdout
    first_sentence(story)["translation_es"] = ""
    path.write_text(json_text(story), encoding="utf-8")
    result = subprocess.run([sys.executable, str(ROOT / "tools/validate_stories.py"), str(path)], capture_output=True, text=True, encoding="utf-8", env=env)
    assert result.returncode == 1
    assert "translation_es" in result.stdout


def test_profile_example_and_constraints():
    profile = load_json(ROOT / "profiles/learner-profile.example.json")
    assert validate_schema(profile, "profile") == []
    profile["generation_preferences"]["preferred_familiar_vocabulary_proportion"] = 1.5
    assert validate_schema(profile, "profile")


def test_demo_content_complete_and_valid():
    paths = sorted((ROOT / "stories").rglob("*.json"))
    assert len(paths) >= 5
    valid, failures = validate_files(paths)
    assert not failures
    for story in valid.values():
        # The original demo brief required 300–700 characters and 3–8 targets.
        # Reinforcement V1 expressly permits shorter pilots with fewer available
        # learning words; its budget and coverage are tested separately.
        if story["id"].endswith("_001"):
            assert 300 <= story["metadata"]["character_count"] <= 700
            assert 3 <= len(story["targets"]["vocabulary"]) <= 8
        assert 1 <= len(story["targets"]["grammar"]) <= 3
        assert len(story["comprehension"]["questions"]) == 3
        assert all(sentence["translation_es"] for sentence in sentences(story))
