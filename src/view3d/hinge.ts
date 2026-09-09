import * as THREE from 'three';
import { samplePath } from '../format/sample';
import { stitchCrossings, splitStitchRuns } from '../format/thread';
import { centroid, polyArea, signedDist, splitRing } from '../format/split';
import type {
	Fold,
	Motion,
	PathCmd,
	Hardware,
	PieceGeom,
	StitchRun,
	Vec2,
} from '../format/types';
import { makeFoldBend, setBendAngle, setStitchWrap } from './bend';
import { addThreadSeg, panelGroup, pieceOrigin, threadMat } from './extrude';

export type HingeData = {
	id: string;
	rest: number;
	sign: number;
	bend?: THREE.Mesh;
	stitchWrap?: THREE.Group;
};

type Region = {
	outline: Vec2[];
	holes: Vec2[][];
	stitches: StitchRun[];
	hardware: Hardware[];
};

function cmdsToRing(cmds: PathCmd[]): Vec2[] {
	const pts = samplePath(cmds, 16);
	if (pts.length > 1) {
		const a = pts[0];
		const b = pts[pts.length - 1];
		if (Math.hypot(a.x - b.x, a.y - b.y) < 1e-6) pts.pop();
	}
	return pts;
}

function distToSeg(p: Vec2, a: Vec2, b: Vec2): number {
	const dx = b.x - a.x;
	const dy = b.y - a.y;
	const l2 = dx * dx + dy * dy;
	if (l2 < 1e-12) return Math.hypot(p.x - a.x, p.y - a.y);
	let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2;
	t = Math.max(0, Math.min(1, t));
	return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}

function onOutline(p: Vec2, pts: Vec2[]): boolean {
	for (let i = 0; i < pts.length; i++) {
		if (distToSeg(p, pts[i], pts[(i + 1) % pts.length]) < 0.8) return true;
	}
	return false;
}

function takeSide(
	outline: Vec2[],
	region: Region,
	from: Vec2,
	to: Vec2,
	pos: boolean,
): Region {
	const keep = (p: Vec2) => {
		const s = signedDist(p, from, to);
		return pos ? s >= 0 : s < 0;
	};
	return {
		outline,
		holes: region.holes.filter((h) => keep(centroid(h))),
		stitches: splitStitchRuns(region.stitches, keep),
		hardware: region.hardware.filter((h) => keep({ x: h.at[0], y: h.at[1] })),
	};
}

function foldFrame(
	fold: Fold,
	origin: { cx: number; cy: number },
	toward: Vec2,
	thickness: number,
): { pos: THREE.Vector3; quat: THREE.Quaternion } {
	const from = { x: fold.from[0], y: fold.from[1] };
	const to = { x: fold.to[0], y: fold.to[1] };
	const zOff = fold.hinge === 'mountain' ? thickness / 2 : -thickness / 2;
	const pos = new THREE.Vector3(
		(from.x + to.x) / 2 - origin.cx,
		-((from.y + to.y) / 2 - origin.cy),
		zOff,
	);
	const x = new THREE.Vector3(to.x - from.x, -(to.y - from.y), 0);
	if (x.lengthSq() < 1e-8) x.set(1, 0, 0);
	x.normalize();
	const z = new THREE.Vector3(0, 0, 1);
	const y = new THREE.Vector3().crossVectors(z, x);
	if (y.lengthSq() < 1e-8) y.set(0, 1, 0);
	y.normalize();
	const cin = new THREE.Vector3(
		toward.x - origin.cx,
		-(toward.y - origin.cy),
		0,
	);
	const toC = cin.sub(new THREE.Vector3(pos.x, pos.y, 0));
	if (toC.dot(y) < 0) y.negate();
	z.crossVectors(x, y).normalize();
	y.crossVectors(z, x).normalize();
	const quat = new THREE.Quaternion().setFromRotationMatrix(
		new THREE.Matrix4().makeBasis(x, y, z),
	);
	return { pos, quat };
}

function addBoundaryMarkers(
	g: THREE.Group,
	piece: PieceGeom,
	region: Region,
	folds: Fold[],
	origin: { cx: number; cy: number },
) {
	const T = Math.max(0.2, piece.thickness);
	const c = centroid(region.outline);
	for (const fold of folds) {
		const from = { x: fold.from[0], y: fold.from[1] };
		const to = { x: fold.to[0], y: fold.to[1] };
		if (!onOutline(from, region.outline) || !onOutline(to, region.outline))
			continue;
		const marker = new THREE.Group();
		const { pos, quat } = foldFrame(fold, origin, c, T);
		marker.position.copy(pos);
		marker.quaternion.copy(quat);
		marker.userData.foldMarker = fold.id;
		g.add(marker);
	}
}

function makeHinge(
	piece: PieceGeom,
	fold: Fold,
	child: Region,
	origin: { cx: number; cy: number },
): { group: THREE.Group; rot: THREE.Group; inner: THREE.Group } {
	const T = Math.max(0.2, piece.thickness);
	const toward = centroid(child.outline);
	const { pos, quat } = foldFrame(fold, origin, toward, T);
	const group = new THREE.Group();
	group.position.copy(pos);
	group.quaternion.copy(quat);
	group.userData.foldMarker = fold.id;
	const rot = new THREE.Group();
	group.add(rot);
	const inner = new THREE.Group();
	inner.quaternion.copy(group.quaternion).invert();
	inner.position
		.copy(group.position)
		.applyQuaternion(inner.quaternion)
		.negate();
	rot.add(inner);
	const length = Math.hypot(
		fold.to[0] - fold.from[0],
		fold.to[1] - fold.from[1],
	);
	// foldFrame may flip local Z to stay right-handed; leather still sits toward piece +Z (valley) or −Z (mountain).
	const frontLocal = new THREE.Vector3(0, 0, 1).applyQuaternion(
		quat.clone().invert(),
	);
	const radius =
		T * (frontLocal.z < 0 ? -1 : 1) * (fold.hinge === 'mountain' ? -1 : 1);
	const bend = makeFoldBend(piece, fold, length, radius);
	group.add(bend);
	const stitchWrap = new THREE.Group();
	group.add(stitchWrap);
	rot.userData.hinge = {
		id: fold.id,
		rest: fold.angle,
		sign: 1,
		bend,
		stitchWrap,
	} as HingeData;
	return { group, rot, inner };
}

function piecePt(
	p: { x: number; y: number },
	origin: { cx: number; cy: number },
	z: number,
) {
	return new THREE.Vector3(p.x - origin.cx, -(p.y - origin.cy), z);
}

function addFoldStitch(
	piece: PieceGeom,
	runs: StitchRun[],
	from: Vec2,
	to: Vec2,
	parentPos: boolean,
	mountain: boolean,
	origin: { cx: number; cy: number },
	parentG: THREE.Group,
	childG: THREE.Group,
	hinge: HingeData,
) {
	const xs = stitchCrossings(runs, from, to);
	if (!xs.length || !hinge.stitchWrap || !hinge.bend) return;
	const T = Math.max(0.2, piece.thickness);
	const mat = threadMat(piece.stitchColor);
	const alongs: number[] = [];
	let rTh = 0.12;
	for (const x of xs) {
		rTh = Math.max(0.12, (x.hole / 2) * 0.42);
		const zF = T / 2 + rTh * 0.35;
		const zB = -T / 2 - rTh * 0.35;
		const aOnParent = signedDist(x.a, from, to) >= 0 === parentPos;
		const aRoot = aOnParent ? parentG : childG;
		const bRoot = aOnParent ? childG : parentG;
		if (x.front) {
			addThreadSeg(
				aRoot,
				piecePt(x.a, origin, zF),
				piecePt(x.q, origin, zF),
				rTh,
				mat,
			);
			addThreadSeg(
				bRoot,
				piecePt(x.b, origin, zF),
				piecePt(x.q, origin, zF),
				rTh,
				mat,
			);
		}
		if (x.back) {
			addThreadSeg(
				aRoot,
				piecePt(x.a, origin, zB),
				piecePt(x.q, origin, zB),
				rTh,
				mat,
			);
			addThreadSeg(
				bRoot,
				piecePt(x.b, origin, zB),
				piecePt(x.q, origin, zB),
				rTh,
				mat,
			);
		}
		if (mountain ? x.back : x.front) alongs.push(x.along);
	}
	const radius = (hinge.bend.userData.foldBend as { radius: number }).radius;
	hinge.stitchWrap.userData.stitchWrap = { alongs, radius, rTh, mat };
}

function fixSign(rot: THREE.Group, inner: THREE.Group, fold: Fold) {
	const sample = () => {
		inner.updateWorldMatrix(true, true);
		const box = new THREE.Box3().setFromObject(inner);
		return box.getCenter(new THREE.Vector3());
	};
	rot.rotation.x = 0;
	const c0 = sample();
	rot.rotation.x = 0.25;
	const c1 = sample();
	rot.rotation.x = 0;
	const valley = fold.hinge !== 'mountain';
	const movedBack = c1.z < c0.z - 1e-6;
	const sign = valley === movedBack ? 1 : -1;
	(rot.userData.hinge as HingeData).sign = sign;
}

function holdsFold(region: Region, from: Vec2, to: Vec2): boolean {
	return onOutline(from, region.outline) && onOutline(to, region.outline);
}

function pickParent(
	posR: Region,
	negR: Region,
	attach: { from: Vec2; to: Vec2 } | undefined,
): Region {
	if (attach) {
		const posH = holdsFold(posR, attach.from, attach.to);
		const negH = holdsFold(negR, attach.from, attach.to);
		if (posH !== negH) return posH ? posR : negR;
	}
	return Math.abs(polyArea(posR.outline)) >= Math.abs(polyArea(negR.outline))
		? posR
		: negR;
}

function nextFold(region: Region, folds: Fold[]): number {
	let best = -1;
	let bestScore = -1;
	for (let i = 0; i < folds.length; i++) {
		const fold = folds[i];
		const from = { x: fold.from[0], y: fold.from[1] };
		const to = { x: fold.to[0], y: fold.to[1] };
		const cut = splitRing(region.outline, from, to);
		if (!cut) continue;
		const score = Math.min(
			Math.abs(polyArea(cut.pos)),
			Math.abs(polyArea(cut.neg)),
		);
		if (score > bestScore) {
			best = i;
			bestScore = score;
		}
	}
	return best;
}

function build(
	piece: PieceGeom,
	region: Region,
	folds: Fold[],
	origin: { cx: number; cy: number },
	attach?: { from: Vec2; to: Vec2 },
): THREE.Group {
	const i = nextFold(region, folds);
	if (i >= 0) {
		const fold = folds[i];
		const from = { x: fold.from[0], y: fold.from[1] };
		const to = { x: fold.to[0], y: fold.to[1] };
		const cut = splitRing(region.outline, from, to);
		if (!cut) return panelLeaf(piece, region, folds, origin);
		const rest = folds.filter((_, j) => j !== i);
		const posR = takeSide(cut.pos, region, from, to, true);
		const negR = takeSide(cut.neg, region, from, to, false);
		const parent = pickParent(posR, negR, attach);
		const child = parent === posR ? negR : posR;
		const g = new THREE.Group();
		g.add(build(piece, parent, rest, origin, attach));
		const { group, rot, inner } = makeHinge(piece, fold, child, origin);
		inner.add(build(piece, child, rest, origin, { from, to }));
		fixSign(rot, inner, fold);
		addFoldStitch(
			piece,
			region.stitches,
			from,
			to,
			parent === posR,
			fold.hinge === 'mountain',
			origin,
			g,
			inner,
			rot.userData.hinge as HingeData,
		);
		g.add(group);
		return g;
	}
	return panelLeaf(piece, region, folds, origin);
}

function panelLeaf(
	piece: PieceGeom,
	region: Region,
	folds: Fold[],
	origin: { cx: number; cy: number },
): THREE.Group {
	const g = panelGroup(
		piece,
		region.outline,
		region.holes,
		region.stitches,
		region.hardware,
		origin,
	);
	addBoundaryMarkers(g, piece, region, folds, origin);
	return g;
}

export function pieceRig(piece: PieceGeom): THREE.Group {
	const origin = pieceOrigin(piece);
	const region: Region = {
		outline: cmdsToRing(piece.outline),
		holes: piece.holes.map(cmdsToRing),
		stitches: piece.stitchRuns,
		hardware: piece.hardware,
	};
	const root = build(piece, region, piece.folds, origin);
	if (piece.flip === 'x') root.rotation.y += Math.PI;
	if (piece.flip === 'y') root.rotation.x += Math.PI;
	root.userData.span = Math.max(origin.w, origin.h, piece.thickness);
	return root;
}

export function applyMotions(
	root: THREE.Object3D,
	motions: Motion[],
	tById: Record<string, number>,
) {
	root.traverse((o) => {
		const h = o.userData.hinge as HingeData | undefined;
		if (!h) return;
		let angle = h.rest;
		for (const m of motions) {
			if (m.folds[h.id] == null) continue;
			const t = tById[m.id] ?? 0;
			angle = h.rest + (m.folds[h.id] - h.rest) * t;
		}
		const rad = h.sign * THREE.MathUtils.degToRad(angle);
		(o as THREE.Group).rotation.x = rad;
		if (h.bend) setBendAngle(h.bend, rad);
		if (h.stitchWrap) setStitchWrap(h.stitchWrap, rad);
	});
}
