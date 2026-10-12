from collections import Counter
from tools.story_utils import ROOT, load_json, sentences, validate_story


def test_published_v2_lengths_annotations_and_editorial_partition():
    stories = [load_json(ROOT / 'stories' / category / (category + '_003.json'))
               for category in ('daily', 'work', 'travel', 'japan', 'cooking')]
    # Check the public editorial audit without loading the private export in CI.
    review = load_json(ROOT / 'docs/REINFORCEMENT_BATCH_V2_LEXICAL_REVIEW.json')
    for story in stories:
        assert not validate_story(story)
        ss = sentences(story)
        assert 600 <= sum(len(s['text']) for s in ss) <= 750
        assert story['generation']['validated']
        assert len(story['comprehension']['questions']) == 3
        counts = Counter(token['lemma'] for s in ss for token in s['tokens'])
        assert all(counts[target['lemma']] == 3 for target in story['targets']['vocabulary'])
        assert len(review[story['id']]['introduced']) + len(review[story['id']]['uncertain']) <= 8
        groups = review[story['id']]
        words = [word for values in groups.values() for word in values]
        assert len(words) == len(set(words))
