BLIP Fine-Tuning (Colab/Kaggle)

Overview

- Model: Salesforce/blip-image-captioning-base (BLIP) from Hugging Face Transformers
- Goal: Light fine-tune on product-style captions; freeze vision encoder, tune the text decoder head
- Exports: Saved HF model directory; optional ONNX export for deployment

Quick Start (Colab/Kaggle)

1) Start a GPU notebook (T4/P100 or better). In Colab: Runtime → Change runtime type → GPU.
2) Install deps:
   pip install -U torch torchvision transformers datasets accelerate tensorboard pillow
   pip install -U optimum onnx onnxruntime-gpu  # optional, for ONNX export
3) Upload this repo folder or fetch this script:
   tools/blip_finetune/train_blip.py
4) Run training (small sample):
   python tools/blip_finetune/train_blip.py \
     --output_dir ./blip-finetuned \
     --epochs 1 --batch_size 16 --lr 2e-5 --max_steps 1000 \
     --dataset coco_captions --sample 10000
5) Export to ONNX (optional):
   python tools/blip_finetune/train_blip.py --export_onnx --model_dir ./blip-finetuned --onnx_out ./onnx_out

Notes

- Default dataset is MSCOCO captions (train subset), downsampled with --sample for speed.
- For Conceptual Captions or custom CSVs, see flags in the training script.
- Logging: prints to stdout; enable TensorBoard with --tb to log to ./runs.

