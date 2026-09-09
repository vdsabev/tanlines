import * as THREE from 'three';
import { samplePath } from '../format/sample';
import { stitchPairs } from '../format/thread';
import type { Hardware, PieceGeom, StitchRun, Vec2 } from '../format/types';

export function bbox(pts: Vec2[]): {
	cx: number;
	cy: number;
	w: number;
	h: number;
} {
	let minX = Infinity,
		minY = Infinity,
		maxX = -Infinity,
		maxY = -Infinity;
	for (const p of pts) {
		if (p.x < minX) minX = p.x;
		if (p.y < minY) minY = p.y;
		if (p.x > maxX) maxX = p.x;
		if (p.y > maxY) maxY = p.y;
	}
	return {
		cx: (minX + maxX) / 2,
		cy: (minY + maxY) / 2,
		w: maxX - minX,
		h: maxY - minY,
	};
}

function assignGroups(geo: THREE.BufferGeometry) {
	const pos = geo.getAttribute('position');
	const idx = geo.getIndex();
	if (!idx) return;
	const buckets: number[][] = [[], [], []];
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
		let b = 2;
		if (n.z > 0.5) b = 0;
		else if (n.z < -0.5) b = 1;
		buckets[b].push(ia, ib, ic);
	}
	const merged = buckets[0].concat(buckets[1], buckets[2]);
	geo.setIndex(merged);
	geo.clearGroups();
	geo.addGroup(0, buckets[0].length, 0);
	geo.addGroup(buckets[0].length, buckets[1].length, 1);
	geo.addGroup(buckets[0].length + buckets[1].length, buckets[2].length, 2);
}

function grainTexture(grain: string): THREE.CanvasTexture {
	const size = 64;
	const c = document.createElement('canvas');
	c.width = size;
	c.height = size;
	const ctx = c.getContext('2d');
	if (!ctx) return new THREE.CanvasTexture(c);
	const img = ctx.createImageData(size, size);
	const amp = grain === 'suede' ? 48 : grain === 'fine' ? 10 : 24;
	for (let i = 0; i < img.data.length; i += 4) {
		const v = 128 + (Math.random() * 2 - 1) * amp;
		img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
		img.data[i + 3] = 255;
	}
	ctx.putImageData(img, 0, 0);
	const t = new THREE.CanvasTexture(c);
	t.wrapS = t.wrapT = THREE.RepeatWrapping;
	t.repeat.set(6, 6);
	t.needsUpdate = true;
	return t;
}

export function leatherMat(
	color: string,
	roughness: number,
	grain: string,
): THREE.MeshStandardMaterial {
	const bumpMap = grainTexture(grain);
	return new THREE.MeshStandardMaterial({
		color,
		roughness,
		metalness: 0,
		bumpMap,
		bumpScale: grain === 'suede' ? 0.35 : 0.08,
	});
}

export function shade(hex: string, k: number): string {
	const n = hex.replace('#', '');
	const r = Math.round(parseInt(n.slice(0, 2), 16) * k);
	const g = Math.round(parseInt(n.slice(2, 4), 16) * k);
	const b = Math.round(parseInt(n.slice(4, 6), 16) * k);
	const h = (x: number) => x.toString(16).padStart(2, '0');
	return `#${h(r)}${h(g)}${h(b)}`;
}

function toShape(pts: Vec2[]): THREE.Shape {
	const v = pts.map((p) => new THREE.Vector2(p.x, -p.y));
	if (v.length > 1 && v[0].distanceTo(v[v.length - 1]) < 1e-6) v.pop();
	if (THREE.ShapeUtils.isClockWise(v)) v.reverse();
	return new THREE.Shape(v);
}

export function panelGroup(
	piece: PieceGeom,
	outline: Vec2[],
	holes: Vec2[][],
	stitches: StitchRun[],
	hardware: Hardware[],
	origin: { cx: number; cy: number },
): THREE.Group {
	const shape = toShape(outline);
	for (const h of holes) {
		const hp = h.map((p) => new THREE.Vector2(p.x, -p.y));
		if (hp.length > 1 && hp[0].distanceTo(hp[hp.length - 1]) < 1e-6) hp.pop();
		if (!THREE.ShapeUtils.isClockWise(hp)) hp.reverse();
		shape.holes.push(new THREE.Path(hp));
	}
	const depth = Math.max(0.2, piece.thickness);
	const geo = new THREE.ExtrudeGeometry(shape, {
		depth,
		bevelEnabled: false,
		curveSegments: 1,
		steps: 1,
	});
	assignGroups(geo);
	geo.translate(-origin.cx, origin.cy, -depth / 2);
	geo.computeVertexNormals();

	const front = leatherMat(
		piece.color,
		piece.front.roughness,
		piece.front.grain,
	);
	const back = leatherMat(piece.color, piece.back.roughness, piece.back.grain);
	const edge = new THREE.MeshStandardMaterial({
		color: shade(piece.color, 0.65),
		roughness: 0.7,
		metalness: 0,
	});
	const mats =
		piece.side === 'back' ? [back, front, edge] : [front, back, edge];
	const mesh = new THREE.Mesh(geo, mats);

	const root = new THREE.Group();
	root.add(mesh);
	const punch = new THREE.MeshStandardMaterial({
		color: '#1c1917',
		roughness: 0.9,
		metalness: 0,
	});
	const thread = threadMat(piece.stitchColor);
	for (const run of stitches) {
		const rHole = Math.max(0.15, run.hole / 2);
		const rTh = Math.max(0.12, rHole * 0.42);
		const zF = depth / 2 + rTh * 0.35;
		const zB = -depth / 2 - rTh * 0.35;
		const xyz = (p: Vec2, z: number) =>
			new THREE.Vector3(p.x - origin.cx, -(p.y - origin.cy), z);
		for (const p of run.pts) {
			addThreadSeg(root, xyz(p, zF), xyz(p, zB), rTh, thread);
			const cyl = new THREE.CylinderGeometry(rHole, rHole, depth + 0.05, 10);
			cyl.rotateX(Math.PI / 2);
			const m = new THREE.Mesh(cyl, punch);
			m.position.set(p.x - origin.cx, -(p.y - origin.cy), 0);
			root.add(m);
		}
		const pairs = stitchPairs(run.pts.length, run.closed, run.style);
		for (const [i, j] of pairs.front) {
			addThreadSeg(root, xyz(run.pts[i], zF), xyz(run.pts[j], zF), rTh, thread);
		}
		for (const [i, j] of pairs.back) {
			addThreadSeg(root, xyz(run.pts[i], zB), xyz(run.pts[j], zB), rTh, thread);
		}
	}
	for (const h of hardware) addHardware(root, h, origin, depth);
	return root;
}

function metal(color: string, metalness: number, roughness: number) {
	return new THREE.MeshStandardMaterial({ color, metalness, roughness });
}

function addHardware(
	root: THREE.Group,
	h: Hardware,
	origin: { cx: number; cy: number },
	depth: number,
) {
	const x = h.at[0] - origin.cx;
	const y = -(h.at[1] - origin.cy);
	const r = Math.max(0.6, h.size / 2);
	const zF = depth / 2;
	const zB = -depth / 2;
	if (h.type === 'stamp') {
		const t = Math.max(0.45, depth * 0.35);
		const geo = new THREE.CylinderGeometry(r, r, t, 20);
		geo.rotateX(Math.PI / 2);
		const m = new THREE.Mesh(
			geo,
			new THREE.MeshStandardMaterial({
				color: '#3f2a22',
				roughness: 0.85,
				metalness: 0,
			}),
		);
		m.position.set(x, y, zF - t * 0.35);
		root.add(m);
		const rim = new THREE.TorusGeometry(
			r * 0.92,
			Math.max(0.25, t * 0.4),
			8,
			20,
		);
		const ring = new THREE.Mesh(
			rim,
			new THREE.MeshStandardMaterial({
				color: '#2a1c16',
				roughness: 0.8,
				metalness: 0,
			}),
		);
		ring.position.set(x, y, zF + 0.05);
		root.add(ring);
		return;
	}
	if (h.type === 'rivet') {
		const brass = metal('#b08d57', 0.85, 0.35);
		const capR = Math.max(r * 0.85, depth * 0.85);
		const cap = (z: number, front: boolean) => {
			const geo = new THREE.SphereGeometry(
				capR,
				16,
				10,
				0,
				Math.PI * 2,
				0,
				Math.PI / 2,
			);
			geo.rotateX(front ? -Math.PI / 2 : Math.PI / 2);
			const m = new THREE.Mesh(geo, brass);
			m.position.set(x, y, z);
			root.add(m);
		};
		cap(zF, true);
		cap(zB, false);
		const shaft = new THREE.CylinderGeometry(
			capR * 0.35,
			capR * 0.35,
			depth + capR * 0.4,
			10,
		);
		shaft.rotateX(Math.PI / 2);
		const m = new THREE.Mesh(shaft, brass);
		m.position.set(x, y, 0);
		root.add(m);
		return;
	}
	if (h.type === 'button') {
		const mat = metal('#4a4038', 0.2, 0.55);
		const t = Math.max(depth * 0.9, r * 0.7);
		const disc = new THREE.CylinderGeometry(r, r * 0.92, t, 24);
		disc.rotateX(Math.PI / 2);
		const m = new THREE.Mesh(disc, mat);
		m.position.set(x, y, zF + t / 2);
		root.add(m);
		const rim = new THREE.TorusGeometry(
			r * 0.55,
			Math.max(0.28, t * 0.18),
			8,
			20,
		);
		const ring = new THREE.Mesh(rim, mat);
		ring.position.set(x, y, zF + t);
		root.add(ring);
		return;
	}
	const nick = metal('#c4c8cc', 0.7, 0.28);
	const capH = Math.max(depth * 1.15, r * 0.45);
	const cap = new THREE.CylinderGeometry(r, r, capH, 24);
	cap.rotateX(Math.PI / 2);
	const c = new THREE.Mesh(cap, nick);
	c.position.set(x, y, zF + capH / 2);
	root.add(c);
	const ring = new THREE.TorusGeometry(
		r * 0.42,
		Math.max(0.28, capH * 0.18),
		8,
		20,
	);
	const rg = new THREE.Mesh(ring, nick);
	rg.position.set(x, y, zF + capH + 0.08);
	root.add(rg);
	const sockH = Math.max(depth * 0.85, r * 0.35);
	const sock = new THREE.CylinderGeometry(r * 0.75, r * 0.75, sockH, 20);
	sock.rotateX(Math.PI / 2);
	const s = new THREE.Mesh(sock, nick);
	s.position.set(x, y, zB - sockH / 2);
	root.add(s);
}

export function threadMat(color = '#e8d4a0') {
	return new THREE.MeshStandardMaterial({
		color,
		roughness: 0.55,
		metalness: 0,
	});
}

export function addThreadSeg(
	root: THREE.Group,
	a: THREE.Vector3,
	b: THREE.Vector3,
	r: number,
	mat: THREE.Material,
) {
	const dir = b.clone().sub(a);
	const len = dir.length();
	if (len < 1e-4) return;
	const geo = new THREE.CylinderGeometry(r, r, len, 6);
	const m = new THREE.Mesh(geo, mat);
	m.position.copy(a).add(b).multiplyScalar(0.5);
	m.quaternion.setFromUnitVectors(
		new THREE.Vector3(0, 1, 0),
		dir.multiplyScalar(1 / len),
	);
	root.add(m);
}

export function disposeObject(obj: THREE.Object3D) {
	obj.traverse((o) => {
		const m = o as THREE.Mesh;
		if (!m.isMesh) return;
		m.geometry.dispose();
		const mats = Array.isArray(m.material) ? m.material : [m.material];
		for (const mat of mats) {
			const std = mat as THREE.MeshStandardMaterial;
			std.bumpMap?.dispose();
			std.map?.dispose();
			mat.dispose();
		}
	});
}

export function pieceOrigin(piece: PieceGeom) {
	return bbox(samplePath(piece.outline, 4));
}
