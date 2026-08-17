export function ProgressBar({ percent }: { percent: number }) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div className="progress-track" aria-label={`${clamped}% concluído`}>
      <div className="progress-fill" style={{ width: `${clamped}%` }} />
    </div>
  );
}
