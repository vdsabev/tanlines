import * as THREE from 'three';
import { samplePath } from '../format/sample';
import type { PieceGeom, Vec2 } from '../format/types';

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
	stitches: PieceGeom['stitchHoles'],
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
	for (const h of stitches) {
		const r = Math.max(0.15, h.d / 2);
		const cyl = new THREE.CylinderGeometry(r, r, depth + 0.05, 10);
		cyl.rotateX(Math.PI / 2);
		const m = new THREE.Mesh(
			cyl,
			new THREE.MeshStandardMaterial({
				color: '#1c1917',
				roughness: 0.9,
				metalness: 0,
			}),
		);
		m.position.set(h.x - origin.cx, -(h.y - origin.cy), 0);
		root.add(m);
	}
	return root;
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
