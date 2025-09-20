from fastapi import FastAPI
from pydantic import BaseModel, HttpUrl
from typing import Optional
import httpx
from PIL import Image
from io import BytesIO

app = FastAPI()


class CaptionIn(BaseModel):
    image_url: HttpUrl
    title: Optional[str] = None
    vendor: Optional[str] = None


class CaptionOut(BaseModel):
    alt_text: str


@app.post("/caption", response_model=CaptionOut)
async def caption(inp: CaptionIn):
    # Gracefully handle errors and always return a caption
    img: Optional[Image.Image] = None
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(str(inp.image_url))
            r.raise_for_status()
        # guard too large downloads (basic cap)
        if len(r.content) > 5 * 1024 * 1024:
            raise RuntimeError("image-too-large")
        img = Image.open(BytesIO(r.content)).convert("RGB")
    except Exception:
        img = None

    if img is not None:
        alt = naive_alt(img, title=inp.title, vendor=inp.vendor)
    else:
        # Fallback caption without image metrics
        core: list[str] = []
        if inp.title:
            core.append(inp.title.strip())
        core.append("product photo")
        alt = ", ".join(core)[:140]

    return CaptionOut(alt_text=alt)


def naive_alt(img: Image.Image, title: Optional[str], vendor: Optional[str]) -> str:
    w, h = img.size
    shape = "square" if abs(w-h) < max(w,h)*0.1 else ("landscape" if w>h else "portrait")
    core: list[str] = []
    if title:
        t = title.strip()
        # strip vendor/brand words from title to avoid duplication
        if vendor and vendor.lower() in t.lower():
            t = " ".join([w for w in t.split() if w.lower() != vendor.lower()])
        core.append(t)
    core.append(f"product photo, {shape} {w}x{h}px")
    alt = ", ".join([c for c in core if c]).strip()[:140]
    return alt
