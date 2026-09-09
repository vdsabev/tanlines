import { describe, expect, it } from 'bun:test';
import { shapeFromRaw, shapeToPath } from '../src/format/shapes';
import { pathToD, ptsToPath } from '../src/format/pathD';
import { samplePath } from '../src/format/sample';
import { stitchCenters } from '../src/format/stitch';

describe('rect', () => {
	it('round corners use arcs', () => {
		const s = shapeFromRaw({ rect: { w: 90, h: 70, r: 6 } });
		const d = pathToD(shapeToPath(s));
		expect(d).toContain('A6 6');
		expect(d).toMatch(/^M6 0/);
	});

	it('chamfer uses lines, 45deg cut', () => {
		const s = shapeFromRaw({ rect: { w: 90, h: 70, chamfer: 8 } });
		const d = pathToD(shapeToPath(s));
		expect(d).not.toContain('A');
		expect(d).toMatch(/^M8 0/);
		expect(d).toContain('L90 8');
	});

	it('r wins over chamfer on the same corner', () => {
		const s = shapeFromRaw({
			rect: { w: 40, h: 40, r: [6, 0, 0, 0], chamfer: [8, 0, 0, 0] },
		});
		const d = pathToD(shapeToPath(s));
		expect(d).toContain('A6 6');
	});
});

describe('ellipse', () => {
	it('two half-arcs', () => {
		const s = shapeFromRaw({ ellipse: { rx: 10, ry: 5 } });
		const d = pathToD(shapeToPath(s));
		expect(d).toContain('A10 5');
	});
});

describe('stitch', () => {
	it('places holes every spacing mm on a round rect', () => {
		const s = shapeFromRaw({ rect: { w: 90, h: 70, r: 6 } });
		const holes = stitchCenters(s, {
			along: 'outline',
			inset: 3.5,
			spacing: 3.5,
			hole: 1,
			start: 0,
			skip: [],
		});
		expect(holes.length).toBeGreaterThan(20);
		const first = holes[0];
		const second = holes[1];
		const dist = Math.hypot(second.x - first.x, second.y - first.y);
		expect(dist).toBeGreaterThan(3);
		expect(dist).toBeLessThan(4.2);
	});
});

describe('path pts', () => {
	it('45deg round stays on the corner, not outside or scooped', () => {
		const p = [28, 0] as [number, number] & { r?: number };
		p.r = 10;
		const pts = samplePath(
			ptsToPath([[10, 18], p, [80, 0], [98, 18], [98, 48], [10, 48]]),
			32,
		);
		expect(Math.min(...pts.map((q) => q.y))).toBeGreaterThan(-0.05);
		const near = pts.filter((q) => Math.abs(q.x - 28) < 6);
		expect(Math.max(...near.map((q) => q.y))).toBeLessThan(6);
	});
});
