import { describe, expect, it } from 'bun:test';
import { PDFDocument } from 'pdf-lib';
import { compile } from '../src/format/compile';
import { parseDocument } from '../src/format/parse';
import { toSvg } from '../src/format/toSvg';
import { toPdf } from '../src/format/toPdf';

const src = `
version: 1
pieces:
  - id: a
    outline: { rect: { w: 40, h: 20, r: 2 } }
layout:
  paper: A5
  placements:
    - { piece: a, x: 10, y: 10, rotate: 0 }
`;

describe('toSvg', () => {
	it('uses mm on the root and A5 size', () => {
		const r = parseDocument(src);
		expect(r.ok).toBe(true);
		if (!r.ok) return;
		const svg = toSvg(compile(r.doc));
		expect(svg).toContain('width="148mm"');
		expect(svg).toContain('height="210mm"');
		expect(svg).toContain('50 mm');
	});
});

describe('toPdf', () => {
	it('page size is A5 in points', async () => {
		const r = parseDocument(src);
		expect(r.ok).toBe(true);
		if (!r.ok) return;
		const bytes = await toPdf(compile(r.doc));
		expect(bytes.byteLength).toBeGreaterThan(200);
		const pdf = await PDFDocument.load(bytes);
		const page = pdf.getPages()[0];
		const { width, height } = page.getSize();
		const MM = 72 / 25.4;
		expect(width).toBeCloseTo(148 * MM, 1);
		expect(height).toBeCloseTo(210 * MM, 1);
	});
});
