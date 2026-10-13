export interface Point { x: number; y: number }
export function compassStatistics(modules: readonly { count: number; compassStatistic?: 'peer-average' }[]): number[] {
  if (modules.some((module) => !Number.isSafeInteger(module.count) || module.count < 0)) throw new Error('Invalid Compass count');
  return modules.map((module, index) => {
    if (module.compassStatistic !== 'peer-average') return module.count;
    const peers = modules.filter((_, position) => position !== index);
    return peers.length ? peers.reduce((total, peer) => total + peer.count, 0) / peers.length : 0;
  });
}

export function compassGeometry(counts: readonly number[]) {
  if (counts.some((count) => !Number.isFinite(count) || count < 0)) throw new Error('Invalid Compass statistic');
  const values = counts.map((count) => Math.log1p(count));
  const maximum = Math.max(0, ...values);
  const point = (index: number, radius: number): Point => {
    const angle = -Math.PI / 2 + index * 2 * Math.PI / counts.length;
    return { x: 300 + Math.cos(angle) * radius, y: 300 + Math.sin(angle) * radius };
  };
  return counts.map((count, index) => ({
    count,
    outer: point(index, 174),
    label: point(index, 232),
    radar: point(index, maximum === 0 ? 0 : 174 * .75 * values[index] / maximum),
  }));
}

export function polygonPoints(points: readonly Point[]): string {
  return points.map(({ x, y }) => `${x.toFixed(3)},${y.toFixed(3)}`).join(' ');
}
