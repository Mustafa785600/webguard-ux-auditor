function scoreColor(score: number): string {
  if (score >= 80) return "#22c55e";
  if (score >= 50) return "#eab308";
  return "#ef4444";
}

export default function ScoreCard({
  label,
  score,
  color,
}: {
  label: string;
  score: number;
  color: string;
}) {
  const displayColor = scoreColor(score);

  return (
    <div className="score-card">
      <div className="score-label">{label}</div>
      <div className="score-value" style={{ color: displayColor }}>
        {score}
        <span style={{ fontSize: "1.5rem", color: "var(--text-muted)" }}>/100</span>
      </div>
      <div className="score-bar-track">
        <div
          className="score-bar-fill"
          style={{ width: `${score}%`, background: displayColor }}
        />
      </div>
    </div>
  );
}
