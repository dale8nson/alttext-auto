use axum::{
    Json, Router,
    extract::State,
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
};
use serde::{Deserialize, Serialize};
use std::sync::{
    Arc,
    atomic::{AtomicU64, Ordering},
};
use tokio::{
    signal,
    time::{Duration},
};
use tower::ServiceBuilder;
use tower_http::{
    request_id::{MakeRequestUuid, PropagateRequestIdLayer, SetRequestIdLayer},
    trace::{DefaultMakeSpan, DefaultOnRequest, DefaultOnResponse, TraceLayer},
};
use tracing::{Level, info};
use tracing_subscriber::EnvFilter;

use image;
use image::DynamicImage;
use reqwest::Client;
use bytes::Bytes;

struct AppState {
    model_name: &'static str,
    request_count: AtomicU64,
    http: Client,
}

#[derive(Deserialize)]
struct CaptionReq {
    image_url: String,
    product_title: Option<String>,
}

#[derive(Serialize)]
struct CaptionResp {
    alt_text: String,
    tags: Vec<String>,
}

#[derive(Deserialize)]
struct BulkReq {
    items: Vec<CaptionReq>,
}

#[derive(Serialize)]
struct BulkResp {
    results: Vec<ItemOutcome>,
}

#[derive(Serialize)]
struct ErrBody {
    error: String,
}

#[derive(Serialize)]
#[serde(tag = "status", content = "data")]
enum ItemOutcome {
    Ok(CaptionResp),
    Error(ErrBody),
}

enum ApiError {
    BadRequest(&'static str),
    Internal,
}

fn make_caption(req: &CaptionReq) -> Result<CaptionResp, ApiError> {
    if req.image_url.trim().is_empty() {
        return Err(ApiError::BadRequest("image_url required"));
    }
    if !(req.image_url.starts_with("http://") || req.image_url.starts_with("https://")) {
        return Err(ApiError::BadRequest("image_url must be http(s)"));
    }

    let base = req
        .product_title
        .as_deref()
        .unwrap_or("Product photo")
        .trim();

    let mut alt = format!("{base} on a plain background");
    if alt.len() > 125 {
        alt.truncate(125);
    }

    Ok(CaptionResp {
        alt_text: alt,
        tags: vec![],
    })
}

#[cfg(feature = "turbo")]
fn is_jpeg(bytes: &[u8]) -> bool {
    bytes.len() >= 3 && bytes[0] == 0xFF && bytes[1] == 0xD8 && bytes[2] == 0xFF
}

async fn fetch_bytes(http: &Client, url: &str) -> Result<Bytes, ApiError> {
    let resp = http.get(url).send().await.map_err(|_| ApiError::BadRequest("fetch failed"))?;
    if !resp.status().is_success() {
        return Err(ApiError::BadRequest("image url not fetchable"));
    }
    resp.bytes().await.map_err(|_| ApiError::BadRequest("read body failed"))

}

impl IntoResponse for ApiError {
    fn into_response(self) -> axum::response::Response {
        match self {
            ApiError::BadRequest(msg) => {
                (StatusCode::BAD_REQUEST, Json(ErrBody { error: msg.into() })).into_response()
            }
            ApiError::Internal => (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrBody {
                    error: "internal error".into(),
                }),
            )
                .into_response(),
        }
    }
}

async fn decode_image(bytes: Bytes) -> Result<DynamicImage, ApiError> {
    #[cfg(feature = "turbo")]
    if is_jpeg(&bytes) {
        let b = bytes.clone();
        let res = tokio::task::spawn_blocking(move || {
            let rgb: image::RgbImage = turbojpeg::decompress_image(&b)
                .map_err(|_| ApiError::BadRequest("invalid jpeg"))?;
            Ok::<DynamicImage, ApiError>(DynamicImage::ImageRgb8(rgb))
        })
        .await
        .map_err(|_| ApiError::Internal)??;
        return Ok(res);
    }

    tokio::task::spawn_blocking(move || image::load_from_memory(&bytes))
    .await
    .map_err(|_| ApiError::Internal)?
    .map_err(|_| ApiError::BadRequest("invalid image data"))
}

async fn health(State(state): State<Arc<AppState>>) -> String {
    let n = state.request_count.load(Ordering::Relaxed);
    format!("ok\nmodel={}; requests={}\n", state.model_name, n)
}

async fn caption(
    State(state): State<Arc<AppState>>,
    Json(req): Json<CaptionReq>,
) -> Result<Json<CaptionResp>, ApiError> {
    info!("caption called");
    
    state.request_count.fetch_add(1, Ordering::Relaxed);

    if req.image_url.trim().is_empty() {
        return Err(ApiError::BadRequest("image_url required"));
    }

    if !(req.image_url.starts_with("http://") || req.image_url.starts_with("https://")) {
        return Err(ApiError::BadRequest("image_url must be http(s)"));
    }

    let bytes = fetch_bytes(&state.http, &req.image_url).await?;
    let _img = decode_image(bytes).await?;

    let resp = make_caption(&req)?;

    Ok(Json(resp))
}

async fn caption_bulk(
    State(state): State<Arc<AppState>>,
    Json(req): Json<BulkReq>,
) -> Result<Json<BulkResp>, ApiError> {
    state
        .request_count
        .fetch_add(req.items.len() as u64, Ordering::Relaxed);

    let mut out = Vec::with_capacity(req.items.len());
    for item in &req.items {
        match make_caption(item) {
            Ok(resp) => out.push(ItemOutcome::Ok(resp)),
            Err(ApiError::BadRequest(msg)) => {
                out.push(ItemOutcome::Error(ErrBody { error: msg.into() }))
            }
            Err(ApiError::Internal) => out.push(ItemOutcome::Error(ErrBody {
                error: "internal error".into(),
            })),
        }
    }
    Ok(Json(BulkResp { results: out }))
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env().add_directive("info".parse().unwrap()))
        .with_target(false)
        .compact()
        .init();

    info!("server starting");

    let http = Client::builder()
    .connect_timeout(Duration::from_secs(3))
    .timeout(Duration::from_secs(10))
    .tcp_keepalive(Duration::from_secs(30))
    .pool_idle_timeout(Duration::from_secs(30))
    .pool_max_idle_per_host(8)
    .build()
    .expect("reqwest client");

    let state = Arc::new(AppState {
        model_name: "clip-vit-b16",
        request_count: AtomicU64::new(0),
        http,
    });

    let layers = ServiceBuilder::new()
        .layer(
            TraceLayer::new_for_http()
                .make_span_with(DefaultMakeSpan::new().level(Level::INFO))
                .on_request(DefaultOnRequest::new().level(Level::INFO))
                .on_response(DefaultOnResponse::new().level(Level::INFO)),
        )
        .layer(PropagateRequestIdLayer::x_request_id())
        .layer(SetRequestIdLayer::x_request_id(MakeRequestUuid));

    let app = Router::new()
        .route("/health", get(health))
        .route("/v1/caption", post(caption))
        .route("/v1/bulk", post(caption_bulk))
        .with_state(state)
        .layer(layers);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3005")
        .await
        .expect("port 3005 in use?");
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await
        .unwrap();
}

async fn shutdown_signal() {
    let _ = signal::ctrl_c().await;
    println!("\nshutting down...");
}

