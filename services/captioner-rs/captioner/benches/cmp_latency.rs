use bytes::Bytes;
use captioner::decode;
use criterion::{BenchmarkId, Criterion, Throughput, criterion_group, criterion_main};
use image::{self, DynamicImage};
use once_cell::sync::Lazy;
use std::hint::black_box;
use std::time::Duration;
use tokio::runtime::{Builder, Runtime};

#[cfg(feature = "turbo")]
use turbojpeg;

static JPEG: &[u8] = include_bytes!("../tests/fixtures/sample.jpg");

static RT: Lazy<Runtime> = Lazy::new(|| {
    Builder::new_current_thread()
        .enable_all()
        .build()
        .expect("tokio rt")
});

fn decode_with_image(bytes: &[u8]) -> DynamicImage {
    image::load_from_memory(bytes).expect("valid jpeg for image crate")
}

#[cfg(feature = "turbo")]
fn decode_with_turbo(bytes: &[u8]) -> DynamicImage {
    let rgb: image::RgbImage =
        turbojpeg::decompress_image(bytes).expect("valid jpeg for turbojpeg");
    DynamicImage::ImageRgb8(rgb)
}

#[cfg(feature = "turbo-ffi")]
async fn decode_with_turbo_ffi(bytes: &Bytes) -> DynamicImage {
    decode(bytes).await.expect("this to work")
}

pub fn cmp_latency(c: &mut Criterion) {
    let target_time = Duration::from_secs(15);

    let mut g = c.benchmark_group("decode_jpeg");
    g.measurement_time(target_time);
    g.throughput(Throughput::Bytes(JPEG.len() as u64));
    g.bench_function(BenchmarkId::new("image", JPEG.len()), |b| {
        b.iter(|| {
            let img = decode_with_image(black_box(JPEG));
            black_box(img)
        })
    });
    #[cfg(feature = "turbo")]
    g.bench_function(BenchmarkId::new("turbojpeg", JPEG.len()), |b| {
        b.iter(|| {
            let img = decode_with_turbo(black_box(JPEG));
            black_box(img);
        });
    });

    #[cfg(feature = "turbo-ffi")]
    {
        g.bench_function(BenchmarkId::new("turbo-ffi", JPEG.len()), move |b| {
            let jpeg = Bytes::from_static(JPEG);
            b.iter(|| {
                let img = RT.block_on(async { decode_with_turbo_ffi(black_box(&jpeg)).await });

                black_box(img);
            });
        });
    }
    g.finish();
}

criterion_group!(benched, cmp_latency);
criterion_main!(benched);
