import { parse as parseYaml } from 'yaml';
import { parsePaper } from './paper';
import { shapeFromRaw } from './shapes';
import type {
	AssemblyJoin,
	Document,
	Fold,
	Leather,
	Motion,
	ParseResult,
	Piece,
	StitchRule,
} from './types';

const VEG: Leather = {
	front: { roughness: 0.35, grain: 'fine' },
	back: { roughness: 0.8, grain: 'suede' },
	color: '#6b3a2a',
};

export function parseDocument(text: string): ParseResult {
	let raw: unknown;
	try {
		raw = parseYaml(text);
	} catch (e) {
		const err = e as {
			linePos?: Array<{ line: number; col: number }>;
			message: string;
		};
		const pos = err.linePos?.[0];
		return {
			ok: false,
			errors: [
				{ line: pos?.line ?? 1, column: pos?.col ?? 1, message: err.message },
			],
		};
	}
	try {
		return { ok: true, doc: normalize(raw) };
	} catch (e) {
		return {
			ok: false,
			errors: [{ line: 1, column: 1, message: (e as Error).message }],
		};
	}
}

function normalize(raw: unknown): Document {
	if (!raw || typeof raw !== 'object')
		throw new Error('document must be a mapping');
	const o = raw as Record<string, unknown>;
	const defaultsRaw = (o.defaults as Record<string, unknown>) ?? {};
	const stitchDef = (defaultsRaw.stitch as Record<string, unknown>) ?? {};
	const defaults = {
		leather: String(defaultsRaw.leather ?? 'veg-tan'),
		thickness: Number(defaultsRaw.thickness ?? 2),
		stitch: {
			inset: Number(stitchDef.inset ?? 3.5),
			spacing: Number(stitchDef.spacing ?? 3.5),
			hole: Number(stitchDef.hole ?? 1),
			style: String(stitchDef.style ?? 'saddle'),
		},
	};
	const leathers: Record<string, Leather> = { 'veg-tan': { ...VEG } };
	const leatherIn = (o.leathers as Record<string, Leather>) ?? {};
	for (const [k, v] of Object.entries(leatherIn))
		leathers[k] = { ...VEG, ...v };

	const piecesRaw = Array.isArray(o.pieces) ? o.pieces : [];
	const pieces = piecesRaw.map((p, i) => pieceFrom(p, i, defaults));

	const layoutRaw = (o.layout as Record<string, unknown>) ?? {};
	const placements = Array.isArray(layoutRaw.placements)
		? layoutRaw.placements.map((pl) => {
				const x = pl as Record<string, unknown>;
				return {
					piece: String(x.piece),
					x: Number(x.x ?? 0),
					y: Number(x.y ?? 0),
					rotate: Number(x.rotate ?? 0),
				};
			})
		: pieces.map((p, i) => ({ piece: p.id, x: 10, y: 10 + i * 20, rotate: 0 }));

	return {
		version: Number(o.version ?? 1),
		unit: 'mm',
		defaults,
		leathers,
		pieces,
		layout: {
			paper: parsePaper(layoutRaw.paper),
			margin: Number(layoutRaw.margin ?? 10),
			placements,
		},
		assembly: assemblyFrom(o.assembly),
	};
}

function pieceFrom(
	raw: unknown,
	index: number,
	defaults: Document['defaults'],
): Piece {
	const o = (raw ?? {}) as Record<string, unknown>;
	const t = (o.transform as Record<string, unknown>) ?? {};
	const outline = shapeFromRaw(o.outline ?? { rect: { w: 10, h: 10 } });
	const holesRaw = Array.isArray(o.holes) ? o.holes : [];
	const stitchRaw = Array.isArray(o.stitch) ? o.stitch : [];
	return {
		id: String(o.id ?? `piece-${index}`),
		side: o.side === 'back' ? 'back' : 'front',
		leather: String(o.leather ?? defaults.leather),
		transform: {
			x: Number(t.x ?? 0),
			y: Number(t.y ?? 0),
			rotate: Number(t.rotate ?? 0),
			flip: t.flip === 'x' || t.flip === 'y' ? t.flip : 'none',
		},
		outline,
		holes: holesRaw.map(shapeFromRaw),
		stitch: stitchRaw.map((s) => stitchFrom(s, defaults)),
		folds: foldsFrom(o.folds),
		hardware: Array.isArray(o.hardware) ? o.hardware : [],
		motion: motionsFrom(o.motion),
	};
}

function stitchFrom(raw: unknown, defaults: Document['defaults']): StitchRule {
	const o = (raw ?? {}) as Record<string, unknown>;
	return {
		along:
			o.along === 'outline' || o.along == null ? 'outline' : Number(o.along),
		inset: Number(o.inset ?? defaults.stitch.inset),
		spacing: Number(o.spacing ?? defaults.stitch.spacing),
		hole: Number(o.hole ?? defaults.stitch.hole),
		start: Number(o.start ?? 0),
		skip: Array.isArray(o.skip) ? (o.skip as Array<[number, number]>) : [],
	};
}

function pair(v: unknown): [number, number] {
	if (Array.isArray(v) && v.length >= 2) return [Number(v[0]), Number(v[1])];
	return [0, 0];
}

function foldsFrom(raw: unknown): Fold[] {
	if (!Array.isArray(raw)) return [];
	return raw.map((f, i) => {
		const o = (f ?? {}) as Record<string, unknown>;
		return {
			id: String(o.id ?? `fold-${i}`),
			from: pair(o.from),
			to: pair(o.to),
			angle: Number(o.angle ?? 0),
			hinge: o.hinge === 'mountain' ? 'mountain' : 'valley',
		};
	});
}

function motionsFrom(raw: unknown): Motion[] {
	if (!Array.isArray(raw)) return [];
	return raw.map((m, i) => {
		const o = (m ?? {}) as Record<string, unknown>;
		const foldsRaw =
			o.folds && typeof o.folds === 'object' && !Array.isArray(o.folds)
				? (o.folds as Record<string, unknown>)
				: {};
		const folds: Record<string, number> = {};
		for (const [k, v] of Object.entries(foldsRaw)) folds[k] = Number(v);
		return { id: String(o.id ?? `motion-${i}`), folds };
	});
}

function assemblyFrom(raw: unknown): AssemblyJoin[] {
	if (!Array.isArray(raw)) return [];
	const out: AssemblyJoin[] = [];
	for (const item of raw) {
		if (!item || typeof item !== 'object') continue;
		const o = item as Record<string, unknown>;
		const a = String(o.a ?? '');
		const b = String(o.b ?? '');
		if (a && b) out.push({ a, b });
	}
	return out;
}
