import type { PathCmd, Vec2 } from './types';

function lerp(a: number, b: number, t: number) {
	return a + (b - a) * t;
}

function cubic(p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2, t: number): Vec2 {
	const u = 1 - t;
	return {
		x:
			u * u * u * p0.x +
			3 * u * u * t * p1.x +
			3 * u * t * t * p2.x +
			t * t * t * p3.x,
		y:
			u * u * u * p0.y +
			3 * u * u * t * p1.y +
			3 * u * t * t * p2.y +
			t * t * t * p3.y,
	};
}

function quad(p0: Vec2, p1: Vec2, p2: Vec2, t: number): Vec2 {
	const u = 1 - t;
	return {
		x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
		y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
	};
}

/** Flatten path to polyline (closed if Z). */
export function samplePath(cmds: PathCmd[], steps = 24): Vec2[] {
	const pts: Vec2[] = [];
	let cx = 0;
	let cy = 0;
	let mx = 0;
	let my = 0;
	for (const c of cmds) {
		if (c.op === 'M') {
			cx = c.x;
			cy = c.y;
			mx = c.x;
			my = c.y;
			pts.push({ x: cx, y: cy });
		} else if (c.op === 'L') {
			pts.push({ x: c.x, y: c.y });
			cx = c.x;
			cy = c.y;
		} else if (c.op === 'C') {
			const p0 = { x: cx, y: cy };
			const p1 = { x: c.x1, y: c.y1 };
			const p2 = { x: c.x2, y: c.y2 };
			const p3 = { x: c.x, y: c.y };
			for (let i = 1; i <= steps; i++)
				pts.push(cubic(p0, p1, p2, p3, i / steps));
			cx = c.x;
			cy = c.y;
		} else if (c.op === 'Q') {
			const p0 = { x: cx, y: cy };
			const p1 = { x: c.x1, y: c.y1 };
			const p2 = { x: c.x, y: c.y };
			for (let i = 1; i <= steps; i++) pts.push(quad(p0, p1, p2, i / steps));
			cx = c.x;
			cy = c.y;
		} else if (c.op === 'A') {
			const n = Math.max(8, steps);
			for (let i = 1; i <= n; i++) {
				const t = i / n;
				pts.push({ x: lerp(cx, c.x, t), y: lerp(cy, c.y, t) });
			}
			// Better arc sampling:
			pts.splice(pts.length - n);
			for (const p of sampleArc(
				cx,
				cy,
				c.rx,
				c.ry,
				c.x,
				c.y,
				c.large,
				c.sweep,
				n,
			))
				pts.push(p);
			cx = c.x;
			cy = c.y;
		} else if (c.op === 'Z') {
			if (pts.length && (pts[0].x !== cx || pts[0].y !== cy))
				pts.push({ x: mx, y: my });
			cx = mx;
			cy = my;
		}
	}
	return dedupe(pts);
}

function sampleArc(
	x1: number,
	y1: number,
	rx: number,
	ry: number,
	x2: number,
	y2: number,
	large: 0 | 1,
	sweep: 0 | 1,
	n: number,
): Vec2[] {
	// Simplified: treat as circular if rx≈ry, else linear-in-angle ellipse from start to end.
	rx = Math.abs(rx) || 1;
	ry = Math.abs(ry) || 1;
	const mx = (x1 + x2) / 2;
	const my = (y1 + y2) / 2;
	const dx = (x1 - x2) / 2;
	const dy = (y1 - y2) / 2;
	// Endpoint-to-center conversion (SVG), rotation=0.
	let rx2 = rx * rx;
	let ry2 = ry * ry;
	const dx2 = dx * dx;
	const dy2 = dy * dy;
	const scale = dx2 / rx2 + dy2 / ry2;
	if (scale > 1) {
		const s = Math.sqrt(scale);
		rx *= s;
		ry *= s;
		rx2 = rx * rx;
		ry2 = ry * ry;
	}
	const sq = Math.max(
		0,
		(rx2 * ry2 - rx2 * dy2 - ry2 * dx2) / (rx2 * dy2 + ry2 * dx2 || 1e-12),
	);
	const coef = (large === sweep ? -1 : 1) * Math.sqrt(sq);
	const cx = mx + coef * ((rx * dy) / ry);
	const cy = my + coef * (-(ry * dx) / rx);
	const a1 = Math.atan2((y1 - cy) / ry, (x1 - cx) / rx);
	const a2 = Math.atan2((y2 - cy) / ry, (x2 - cx) / rx);
	let da = a2 - a1;
	if (sweep === 0 && da > 0) da -= 2 * Math.PI;
	if (sweep === 1 && da < 0) da += 2 * Math.PI;
	if (large && Math.abs(da) < Math.PI)
		da += da > 0 ? 2 * Math.PI : -2 * Math.PI;
	const out: Vec2[] = [];
	for (let i = 1; i <= n; i++) {
		const a = a1 + (da * i) / n;
		out.push({ x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) });
	}
	return out;
}

function dedupe(pts: Vec2[]): Vec2[] {
	const out: Vec2[] = [];
	for (const p of pts) {
		const last = out[out.length - 1];
		if (!last || Math.hypot(p.x - last.x, p.y - last.y) > 1e-6) out.push(p);
	}
	return out;
}

export function polylineLength(pts: Vec2[]): number {
	let L = 0;
	for (let i = 1; i < pts.length; i++)
		L += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
	return L;
}

export function pointAtLength(pts: Vec2[], dist: number): Vec2 {
	if (pts.length === 0) return { x: 0, y: 0 };
	if (dist <= 0) return pts[0];
	let left = dist;
	for (let i = 1; i < pts.length; i++) {
		const seg = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
		if (left <= seg) {
			const t = seg === 0 ? 0 : left / seg;
			return {
				x: lerp(pts[i - 1].x, pts[i].x, t),
				y: lerp(pts[i - 1].y, pts[i].y, t),
			};
		}
		left -= seg;
	}
	return pts[pts.length - 1];
}
