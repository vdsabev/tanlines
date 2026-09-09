import { describe, expect, it } from 'bun:test';
import { polyArea, splitRing } from '../src/format/split';

const sq = [
	{ x: 0, y: 0 },
	{ x: 10, y: 0 },
	{ x: 10, y: 10 },
	{ x: 0, y: 10 },
];

describe('splitRing', () => {
	it('cuts a square on a mid line', () => {
		const r = splitRing(sq, { x: 0, y: 5 }, { x: 10, y: 5 });
		expect(r).not.toBeNull();
		if (!r) return;
		expect(Math.abs(polyArea(r.pos))).toBeCloseTo(50, 5);
		expect(Math.abs(polyArea(r.neg))).toBeCloseTo(50, 5);
	});

	it('returns null for an edge (no interior cut)', () => {
		expect(splitRing(sq, { x: 0, y: 0 }, { x: 10, y: 0 })).toBeNull();
	});
});
