#[test]
fn decode_equivalence_dimensions() {
    let bytes = include_bytes!("fixtures/sample.jpg");

    let img_image = image::load_from_memory(bytes).expect("valid jpeg");

    #[cfg(feature = "turbo")]
    {
        let rgb: image::RgbImage = turbojpeg::decompress_image(bytes).expect("valid jpeg");
        let img_turbo = image::DynamicImage::ImageRgb8(rgb);
        assert!(img_image.width() == img_turbo.width() && img_image.height() == img_turbo.height());
    }
}
