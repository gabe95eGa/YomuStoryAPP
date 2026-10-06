import pytest

from tools.story_utils import validate_story
from tools.tokenize_story import enrich_story, make_tokenizer, tokenize_text

pytest.importorskip("sudachipy")
pytest.importorskip("sudachidict_core")


@pytest.fixture(scope="module")
def tokenizer():
    return make_tokenizer()


def test_local_inflection_and_offsets(tokenizer):
    text = "仕事に慣れてきました。"
    tokens = tokenize_text(text, tokenizer, {"慣れる"})
    assert "".join(t["surface"] for t in tokens) == text
    assert all(text[t["start"]:t["end"]] == t["surface"] for t in tokens)
    assert any(t["surface"] == "慣れ" and t["lemma"] == "慣れる" and t["target"] for t in tokens)
    assert tokens[-1]["ignore_lookup"]


def test_enrichment_preserves_input_and_resets_flag(story, tokenizer):
    story["generation"]["validated"] = True
    original_tokens = story["content"]["paragraphs"][0]["sentences"][0]["tokens"]
    result = enrich_story(story, tokenizer)
    assert result["generation"]["validated"] is False
    assert story["generation"]["validated"] is True
    assert len(original_tokens) == 2
    assert validate_story(result) == []
