import copy
import os
import subprocess
import sys

import pytest

from tools.build_manifest import build_manifest, write_manifest
from tools.story_utils import ROOT, json_text, load_json


def put_story(root, story, filename="work/one.json"):
    path = root / "stories" / filename
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json_text(story), encoding="utf-8")
    return path


def test_manifest_valid_stories_and_browsing_fields(story, tmp_path):
    put_story(tmp_path, story)
    manifest = build_manifest(tmp_path)
    assert manifest["stories"][0]["id"] == story["id"]
    assert manifest["stories"][0]["path"] == "stories/work/one.json"
    assert "content" not in manifest["stories"][0]
    assert "targets" not in manifest["stories"][0]


def test_manifest_invalid_library_fails_without_overwriting(story, tmp_path):
    path = put_story(tmp_path, story)
    output = tmp_path / "manifest.json"
    write_manifest(build_manifest(tmp_path), output)
    original = output.read_bytes()
    story["metadata"]["difficulty"] = 9
    path.write_text(json_text(story), encoding="utf-8")
    result = subprocess.run([sys.executable, str(ROOT / "tools/build_manifest.py"), "--root", str(tmp_path)], capture_output=True, env={**os.environ, "PYTHONUTF8": "1"})
    assert result.returncode == 1
    assert output.read_bytes() == original


def test_manifest_deterministic_order_and_content_date(story, tmp_path):
    later = copy.deepcopy(story)
    later["id"] = "z_002"
    later["generation"]["created_at"] = "2026-10-07"
    earlier = copy.deepcopy(story)
    earlier["id"] = "a_001"
    put_story(tmp_path, later, "a/later.json")
    put_story(tmp_path, earlier, "z/earlier.json")
    result = build_manifest(tmp_path)
    assert [item["id"] for item in result["stories"]] == ["a_001", "z_002"]
    assert result["generated_at"] == "2026-10-07"
    assert json_text(result) == json_text(build_manifest(tmp_path))


def test_identical_manifest_across_different_machine_paths(story, tmp_path):
    one, two = tmp_path / "one", tmp_path / "another/deep/root"
    put_story(one, story)
    put_story(two, story)
    assert json_text(build_manifest(one)) == json_text(build_manifest(two))


def test_duplicate_ids_fail_manifest(story, tmp_path):
    put_story(tmp_path, story, "work/one.json")
    put_story(tmp_path, story, "work/two.json")
    with pytest.raises(ValueError, match="invalid stories"):
        build_manifest(tmp_path)


def test_empty_library_rejected(tmp_path):
    with pytest.raises(ValueError, match="no story"):
        build_manifest(tmp_path)


def test_committed_manifest_is_current():
    assert load_json(ROOT / "manifest.json") == build_manifest(ROOT)
