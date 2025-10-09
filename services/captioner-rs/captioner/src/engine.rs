use crate::ApiError;
use anyhow;
use image::{DynamicImage, GenericImageView};
use ort::{
    execution_providers::{
        CPUExecutionProviderOptions, ExecutionProvider,
    }, session::{self, Session}, Environment
};
use ndarray::{Array4, IxDyn, CowArray};
use ort::value::Value;
use ort::tensor::OrtOwnedTensor;

#[cfg(feature = "cuda")]
use ort::execution_providers::CUDAExecutionProviderOptions;

#[cfg(feature = "coreml")]
use ort::execution_providers::CoreMLExecutionProviderOptions;

use tokio::sync::{mpsc, oneshot};

pub struct Job {
    pub image: DynamicImage,
    pub tx: oneshot::Sender<Result<EngineOutput, ApiError>>,
}

pub struct EngineOutput {
    pub embed_dim: usize,
    pub embedding: Vec<f32>,
}

pub struct Engine {
    tx: mpsc::Sender<Job>,
}

impl Engine {
    pub fn sender(&self) -> mpsc::Sender<Job> {
        self.tx.clone()
    }
}

pub fn spawn(queue_cap: usize, model_path: &str) -> Engine {
    let (tx, mut rx) = mpsc::channel::<Job>(queue_cap);

    let session = build_session(model_path).expect("onnx session");

    tokio::spawn(async move {
        while let Some(Job { image, tx }) = rx.recv().await {
            let out = infer_clip(&session, &image).await;
            let _ = tx.send(out);
        }
    });

    Engine { tx }
}

fn build_session(model_path: &str) -> anyhow::Result<Session> {
    let mut eps: Vec<ExecutionProvider> = Vec::<ExecutionProvider>::new();

    #[cfg(feature = "cuda")]
    {
        let cuda = ExecutionProvider::CUDA(CUDAExecutionProviderOptions::default());
        if cuda.is_available() {
            eps.push(cuda);
        }
    }
    #[cfg(feature = "coreml")]
    {

        let coreml = ExecutionProvider::CoreML(CoreMLExecutionProviderOptions::default());
        if coreml.is_available() {
            eps.push(coreml);
        }
    }

    eps.push(ExecutionProvider::CPU(
        CPUExecutionProviderOptions::default(),
    ));

    let environment = Environment::builder().build()?.into_arc();

    let session = ort::session::SessionBuilder::new(&environment)?
        .with_execution_providers(&eps)?
        .with_model_from_file(model_path)?;

    Ok(session)
}

fn preprocess_clip(img: &DynamicImage) -> Vec<f32> {
  let rgb = img.to_rgb8();
  let resized = image::imageops::resize(
    &rgb, 224, 224, image::imageops::FilterType::CatmullRom
  );

  let mean = [0.48145466f32, 0.4578275, 0.40821073];
  let std = [0.26862954f32, 0.26130258, 0.27577711];

  let mut chw = vec![0f32; 3 * 224 * 224];
  for y in 0..224 {
    for x in 0..224 {
      let p = resized.get_pixel(x, y).0;
      let i = (y as usize) * 224 + x as usize;
      chw[0 * 224 * 224 + i] = (p[0] as f32 / 255.0 - mean[0]) / std[0];
      chw[1 * 224 * 224 + i] = (p[1] as f32 / 255.0 - mean[1]) / std[1];
      chw[2 * 224 * 224 + i] = (p[2] as f32 / 255.0 - mean[2]) / std[2];

    }
  }
  chw
}

async fn infer_clip(session: &Session, img: &DynamicImage) -> Result<EngineOutput, ApiError> {
  let chw = preprocess_clip(img);

  let arr = ndarray::Array::from_shape_vec((1, 3, 224, 224), chw)
  .map_err(|_| ApiError::Internal)?;

  let cow = CowArray::from(arr.into_dyn());

  let val = Value::from_array(session.allocator(), &cow)
  .map_err(|_| ApiError::Internal)?;

  let outputs = session
  .run(vec![val])
  .map_err(|_| ApiError::Internal)?;

  let emb: ort::tensor::OrtOwnedTensor<'_, f32, IxDyn> = 
  outputs[0]
  .try_extract()
  .map_err(|_| ApiError::Internal)?;

  let view = emb.view();

  let mut v: Vec<f32> = view.iter().copied().collect();

  let n = (v.iter().map(|x| x * x).sum::<f32>()).sqrt().max(1e-12);
  for x in &mut v { *x /= n; }

  Ok(EngineOutput { embed_dim: v.len(), embedding: v })
}
