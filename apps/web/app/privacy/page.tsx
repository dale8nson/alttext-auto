export default function Privacy() {
  return (
    <div className="prose max-w-none dark:prose-invert">
      <h1>Privacy Policy</h1>
      <p>We process only the minimum data required to provide automatic alt text for your Shopify products. We never store customer PII. Images are processed via URL for the sole purpose of generating captions.</p>
      <h2>Data we store</h2>
      <ul>
        <li>Shop domain, access token, plan and usage metrics.</li>
        <li>Caption logs containing product and image IDs with generated alt text.</li>
      </ul>
      <h2>Data retention</h2>
      <p>Logs may be purged periodically. You can request deletion by contacting support.</p>
    </div>
  );
}

