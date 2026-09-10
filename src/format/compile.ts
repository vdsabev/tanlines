import { stitchCenters, stitchOnEdges } from './stitch';
import { shapeToPath } from './shapes';
import type { Document, PieceGeom, Scene } from './types';

export function compile(doc: Document): Scene {
	const byId = new Map(doc.pieces.map((p) => [p.id, p]));
	const pieces: Scene['pieces'] = [];
	for (const place of doc.layout.placements) {
		const p = byId.get(place.piece);
		if (!p) continue;
		const leather = doc.leathers[p.leather] ?? doc.leathers['veg-tan'];
		const color = leather?.color ?? '#6b3a2a';
		const geom: PieceGeom = {
			id: p.id,
			color: p.side === 'back' ? shade(color, 0.7) : color,
			thickness: doc.defaults.thickness,
			side: p.side,
			flip: p.transform.flip,
			front: leather?.front ?? { roughness: 0.35, grain: 'fine' },
			back: leather?.back ?? { roughness: 0.8, grain: 'suede' },
			outline: shapeToPath(p.outline),
			holes: p.holes.map(shapeToPath),
			stitchHoles: [],
			stitchRuns: [],
			stitchColor: doc.defaults.stitch.color,
			folds: p.folds,
			hardware: p.hardware,
			motion: p.motion,
		};
		for (const rule of p.stitch) {
			const runs =
				rule.edges.length > 0
					? stitchOnEdges(rule)
					: (() => {
							const shape =
								rule.along === 'outline' ? p.outline : p.holes[rule.along];
							return shape ? [stitchCenters(shape, rule)] : [];
						})();
			for (const pts of runs) {
				geom.stitchRuns.push({
					style: rule.style,
					hole: rule.hole,
					pts,
					closed: rule.edges.length === 0 && rule.skip.length === 0,
				});
				for (const c of pts) {
					geom.stitchHoles.push({ x: c.x, y: c.y, d: rule.hole });
				}
			}
		}
		pieces.push({ ...geom, place });
	}
	return {
		paper: doc.layout.paper,
		margin: doc.layout.margin,
		pieces,
		assembly: doc.assembly,
	};
}

function shade(hex: string, k: number): string {
	const n = hex.replace('#', '');
	const r = Math.round(parseInt(n.slice(0, 2), 16) * k);
	const g = Math.round(parseInt(n.slice(2, 4), 16) * k);
	const b = Math.round(parseInt(n.slice(4, 6), 16) * k);
	const h = (x: number) => x.toString(16).padStart(2, '0');
	return `#${h(r)}${h(g)}${h(b)}`;
}
