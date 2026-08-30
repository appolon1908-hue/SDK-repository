from pathlib import Path


def test_sdk_contains_marketing_modules():
    root = Path('python/codestra_sdk')
    required = ['marketing', 'ai', 'communication', 'social']
    for name in required:
        assert (root / f'{name}.py').exists(), f'missing SDK module: {name}'
    text = '\n'.join(p.read_text(encoding='utf-8', errors='ignore') for p in root.rglob('*.py'))
    assert 'Authorization' in text or 'authorization' in text
    assert 'Idempotency-Key' in text or 'idempotency' in text.lower()
    assert 'X-Correlation-ID' in text or 'correlation' in text.lower()


def test_sdk_does_not_embed_provider_credentials():
    root = Path('python/codestra_sdk')
    text = '\n'.join(p.read_text(encoding='utf-8', errors='ignore') for p in root.rglob('*.py')).lower()
    forbidden = ['facebook_access_token=', 'meta_access_token=', 'google_ads_refresh_token=', 'client_secret=']
    for needle in forbidden:
        assert needle not in text
