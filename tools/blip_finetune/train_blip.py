#!/usr/bin/env python
import argparse, os, random
from dataclasses import dataclass
from typing import Optional

import torch
from torch.utils.data import Dataset
from PIL import Image

from datasets import load_dataset
from transformers import (
    AutoProcessor,
    BlipForConditionalGeneration,
    Trainer,
    TrainingArguments,
    default_data_collator,
)


def seed_all(seed: int = 42):
    random.seed(seed)
    torch.manual_seed(seed)
    torch.cuda.manual_seed_all(seed)


def load_hf_dataset(name: str, sample: Optional[int] = None):
    if name == "coco_captions":
        ds = load_dataset("coco_captions", split="train")
        # Flatten annotations to one caption per sample (first caption)
        def map_first(example):
            captions = example.get("captions") or []
            cap = captions[0]["text"] if captions else ""
            return {"image": example["image"], "text": cap}
        ds = ds.map(map_first, remove_columns=[c for c in ds.column_names if c not in ("image", "text")])
    elif name == "flickr30k":
        ds = load_dataset("flickr30k", split="train")
        def map_first(example):
            caps = example.get("sentences") or []
            cap = caps[0]["raw"] if caps else ""
            return {"image": example["image"], "text": cap}
        ds = ds.map(map_first, remove_columns=[c for c in ds.column_names if c not in ("image", "text")])
    else:
        raise ValueError(f"Unsupported dataset: {name}")

    if sample and sample > 0:
        ds = ds.shuffle(seed=123).select(range(min(sample, len(ds))))
    return ds


@dataclass
class CaptionRecord:
    image: Image.Image
    text: str


class HFVisionTextDataset(Dataset):
    def __init__(self, ds, processor):
        self.ds = ds
        self.processor = processor

    def __len__(self):
        return len(self.ds)

    def __getitem__(self, idx):
        row = self.ds[idx]
        image = row["image"]
        text = (row.get("text") or "").strip()
        return {"image": image, "text": text}


def freeze_for_lora_like(model: BlipForConditionalGeneration):
    # Freeze vision encoder entirely; leave text decoder trainable
    for p in model.vision_model.parameters():
        p.requires_grad = False
    # Optionally freeze some lower decoder layers for faster fine-tuning
    # Uncomment to freeze more aggressively
    # for name, param in model.text_decoder.named_parameters():
    #     if any(layer in name for layer in ["layers.0", "layers.1", "layers.2", "embed_tokens", "embed_positions"]):
    #         param.requires_grad = False


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dataset", default="coco_captions", help="coco_captions or flickr30k")
    ap.add_argument("--sample", type=int, default=10000, help="sample size for quick runs")
    ap.add_argument("--model", default="Salesforce/blip-image-captioning-base")
    ap.add_argument("--output_dir", default="./blip-finetuned")
    ap.add_argument("--epochs", type=int, default=1)
    ap.add_argument("--batch_size", type=int, default=16)
    ap.add_argument("--lr", type=float, default=2e-5)
    ap.add_argument("--max_steps", type=int, default=-1)
    ap.add_argument("--tb", action="store_true", help="enable TensorBoard logs")
    ap.add_argument("--export_onnx", action="store_true")
    ap.add_argument("--model_dir", default=None, help="use an existing fine-tuned model dir for export")
    ap.add_argument("--onnx_out", default="./onnx_out")
    args = ap.parse_args()

    seed_all(42)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {device}")

    if args.export_onnx:
        model_dir = args.model_dir or args.output_dir
        assert os.path.isdir(model_dir), f"model dir not found: {model_dir}"
        print("Exporting to ONNX via optimum.onnxruntime ...")
        from optimum.onnxruntime import ORTModelForVision2Seq
        os.makedirs(args.onnx_out, exist_ok=True)
        _ = ORTModelForVision2Seq.from_pretrained(model_dir, export=True, from_transformers=True)
        _.save_pretrained(args.onnx_out)
        print(f"ONNX saved to {args.onnx_out}")
        return

    ds = load_hf_dataset(args.dataset, args.sample)
    processor = AutoProcessor.from_pretrained(args.model)
    model = BlipForConditionalGeneration.from_pretrained(args.model)
    freeze_for_lora_like(model)
    model.to(device)

    tr_ds = HFVisionTextDataset(ds, processor)

    def preprocess(batch):
        images = [i for i in batch["image"]]
        text = [t for t in batch["text"]]
        # Avoid starting with "image of" variant words as per Shopify guidance
        text = [t.replace("a photo of ", "").replace("an image of ", "").replace("a picture of ", "").strip() for t in text]
        enc = processor(images=images, text=text, return_tensors="pt", padding=True)
        return enc

    args_train = TrainingArguments(
        output_dir=args.output_dir,
        per_device_train_batch_size=args.batch_size,
        learning_rate=args.lr,
        num_train_epochs=args.epochs,
        max_steps=args.max_steps if args.max_steps > 0 else None,
        logging_steps=50,
        save_steps=500,
        save_total_limit=2,
        report_to=["tensorboard"] if args.tb else [],
        dataloader_num_workers=2,
        remove_unused_columns=False,
        fp16=torch.cuda.is_available(),
    )

    trainer = Trainer(
        model=model,
        args=args_train,
        train_dataset=tr_ds,
        data_collator=default_data_collator,
        preprocess_logits_for_metrics=None,
        tokenizer=processor,
    )

    # Patch trainer's get_train_dataloader to apply preprocess on the fly
    orig = trainer.get_train_dataloader
    def get_train_dataloader_patched():
        dl = orig()
        def _collate(examples):
            batch = {k: [ex[k] for ex in examples] for k in examples[0].keys()}
            enc = preprocess(batch)
            return enc
        dl.collate_fn = _collate
        return dl
    trainer.get_train_dataloader = get_train_dataloader_patched

    trainer.train()
    trainer.save_model(args.output_dir)
    processor.save_pretrained(args.output_dir)
    print(f"Saved to {args.output_dir}")


if __name__ == "__main__":
    main()

