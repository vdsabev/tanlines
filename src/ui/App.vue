<template>
	<div class="flex h-full flex-col print:block print:h-auto">
		<header
			class="flex items-center gap-1 border-b border-stone-700 px-1.5 py-1 print:hidden"
		>
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

			<span class="min-w-0 max-w-[30vw] shrink-0 truncate text-stone-400">{{
				filename
			}}</span>
			<span
				v-if="error"
				class="ms-auto min-w-0 flex-1 truncate text-right text-red-400"
				:title="error"
				>{{ error }}</span
			>
			<ExportButton :class="error ? '' : 'ms-auto'" @export="onExport" />
		</header>

		<div ref="splitEl" class="flex min-h-0 flex-1 print:block">
			<div
				v-show="!mobile || mobileTab === 'view'"
				class="print-view relative min-h-0 min-w-0 flex-1 overflow-hidden bg-stone-900 print:overflow-visible print:bg-white"
			>
				<div
					v-show="view === '2d'"
					class="h-full [&_svg]:block [&_svg]:h-full [&_svg]:w-full print:hidden"
					v-html="svg"
				/>
				<div
					ref="printSheetEl"
					class="print-sheet hidden [&_svg]:block [&_svg]:h-auto [&_svg]:w-full"
					v-html="printSvg"
				/>
				<View3d
					v-show="view !== '2d'"
					class="print:hidden"
					:active="view !== '2d' && (!mobile || mobileTab === 'view')"
					:mode="view === 'assembly' ? 'assembly' : 'piece'"
					:piece="activePiece"
					:scene="lastScene"
					:motions="viewMotions"
					:motionT="motionT"
				/>

				<div
					class="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap gap-1 p-1.5 print:hidden"
				>
					<div
						class="pointer-events-auto flex flex-wrap items-center gap-x-3 gap-y-1 rounded border border-stone-700/80 bg-stone-950/60 px-1.5 py-1 backdrop-blur"
					>
						<span class="flex flex-wrap items-center gap-1">
							<ToolbarButton :on="view === '2d'" @click="view = '2d'"
								>2d</ToolbarButton
							>
							<ToolbarButton :on="view === '3d'" @click="view = '3d'"
								>3d</ToolbarButton
							>
							<ToolbarButton
								v-if="pieceIds.length > 1"
								:on="view === 'assembly'"
								@click="view = 'assembly'"
							>
								assembly
							</ToolbarButton>
							<template v-if="view === '3d' && pieceIds.length > 1">
								<ToolbarButton
									v-for="id in pieceIds"
									:key="id"
									:on="pieceId === id"
									@click="pieceId = id"
								>
									{{ id }}
								</ToolbarButton>
							</template>
							<span v-if="view === 'assembly'" class="text-stone-400">
								<template v-if="joins.length">
									join:
									<template v-for="(j, i) in joins" :key="i">
										<span v-if="i">, </span>{{ j.a }} ↔ {{ j.b }}
									</template>
								</template>
								<template v-else>join: none</template>
							</span>
						</span>

						<span class="flex flex-wrap items-center gap-1">
							<span class="text-stone-500">paper:</span>
							<select
								class="border border-stone-600 bg-stone-900 px-1 py-0.5 text-stone-200"
								:value="paperKind"
								@change="
									setPaper(
										($event.target as HTMLSelectElement).value as PaperPick,
									)
								"
							>
								<option v-for="p in paperNames" :key="p" :value="p">
									{{ p }}
								</option>
							</select>
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
							<span v-else class="text-stone-400">
								{{ paperW }}×{{ paperH }}mm
							</span>
						</span>
					</div>
				</div>
			</div>

			<aside
				v-show="!mobile || mobileTab !== 'view'"
				class="relative flex min-h-0 shrink-0 flex-col bg-stone-900 print:hidden"
				:class="mobile ? 'min-w-0 flex-1' : ''"
				:style="mobile ? undefined : { width: sidebarW + 'px' }"
			>
				<div
					class="hidden gap-1 border-b border-l border-stone-700 px-1.5 py-1 md:flex"
				>
					<ToolbarButton :on="panel === 'code'" @click="setPanel('code')">
						code
					</ToolbarButton>
					<ToolbarButton
						:on="panel === 'controls'"
						@click="setPanel('controls')"
					>
						controls
					</ToolbarButton>
				</div>
				<YamlEditor
					v-if="sideTab === 'code'"
					v-model="text"
					@input="onInput"
				/>
				<ControlPanel v-else>
					<label
						v-for="m in viewMotions"
						:key="m.id"
						class="mb-2 flex items-center gap-2 text-stone-400"
					>
						<span class="w-16 shrink-0 truncate">{{ m.id }}</span>
						<input
							class="min-w-0 flex-1 accent-amber-400"
							type="range"
							:min="motionSlider(m).min"
							:max="motionSlider(m).max"
							step="1"
							:value="motionSlider(m).value"
							@input="onMotion(m, $event)"
						/>
						<span class="w-16 shrink-0 text-right text-stone-200">{{
							motionReadout(m)
						}}</span>
					</label>
					<p v-if="!viewMotions.length" class="text-stone-500">
						no 3d motions
					</p>
				</ControlPanel>

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

		<nav
			v-if="mobile"
			class="flex gap-1 border-t border-stone-700 px-1.5 py-1 md:hidden print:hidden"
		>
			<ToolbarButton
				class="flex-1 text-center"
				:on="mobileTab === 'view'"
				@click="setMobileTab('view')"
				>view</ToolbarButton
			>
			<ToolbarButton
				class="flex-1 text-center"
				:on="mobileTab === 'code'"
				@click="setMobileTab('code')"
				>code</ToolbarButton
			>
			<ToolbarButton
				class="flex-1 text-center"
				:on="mobileTab === 'controls'"
				@click="setMobileTab('controls')"
				>controls</ToolbarButton
			>
		</nav>
	</div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import ToolbarButton from './ToolbarButton.vue';
import ExportButton, { type ExportFormat } from './ExportButton.vue';
import PaperSizeInput from './PaperSizeInput.vue';
import YamlEditor from './YamlEditor.vue';
import ControlPanel from './ControlPanel.vue';
import View3d from '../view3d/View3d.vue';
import { compile } from '../format/compile';
import { parseDocument } from '../format/parse';
import { paperPick, setLayoutPaper, type PaperPick } from '../format/paper';
import { toSvg, toPrintSvg } from '../format/toSvg';
import type { Motion, PieceGeom, Scene } from '../format/types';
import { assemblyMotions } from '../view3d/assemble';
import { foldPose, foldPoseT, motionTarget } from '../format/pose';
import {
	download,
	loadSidebarW,
	loadStored,
	saveSidebarW,
	saveStored,
	SIDEBAR_W_MIN,
} from '../persist';
import example from '../../examples/cardholder.tan?raw';

const text = ref(example);
const filename = ref('cardholder.tan');
const error = ref('');
const svg = ref('');
const printSvg = ref('');
const stitchNote = ref('');
const sidebarW = ref(loadSidebarW());
const panel = ref<'code' | 'controls'>('code');
const mobileTab = ref<'view' | 'code' | 'controls'>('view');
const mobile = ref(false);
const splitEl = ref<HTMLElement | null>(null);
const printSheetEl = ref<HTMLElement | null>(null);
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
const sideTab = computed<'code' | 'controls'>(() =>
	mobile.value && mobileTab.value !== 'view' ? mobileTab.value : panel.value,
);
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
	window.addEventListener('beforeprint', onBeforePrint);
});

onUnmounted(() => {
	mq?.removeEventListener('change', onMq);
	window.removeEventListener('beforeprint', onBeforePrint);
});

function onBeforePrint() {
	if (!lastScene.value) {
		printSvg.value = '';
		return;
	}
	printSvg.value = toPrintSvg(lastScene.value);
	// 1:1 scale with no browser header/footer: page matches paper, zero margin.
	const { w, h } = lastScene.value.paper;
	let el = document.getElementById('print-page-size');
	if (!el) {
		el = document.createElement('style');
		el.id = 'print-page-size';
		document.head.appendChild(el);
	}
	el.textContent = `@page { size: ${w}mm ${h}mm; margin: 0; }`;
	// Exact-size box so a fractional-pixel sliver can't spill onto page 2;
	// overflow is clipped instead (see .print-sheet CSS).
	const sheet = printSheetEl.value;
	if (sheet) {
		sheet.style.width = `${w}mm`;
		sheet.style.height = `${h}mm`;
	}
}

function onMq(e: MediaQueryListEvent) {
	mobile.value = e.matches;
}

function setPanel(p: 'code' | 'controls') {
	panel.value = p;
	if (mobile.value) mobileTab.value = p;
}

function setMobileTab(t: 'view' | 'code' | 'controls') {
	mobileTab.value = t;
	if (t !== 'view') panel.value = t;
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

function motionPrimary(m: Motion): { rest: number; motion: number } | null {
	const id = Object.keys(m.folds)[0];
	if (id == null) return null;
	return { rest: foldRest(id), motion: m.folds[id] };
}

function motionSlider(m: Motion): { min: number; max: number; value: number } {
	const p = motionPrimary(m);
	if (!p) return { min: 0, max: 1, value: 0 };
	const target = motionTarget(p.rest, p.motion);
	const t = motionT.value[m.id] ?? 0;
	const value = foldPose(p.rest, p.motion, t);
	const min = Math.min(p.rest, target);
	const max = Math.max(p.rest, target);
	if (min === max) return { min, max: min + 1, value };
	return { min, max, value };
}

function onMotion(m: Motion, ev: Event) {
	const p = motionPrimary(m);
	if (!p) return;
	const angle = Number((ev.target as HTMLInputElement).value);
	motionT.value = {
		...motionT.value,
		[m.id]: foldPoseT(p.rest, p.motion, angle),
	};
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
			return `${Math.round(foldPose(rest, target, t))}°`;
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
	const nPieces = new Set(scene.pieces.map((p) => p.id)).size;
	if (nPieces <= 1 && view.value === 'assembly') view.value = '3d';
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

function onExport(f: ExportFormat) {
	if (f === 'tan') onExportTan();
	else if (f === 'svg') onExportSvg();
	else if (f === 'pdf') void onExportPdf();
	else void onPrint();
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
