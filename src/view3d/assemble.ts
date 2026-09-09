import * as THREE from 'three';
import type { Motion, PieceGeom, Scene } from '../format/types';
import { pieceRig } from './hinge';

export function parseJoinRef(
	s: string,
): { piece: string; fold: string } | null {
	const i = s.lastIndexOf('.');
	if (i <= 0 || i === s.length - 1) return null;
	return { piece: s.slice(0, i), fold: s.slice(i + 1) };
}

function findMarker(
	root: THREE.Object3D,
	foldId: string,
): THREE.Object3D | null {
	let found: THREE.Object3D | null = null;
	root.traverse((o) => {
		if (o.userData.foldMarker === foldId) found = o;
	});
	return found;
}

function alignJoin(
	hostM: THREE.Object3D,
	guestM: THREE.Object3D,
	guest: THREE.Object3D,
) {
	hostM.updateWorldMatrix(true, false);
	guest.updateWorldMatrix(true, true);
	guestM.updateWorldMatrix(true, false);
	const flip = new THREE.Matrix4().makeRotationZ(Math.PI);
	const target = hostM.matrixWorld.clone().multiply(flip);
	const guestLocal = guest.matrixWorld
		.clone()
		.invert()
		.multiply(guestM.matrixWorld);
	const newWorld = target.multiply(guestLocal.invert());
	newWorld.decompose(guest.position, guest.quaternion, guest.scale);
	guest.updateMatrixWorld(true);
	hostM.attach(guest);
}

export function assemblyMotions(scene: Scene): Motion[] {
	const byId = new Map<string, Motion>();
	for (const p of scene.pieces) {
		for (const m of p.motion) {
			const cur = byId.get(m.id);
			if (!cur) {
				byId.set(m.id, { id: m.id, folds: { ...m.folds } });
				continue;
			}
			Object.assign(cur.folds, m.folds);
		}
	}
	return [...byId.values()];
}

export function assemblyRig(scene: Scene): THREE.Group {
	const unique: PieceGeom[] = [];
	const seen = new Set<string>();
	for (const p of scene.pieces) {
		if (seen.has(p.id)) continue;
		seen.add(p.id);
		unique.push(p);
	}
	const rigs = new Map<string, THREE.Group>();
	for (const p of unique) rigs.set(p.id, pieceRig(p));

	const root = new THREE.Group();
	const attached = new Set<string>();

	if (scene.assembly.length === 0) {
		let x = 0;
		for (const p of unique) {
			const g = rigs.get(p.id)!;
			g.position.x = x;
			root.add(g);
			x += Number(g.userData.span) + 12;
		}
	} else {
		const first = parseJoinRef(scene.assembly[0].a);
		const groundId =
			first?.piece && rigs.has(first.piece) ? first.piece : unique[0].id;
		root.add(rigs.get(groundId)!);
		attached.add(groundId);

		let progress = true;
		while (progress) {
			progress = false;
			for (const j of scene.assembly) {
				const A = parseJoinRef(j.a);
				const B = parseJoinRef(j.b);
				if (!A || !B) continue;
				const aOn = attached.has(A.piece);
				const bOn = attached.has(B.piece);
				if (aOn === bOn) continue;
				const hostRef = aOn ? A : B;
				const guestRef = aOn ? B : A;
				const host = rigs.get(hostRef.piece);
				const guest = rigs.get(guestRef.piece);
				if (!host || !guest) continue;
				const hostM = findMarker(host, hostRef.fold);
				const guestM = findMarker(guest, guestRef.fold);
				if (!hostM || !guestM) continue;
				alignJoin(hostM, guestM, guest);
				attached.add(guestRef.piece);
				progress = true;
			}
		}
		let extra = 0;
		for (const p of unique) {
			if (attached.has(p.id)) continue;
			const g = rigs.get(p.id)!;
			extra += Number(g.userData.span) + 12;
			g.position.x = extra;
			root.add(g);
		}
	}

	const box = new THREE.Box3().setFromObject(root);
	const size = box.getSize(new THREE.Vector3());
	root.userData.span = Math.max(size.x, size.y, size.z, 40);
	return root;
}
