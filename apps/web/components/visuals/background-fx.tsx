export default function BackgroundFX() {
  return (
    <div className="fx-wrap pointer-events-none" aria-hidden>
      <div className="fx-aurora">
        <div className="fx-blob a" />
        <div className="fx-blob b" />
        <div className="fx-blob c" />
        <div className="fx-blob d" />
        <div className="fx-blob e" />
        <div className="fx-blob f" />
      </div>
      <div className="fx-grid" />
    </div>
  );
}
