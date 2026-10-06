from pathlib import Path

import pytest

from tools.story_utils import load_json


@pytest.fixture
def story():
    return load_json(Path(__file__).parent / "fixtures/valid_story.json")
