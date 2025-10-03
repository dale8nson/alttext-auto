use serde::{Deserialize, Serialize};
use axum::{Router, Json, routing::{get, post}};

async fn health() -> &'static str {
    "ok\n"
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

async fn caption(Json(req): Json<CaptionReq>) -> Json<CaptionResp> {
    let base = req.product_title.as_deref().unwrap_or("Product photo").trim();

    let mut alt = format!("{base} on a plain background");
    if alt.len() > 125 {
        alt.truncate(125);
    }

    let resp = CaptionResp { alt_text: alt, tags: vec![]};
    Json(resp)
}

#[tokio::main]
async fn main() {
    let app = Router::new().route("/health", get(health));

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3005")
        .await
        .expect("port 3005 in use?");
    axum::serve(listener, app).await.unwrap();
}
