import { signedDist } from './split';
import type { StitchRun, StitchStyle, Vec2 } from './types';

export type StitchCrossing = {
	a: Vec2;
	b: Vec2;
	q: Vec2;
	along: number;
	hole: number;
	style: StitchStyle;
	front: boolean;
	back: boolean;
};

export function stitchStyle(raw: unknown): StitchStyle {
	if (raw === 'running' || raw === 'box') return raw;
	return 'saddle';
}

/** Consecutive hole pairs on each face. Saddle fills every gap on both faces. */
export function stitchPairs(
	n: number,
	closed: boolean,
	style: StitchStyle,
): { front: Array<[number, number]>; back: Array<[number, number]> } {
	const front: Array<[number, number]> = [];
	const back: Array<[number, number]> = [];
	if (n < 2) return { front, back };
	const edges = closed ? n : n - 1;
	for (let i = 0; i < edges; i++) {
		const j = (i + 1) % n;
		if (style === 'running') {
			if (i % 2 === 0) front.push([i, j]);
			else back.push([i, j]);
		} else if (style === 'box') {
			if (i % 2 === 0) {
				front.push([i, j]);
				back.push([i, j]);
			}
		} else {
			front.push([i, j]);
			back.push([i, j]);
		}
	}
	return { front, back };
}

/** Keep holes on one side of a fold. A closed run's wrap (last→first) stays one chain. */
export function splitStitchRuns(
	runs: StitchRun[],
	keep: (p: Vec2) => boolean,
): StitchRun[] {
	const out: StitchRun[] = [];
	for (const run of runs) {
		if (run.pts.length && run.closed && run.pts.every(keep)) {
			out.push(run);
			continue;
		}
		const segs: Vec2[][] = [];
		let buf: Vec2[] = [];
		const flush = () => {
			if (buf.length) {
				segs.push(buf);
				buf = [];
			}
		};
		for (const p of run.pts) {
			if (keep(p)) buf.push(p);
			else flush();
		}
		flush();
		if (
			run.closed &&
			segs.length >= 2 &&
			keep(run.pts[0]) &&
			keep(run.pts[run.pts.length - 1])
		) {
			const last = segs.pop()!;
			segs[0] = last.concat(segs[0]);
		}
		for (const pts of segs) out.push({ ...run, pts, closed: false });
	}
	return out;
}

function hasPair(
	pairs: Array<[number, number]>,
	i: number,
	j: number,
): boolean {
	return pairs.some(([x, y]) => x === i && y === j);
}

/** Consecutive holes on opposite sides of a fold, with the 2D crossing on the fold. */
export function stitchCrossings(
	runs: StitchRun[],
	from: Vec2,
	to: Vec2,
): StitchCrossing[] {
	const mx = (from.x + to.x) / 2;
	const my = (from.y + to.y) / 2;
	const dx = to.x - from.x;
	const dy = to.y - from.y;
	const L = Math.hypot(dx, dy) || 1;
	const out: StitchCrossing[] = [];
	for (const run of runs) {
		const n = run.pts.length;
		if (n < 2) continue;
		const pairs = stitchPairs(n, run.closed, run.style);
		const edges = run.closed ? n : n - 1;
		for (let i = 0; i < edges; i++) {
			const j = (i + 1) % n;
			const a = run.pts[i];
			const b = run.pts[j];
			const sa = signedDist(a, from, to);
			const sb = signedDist(b, from, to);
			if (sa * sb >= 0) continue;
			const t = sa / (sa - sb);
			const q = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
			out.push({
				a,
				b,
				q,
				along: ((q.x - mx) * dx + (q.y - my) * dy) / L,
				hole: run.hole,
				style: run.style,
				front: hasPair(pairs.front, i, j),
				back: hasPair(pairs.back, i, j),
			});
		}
	}
	return out;
}
