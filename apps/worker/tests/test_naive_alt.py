from PIL import Image
import os, sys

# Ensure imports resolve to apps/worker/main.py
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import main


def create_img(w: int, h: int) -> Image.Image:
    return Image.new("RGB", (w, h), color=(120, 120, 120))


def test_naive_alt_square_shape_and_vendor_removed():
    img = create_img(100, 100)
    alt = main.naive_alt(img, title="ACME Widget", vendor="ACME")
    assert "Widget" in alt and "ACME" not in alt
    assert "square 100x100px" in alt


def test_naive_alt_landscape_and_portrait():
    img_land = create_img(200, 100)
    alt_land = main.naive_alt(img_land, title=None, vendor=None)
    assert "landscape 200x100px" in alt_land

    img_port = create_img(100, 200)
    alt_port = main.naive_alt(img_port, title=None, vendor=None)
    assert "portrait 100x200px" in alt_port
