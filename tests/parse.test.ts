import { describe, expect, it } from 'bun:test';
import { parseDocument } from '../src/format/parse';
import { setLayoutPaper } from '../src/format/paper';
import { compile } from '../src/format/compile';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const example = readFileSync(
	join(dirname(fileURLToPath(import.meta.url)), '../public/examples/cardholder.tan'),
	'utf8',
);

describe('parse', () => {
	it('parses the cardholder example', () => {
		const r = parseDocument(example);
		expect(r.ok).toBe(true);
		if (!r.ok) return;
		expect(r.doc.pieces.map((p) => p.id)).toEqual(['body']);
		expect(r.doc.layout.paper.name).toBe('A4');
		expect(r.doc.layout.paper.w).toBe(210);
		expect(r.doc.pieces[0].folds.map((f) => f.id)).toEqual([
			'overBack',
			'lid',
			'underBack',
			'underFront',
			'left',
			'right',
		]);
		expect(r.doc.pieces[0].motion.map((m) => m.id)).toEqual([
			'overBack',
			'lid',
			'underBack',
			'underFront',
			'left',
			'right',
		]);
		expect(r.doc.pieces[0].motion[0]).toEqual({
			id: 'overBack',
			folds: { overBack: 90 },
		});
		expect(r.doc.assembly).toEqual([]);
		expect(r.doc.pieces[0].hardware).toEqual([
			{ type: 'snap', at: [54, 14], size: 10 },
		]);
		expect(r.doc.pieces[0].holes).toEqual([]);
	});

	it('reports yaml errors', () => {
		const r = parseDocument('pieces: [');
		expect(r.ok).toBe(false);
	});
});

describe('setLayoutPaper', () => {
	it('swaps A4 for A3 in the example', () => {
		const next = setLayoutPaper(example, 'A3');
		expect(next).toContain('paper: A3');
		expect(next).not.toContain('paper: A4');
		const r = parseDocument(next);
		expect(r.ok).toBe(true);
		if (!r.ok) return;
		expect(r.doc.layout.paper.name).toBe('A3');
	});

	it('writes custom w/h inline', () => {
		const next = setLayoutPaper(example, 'custom', { w: 200, h: 250 });
		expect(next).toContain('paper: { w: 200, h: 250 }');
		const r = parseDocument(next);
		expect(r.ok).toBe(true);
		if (!r.ok) return;
		expect(r.doc.layout.paper.w).toBe(200);
		expect(r.doc.layout.paper.h).toBe(250);
	});
});

describe('compile', () => {
	it('emits matching cross-stitch holes on flaps and underFront', () => {
		const r = parseDocument(example);
		expect(r.ok).toBe(true);
		if (!r.ok) return;
		const scene = compile(r.doc);
		expect(scene.pieces).toHaveLength(1);
		const p = scene.pieces[0];
		expect(p.stitchRuns).toHaveLength(4);
		expect(p.stitchRuns.every((run) => run.style === 'cross')).toBe(true);
		expect(p.stitchRuns.every((run) => run.closed === false)).toBe(true);
		expect(p.stitchRuns[0].pts.length).toBe(p.stitchRuns[1].pts.length);
		expect(p.stitchRuns[2].pts.length).toBe(p.stitchRuns[3].pts.length);
		expect(p.stitchRuns[0].pts.length).toBeGreaterThanOrEqual(2);
		const ys = p.stitchRuns.flatMap((run) => run.pts.map((q) => q.y));
		expect(Math.min(...ys)).toBeGreaterThan(48);
		expect(Math.max(...ys)).toBeGreaterThan(114);
		const along = (a: { x: number; y: number }, b: { x: number; y: number }) =>
			Math.hypot(b.x - a.x, b.y - a.y);
		for (let i = 0; i < p.stitchRuns[0].pts.length; i++) {
			expect(
				along(p.stitchRuns[0].pts[0], p.stitchRuns[0].pts[i]),
			).toBeCloseTo(along(p.stitchRuns[1].pts[0], p.stitchRuns[1].pts[i]));
		}
		expect(p.holes).toHaveLength(0);
		expect(p.thickness).toBe(2);
		expect(p.front.roughness).toBe(0.35);
		expect(p.back.roughness).toBe(0.8);
		expect(p.folds.map((f) => f.id)).toEqual([
			'overBack',
			'lid',
			'underBack',
			'underFront',
			'left',
			'right',
		]);
		expect(scene.assembly).toEqual([]);
	});
});
