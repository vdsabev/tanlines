import { clampCorners, expand4 } from './corners';
import { parseD, ptsToPath } from './pathD';
import type { PathCmd, Shape } from './types';

export function shapeFromRaw(raw: unknown): Shape {
	if (!raw || typeof raw !== 'object')
		throw new Error('shape must be an object');
	const o = raw as Record<string, unknown>;
	if ('rect' in o) {
		const r = o.rect as Record<string, unknown>;
		const w = Number(r.w);
		const h = Number(r.h);
		return {
			kind: 'rect',
			x: Number(r.x ?? 0),
			y: Number(r.y ?? 0),
			w,
			h,
			r: clampCorners(w, h, expand4(r.r as number | number[] | undefined)),
			chamfer: clampCorners(
				w,
				h,
				expand4(r.chamfer as number | number[] | undefined),
			),
		};
	}
	if ('ellipse' in o) {
		const e = o.ellipse as Record<string, unknown>;
		const rx = Number(e.rx);
		const ry = Number(e.ry);
		return {
			kind: 'ellipse',
			cx: Number(e.cx ?? rx),
			cy: Number(e.cy ?? ry),
			rx,
			ry,
		};
	}
	if ('path' in o) {
		const p = o.path as Record<string, unknown>;
		return {
			kind: 'path',
			d: p.d as string | undefined,
			pts: p.pts as PathShapePts,
		};
	}
	throw new Error('shape needs rect, ellipse, or path');
}

type PathShapePts = Array<[number, number] & { r?: number; chamfer?: number }>;

export function shapeToPath(shape: Shape): PathCmd[] {
	if (shape.kind === 'rect') return rectPath(shape);
	if (shape.kind === 'ellipse') return ellipsePath(shape);
	if (shape.d) return parseD(shape.d);
	if (shape.pts) return ptsToPath(shape.pts);
	return [];
}

function rectPath(s: Extract<Shape, { kind: 'rect' }>): PathCmd[] {
	const { x, y, w, h } = s;
	const r = s.r;
	const ch = s.chamfer;
	const corner = (i: number): { r: number; ch: number } => ({
		r: r[i],
		ch: r[i] > 0 ? 0 : ch[i],
	});
	const tl = corner(0);
	const tr = corner(1);
	const br = corner(2);
	const bl = corner(3);

	const cmds: PathCmd[] = [];
	const startX = x + (tl.r || tl.ch);
	cmds.push({ op: 'M', x: startX, y });

	cmds.push({ op: 'L', x: x + w - (tr.r || tr.ch), y });
	addCorner(cmds, x + w, y, tr, 1);

	cmds.push({ op: 'L', x: x + w, y: y + h - (br.r || br.ch) });
	addCorner(cmds, x + w, y + h, br, 2);

	cmds.push({ op: 'L', x: x + (bl.r || bl.ch), y: y + h });
	addCorner(cmds, x, y + h, bl, 3);

	cmds.push({ op: 'L', x, y: y + (tl.r || tl.ch) });
	addCorner(cmds, x, y, tl, 0);

	cmds.push({ op: 'Z' });
	return cmds;
}

/** cornerIndex: 0 TL, 1 TR, 2 BR, 3 BL — sweep into the next edge. */
function addCorner(
	cmds: PathCmd[],
	cx: number,
	cy: number,
	c: { r: number; ch: number },
	cornerIndex: number,
) {
	const end = endOfCorner(cx, cy, c, cornerIndex);
	if (c.r > 0) {
		cmds.push({
			op: 'A',
			rx: c.r,
			ry: c.r,
			rot: 0,
			large: 0,
			sweep: 1,
			x: end.x,
			y: end.y,
		});
	} else if (c.ch > 0) {
		cmds.push({ op: 'L', x: end.x, y: end.y });
	}
}

function endOfCorner(
	cx: number,
	cy: number,
	c: { r: number; ch: number },
	i: number,
): { x: number; y: number } {
	const d = c.r || c.ch;
	if (i === 0) return { x: cx + d, y: cy }; // TL → along top
	if (i === 1) return { x: cx, y: cy + d }; // TR → along right
	if (i === 2) return { x: cx - d, y: cy }; // BR → along bottom
	return { x: cx, y: cy - d }; // BL → along left
}

function ellipsePath(s: Extract<Shape, { kind: 'ellipse' }>): PathCmd[] {
	const { cx, cy, rx, ry } = s;
	return [
		{ op: 'M', x: cx - rx, y: cy },
		{ op: 'A', rx, ry, rot: 0, large: 1, sweep: 1, x: cx + rx, y: cy },
		{ op: 'A', rx, ry, rot: 0, large: 1, sweep: 1, x: cx - rx, y: cy },
		{ op: 'Z' },
	];
}

export function insetRectLike(
	s: Extract<Shape, { kind: 'rect' }>,
	inset: number,
): Shape {
	const x = s.x + inset;
	const y = s.y + inset;
	const w = s.w - 2 * inset;
	const h = s.h - 2 * inset;
	const shrink = (c: [number, number, number, number]) =>
		c.map((n) => Math.max(0, n - inset)) as [number, number, number, number];
	return {
		kind: 'rect',
		x,
		y,
		w: Math.max(0, w),
		h: Math.max(0, h),
		r: shrink(s.r),
		chamfer: shrink(s.chamfer),
	};
}

export function insetEllipse(
	s: Extract<Shape, { kind: 'ellipse' }>,
	inset: number,
): Shape {
	return {
		kind: 'ellipse',
		cx: s.cx,
		cy: s.cy,
		rx: Math.max(0, s.rx - inset),
		ry: Math.max(0, s.ry - inset),
	};
}
