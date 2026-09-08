export type Vec2 = { x: number; y: number };

export type CornerValues = number | number[];

export type RectShape = {
	kind: 'rect';
	x: number;
	y: number;
	w: number;
	h: number;
	r: [number, number, number, number];
	chamfer: [number, number, number, number];
};

export type EllipseShape = {
	kind: 'ellipse';
	cx: number;
	cy: number;
	rx: number;
	ry: number;
};

export type PathShape = {
	kind: 'path';
	d?: string;
	pts?: Array<[number, number] & { r?: number; chamfer?: number }>;
};

export type Shape = RectShape | EllipseShape | PathShape;

export type StitchRule = {
	along: 'outline' | number;
	inset: number;
	spacing: number;
	hole: number;
	start: number;
	skip: Array<[number, number]>;
};

export type Fold = {
	id?: string;
	from: [number, number];
	to: [number, number];
	angle: number;
	hinge: 'valley' | 'mountain';
};

export type Piece = {
	id: string;
	side: 'front' | 'back';
	leather: string;
	transform: { x: number; y: number; rotate: number; flip: 'none' | 'x' | 'y' };
	outline: Shape;
	holes: Shape[];
	stitch: StitchRule[];
	folds: Fold[];
	hardware: unknown[];
	motion: unknown[];
};

export type Leather = {
	front: { roughness: number; grain: string };
	back: { roughness: number; grain: string };
	color: string;
};

export type Placement = {
	piece: string;
	x: number;
	y: number;
	rotate: number;
};

export type Paper = { w: number; h: number; name?: string };

export type Document = {
	version: number;
	unit: 'mm';
	defaults: {
		leather: string;
		thickness: number;
		stitch: { inset: number; spacing: number; hole: number; style: string };
	};
	leathers: Record<string, Leather>;
	pieces: Piece[];
	layout: {
		paper: Paper;
		margin: number;
		placements: Placement[];
	};
	assembly: unknown[];
};

export type ParseError = { line: number; column: number; message: string };

export type ParseResult =
	{ ok: true; doc: Document } | { ok: false; errors: ParseError[] };

export type PathCmd =
	| { op: 'M' | 'L'; x: number; y: number }
	| {
			op: 'C';
			x1: number;
			y1: number;
			x2: number;
			y2: number;
			x: number;
			y: number;
	  }
	| { op: 'Q'; x1: number; y1: number; x: number; y: number }
	| {
			op: 'A';
			rx: number;
			ry: number;
			rot: number;
			large: 0 | 1;
			sweep: 0 | 1;
			x: number;
			y: number;
	  }
	| { op: 'Z' };

export type PieceGeom = {
	id: string;
	color: string;
	outline: PathCmd[];
	holes: PathCmd[][];
	stitchHoles: Array<{ x: number; y: number; d: number }>;
};

export type Scene = {
	paper: Paper;
	margin: number;
	pieces: Array<PieceGeom & { place: Placement }>;
};
