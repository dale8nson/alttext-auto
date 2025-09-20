from fastapi.testclient import TestClient
from PIL import Image
from io import BytesIO
import os, sys

# Ensure imports resolve to apps/worker/main.py
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import main


def _png_bytes(w=64, h=64):
    img = Image.new("RGB", (w, h), color=(200, 200, 200))
    buf = BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


class _FakeResponse:
    def __init__(self, content: bytes):
        self.content = content

    def raise_for_status(self):
        return None


class _FakeAsyncClient:
    def __init__(self, *args, **kwargs):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def get(self, url: str):
        # Return a small valid PNG regardless of URL
        return _FakeResponse(_png_bytes(100, 100))


class _FailAsyncClient(_FakeAsyncClient):
    async def get(self, url: str):
        raise RuntimeError("network error")


def test_caption_endpoint_monkeypatch_httpx(monkeypatch):
    # Patch httpx.AsyncClient used inside the endpoint
    import httpx

    monkeypatch.setattr(httpx, "AsyncClient", _FakeAsyncClient)

    client = TestClient(main.app)
    res = client.post(
        "/caption",
        json={
            "image_url": "http://example.com/image.png",
            "title": "ACME Widget",
            "vendor": "ACME",
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert "alt_text" in data
    assert "Widget" in data["alt_text"] and "ACME" not in data["alt_text"]
    assert "square 100x100px" in data["alt_text"]


def test_caption_endpoint_fallback_on_failure(monkeypatch):
    # Force network failure and ensure fallback caption is returned
    import httpx
    monkeypatch.setattr(httpx, "AsyncClient", _FailAsyncClient)
    client = TestClient(main.app)
    res = client.post(
        "/caption",
        json={"image_url": "http://example.com/x.png", "title": "Example", "vendor": None},
    )
    assert res.status_code == 200
    data = res.json()
    assert "alt_text" in data and len(data["alt_text"]) > 0
