import copy

from tools.reinforcement_metrics import generation_input, lexical_counts, batch_metrics
from tools.story_utils import ROOT, json_text, load_json
from tools.tokenize_story import make_tokenizer, tokenize_text


def context_fixture(stamp):
    context, _ = generation_input(ROOT / 'schema', ROOT / 'profiles/learner-profile.example.json')
    context = copy.deepcopy(context)
    context.update(context_version='1.0', generated_at=stamp)
    for key in ('known_vocabulary', 'learning_vocabulary'):
        context[key] = [{k: word[k] for k in ('lemma', 'reading')} for word in context[key]]
    return context


def test_context_selection_uses_timestamp_and_ignores_invalid_newer_file(tmp_path):
    older = context_fixture('2026-10-05T00:00:00Z')
    newer = context_fixture('2026-10-06T00:00:00Z')
    (tmp_path / 'yomustory-learner-context-9999.json').write_text(json_text(older), encoding='utf-8')
    chosen = tmp_path / 'yomustory-learner-context-0000.json'
    chosen.write_text(json_text(newer), encoding='utf-8')
    (tmp_path / 'yomustory-learner-context-invalid.json').write_text('{"generated_at":"2099-01-01T00:00:00Z"}', encoding='utf-8')
    before = {p.name: p.read_bytes() for p in tmp_path.iterdir()}
    context, source = generation_input(tmp_path)
    assert context == newer
    assert source == {'kind': 'learner_context', 'path': chosen.as_posix()}
    assert before == {p.name: p.read_bytes() for p in tmp_path.iterdir()}


def test_profile_fallback_does_not_claim_runtime_knowledge(tmp_path):
    profile = ROOT / 'profiles/learner-profile.example.json'
    original = profile.read_bytes()
    context, source = generation_input(tmp_path, profile)
    assert source['kind'] == 'profile_only'
    assert context['learning_vocabulary'] == load_json(profile)['learning_vocabulary']
    assert profile.read_bytes() == original
    assert not list(tmp_path.iterdir())


def test_lexical_budget_counts_unlisted_basic_words_and_literal_verbs():
    t = make_tokenizer()
    counts = lexical_counts(tokenize_text('水を置いておく。客が来る。地図を確認しておく。仕事に慣れている。', t))
    assert counts['水'] == counts['置く'] == counts['客'] == counts['来る'] == 1
    assert counts['地図'] == counts['確認'] == counts['仕事'] == counts['慣れる'] == 1
    assert 'おく' not in counts and 'いる' not in counts


def test_published_batch_budget_coverage_and_nonmutation():
    context, _ = generation_input(ROOT / 'schema', ROOT / 'profiles/learner-profile.example.json')
    stories = [load_json(ROOT / 'stories' / category / f'{category}_002.json')
               for category in ('daily', 'work', 'travel', 'japan', 'cooking')]
    before = copy.deepcopy(stories)
    t = make_tokenizer()
    titles = {s['id']: tokenize_text(s['metadata']['title'], t) for s in stories}
    result = batch_metrics(stories, context, titles)
    assert result['learning_vocabulary_used'] == result['learning_vocabulary_available'] == 3
    assert result['learning_vocabulary_in_multiple_stories'] == 3
    assert all(s['new_lexical_count'] <= 8 for s in result['stories'])
    assert all(2 <= n <= 4 for s in result['stories'] for n in s['target_occurrences'].values())
    assert all(len(s['comprehension']['questions']) == 3 and s['generation']['validated'] for s in stories)
    assert stories == before
    assert result == batch_metrics(list(reversed(stories)), context, titles)
