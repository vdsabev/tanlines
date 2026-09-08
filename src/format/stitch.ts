import { pointAtLength, polylineLength, samplePath } from './sample';
import { insetEllipse, insetRectLike, shapeToPath } from './shapes';
import type { Shape, StitchRule, Vec2 } from './types';

export function insetShape(shape: Shape, inset: number): Shape {
	if (shape.kind === 'rect') return insetRectLike(shape, inset);
	if (shape.kind === 'ellipse') return insetEllipse(shape, inset);
	return shape;
}

/** Holes every `spacing` mm along the inset path. Last gap may be larger than spacing. */
export function stitchCenters(shape: Shape, rule: StitchRule): Vec2[] {
	const inset = insetShape(shape, rule.inset);
	if (inset.kind === 'path' && inset === shape) {
		// Free paths: sample the original and skip inset until a real offset exists.
	}
	const pts = samplePath(shapeToPath(inset), 32);
	if (pts.length < 2) return [];
	const closed = [...pts];
	if (
		Math.hypot(
			pts[0].x - pts[pts.length - 1].x,
			pts[0].y - pts[pts.length - 1].y,
		) > 1e-4
	) {
		closed.push(pts[0]);
	}
	const L = polylineLength(closed);
	const spacing = rule.spacing;
	if (spacing <= 0 || L < spacing) return [];
	const centers: Vec2[] = [];
	let d = rule.start % L;
	if (d < 0) d += L;
	const limit = L - spacing / 2;
	while (d < limit + 1e-9) {
		if (!skipped(d, rule.skip)) centers.push(pointAtLength(closed, d));
		d += spacing;
	}
	return centers;
}

function skipped(d: number, skip: Array<[number, number]>): boolean {
	return skip.some(([a, b]) => d >= a && d <= b);
}
