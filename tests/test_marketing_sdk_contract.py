from pathlib import Path


def test_sdk_contains_marketing_modules():
    root = Path('codestra_sdk')
    required = ['marketing', 'ai', 'communication', 'social']
    text = '\n'.join(p.read_text(encoding='utf-8', errors='ignore') for p in root.rglob('*.py'))
    for name in required:
        assert name in text
    assert 'Authorization' in text or 'authorization' in text
    assert 'Idempotency-Key' in text or 'idempotency' in text.lower()
    assert 'X-Correlation-ID' in text or 'correlation' in text.lower()
