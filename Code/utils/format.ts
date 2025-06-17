export function formatDistance(meters: number): string {
  const kilometers = meters / 1000;
  return `${kilometers.toFixed(1)} km`;
}

export function formatPace(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")} /km`;
}
