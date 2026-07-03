import "./AudioVisualizer.css";

export default function AudioVisualizer({ level = 0, isRecording = false }) {
  const bars = 24;
  const normalised = Math.min(level * 18, 1); // scale up for visibility

  return (
    <div className={`viz ${isRecording ? "viz--active" : ""}`}>
      {Array.from({ length: bars }, (_, i) => {
        const threshold = i / bars;
        const active = normalised > threshold;
        const height = 6 + (i / bars) * 34;

        return (
          <div
            key={i}
            className={`viz-bar ${active ? "viz-bar--active" : ""}`}
            style={{
              height: `${height}px`,
              animationDelay: `${i * 30}ms`,
            }}
          />
        );
      })}
    </div>
  );
}
