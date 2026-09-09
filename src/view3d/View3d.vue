<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { Motion, PieceGeom, Scene } from '../format/types';
import { assemblyRig } from './assemble';
import { disposeObject } from './extrude';
import { applyMotions, pieceRig } from './hinge';

const props = defineProps<{
	piece: PieceGeom | null;
	scene: Scene | null;
	mode: 'piece' | 'assembly';
	motions: Motion[];
	motionT: Record<string, number>;
	active?: boolean;
}>();

const host = ref<HTMLElement | null>(null);
let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;
let camera: THREE.PerspectiveCamera | null = null;
let controls: OrbitControls | null = null;
let pieceObj: THREE.Object3D | null = null;
let raf = 0;
let ro: ResizeObserver | null = null;

onMounted(() => {
	const el = host.value;
	if (!el) return;
	const w = el.clientWidth || 1;
	const h = el.clientHeight || 1;
	scene = new THREE.Scene();
	scene.background = new THREE.Color(0x1c1917);
	camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 4000);
	camera.position.set(40, 50, 140);
	renderer = new THREE.WebGLRenderer({ antialias: true });
	renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
	renderer.setSize(w, h);
	el.appendChild(renderer.domElement);

	scene.add(new THREE.AmbientLight(0xffffff, 0.35));
	const hemi = new THREE.HemisphereLight(0xf5f0e6, 0x3f2a1d, 0.7);
	scene.add(hemi);
	const key = new THREE.DirectionalLight(0xfff6e8, 1.1);
	key.position.set(60, 80, 120);
	scene.add(key);
	const fill = new THREE.DirectionalLight(0xc4b8a8, 0.35);
	fill.position.set(-80, -20, 40);
	scene.add(fill);

	controls = new OrbitControls(camera, renderer.domElement);
	controls.enableDamping = true;
	controls.dampingFactor = 0.08;

	ro = new ResizeObserver(resize);
	ro.observe(el);
	rebuild();
	loop();
});

onUnmounted(() => {
	cancelAnimationFrame(raf);
	ro?.disconnect();
	controls?.dispose();
	if (pieceObj) disposeObject(pieceObj);
	renderer?.dispose();
	renderer?.domElement.remove();
});

watch(
	() => [props.mode, props.piece, props.scene] as const,
	() => rebuild(),
	{ deep: true },
);

watch(
	() => props.motionT,
	() => pose(),
	{ deep: true },
);

watch(
	() => props.active,
	(on) => {
		if (on)
			requestAnimationFrame(() => {
				resize();
				if (!pieceObj) rebuild();
			});
	},
);

function resize() {
	const el = host.value;
	if (!el || !renderer || !camera) return;
	const w = Math.max(1, el.clientWidth);
	const h = Math.max(1, el.clientHeight);
	camera.aspect = w / h;
	camera.updateProjectionMatrix();
	renderer.setSize(w, h);
}

function pose() {
	if (!pieceObj) return;
	applyMotions(pieceObj, props.motions, props.motionT);
}

function rebuild() {
	if (!scene || !camera || !controls) return;
	if (pieceObj) {
		scene.remove(pieceObj);
		disposeObject(pieceObj);
		pieceObj = null;
	}
	if (props.mode === 'assembly') {
		if (!props.scene) return;
		pieceObj = assemblyRig(props.scene);
	} else if (props.piece) {
		pieceObj = pieceRig(props.piece);
	} else {
		return;
	}
	scene.add(pieceObj);
	pose();
	const box = new THREE.Box3().setFromObject(pieceObj);
	const center = box.getCenter(new THREE.Vector3());
	const size = box.getSize(new THREE.Vector3());
	const span = Math.max(size.x, size.y, size.z, 40);
	camera.position.set(
		center.x + span * 0.55,
		center.y + span * 0.45,
		center.z + span * 1.35,
	);
	controls.target.copy(center);
	controls.update();
}

function loop() {
	raf = requestAnimationFrame(loop);
	controls?.update();
	if (renderer && scene && camera) renderer.render(scene, camera);
}
</script>

<template>
	<div ref="host" class="h-full min-h-0 min-w-0 w-full bg-stone-900" />
</template>
