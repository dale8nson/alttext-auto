Shopify Compliance Checklist (Alt Text Service)

General App Requirements

- Uses Shopify APIs meaningfully (product media, webhooks) and does not require desktop software.
- No person-to-person interactions for core functionality; automation via API.
- No off-platform payments; billing via Shopify or Stripe for ancillary services only.

Accessibility and Alt Text

- Alt text generation follows guidance: concise and specific; aim ≤125 characters; absolute max 512.
- Avoids prefixes like “image of” / “picture of”; the service strips those and refines output.
- Decorative images: omit alt text or return an empty string when flagged by the client (planned optional flag).

Data Privacy and Security

- Processes only image URLs and optional product titles; no PII is stored.
- Provides endpoints to comply with data webhook requirements (customers/data_request, customers/redact, shop/redact) in the web app.
- Transport over HTTPS; CORS limited in production.

Operational Notes

- Logs avoid sensitive data; request IDs are propagated.
- Configuration via env vars; secrets injected at deploy time.

