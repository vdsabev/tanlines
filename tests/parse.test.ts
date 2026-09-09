import { describe, expect, it } from 'bun:test';
import { parseDocument } from '../src/format/parse';
import { setLayoutPaper } from '../src/format/paper';
import { compile } from '../src/format/compile';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const example = readFileSync(
	join(dirname(fileURLToPath(import.meta.url)), '../examples/cardholder.tan'),
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
			'seamLeft',
			'seamRight',
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
	it('emits one placed piece and two seam stitch runs', () => {
		const r = parseDocument(example);
		expect(r.ok).toBe(true);
		if (!r.ok) return;
		const scene = compile(r.doc);
		expect(scene.pieces).toHaveLength(1);
		expect(scene.pieces[0].stitchRuns).toHaveLength(2);
		expect(scene.pieces[0].stitchRuns[0].style).toBe('saddle');
		expect(scene.pieces[0].stitchRuns[0].closed).toBe(false);
		expect(scene.pieces[0].stitchRuns[1].closed).toBe(false);
		expect(scene.pieces[0].stitchHoles.length).toBeGreaterThan(8);
		expect(scene.pieces[0].holes).toHaveLength(0);
		expect(scene.pieces[0].thickness).toBe(2);
		expect(scene.pieces[0].front.roughness).toBe(0.35);
		expect(scene.pieces[0].back.roughness).toBe(0.8);
		expect(scene.pieces[0].folds.map((f) => f.id)).toEqual([
			'overBack',
			'lid',
			'underBack',
			'underFront',
			'left',
			'right',
			'seamLeft',
			'seamRight',
		]);
		expect(scene.assembly).toEqual([]);
	});
});
