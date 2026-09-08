import { PDFDocument, rgb, LineCapStyle } from 'pdf-lib';
import { samplePath } from './sample';
import type { Scene, Vec2 } from './types';

const MM = 72 / 25.4;

export async function toPdf(scene: Scene): Promise<Uint8Array> {
	const doc = await PDFDocument.create();
	const page = doc.addPage([scene.paper.w * MM, scene.paper.h * MM]);
	const paperH = scene.paper.h;

	const toPage = (x: number, y: number) => ({
		x: x * MM,
		y: (paperH - y) * MM,
	});

	page.drawRectangle({
		x: 0,
		y: 0,
		width: scene.paper.w * MM,
		height: scene.paper.h * MM,
		color: rgb(0.96, 0.94, 0.9),
	});

	const mx = scene.margin;
	const a = toPage(mx, 4);
	const b = toPage(mx + 50, 4);
	page.drawLine({
		start: a,
		end: b,
		thickness: 0.8,
		color: rgb(0.1, 0.1, 0.1),
		lineCap: LineCapStyle.Butt,
	});
	page.drawText('50 mm', {
		x: toPage(mx + 18, 9).x,
		y: toPage(mx + 18, 9).y,
		size: 8,
		color: rgb(0.1, 0.1, 0.1),
	});

	for (const p of scene.pieces) {
		const xf = (v: Vec2): Vec2 => {
			const rad = (p.place.rotate * Math.PI) / 180;
			const c = Math.cos(rad);
			const s = Math.sin(rad);
			const x = v.x * c - v.y * s + p.place.x;
			const y = v.x * s + v.y * c + p.place.y;
			return toPage(x, y);
		};
		const stroke = (
			pts: Vec2[],
			color: [number, number, number],
			thickness: number,
		) => {
			for (let i = 1; i < pts.length; i++) {
				page.drawLine({
					start: xf(pts[i - 1]),
					end: xf(pts[i]),
					thickness,
					color: rgb(color[0], color[1], color[2]),
				});
			}
		};
		stroke(samplePath(p.outline, 24), hexRgb(p.color), 0.7);
		for (const hole of p.holes)
			stroke(samplePath(hole, 24), [0.1, 0.1, 0.1], 0.5);
		for (const s of p.stitchHoles) {
			const c = xf({ x: s.x, y: s.y });
			page.drawCircle({
				x: c.x,
				y: c.y,
				size: (s.d / 2) * MM,
				borderWidth: 0.4,
				borderColor: rgb(0.05, 0.05, 0.05),
			});
		}
	}

	return doc.save();
}

function hexRgb(hex: string): [number, number, number] {
	const n = hex.replace('#', '');
	return [
		parseInt(n.slice(0, 2), 16) / 255,
		parseInt(n.slice(2, 4), 16) / 255,
		parseInt(n.slice(4, 6), 16) / 255,
	];
}
