import * as THREE from 'three';
import type { Fold, PieceGeom } from '../format/types';
import { addThreadSeg, leatherMat, shade } from './extrude';

const EPS = 1e-3;
/** Extra sweep (rad) so the radial faces sit inside the panels, not on them. */
const FACE_PAD = 0.01;

const AXES = new THREE.Matrix4().set(
	0,
	0,
	1,
	0,
	1,
	0,
	0,
	0,
	0,
	1,
	0,
	0,
	0,
	0,
	0,
	1,
);

function pieShape(radius: number, angle: number): THREE.Shape {
	const pad = Math.sign(angle || 1) * FACE_PAD;
	const a0 = -pad;
	const a1 = angle + pad;
	const n = Math.max(8, Math.ceil((Math.abs(a1 - a0) * 18) / Math.PI));
	const pts: THREE.Vector2[] = [new THREE.Vector2(0, 0)];
	for (let i = 0; i <= n; i++) {
		const φ = a0 + ((a1 - a0) * i) / n;
		pts.push(new THREE.Vector2(-radius * Math.sin(φ), radius * Math.cos(φ)));
	}
	if (THREE.ShapeUtils.isClockWise(pts)) pts.reverse();
	return new THREE.Shape(pts);
}

function assignBendGroups(geo: THREE.BufferGeometry) {
	const pos = geo.getAttribute('position');
	const idx = geo.getIndex();
	if (!idx) return;
	const wrap: number[] = [];
	const cap: number[] = [];
	const ax = new THREE.Vector3();
	const bx = new THREE.Vector3();
	const cx = new THREE.Vector3();
	const ab = new THREE.Vector3();
	const ac = new THREE.Vector3();
	const n = new THREE.Vector3();
	for (let i = 0; i < idx.count; i += 3) {
		const ia = idx.getX(i);
		const ib = idx.getX(i + 1);
		const ic = idx.getX(i + 2);
		ax.fromBufferAttribute(pos, ia);
		bx.fromBufferAttribute(pos, ib);
		cx.fromBufferAttribute(pos, ic);
		ab.subVectors(bx, ax);
		ac.subVectors(cx, ax);
		n.crossVectors(ab, ac).normalize();
		(Math.abs(n.x) > 0.5 ? cap : wrap).push(ia, ib, ic);
	}
	geo.setIndex(wrap.concat(cap));
	geo.clearGroups();
	geo.addGroup(0, wrap.length, 0);
	geo.addGroup(wrap.length, cap.length, 1);
}

export function foldBendGeometry(
	length: number,
	radius: number,
	angle: number,
): THREE.BufferGeometry {
	const L = Math.max(0.1, length);
	const geo = new THREE.ExtrudeGeometry(pieShape(radius, angle), {
		depth: L,
		bevelEnabled: false,
		curveSegments: 1,
		steps: 1,
	});
	geo.translate(0, 0, -L / 2);
	geo.applyMatrix4(AXES);
	assignBendGroups(geo);
	geo.computeVertexNormals();
	return geo;
}

function wrapMat(piece: PieceGeom, hinge: Fold['hinge']) {
	const mountain = hinge === 'mountain';
	const useBack = piece.side === 'back' ? !mountain : mountain;
	const face = useBack ? piece.back : piece.front;
	const m = leatherMat(piece.color, face.roughness, face.grain);
	m.polygonOffset = true;
	m.polygonOffsetFactor = -1;
	m.polygonOffsetUnits = -1;
	return m;
}

export function makeFoldBend(
	piece: PieceGeom,
	fold: Fold,
	length: number,
	radius: number,
): THREE.Mesh {
	const edge = new THREE.MeshStandardMaterial({
		color: shade(piece.color, 0.65),
		roughness: 0.7,
		metalness: 0,
		polygonOffset: true,
		polygonOffsetFactor: -1,
		polygonOffsetUnits: -1,
	});
	const mesh = new THREE.Mesh(foldBendGeometry(length, radius, 1e-2), [
		wrapMat(piece, fold.hinge),
		edge,
	]);
	mesh.visible = false;
	mesh.userData.foldBend = { length, radius };
	return mesh;
}

export function setBendAngle(mesh: THREE.Mesh, angle: number) {
	const d = mesh.userData.foldBend as { length: number; radius: number };
	if (Math.abs(angle) < EPS) {
		mesh.visible = false;
		return;
	}
	const old = mesh.geometry;
	mesh.geometry = foldBendGeometry(d.length, d.radius, angle);
	old.dispose();
	mesh.visible = true;
}

export type StitchWrapData = {
	alongs: number[];
	radius: number;
	rTh: number;
	mat: THREE.Material;
};

function wrapPt(along: number, radius: number, φ: number): THREE.Vector3 {
	return new THREE.Vector3(along, -radius * Math.sin(φ), radius * Math.cos(φ));
}

export function setStitchWrap(group: THREE.Group, angle: number) {
	const d = group.userData.stitchWrap as StitchWrapData | undefined;
	if (!d) return;
	while (group.children.length) {
		const ch = group.children[0] as THREE.Mesh;
		group.remove(ch);
		ch.geometry?.dispose();
	}
	if (Math.abs(angle) < EPS) return;
	const n = Math.max(6, Math.ceil((Math.abs(angle) * 12) / Math.PI));
	const r = d.radius + Math.sign(d.radius || 1) * d.rTh * 0.35;
	for (const along of d.alongs) {
		let prev = wrapPt(along, r, 0);
		for (let i = 1; i <= n; i++) {
			const φ = (angle * i) / n;
			const next = wrapPt(along, r, φ);
			addThreadSeg(group, prev, next, d.rTh, d.mat);
			prev = next;
		}
	}
}
