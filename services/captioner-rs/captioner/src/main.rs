mod engine;

use axum::{
    Json, Router,
    extract::State,
    routing::{get, post},
};
use serde::{Deserialize, Serialize};
use std::borrow::Cow;
use std::sync::{
    Arc, Mutex,
    atomic::{AtomicU64, AtomicUsize, Ordering},
};
use std::collections::HashMap;
use std::time::Instant as StdInstant;
#[cfg(feature = "turbo-ffi")]
use std::time::Instant;

use tokio::{signal, time::Duration};
#[cfg(feature = "turbo-ffi")]
use tokio::sync::Semaphore;
use tower::ServiceBuilder;
use tower_http::{
    request_id::{MakeRequestUuid, PropagateRequestIdLayer, SetRequestIdLayer},
    trace::{DefaultMakeSpan, DefaultOnRequest, DefaultOnResponse, TraceLayer},
};
use tower_http::cors::CorsLayer;
use tracing::{Level, info};
use std::path::PathBuf;
use tracing_subscriber::EnvFilter;

use captioner::{ApiError, ErrBody};
#[cfg(not(feature = "turbo-ffi"))]
use captioner::decode_image;
#[cfg(feature = "turbo-ffi")]
use captioner::decode;

use bytes::Bytes;
use reqwest::Client;
use unicode_segmentation::UnicodeSegmentation;

struct AppState {
    model_name: &'static str,
    request_count: AtomicU64,
    http: Client,
    // Optional remote inference endpoints for GPU-backed model; tried in order
    remote_infer_urls: Vec<String>,
    // Round-robin index for remote endpoints
    remote_rr: AtomicUsize,
    // Backoff table for endpoints (until Instant)
    remote_backoff: Mutex<HashMap<String, StdInstant>>,
    // Backoff duration in seconds
    remote_backoff_secs: u64,
    #[cfg(feature = "turbo-ffi")]
    decode_limit: Arc<Semaphore>,
    engine_tx: tokio::sync::mpsc::Sender<engine::Job>,
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
#[serde(tag = "status", content = "data")]
enum ItemOutcome {
    Ok(CaptionResp),
    #[allow(dead_code)]
    Error(ErrBody),
}

type Result<T> = std::result::Result<T, ApiError>;

fn make_caption(req: &CaptionReq) -> Result<CaptionResp> {
    if req.image_url.trim().is_empty() {
        return Err(ApiError::BadRequest(Cow::Borrowed("image_url required")));
    }
    if !(req.image_url.starts_with("http://") || req.image_url.starts_with("https://")) {
        return Err(ApiError::BadRequest(Cow::Borrowed(
            "image_url must be http(s)",
        )));
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

    Ok(CaptionResp { alt_text: alt, tags: vec![] })
}

fn clean_caption(mut s: String) -> String {
    let orig = s.clone();
    let lower = s.to_lowercase();
    for p in [
        "a product photo of ",
        "a studio product photo of ",
        "a studio product shot of ",
        "a product image of ",
        "a photo of ",
        "an image of ",
        "a picture of ",
    ] {
        if lower.starts_with(p) {
            s = s.split_at(p.len()).1.to_string();
            break;
        }
    }
    s = s.trim().to_string();
    // Remove dangling connectors at end
    let mut words: Vec<&str> = s.unicode_words().collect();
    while let Some(w) = words.last().copied() {
        if ["with","and","of","on","in","at","for","to","by","a","an"].contains(&w) {
            words.pop();
        } else { break; }
    }
    if words.is_empty() { return orig; }
    s = words.join(" ");
    s
}

fn contains_any(haystack: &str, needles: &[&str]) -> bool {
    let lower = haystack.to_lowercase();
    needles.iter().any(|w| lower.contains(w))
}

fn pick_first<'a>(candidates: &'a[&str], tags: &[String]) -> Option<&'a str> {
    for &c in candidates {
        if tags.iter().any(|t| t.eq_ignore_ascii_case(c)) { return Some(c); }
    }
    None
}

fn pick_from_text<'a>(candidates: &'a[&str], text: &str) -> Option<&'a str> {
    let lower = text.to_lowercase();
    for &c in candidates {
        if lower.contains(c) { return Some(c); }
    }
    None
}

// Compose a product-focused alt text from tags/title when the model caption is generic or person-centric.
fn refine_alt(product_title: Option<&str>, current_alt: &str, tags: &[String]) -> String {
    // Heuristics to detect low-value/person-centric captions
    const PEOPLE: &[&str] = &["woman","women","man","men","person","people","girl","boy","lady","gentleman","model","wearing","holding","sitting","standing","smiling","posing"];
    const PRODUCT_NOUNS: &[&str] = &["shoe","sneaker","boot","loafer","heel","sandal","watch","bag","backpack","wallet","tote","duffle","crossbody","shirt","t-shirt","dress","jacket","pants","jeans","skirt","sweater","hoodie","sweatshirt","coat","blazer","top","hat","sunglasses","glasses","ring","necklace","earrings","phone","case","laptop","tablet","headphones","earbuds","mug","bottle","cup","belt","scarf"];
    const COLORS: &[&str] = &["black","white","gray","charcoal","red","blue","navy","teal","green","olive","yellow","orange","brown","beige","tan","cream","ivory","khaki","purple","maroon","burgundy","pink"];
    const MATERIALS: &[&str] = &["leather","suede","cotton","wool","denim","silk","canvas","mesh","rubber","plastic","nylon","polyester","stainless","steel","gold","silver","ceramic"];
    const DETAILS: &[&str] = &["zipper","buckle","strap","logo","matte","glossy","insulated"];
    const SLEEVES: &[&str] = &["sleeveless","short sleeve","long sleeve","3/4 sleeve","cap sleeve"];
    const NECKLINES: &[&str] = &["cowl neck","v-neck","crew neck","turtleneck","halter","off shoulder","one shoulder","boat neck","square neck","sweetheart"];
    const EMBELLISH: &[&str] = &["sequin","sequined","lace","ribbed","velvet","satin","ruched","pleated","wrap","peplum","crop"];

    // If a title is supplied, always refine to align with it.
    let current_ok = product_title.is_none()
        && !contains_any(current_alt, PEOPLE)
        && pick_from_text(PRODUCT_NOUNS, current_alt).is_some()
        && pick_from_text(COLORS, current_alt).is_some();
    if current_ok {
        return current_alt.to_string();
    }

    // Synonyms for some product categories, to anchor attribute lookup near the intended item
    fn cat_synonyms(cat: &str) -> Vec<&str> {
        match cat {
            "pants" => vec!["pants","trousers","slacks","chinos","denim","jeans","leggings"],
            "sweater" => vec!["sweater","jumper","pullover","knit"],
            "shirt" => vec!["shirt","top","blouse"],
            "t-shirt" => vec!["t-shirt","tee","tee-shirt"],
            _ => vec![cat],
        }
    }

    // Find a candidate term (color/material/detail) that appears adjacent to any category token
    fn find_term_near<'a>(text: &str, cats: &[&str], terms: &'a[&str]) -> Option<&'a str> {
        let lower = text.to_lowercase();
        let words: Vec<&str> = lower.unicode_words().collect();
        let is_term = |tok: &str| -> Option<&'a str> { for &c in terms { if c == tok { return Some(c); } } None };
        for i in 0..words.len() {
            if cats.contains(&words[i]) {
                if i > 0 { if let Some(c) = is_term(words[i-1]) { return Some(c); } }
                if i + 1 < words.len() { if let Some(c) = is_term(words[i+1]) { return Some(c); } }
                if i + 2 < words.len() && ["in","with","of","on"].contains(&words[i+1]) {
                    if let Some(c) = is_term(words[i+2]) { return Some(c); }
                }
            }
        }
        for i in 0..words.len().saturating_sub(1) {
            if cats.contains(&words[i+1]) { if let Some(c) = is_term(words[i]) { return Some(c); } }
        }
        None
    }

    // Determine requested category if title mentions it
    let wanted_category = product_title.and_then(|t| pick_from_text(PRODUCT_NOUNS, t));
    // Determine category first, prefer title, then tags, then caption
    let mut category = wanted_category.or_else(|| pick_first(PRODUCT_NOUNS, tags));
    if category.is_none() {
        if let Some(title) = product_title { category = pick_from_text(PRODUCT_NOUNS, title); }
    }
    if category.is_none() { category = pick_from_text(PRODUCT_NOUNS, current_alt); }

    // Build from tags and, if needed, title
    let mut color = None;
    if let Some(cat) = wanted_category.or(category) {
        let tokens = cat_synonyms(cat);
        color = find_term_near(current_alt, tokens.as_slice(), COLORS);
    }
    if color.is_none() { color = pick_first(COLORS, tags); }
    if color.is_none() { color = product_title.and_then(|t| pick_from_text(COLORS, t)); }
    // Intentionally do NOT fall back to any color in the caption when it isn't
    // near the requested category; this avoids picking the sweater's color for pants.

    // Only include a material if it is near the chosen category (to avoid borrowing sweater materials for pants)
    let mut material = None;
    if let Some(cat) = wanted_category.or(category) {
        let tokens = cat_synonyms(cat);
        material = find_term_near(current_alt, tokens.as_slice(), MATERIALS);
    }
    if material.is_none() { material = pick_first(MATERIALS, tags); }
    if material.is_none() { material = product_title.and_then(|t| pick_from_text(MATERIALS, t)); }

    // Optional style attributes (sleeves, neckline, embellishment)
    let mut sleeve = None;
    if let Some(cat) = wanted_category.or(category) { let tokens = cat_synonyms(cat); sleeve = find_term_near(current_alt, tokens.as_slice(), SLEEVES); }
    if sleeve.is_none() { sleeve = pick_first(SLEEVES, tags); }
    if sleeve.is_none() { sleeve = product_title.and_then(|t| pick_from_text(SLEEVES, t)); }

    let mut neckline = None;
    if let Some(cat) = wanted_category.or(category) { let tokens = cat_synonyms(cat); neckline = find_term_near(current_alt, tokens.as_slice(), NECKLINES); }
    if neckline.is_none() { neckline = pick_first(NECKLINES, tags); }
    if neckline.is_none() { neckline = product_title.and_then(|t| pick_from_text(NECKLINES, t)); }

    let mut emb = None;
    if let Some(cat) = wanted_category.or(category) { let tokens = cat_synonyms(cat); emb = find_term_near(current_alt, tokens.as_slice(), EMBELLISH); }
    if emb.is_none() { emb = pick_first(EMBELLISH, tags); }
    if emb.is_none() { emb = product_title.and_then(|t| pick_from_text(EMBELLISH, t)); }

    // If we still don't know the category, fall back to current_alt with people words stripped
    if category.is_none() {
        let mut s = current_alt.to_string();
        for w in PEOPLE { s = s.replace(w, ""); }
        return clean_caption(s);
    }

    let category = category.unwrap();
    let mut parts: Vec<&str> = Vec::new();
    if let Some(sl) = sleeve { parts.push(sl); }
    if let Some(e) = emb { parts.push(e); }
    if let Some(nk) = neckline { parts.push(nk); }
    if let Some(m) = material { parts.push(m); }
    parts.push(category);
    if let Some(c) = color { parts.push(c); }

    // Optional detail
    if let Some(d) = pick_first(DETAILS, tags)
        .or_else(|| product_title.and_then(|t| pick_from_text(DETAILS, t)))
        .or_else(|| pick_from_text(DETAILS, current_alt)) { parts.push(d); }

    let mut out = parts.join(" ");
    out = out.trim().to_string();
    // Guard against overly short outputs: prefer a short, correct phrase over a long, incorrect one.
    if out.split_whitespace().count() < 2 {
        // Try to add a descriptor from title or tags only (do not borrow from unrelated caption tokens)
        let desc = product_title.and_then(|t| pick_from_text(COLORS, t))
            .or_else(|| product_title.and_then(|t| pick_from_text(MATERIALS, t)))
            .or_else(|| pick_first(COLORS, tags))
            .or_else(|| pick_first(MATERIALS, tags));
        if let Some(d) = desc {
            out = format!("{} {}", d, category);
        } else {
            // Leave as just the category if no safe descriptor is available
            out = category.to_string();
        }
    }
    out
}

async fn fetch_bytes(http: &Client, url: &str) -> Result<Bytes> {
    let resp = http.get(url).send().await?;
    if !resp.status().is_success() {
        return Err(ApiError::BadRequest(Cow::Borrowed(
            "image url not fetchable",
        )));
    }
    resp.bytes()
        .await
        .map_err(|_| ApiError::BadRequest(Cow::Borrowed("read body failed")))
}

async fn health(State(state): State<Arc<AppState>>) -> String {
    let n = state.request_count.load(Ordering::Relaxed);
    format!("ok\nmodel={}; requests={}\n", state.model_name, n)
}

async fn caption(
    State(state): State<Arc<AppState>>,
    Json(req): Json<CaptionReq>,
) -> Result<Json<CaptionResp>> {
    info!("caption called");

    state.request_count.fetch_add(1, Ordering::Relaxed);

    if req.image_url.trim().is_empty() {
        return Err(ApiError::BadRequest(Cow::Borrowed("image_url required")));
    }

    if !(req.image_url.starts_with("http://") || req.image_url.starts_with("https://")) {
        return Err(ApiError::BadRequest(Cow::Borrowed(
            "image_url must be http(s)",
        )));
    }

    // Prefer remote inference when configured; fallback to local engine.
    let eng_out = if !state.remote_infer_urls.is_empty() {
        let n = state.remote_infer_urls.len();
        let start = state.remote_rr.fetch_add(1, Ordering::Relaxed) % n.max(1);
        let mut try_urls = rotate_urls(&state.remote_infer_urls, start);
        try_urls = filter_backoff(&state, try_urls);
        match remote_infer_failover_backoff(&state, &try_urls, &req.image_url, req.product_title.as_deref()).await {
            Ok(o) => o,
            Err(e) => {
                tracing::warn!(err = %e, "all remote inference endpoints failed; falling back to local");
                local_engine_run(&state, &req).await?
            }
        }
    } else {
        local_engine_run(&state, &req).await?
    };

    let base = make_caption(&req)?;
    let raw = if !eng_out.caption.is_empty() { clean_caption(eng_out.caption.clone()) } else { base.alt_text };
    let mut alt = refine_alt(req.product_title.as_deref(), &raw, &eng_out.tags);
    // Truncate without cutting mid‑word
    if alt.len() > 125 {
        let mut cut = 125usize;
        if let Some(pos) = alt[..125].rfind(' ') { cut = pos; }
        alt.truncate(cut);
        // Remove dangling connectors if truncation leaves them at the end
        for conn in [" with", " and", " of", " on", " in", " at", " for", " to", " by"] {
            if alt.ends_with(conn) { alt.truncate(alt.len() - conn.len()); break; }
        }
    }
    let resp = CaptionResp { alt_text: alt, tags: eng_out.tags };

    Ok(Json(resp))
}

async fn local_engine_run(state: &Arc<AppState>, req: &CaptionReq) -> Result<engine::EngineOutput> {
    let bytes = fetch_bytes(&state.http, &req.image_url).await?;
    let img = {
        let span = tracing::info_span!("caption", model = state.model_name);
        let _enter = span.enter();
        #[cfg(feature = "turbo-ffi")]
        {
            let _permit = state.decode_limit.clone().acquire_owned().await.unwrap();
            let t0 = Instant::now();
            let decoded = decode(&bytes).await?;
            tracing::info!(decode_ms = t0.elapsed().as_millis(), "jpeg decoded");
            decoded
        }

        #[cfg(not(feature = "turbo-ffi"))]
        {
            decode_image(bytes.clone()).await?
        }
    };

    let (tx, rx) = tokio::sync::oneshot::channel();
    state
        .engine_tx
        .send(engine::Job { image: img, title: req.product_title.clone(), tx })
        .await
        .map_err(|_| ApiError::Internal)?;
    let eng_out = rx.await.map_err(|_| ApiError::Internal)??;
    Ok(eng_out)
}

#[derive(Serialize, Deserialize)]
struct RemoteInferReq<'a> {
    image_url: &'a str,
    #[serde(skip_serializing_if = "Option::is_none")] title: Option<&'a str>,
}
#[derive(Serialize, Deserialize)]
struct RemoteInferResp { caption: String, #[serde(default)] tags: Vec<String> }

async fn remote_infer(http: &Client, base_url: &str, image_url: &str, title: Option<&str>) -> Result<engine::EngineOutput> {
    let url = format!("{}/v1/infer", base_url.trim_end_matches('/'));
    let req = RemoteInferReq { image_url, title };
    let resp = http
        .post(url)
        .timeout(Duration::from_secs(12))
        .json(&req)
        .send()
        .await
        .map_err(|_| ApiError::BadRequest(Cow::Borrowed("remote infer: send failed")))?;
    if !resp.status().is_success() {
        return Err(ApiError::BadRequest(Cow::Borrowed("remote infer: bad status")));
    }
    let r: RemoteInferResp = resp.json().await.map_err(|_| ApiError::Internal)?;
    Ok(engine::EngineOutput { embed_dim: 0, embedding: vec![], caption: r.caption, tags: r.tags })
}

enum RemoteError { Status(u16), Send, Parse }

async fn remote_infer_try(http: &Client, base_url: &str, image_url: &str, title: Option<&str>) -> std::result::Result<engine::EngineOutput, RemoteError> {
    let url = format!("{}/v1/infer", base_url.trim_end_matches('/'));
    let req = RemoteInferReq { image_url, title };
    let resp = http
        .post(url)
        .timeout(Duration::from_secs(12))
        .json(&req)
        .send()
        .await
        .map_err(|_| RemoteError::Send)?;
    let code = resp.status().as_u16();
    if !(200..300).contains(&code) {
        return Err(RemoteError::Status(code));
    }
    let r: RemoteInferResp = resp.json().await.map_err(|_| RemoteError::Parse)?;
    Ok(engine::EngineOutput { embed_dim: 0, embedding: vec![], caption: r.caption, tags: r.tags })
}

async fn remote_infer_failover_backoff(state: &Arc<AppState>, urls: &[String], image_url: &str, title: Option<&str>) -> Result<engine::EngineOutput> {
    let mut last_err: Option<String> = None;
    for u in urls {
        match remote_infer_try(&state.http, u, image_url, title).await {
            Ok(o) => return Ok(o),
            Err(e) => {
                match e {
                    RemoteError::Status(code) => {
                        tracing::warn!(endpoint = %u, status = %code, "remote endpoint status; backing off if throttled");
                        if code == 429 || code >= 500 { mark_backoff(state, u); }
                        last_err = Some(format!("status:{}", code));
                    }
                    RemoteError::Send => {
                        tracing::warn!(endpoint = %u, "remote endpoint send failed; backing off");
                        mark_backoff(state, u);
                        last_err = Some("send failed".into());
                    }
                    RemoteError::Parse => {
                        tracing::warn!(endpoint = %u, "remote endpoint parse failed");
                        last_err = Some("parse failed".into());
                    }
                }
            }
        }
    }
    Err(ApiError::BadRequest(Cow::Owned(last_err.unwrap_or_else(|| "all remote endpoints failed".into()))))
}

fn rotate_urls(urls: &[String], start: usize) -> Vec<String> {
    if urls.is_empty() { return vec![]; }
    let n = urls.len();
    let mut out = Vec::with_capacity(n);
    for i in 0..n {
        out.push(urls[(start + i) % n].clone());
    }
    out
}

fn filter_backoff(state: &Arc<AppState>, urls: Vec<String>) -> Vec<String> {
    if urls.is_empty() { return urls; }
    let now = StdInstant::now();
    let m = state.remote_backoff.lock().unwrap();
    urls.into_iter().filter(|u| m.get(u).map(|&until| now >= until).unwrap_or(true)).collect()
}

fn mark_backoff(state: &Arc<AppState>, url: &str) {
    let until = StdInstant::now() + std::time::Duration::from_secs(state.remote_backoff_secs);
    let mut m = state.remote_backoff.lock().unwrap();
    m.insert(url.to_string(), until);
}

async fn caption_bulk(
    State(state): State<Arc<AppState>>,
    Json(req): Json<BulkReq>,
) -> Result<Json<BulkResp>> {
    state
        .request_count
        .fetch_add(req.items.len() as u64, Ordering::Relaxed);

    // Process items concurrently for throughput.
    let mut handles = Vec::with_capacity(req.items.len());
    let remote_urls = state.remote_infer_urls.clone();
    for item in req.items.into_iter() {
        let http = state.http.clone();
        let engine_tx = state.engine_tx.clone();
        #[cfg(feature = "turbo-ffi")]
        let decode_limit = state.decode_limit.clone();
        let model_name = state.model_name;
        let remote_urls = remote_urls.clone();
        let state_cl = state.clone();
        handles.push(tokio::spawn(async move {
            // validate URL early
            if item.image_url.trim().is_empty()
                || !(item.image_url.starts_with("http://") || item.image_url.starts_with("https://"))
            {
                return ItemOutcome::Error(ErrBody { error: "invalid image_url".to_string() });
            }

            // Choose remote or local path
            let eng_out = if !remote_urls.is_empty() {
                // Distribute requests by hashing the URL to choose the starting endpoint
                use std::collections::hash_map::DefaultHasher;
                use std::hash::{Hash, Hasher};
                let mut hasher = DefaultHasher::new();
                item.image_url.hash(&mut hasher);
                let start = (hasher.finish() as usize) % remote_urls.len().max(1);
                let try_urls = rotate_urls(&remote_urls, start);
                // No backoff state in this task: simply try in computed order
                match remote_infer_failover_backoff(&state_cl, &try_urls, &item.image_url, item.product_title.as_deref()).await {
                    Ok(o) => o,
                    Err(_) => {
                        // Fallback to local on error
                        let bytes = match fetch_bytes(&http, &item.image_url).await { Ok(b) => b, Err(e) => return ItemOutcome::Error(ErrBody { error: e.to_string() }) };
                        let img = {
                            let span = tracing::info_span!("caption_bulk", model = model_name);
                            let _enter = span.enter();
                            #[cfg(feature = "turbo-ffi")]
                            {
                                let _permit = decode_limit.acquire_owned().await.unwrap();
                                match decode(&bytes).await { Ok(img) => img, Err(e) => return ItemOutcome::Error(ErrBody { error: e.to_string() }) }
                            }
                            #[cfg(not(feature = "turbo-ffi"))]
                            {
                                match decode_image(bytes.clone()).await { Ok(img) => img, Err(e) => return ItemOutcome::Error(ErrBody { error: e.to_string() }) }
                            }
                        };
                        let (tx1, rx1) = tokio::sync::oneshot::channel();
                        if let Err(_) = engine_tx.send(engine::Job { image: img, title: item.product_title.clone(), tx: tx1 }).await {
                            return ItemOutcome::Error(ErrBody { error: "engine unavailable".into() });
                        }
                        match rx1.await { Ok(Ok(e)) => e, Ok(Err(e)) => return ItemOutcome::Error(ErrBody { error: e.to_string() }), Err(_) => return ItemOutcome::Error(ErrBody { error: "engine failed".into() }) }
                    }
                }
            } else {
                // Local path
                let bytes = match fetch_bytes(&http, &item.image_url).await { Ok(b) => b, Err(e) => return ItemOutcome::Error(ErrBody { error: e.to_string() }) };
                let img = {
                    let span = tracing::info_span!("caption_bulk", model = model_name);
                    let _enter = span.enter();
                    #[cfg(feature = "turbo-ffi")]
                    {
                        let _permit = decode_limit.acquire_owned().await.unwrap();
                        match decode(&bytes).await { Ok(img) => img, Err(e) => return ItemOutcome::Error(ErrBody { error: e.to_string() }) }
                    }
                    #[cfg(not(feature = "turbo-ffi"))]
                    {
                        match decode_image(bytes.clone()).await { Ok(img) => img, Err(e) => return ItemOutcome::Error(ErrBody { error: e.to_string() }) }
                    }
                };
                let (tx1, rx1) = tokio::sync::oneshot::channel();
                if let Err(_) = engine_tx.send(engine::Job { image: img, title: item.product_title.clone(), tx: tx1 }).await {
                    return ItemOutcome::Error(ErrBody { error: "engine unavailable".into() });
                }
                match rx1.await { Ok(Ok(e)) => e, Ok(Err(e)) => return ItemOutcome::Error(ErrBody { error: e.to_string() }), Err(_) => return ItemOutcome::Error(ErrBody { error: "engine failed".into() }) }
            };

            // Compose response using make_caption template + tags/caption
            let base = make_caption(&CaptionReq { image_url: item.image_url, product_title: item.product_title.clone() }).unwrap_or(CaptionResp { alt_text: "Product photo".into(), tags: vec![] });
            let raw = if !eng_out.caption.is_empty() { clean_caption(eng_out.caption.clone()) } else { base.alt_text };
            let mut alt = refine_alt(item.product_title.as_deref(), &raw, &eng_out.tags);
            if alt.len() > 125 {
                let mut cut = 125usize;
                if let Some(pos) = alt[..125].rfind(' ') { cut = pos; }
                alt.truncate(cut);
                for conn in [" with", " and", " of", " on", " in", " at", " for", " to", " by"] {
                    if alt.ends_with(conn) { alt.truncate(alt.len() - conn.len()); break; }
                }
            }
            ItemOutcome::Ok(CaptionResp { alt_text: alt, tags: eng_out.tags })
        }));
    }

    let mut out = Vec::with_capacity(handles.len());
    for h in handles {
        match h.await {
            Ok(item) => out.push(item),
            Err(_) => out.push(ItemOutcome::Error(ErrBody { error: "task join failed".into() })),
        }
    }
    Ok(Json(BulkResp { results: out }))
}

#[tokio::main]
async fn main() {
    // Load .env if present so running `cargo run` picks up variables from the repo root
    let _ = dotenvy::dotenv();
    // Also try repo root .env when running from crate dir
    let root_env: PathBuf = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../.." ).join(".env");
    let _ = dotenvy::from_filename(&root_env);

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

    // Heavy BLIP model benefits from fewer concurrent sessions.
    // Default to 1 worker unless explicitly overridden.
    let worker_count: usize = std::env::var("CAPTIONER_WORKERS")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(1);

    let permits = (worker_count * 2).max(2);

    let clip_vis = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../models/clip/onnx32-open_clip-ViT-B-16-openai-visual.onnx")
        .to_string_lossy()
        .into_owned();
    let engine = engine::spawn(
        permits,
        worker_count,
        &clip_vis,
    );

    // Log key toggles for easier debugging of env mismatches
    info!(
        enable_tags = %std::env::var("CAPTIONER_ENABLE_TAGS").unwrap_or_else(|_| "(default)".into()),
        use_qa = %std::env::var("CAPTIONER_USE_QA").unwrap_or_else(|_| "(default)".into()),
        blip_split = %std::env::var("CAPTIONER_BLIP_SPLIT").unwrap_or_else(|_| "(default)".into()),
        blip_kv = %std::env::var("CAPTIONER_BLIP_KV").unwrap_or_else(|_| "(default)".into()),
        blip_prefix = %std::env::var("CAPTIONER_BLIP_PREFIX").unwrap_or_else(|_| "(default)".into()),
        cors_mode = %std::env::var("CAPTIONER_CORS_PERMISSIVE").unwrap_or_else(|_| "(default)".into()),
        remote_endpoints = %std::env::var("CAPTIONER_REMOTE_INFER_URLS").unwrap_or_else(|_| "(none)".into()),
        remote_backoff_secs = %std::env::var("CAPTIONER_REMOTE_BACKOFF_SECS").unwrap_or_else(|_| "(default)".into()),
        "env configured"
    );

    let state = Arc::new(AppState {
        model_name: "onnx32-open_clip-ViT-B-16-openai-visual",
        request_count: AtomicU64::new(0),
        http,
        remote_infer_urls: {
            let mut v: Vec<String> = std::env::var("CAPTIONER_REMOTE_INFER_URLS")
                .ok()
                .map(|s| s.split(',').map(|p| p.trim().to_string()).filter(|x| !x.is_empty()).collect())
                .unwrap_or_else(Vec::new);
            if v.is_empty() {
                if let Ok(u1) = std::env::var("CAPTIONER_REMOTE_INFER_URL") {
                    let u1 = u1.trim().to_string();
                    if !u1.is_empty() { v.push(u1); }
                }
            }
            v
        },
        remote_rr: AtomicUsize::new(0),
        remote_backoff: Mutex::new(HashMap::new()),
        remote_backoff_secs: std::env::var("CAPTIONER_REMOTE_BACKOFF_SECS").ok().and_then(|s| s.parse().ok()).unwrap_or(300),
        #[cfg(feature = "turbo-ffi")]
        decode_limit: Arc::new(Semaphore::new(permits)),
        engine_tx: engine.sender(),
    });

    // CORS: default to permissive for development
    let cors = CorsLayer::permissive();

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
        .layer(layers)
        // Make CORS the outermost layer so preflights and errors include headers
        .layer(cors);

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

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{body, body::Body, http::{Request, StatusCode}};
    use tower::ServiceExt; // for `app.oneshot`
    use tokio::sync::mpsc;

    fn build_test_app(state: Arc<AppState>) -> Router {
        Router::new()
            .route("/health", get(health))
            .route("/v1/caption", post(caption))
            .route("/v1/bulk", post(caption_bulk))
            .with_state(state)
    }

    fn dummy_state() -> Arc<AppState> {
        // Engine stub that immediately replies with fixed tags
        let (tx, mut rx) = mpsc::channel::<engine::Job>(1);
        tokio::spawn(async move {
            while let Some(job) = rx.recv().await {
                let _ = job.tx.send(Ok(engine::EngineOutput {
                    embed_dim: 1,
                    embedding: vec![0.0],
                    caption: String::new(),
                    tags: vec!["red".into(), "shoe".into()],
                }));
            }
        });

        Arc::new(AppState {
            model_name: "test-model",
            request_count: AtomicU64::new(0),
            http: Client::new(),
            remote_infer_urls: Vec::new(),
            remote_rr: AtomicUsize::new(0),
            remote_backoff: Mutex::new(HashMap::new()),
            remote_backoff_secs: 60,
            #[cfg(feature = "turbo-ffi")]
            decode_limit: Arc::new(Semaphore::new(2)),
            engine_tx: tx,
        })
    }

    #[test]
    fn make_caption_validates() {
        let empty = CaptionReq { image_url: "".into(), product_title: None };
        assert!(matches!(make_caption(&empty), Err(ApiError::BadRequest(_))));

        let bad_scheme = CaptionReq { image_url: "ftp://example.com/x.jpg".into(), product_title: None };
        assert!(matches!(make_caption(&bad_scheme), Err(ApiError::BadRequest(_))));
    }

    #[test]
    fn make_caption_truncates() {
        let long_title = "a".repeat(200);
        let req = CaptionReq { image_url: "https://x".into(), product_title: Some(long_title) };
        let out = make_caption(&req).expect("ok");
        assert!(out.alt_text.len() <= 125);
    }

    #[tokio::test]
    async fn health_reports_and_counts() {
        let state = dummy_state();
        let app = build_test_app(state.clone());

        // Initially 0
        let resp = app.clone().oneshot(Request::builder().uri("/health").body(Body::empty()).unwrap()).await.unwrap();
        assert_eq!(resp.status(), StatusCode::OK);

        // Bulk of two increments by 2
        let body = serde_json::json!({
            "items": [
                {"image_url": "https://example.com/a.jpg", "product_title": "A"},
                {"image_url": "https://example.com/b.jpg", "product_title": "B"}
            ]
        });
        let resp = app.clone().oneshot(
            Request::builder()
                .method("POST")
                .uri("/v1/bulk")
                .header("content-type", "application/json")
                .body(Body::from(serde_json::to_vec(&body).unwrap()))
                .unwrap()
        ).await.unwrap();
        assert_eq!(resp.status(), StatusCode::OK);

        // After bulk request_count should be 2
        let txt = app.clone().oneshot(Request::builder().uri("/health").body(Body::empty()).unwrap()).await.unwrap();
        let bytes = body::to_bytes(txt.into_body(), usize::MAX).await.unwrap();
        let s = String::from_utf8(bytes.to_vec()).unwrap();
        assert!(s.contains("requests=2"), "health body: {}", s);
    }

    #[tokio::test]
    async fn caption_validates_input() {
        let state = dummy_state();
        let app = build_test_app(state);
        let body = serde_json::json!({"image_url": "", "product_title": null});
        let resp = app.oneshot(
            Request::builder()
                .method("POST")
                .uri("/v1/caption")
                .header("content-type", "application/json")
                .body(Body::from(serde_json::to_vec(&body).unwrap()))
                .unwrap()
        ).await.unwrap();
        assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
        let bytes = body::to_bytes(resp.into_body(), usize::MAX).await.unwrap();
        let v: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(v["error"], "image_url required");
    }
}
