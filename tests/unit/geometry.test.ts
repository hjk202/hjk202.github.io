import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compassGeometry, compassStatistics, polygonPoints } from '../../src/shell/home/geometry.ts';
const radius = (point: { x: number; y: number }) => Math.hypot(point.x - 300, point.y - 300);
test('four to seven modules have equal angles, top start, and fixed outer radius', () => {
  for (const count of [4, 5, 6, 7]) {
    const nodes = compassGeometry(Array.from({ length: count }, (_, i) => i + 1));
    assert.equal(nodes.length, count);
    assert.deepEqual(nodes[0].outer, { x: 300, y: 126 });
    nodes.forEach((node, index) => {
      assert.ok(Math.abs(radius(node.outer) - 174) < 1e-8);
      const next = nodes[(index + 1) % count].outer;
      const cosine = ((node.outer.x - 300) * (next.x - 300) + (node.outer.y - 300) * (next.y - 300)) / 174 ** 2;
      assert.ok(Math.abs(cosine - Math.cos(2 * Math.PI / count)) < 1e-8);
      assert.ok(radius(node.radar) <= 174 * .75 + 1e-8);
    });
  }
});

test('peer average uses raw populations before logarithms, includes zeros and keeps content counts intact', () => {
  const modules = [{ count: 0 }, { count: 0 }, { count: 1, compassStatistic: 'peer-average' as const }, { count: 2 }];
  const statistics = compassStatistics(modules);
  assert.deepEqual(statistics, [0, 0, 2 / 3, 2]);
  assert.equal(modules[2].count, 1);
  const nodes = compassGeometry(statistics);
  assert.ok(Math.abs(radius(nodes[2].radar) / radius(nodes[3].radar) - Math.log1p(2 / 3) / Math.log1p(2)) < 1e-8);
  assert.deepEqual(compassStatistics([{ count: 1, compassStatistic: 'peer-average' }]), [0]);
  assert.deepEqual(compassStatistics([{ count: 0 }, { count: 1, compassStatistic: 'peer-average' }, { count: 0 }]), [0, 0, 0]);
  const expanded = [{ count: 9 }, ...modules];
  assert.equal(compassStatistics(expanded)[3], 11 / 4);
  assert.equal(compassStatistics([...expanded].reverse())[1], 11 / 4);
  assert.deepEqual(compassStatistics([]), []);
  for (const count of [-1, .5, NaN, Infinity]) assert.throws(() => compassStatistics([{ count }]), /Invalid/);
  for (const count of [-1, NaN, Infinity]) assert.throws(() => compassGeometry([count]), /Invalid/);
});
test('zero, equal, skewed and degenerate populations preserve honest radii', () => {
  assert.ok(compassGeometry([0, 0, 0, 0]).every((node) => radius(node.radar) === 0));
  assert.ok(compassGeometry([4, 4, 4, 4]).every((node) => Math.abs(radius(node.radar) - 130.5) < 1e-8));
  const skewed = compassGeometry([500, 8]);
  assert.ok(Math.abs(radius(skewed[1].radar) / radius(skewed[0].radar) - Math.log1p(8) / Math.log1p(500)) < 1e-8);
  for (const counts of [[], [0], [2], [0, 1]]) assert.ok(!/NaN|Infinity/.test(polygonPoints(compassGeometry(counts).map((node) => node.outer))));
  assert.throws(() => compassGeometry([-1]), /Invalid/);
});
