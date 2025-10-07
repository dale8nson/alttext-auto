#[cfg(feature = "turbo-ffi")]
use std::{
    cell::RefCell,
    ffi::{c_int, c_void},
    ptr,
};

use axum::{Json, http::StatusCode, response::IntoResponse};
use bytes::Bytes;
use image::DynamicImage;
use serde::Serialize;

#[derive(Debug)]
pub enum ApiError {
    BadRequest(&'static str),
    Internal,
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

#[derive(Serialize)]
pub struct ErrBody {
    pub error: String,
}

#[cfg(feature = "turbo-ffi")]
struct TJHandle(ptr::NonNull<c_void>);

#[cfg(feature = "turbo-ffi")]
impl Drop for TJHandle {
    fn drop(&mut self) {
        unsafe {
            free_tj3(self.0.as_ptr());
        }
    }
}

thread_local! {
    static TJ: RefCell<Option<TJHandle>> = const {RefCell::new(None)};
}

fn with_tj<R>(f: impl FnOnce(*mut c_void) -> Result<R, ApiError>) -> Result<R, ApiError> {
    TJ.with(|slot| {
        if slot.borrow().is_none() {
            let h = unsafe { init_tj3() };
            if h.is_null() {
                return Err(ApiError::Internal);
            }
            slot.replace(Some(TJHandle(unsafe { ptr::NonNull::new_unchecked(h) })));
        }

        let raw = slot.borrow().as_ref().unwrap().0.as_ptr();
        f(raw)
    })
}

#[cfg(any(feature = "turbo", feature = "turbo-ffi"))]
pub fn is_jpeg(bytes: &[u8]) -> bool {
    bytes.len() >= 3 && bytes[0] == 0xFF && bytes[1] == 0xD8 && bytes[2] == 0xFF
}

#[cfg(feature = "turbo-ffi")]
fn get_size(
    tj3: *mut c_void,
    jpeg_buf: *const u8,
    jpeg_size: usize,
) -> Result<(i32, i32), ApiError> {
    let mut out_w: i32 = 0i32;
    let mut out_h: i32 = 0i32;
    let result = unsafe {
        get_dimensions(
            tj3,
            jpeg_buf,
            jpeg_size,
            &mut out_w as *mut c_int,
            &mut out_h as *mut c_int,
        )
    };
    if result > 0 || out_w <= 0 || out_h <= 0 {
        return Err(ApiError::BadRequest("invalid jpeg"));
    }

    // println!("\nout_w: {} out_h: {}", &out_w, &out_h);

    Ok((out_w, out_h))
}

#[cfg(feature = "turbo-ffi")]
pub async fn decode(jpeg_buf: &Bytes) -> Result<DynamicImage, ApiError> {
    if !is_jpeg(jpeg_buf.as_ref()) {
        return Err(ApiError::BadRequest("invalid jpeg"));
    }
    let b = jpeg_buf.clone();
    let res = tokio::task::spawn_blocking(move || {
        let img = with_tj(|tj3| {
            let (mut w, mut h) = get_size(tj3, b.as_ptr(), b.len())?;
            let capacity = 3 * (w as usize) * (h as usize);
            let mut dst_rgb = Vec::<u8>::with_capacity( capacity);

            unsafe { dst_rgb.set_len(capacity); }

            let result = unsafe {
                decompress(
                    tj3,
                    b.as_ptr(),
                    b.len(),
                    dst_rgb.as_mut_ptr() as *mut c_void,
                    &mut w,
                    &mut h,
                )
            };
            if result != 0 {
                return Err(ApiError::BadRequest("jpeg decompress failed"));
            }
        
            let rgb = image::RgbImage::from_vec(w as u32, h as u32, dst_rgb)
            .ok_or::<ApiError>(ApiError::BadRequest("invalid jpeg"))?;
            Ok(DynamicImage::ImageRgb8(rgb))
        });
        img
    }).await.map_err(|_| ApiError::BadRequest("decode failed"))?;
    res
}


#[cfg(feature = "turbo-ffi")]
unsafe extern "C" {

    fn init_tj3() -> *mut c_void;

    fn free_tj3(tj3: *mut c_void);

    fn get_dimensions(
        tj3: *mut c_void,
        jpeg_buf: *const u8,
        jpeg_size: usize,
        out_w: *mut c_int,
        out_h: *mut c_int,
    ) -> c_int;

    fn decompress(
        tj3: *mut c_void,
        jpeg_buf: *const u8,
        jpeg_size: usize,
        dst_rgb: *mut c_void,
        out_w: *mut c_int,
        out_h: *mut c_int,
    ) -> c_int;

}

pub async fn decode_image(bytes: Bytes) -> Result<DynamicImage, ApiError> {
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
