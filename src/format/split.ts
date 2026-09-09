import type { Vec2 } from './types';

const EPS = 1e-7;

export function signedDist(p: Vec2, a: Vec2, b: Vec2): number {
	return (p.x - a.x) * (b.y - a.y) - (p.y - a.y) * (b.x - a.x);
}

export function polyArea(pts: Vec2[]): number {
	let a = 0;
	for (let i = 0; i < pts.length; i++) {
		const p = pts[i];
		const q = pts[(i + 1) % pts.length];
		a += p.x * q.y - q.x * p.y;
	}
	return a / 2;
}

export function centroid(pts: Vec2[]): Vec2 {
	let x = 0,
		y = 0;
	for (const p of pts) {
		x += p.x;
		y += p.y;
	}
	const n = pts.length || 1;
	return { x: x / n, y: y / n };
}

export function pointInPoly(p: Vec2, pts: Vec2[]): boolean {
	let inside = false;
	for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
		const a = pts[i];
		const b = pts[j];
		if (a.y > p.y !== b.y > p.y) {
			const x = ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y || 1e-12) + a.x;
			if (x > p.x) inside = !inside;
		}
	}
	return inside;
}

function near(a: Vec2, b: Vec2) {
	return Math.hypot(a.x - b.x, a.y - b.y) < 1e-6;
}

/** Split a closed ring (no duplicate close) by the infinite line through a→b. Null if the cut is degenerate (edge fold). */
export function splitRing(
	ring: Vec2[],
	a: Vec2,
	b: Vec2,
): { pos: Vec2[]; neg: Vec2[] } | null {
	const n = ring.length;
	if (n < 3) return null;
	const verts: { p: Vec2; s: number }[] = [];
	for (let i = 0; i < n; i++) {
		const p = ring[i];
		const q = ring[(i + 1) % n];
		const sp0 = signedDist(p, a, b);
		const sq0 = signedDist(q, a, b);
		const sp = Math.abs(sp0) < EPS ? 0 : sp0;
		const sq = Math.abs(sq0) < EPS ? 0 : sq0;
		verts.push({ p, s: sp });
		if (sp !== 0 && sq !== 0 && sp * sq < 0) {
			const t = sp / (sp - sq);
			verts.push({
				p: { x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t },
				s: 0,
			});
		}
	}
	const clean: { p: Vec2; s: number }[] = [];
	for (const v of verts) {
		const last = clean[clean.length - 1];
		if (last && near(v.p, last.p)) {
			if (v.s === 0) last.s = 0;
			continue;
		}
		clean.push({ p: { x: v.p.x, y: v.p.y }, s: v.s });
	}
	if (clean.length > 1 && near(clean[0].p, clean[clean.length - 1].p)) {
		if (clean[clean.length - 1].s === 0) clean[0].s = 0;
		clean.pop();
	}

	const zeros: number[] = [];
	for (let i = 0; i < clean.length; i++) if (clean[i].s === 0) zeros.push(i);
	if (zeros.length < 2) return null;

	const along = (p: Vec2) =>
		(p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y);
	let i0 = zeros[0];
	let i1 = zeros[1];
	let best = -1;
	for (let i = 0; i < zeros.length; i++) {
		for (let j = i + 1; j < zeros.length; j++) {
			const d = Math.abs(along(clean[zeros[i]].p) - along(clean[zeros[j]].p));
			if (d > best) {
				best = d;
				i0 = zeros[i];
				i1 = zeros[j];
			}
		}
	}
	if (best < 1e-4) return null;

	function walk(from: number, to: number): Vec2[] {
		const out: Vec2[] = [];
		let i = from;
		for (;;) {
			const p = clean[i].p;
			const last = out[out.length - 1];
			if (!last || !near(p, last)) out.push({ x: p.x, y: p.y });
			if (i === to) break;
			i = (i + 1) % clean.length;
		}
		return out;
	}

	const A = walk(i0, i1);
	const B = walk(i1, i0);
	if (A.length < 3 || B.length < 3) return null;
	if (Math.abs(polyArea(A)) < 1e-3 || Math.abs(polyArea(B)) < 1e-3) return null;

	const cA = centroid(A);
	const pos = signedDist(cA, a, b) >= 0 ? A : B;
	const neg = pos === A ? B : A;
	return { pos, neg };
}
