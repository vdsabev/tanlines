<template>
	<div class="flex h-full flex-col">
		<header
			class="flex flex-wrap items-center gap-1 border-b border-stone-700 p-1"
		>
			<ToolbarButton class="md:hidden" @click="toggleSidebar">
				{{ sidebarOpen ? 'hide code' : 'show code' }}
			</ToolbarButton>

			<ToolbarButton @click="onNew">new</ToolbarButton>

			<ToolbarButton as="label">
				open
				<input
					class="hidden"
					type="file"
					accept=".tan,.yaml,.yml,text/yaml"
					@change="onOpen"
				/>
			</ToolbarButton>

			<span class="text-stone-400">{{ filename }}</span>

			<span class="ms-2 text-stone-400">view:</span>
			<ToolbarButton :on="view === '2d'" @click="view = '2d'">2d</ToolbarButton>
			<ToolbarButton :on="view === '3d'" @click="view = '3d'">3d</ToolbarButton>
			<ToolbarButton :on="view === 'assembly'" @click="view = 'assembly'">
				assembly
			</ToolbarButton>
			<template v-if="view === '3d'">
				<ToolbarButton
					v-for="id in pieceIds"
					:key="id"
					:on="pieceId === id"
					@click="pieceId = id"
				>
					{{ id }}
				</ToolbarButton>
			</template>
			<span v-if="view === 'assembly'" class="ms-1 text-stone-400">
				<template v-if="joins.length">
					join:
					<template v-for="(j, i) in joins" :key="i">
						<span v-if="i">, </span>
						{{ j.a }} ↔ {{ j.b }}
					</template>
				</template>
				<template v-else>join: none</template>
			</span>
			<label
				v-for="m in viewMotions"
				:key="m.id"
				class="ms-2 flex items-center gap-1 text-stone-400"
			>
				{{ m.id }}
				<input
					class="accent-amber-400"
					type="range"
					min="0"
					max="1"
					step="0.01"
					:value="motionT[m.id] ?? 0"
					@input="onMotion(m.id, $event)"
				/>
				<span>{{ motionReadout(m) }}</span>
			</label>
		</header>

		<div ref="splitEl" class="flex min-h-0 flex-1">
			<div class="relative min-h-0 min-w-0 flex-1 overflow-hidden bg-stone-900">
				<div
					v-show="view === '2d'"
					class="h-full [&_svg]:block [&_svg]:h-full [&_svg]:w-full"
					v-html="svg"
				/>
				<View3d
					v-show="view !== '2d'"
					:active="view !== '2d'"
					:mode="view === 'assembly' ? 'assembly' : 'piece'"
					:piece="activePiece"
					:scene="lastScene"
					:motions="viewMotions"
					:motionT="motionT"
				/>
			</div>

			<aside
				v-show="!mobile || sidebarOpen"
				class="relative flex shrink-0 flex-col bg-stone-900"
				:class="mobile ? 'absolute inset-0 z-10' : ''"
				:style="mobile ? undefined : { width: sidebarW + 'px' }"
			>
				<textarea
					v-model="text"
					class="min-h-0 flex-1 border-l border-stone-700 resize-none bg-stone-900 p-2 text-stone-200 outline-none"
					spellcheck="false"
					@input="onInput"
				/>

				<div
					v-if="!mobile"
					class="absolute top-1/2 right-full flex w-6 h-8 rounded-s-full cursor-col-resize touch-none select-none items-center justify-center border-t border-b border-l border-stone-700 bg-stone-950 ps-0.5 text-stone-500 hover:bg-stone-800 hover:text-stone-200 active:bg-stone-800 active:text-stone-200"
					title="drag to resize"
					@pointerdown="onDragStart"
				>
					<span class="pointer-events-none leading-none" aria-hidden="true">
						⋮
					</span>
				</div>
			</aside>
		</div>

		<footer
			class="flex items-center gap-1 border-t border-stone-700 bg-stone-950 p-1"
		>
			<div class="contents">
				<!-- Paper -->
				<span class="text-stone-400">paper:</span>

				<ToolbarButton
					v-for="p in paperNames"
					:key="p"
					:on="paperKind === p"
					@click="setPaper(p)"
				>
					{{ p }}
				</ToolbarButton>

				<template v-if="paperKind === 'custom'">
					<PaperSizeInput
						type="number"
						min="1"
						step="1"
						:value="customW"
						@change="onCustomDim($event, 'w')"
					/>

					<span class="text-stone-400">×</span>

					<PaperSizeInput
						type="number"
						min="1"
						step="1"
						:value="customH"
						@change="onCustomDim($event, 'h')"
					/>

					<span class="text-stone-400">mm</span>
				</template>

				<span v-else class="text-stone-400"> {{ paperW }}×{{ paperH }}mm </span>
			</div>

			<!-- Export -->
			<div class="contents">
				<span class="ms-2 text-stone-400">export:</span>

				<ToolbarButton @click="onExportTan">tan</ToolbarButton>

				<ToolbarButton @click="onExportSvg">svg</ToolbarButton>

				<ToolbarButton @click="onExportPdf">pdf</ToolbarButton>

				<ToolbarButton @click="onPrint">print</ToolbarButton>
			</div>

			<div v-if="error" class="ms-auto text-red-400">{{ error }}</div>
		</footer>
	</div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import ToolbarButton from './ToolbarButton.vue';
import PaperSizeInput from './PaperSizeInput.vue';
import View3d from '../view3d/View3d.vue';
import { compile } from '../format/compile';
import { parseDocument } from '../format/parse';
import { paperPick, setLayoutPaper, type PaperPick } from '../format/paper';
import { toSvg } from '../format/toSvg';
import type { Motion, PieceGeom, Scene } from '../format/types';
import { assemblyMotions } from '../view3d/assemble';
import {
	download,
	loadSidebarOpen,
	loadSidebarW,
	loadStored,
	saveSidebarOpen,
	saveSidebarW,
	saveStored,
	SIDEBAR_W_MIN,
} from '../persist';
import example from '../../examples/cardholder.tan?raw';

const text = ref(example);
const filename = ref('cardholder.tan');
const error = ref('');
const svg = ref('');
const stitchNote = ref('');
const sidebarW = ref(loadSidebarW());
const sidebarOpen = ref(loadSidebarOpen());
const mobile = ref(false);
const splitEl = ref<HTMLElement | null>(null);
const paperNames: PaperPick[] = ['A3', 'A4', 'A5', 'custom'];
const paperKind = ref<PaperPick>('A4');
const paperW = ref(210);
const paperH = ref(297);
const customW = ref(210);
const customH = ref(297);
const view = ref<'2d' | '3d' | 'assembly'>('2d');
const pieceId = ref('');
const lastScene = ref<Scene | null>(null);
const motionT = ref<Record<string, number>>({});
const pieceIds = computed(() => [
	...new Set(lastScene.value?.pieces.map((p) => p.id) ?? []),
]);
const activePiece = computed<PieceGeom | null>(() => {
	const s = lastScene.value;
	if (!s) return null;
	return s.pieces.find((p) => p.id === pieceId.value) ?? s.pieces[0] ?? null;
});
const joins = computed(() => lastScene.value?.assembly ?? []);
const viewMotions = computed<Motion[]>(() => {
	if (view.value === '2d') return [];
	if (view.value === 'assembly')
		return lastScene.value ? assemblyMotions(lastScene.value) : [];
	return activePiece.value?.motion ?? [];
});
let lastGoodSvg = '';
let t = 0;
let mq: MediaQueryList | null = null;

onMounted(() => {
	const stored = loadStored();
	if (stored) {
		text.value = stored.text;
		filename.value = stored.filename;
	}
	compileNow();
	mq = window.matchMedia('(max-width: 767px)');
	mobile.value = mq.matches;
	mq.addEventListener('change', onMq);
});

onUnmounted(() => {
	mq?.removeEventListener('change', onMq);
});

function onMq(e: MediaQueryListEvent) {
	mobile.value = e.matches;
}

function toggleSidebar() {
	sidebarOpen.value = !sidebarOpen.value;
	saveSidebarOpen(sidebarOpen.value);
}

function onDragStart(e: PointerEvent) {
	e.preventDefault();
	const root = splitEl.value;
	if (!root) return;
	const startX = e.clientX;
	const startW = sidebarW.value;
	const max = Math.max(SIDEBAR_W_MIN, root.clientWidth - 80);
	const prevCursor = document.body.style.cursor;
	document.body.style.cursor = 'col-resize';
	const onMove = (ev: PointerEvent) => {
		sidebarW.value = Math.min(
			max,
			Math.max(SIDEBAR_W_MIN, startW - (ev.clientX - startX)),
		);
	};
	const onUp = () => {
		document.body.style.cursor = prevCursor;
		window.removeEventListener('pointermove', onMove);
		window.removeEventListener('pointerup', onUp);
		saveSidebarW(sidebarW.value);
	};
	window.addEventListener('pointermove', onMove);
	window.addEventListener('pointerup', onUp);
}

function onMotion(id: string, ev: Event) {
	const n = Number((ev.target as HTMLInputElement).value);
	motionT.value = { ...motionT.value, [id]: n };
}

function foldRest(id: string): number {
	for (const p of lastScene.value?.pieces ?? []) {
		const f = p.folds.find((x) => x.id === id);
		if (f) return f.angle;
	}
	return 0;
}

function motionReadout(m: Motion): string {
	const t = motionT.value[m.id] ?? 0;
	return Object.entries(m.folds)
		.map(([id, target]) => {
			const rest = foldRest(id);
			return `${Math.round(rest + (target - rest) * t)}°`;
		})
		.join(' ');
}

function onInput() {
	clearTimeout(t);
	t = window.setTimeout(compileNow, 50);
}

function compileNow() {
	const parsed = parseDocument(text.value);
	if (!parsed.ok) {
		error.value = `${parsed.errors[0].line}:${parsed.errors[0].column} ${parsed.errors[0].message}`;
		svg.value = lastGoodSvg;
		return;
	}
	error.value = '';
	const scene = compile(parsed.doc);
	lastScene.value = scene;
	if (!scene.pieces.some((p) => p.id === pieceId.value))
		pieceId.value = scene.pieces[0]?.id ?? '';
	const nextT = { ...motionT.value };
	for (const m of assemblyMotions(scene))
		if (nextT[m.id] == null) nextT[m.id] = 0;
	motionT.value = nextT;
	const n = scene.pieces.reduce((s, p) => s + p.stitchHoles.length, 0);
	stitchNote.value = n === 1 ? '1 stitch hole' : `${n} stitch holes`;
	lastGoodSvg = toSvg(scene);
	svg.value = lastGoodSvg;
	paperKind.value = paperPick(scene.paper);
	paperW.value = scene.paper.w;
	paperH.value = scene.paper.h;
	if (paperKind.value === 'custom') {
		customW.value = scene.paper.w;
		customH.value = scene.paper.h;
	}
	saveStored(text.value, filename.value);
}

function setPaper(pick: PaperPick) {
	if (pick === 'custom') {
		customW.value = paperW.value;
		customH.value = paperH.value;
	}
	text.value = setLayoutPaper(text.value, pick, {
		w: customW.value,
		h: customH.value,
	});
	compileNow();
}

function onCustomDim(ev: Event, axis: 'w' | 'h') {
	const n = Number((ev.target as HTMLInputElement).value);
	if (!Number.isFinite(n) || n <= 0) return;
	if (axis === 'w') customW.value = n;
	else customH.value = n;
	text.value = setLayoutPaper(text.value, 'custom', {
		w: customW.value,
		h: customH.value,
	});
	compileNow();
}

function onNew() {
	text.value = example;
	filename.value = 'pattern.tan';
	compileNow();
}

function onOpen(ev: Event) {
	const file = (ev.target as HTMLInputElement).files?.[0];
	if (!file) return;
	file.text().then((s) => {
		text.value = s;
		filename.value = file.name;
		compileNow();
	});
}

function onExportTan() {
	download(
		filename.value.endsWith('.tan') ? filename.value : filename.value + '.tan',
		text.value,
		'text/yaml',
	);
}

function onExportSvg() {
	const parsed = parseDocument(text.value);
	if (!parsed.ok) return;
	download(
		filename.value.replace(/\.tan$/, '') + '.svg',
		toSvg(compile(parsed.doc)),
		'image/svg+xml',
	);
}

async function pdfBytes(): Promise<Uint8Array | null> {
	const parsed = parseDocument(text.value);
	if (!parsed.ok) return null;
	const { toPdf } = await import('../format/toPdf');
	return toPdf(compile(parsed.doc));
}

async function onExportPdf() {
	const bytes = await pdfBytes();
	if (!bytes) return;
	download(
		filename.value.replace(/\.tan$/, '') + '.pdf',
		bytes as BlobPart,
		'application/pdf',
	);
}

async function onPrint() {
	const bytes = await pdfBytes();
	if (!bytes) return;
	const url = URL.createObjectURL(
		new Blob([bytes as BlobPart], { type: 'application/pdf' }),
	);
	const iframe = document.createElement('iframe');
	iframe.setAttribute('aria-hidden', 'true');
	iframe.style.position = 'fixed';
	iframe.style.width = '0';
	iframe.style.height = '0';
	iframe.style.border = '0';
	iframe.src = url;
	iframe.addEventListener('load', () => {
		iframe.contentWindow?.focus();
		iframe.contentWindow?.print();
	});
	document.body.appendChild(iframe);
}
</script>
