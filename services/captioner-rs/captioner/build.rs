fn main() {
    #[cfg(feature = "turbo-ffi")]
    {
        // Re-run on source or env changes
        println!("cargo:rerun-if-changed=src/ffi/decoder.c");
        println!("cargo:rerun-if-env-changed=LIBJPEG_TURBO_PREFIX");

        let mut cc = cc::Build::new();
        cc.file("src/ffi/decoder.c");
        // Prefer broadly-supported C standard
        cc.std("c11");

        match pkg_config::Config::new().atleast_version("3.0").probe("libturbojpeg") {
            Ok(lib) => {
                // Use include paths discovered by pkg-config for the C compile step
                for p in lib.include_paths {
                    cc.include(p);
                }
                // Linking is already handled by pkg-config via cargo metadata
            }
            Err(_) => {
                // Fallback: allow custom install prefix or common default locations
                if let Ok(prefix) = std::env::var("LIBJPEG_TURBO_PREFIX") {
                    println!("cargo:rustc-link-search=native={}/lib", prefix);
                    cc.include(format!("{}/include", prefix));
                } else {
                    // Homebrew (Apple Silicon) and common local prefix
                    println!("cargo:rustc-link-search=native=/opt/homebrew/lib");
                    println!("cargo:rustc-link-search=native=/usr/local/lib");
                    cc.include("/opt/homebrew/include");
                    cc.include("/usr/local/include");
                }
                println!("cargo:rustc-link-lib=turbojpeg");
            }
        }

        cc.compile("decoder");
    }
}
