#!/usr/bin/env python
import io
import os
from typing import Optional

import uvicorn
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import requests
from PIL import Image
import torch
from transformers import AutoProcessor, BlipForConditionalGeneration


MODEL_DIR = os.environ.get("MODEL_DIR") or "Salesforce/blip-image-captioning-base"
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

app = FastAPI(title="BLIP Inference Server")

processor = AutoProcessor.from_pretrained(MODEL_DIR)
model = BlipForConditionalGeneration.from_pretrained(MODEL_DIR).to(DEVICE).eval()


class InferReq(BaseModel):
    image_url: str
    title: Optional[str] = None


def fetch_image(url: str) -> Image.Image:
    r = requests.get(url, timeout=20)
    if r.status_code >= 400:
        raise HTTPException(400, detail="image_url not fetchable")
    return Image.open(io.BytesIO(r.content)).convert("RGB")


@app.post("/v1/infer")
def infer(req: InferReq):
    if not (req.image_url.startswith("http://") or req.image_url.startswith("https://")):
        raise HTTPException(400, detail="image_url must be http(s)")
    image = fetch_image(req.image_url)
    # Prepend title lightly if provided (acts as a steer)
    prompt = req.title.strip() if req.title else None
    inputs = processor(images=image, text=prompt, return_tensors="pt").to(DEVICE)
    with torch.no_grad():
        out = model.generate(**inputs, max_new_tokens=16)
    caption = processor.decode(out[0], skip_special_tokens=True)
    # Basic cleanup per Shopify guidance
    for p in ["a product photo of ", "a studio product photo of ", "a studio product shot of ", "a product image of ", "a photo of ", "an image of ", "a picture of "]:
        if caption.lower().startswith(p):
            caption = caption[len(p):]
            break
    caption = caption.strip()
    # tags left empty by default in this server; Rust refiner can add product-centric details
    return {"caption": caption, "tags": []}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 8001)))

