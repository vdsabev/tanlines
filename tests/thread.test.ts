import { describe, expect, it } from 'bun:test';
import {
	splitStitchRuns,
	stitchCrossings,
	stitchPairs,
} from '../src/format/thread';
import type { StitchRun } from '../src/format/types';

describe('stitchPairs', () => {
	it('saddle fills every gap on both faces of a closed loop', () => {
		const p = stitchPairs(4, true, 'saddle');
		expect(p.front).toEqual([
			[0, 1],
			[1, 2],
			[2, 3],
			[3, 0],
		]);
		expect(p.back).toEqual(p.front);
	});

	it('running alternates faces', () => {
		const p = stitchPairs(4, true, 'running');
		expect(p.front).toEqual([
			[0, 1],
			[2, 3],
		]);
		expect(p.back).toEqual([
			[1, 2],
			[3, 0],
		]);
	});

	it('box fills even gaps on both faces', () => {
		const p = stitchPairs(4, true, 'box');
		expect(p.front).toEqual([
			[0, 1],
			[2, 3],
		]);
		expect(p.back).toEqual(p.front);
	});

	it('open run does not wrap', () => {
		const p = stitchPairs(3, false, 'saddle');
		expect(p.front).toEqual([
			[0, 1],
			[1, 2],
		]);
	});
});

describe('splitStitchRuns', () => {
	it('finds outline holes that straddle a mid fold', () => {
		const run: StitchRun = {
			style: 'saddle',
			hole: 1,
			closed: false,
			pts: [
				{ x: 0, y: 0 },
				{ x: 0, y: 10 },
				{ x: 0, y: 20 },
				{ x: 0, y: 30 },
			],
		};
		const xs = stitchCrossings([run], { x: -5, y: 15 }, { x: 5, y: 15 });
		expect(xs).toHaveLength(1);
		expect(xs[0].q.y).toBeCloseTo(15);
		expect(xs[0].front).toBe(true);
		expect(xs[0].back).toBe(true);
	});

	it('joins last and first fragments of a closed run', () => {
		const run: StitchRun = {
			style: 'saddle',
			hole: 1,
			closed: true,
			pts: [
				{ x: 0, y: 0 },
				{ x: 1, y: 0 },
				{ x: 2, y: 0 },
				{ x: 3, y: 0 },
				{ x: 4, y: 0 },
				{ x: 5, y: 0 },
			],
		};
		const kept = splitStitchRuns([run], (p) => p.x < 1.5 || p.x > 3.5);
		expect(kept).toHaveLength(1);
		expect(kept[0].pts.map((p) => p.x)).toEqual([4, 5, 0, 1]);
		expect(kept[0].closed).toBe(false);
	});
});
