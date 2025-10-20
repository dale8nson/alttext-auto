# syntax=docker/dockerfile:1.6

FROM rust:1-bullseye AS builder
WORKDIR /work
# Cache deps
COPY services/captioner-rs/captioner/Cargo.toml services/captioner-rs/captioner/Cargo.lock ./services/captioner-rs/captioner/
COPY services/captioner-rs/captioner/build.rs ./services/captioner-rs/captioner/
RUN mkdir -p services/captioner-rs/captioner/src && \
    echo 'fn main(){}' > services/captioner-rs/captioner/src/main.rs && \
    cargo build -p captioner --release || true

# Build
COPY . .
WORKDIR /work/services/captioner-rs/captioner
RUN cargo build --release

FROM debian:bullseye-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=builder /work/target/release/captioner /app/captioner
# Copy ONNX Runtime dylibs that the ort crate emits next to the binary (copy-dylibs feature)
COPY --from=builder /work/target/release/*.so /app/ 2>/dev/null || true
# Models
COPY services/captioner-rs/models /app/services/captioner-rs/models
ENV RUST_LOG=info
EXPOSE 3005
CMD ["/app/captioner"]

