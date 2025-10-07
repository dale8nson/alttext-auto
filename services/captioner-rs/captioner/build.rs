fn main() {
    cc::Build::new()
        .std("c23")
        .include("/opt/homebrew/include")
        .file("./src/ffi/decoder.c")
        .out_dir("./src/ffi")
        .compile("decoder");
}
