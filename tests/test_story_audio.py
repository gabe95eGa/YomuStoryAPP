import copy
import json
from urllib.error import HTTPError

import pytest

from tools.story_audio import check_catalog, free_resource, prepare, publish, ssml
from tools import story_audio
from tools.story_utils import ROOT, load_json

RESOURCE = '/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/yomu/providers/Microsoft.CognitiveServices/accounts/speech'


@pytest.mark.parametrize('subscription,resource', [
    ({'state': 'Enabled', 'subscriptionPolicies': {'spendingLimit': 'Off'}}, {}),
    ({'state': 'Disabled', 'subscriptionPolicies': {'spendingLimit': 'On'}}, {}),
    ({'state': 'Enabled', 'subscriptionPolicies': {'spendingLimit': 'On'}}, {'sku': {'name': 'S0'}, 'kind': 'SpeechServices'}),
    ({'state': 'Enabled', 'subscriptionPolicies': {'spendingLimit': 'On'}}, {'sku': {'name': 'F0'}, 'kind': 'Other'}),
])
def test_refuses_unprotected_billing_before_retrieving_keys(subscription, resource):
    calls = []
    def query(args):
        calls.append(args)
        assert 'listKeys' not in args[args.index('--url') + 1]
        return subscription if len(calls) == 1 else resource
    with pytest.raises(ValueError, match='Refusing synthesis'):
        free_resource(RESOURCE, query)


def test_only_protected_f0_resource_retrieves_key():
    responses = iter([{'state': 'Enabled', 'subscriptionPolicies': {'spendingLimit': 'On'}},
                      {'sku': {'name': 'F0'}, 'kind': 'SpeechServices', 'location': 'australiaeast'}, {'key1': 'test-only'}])
    assert free_resource(RESOURCE, lambda args: next(responses)) == ('australiaeast', 'test-only')


def test_publish_rejects_stale_japanese_but_allows_translation_updates(tmp_path):
    story = load_json(ROOT / 'stories/cooking/cooking_001.json')
    path = tmp_path / 'stories/cooking/cooking_001.json'
    path.parent.mkdir(parents=True)
    path.write_text(json.dumps(story), encoding='utf-8')
    (tmp_path / 'manifest.json').write_text(json.dumps({'stories': [{'id': story['id'], 'path': 'stories/cooking/cooking_001.json'}]}), encoding='utf-8')
    (tmp_path / 'audio').mkdir()
    (tmp_path / 'audio/catalog.json').write_text('{"version":1,"stories":{}}', encoding='utf-8')
    plan = prepare(story, 'ja-JP-NanamiNeural')
    draft = tmp_path / 'draft'
    draft.mkdir()
    for i in range(1, len(plan['paragraphs']) + 1):
        (draft / f'{i:02d}.mp3').write_bytes(b'ID3' + bytes(300))
    edited = copy.deepcopy(story)
    edited['content']['paragraphs'][0]['sentences'][0]['text'] += '。'
    path.write_text(json.dumps(edited), encoding='utf-8')
    with pytest.raises(ValueError, match='no longer matches'):
        publish(plan, draft, tmp_path)
    assert not (tmp_path / 'audio/cooking_001').exists()
    story['content']['paragraphs'][0]['sentences'][0]['translation_es'] = 'An editorial correction'
    path.write_text(json.dumps(story), encoding='utf-8')
    publish(plan, draft, tmp_path)
    assert check_catalog(tmp_path) == 1
    (tmp_path / 'audio/cooking_001/01.mp3').write_bytes(b'ID3' + bytes(400))
    with pytest.raises(ValueError, match='checksum'):
        check_catalog(tmp_path)


def test_ssml_escapes_text_instead_of_interpreting_markup(story):
    paragraph = {'sentences': [{'text': 'A&B <break/>'}]}
    result = ssml(paragraph, 'ja-JP-NanamiNeural').decode()
    assert 'A&amp;B &lt;break/&gt;' in result


def test_repository_audio_is_current():
    assert check_catalog() >= 0


def test_synthesis_stops_on_quota_or_capacity_failure_without_retry(story, tmp_path, monkeypatch):
    plan = prepare(story, 'ja-JP-NanamiNeural')
    monkeypatch.setattr(story_audio, 'free_resource', lambda resource: ('australiaeast', 'test-only'))
    requests = []
    def reject(request, **kwargs):
        requests.append(request)
        raise HTTPError(request.full_url, 429, 'capacity', None, None)
    monkeypatch.setattr(story_audio, 'urlopen', reject)
    with pytest.raises(ValueError, match='HTTP 429'):
        story_audio.generate(plan, tmp_path, RESOURCE)
    assert len(requests) == 1
    assert list(tmp_path.iterdir()) == []


def test_cached_drafts_do_not_consume_more_synthesis(story, tmp_path, monkeypatch):
    plan = prepare(story, 'ja-JP-NanamiNeural')
    for i in range(1, len(plan['paragraphs']) + 1):
        (tmp_path / f'{i:02d}.mp3').write_bytes(b'ID3' + bytes(300))
    monkeypatch.setattr(story_audio, 'free_resource', lambda resource: ('australiaeast', 'test-only'))
    def unexpected(*args, **kwargs):
        pytest.fail('Cached MP3s must not trigger synthesis requests')
    monkeypatch.setattr(story_audio, 'urlopen', unexpected)
    story_audio.generate(plan, tmp_path, RESOURCE)
