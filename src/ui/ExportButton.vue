<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';

export type ExportFormat = 'tan' | 'svg' | 'pdf' | 'print';

const emit = defineEmits<{
	export: [ExportFormat];
}>();

const formats: ExportFormat[] = ['tan', 'svg', 'pdf', 'print'];
const open = ref(false);

function onPick(f: ExportFormat) {
	open.value = false;
	emit('export', f);
}

function onKey(e: KeyboardEvent) {
	if (e.key === 'Escape') open.value = false;
}

onMounted(() => window.addEventListener('keydown', onKey));
onUnmounted(() => window.removeEventListener('keydown', onKey));
</script>

<template>
	<span class="relative inline-flex shrink-0">
		<button
			type="button"
			class="border border-stone-600 bg-stone-900 px-2 py-1 whitespace-nowrap hover:bg-stone-800 active:bg-stone-700"
			aria-haspopup="menu"
			:aria-expanded="open"
			@click="open = !open"
		>
			export ▾
		</button>
		<span v-if="open" class="fixed inset-0 z-10" @click="open = false" />
		<span
			v-if="open"
			role="menu"
			class="absolute top-full right-0 z-20 mt-1 min-w-full border border-stone-600 bg-stone-900 py-0.5"
		>
			<button
				v-for="f in formats"
				:key="f"
				type="button"
				role="menuitem"
				class="block w-full px-2 py-1 text-left whitespace-nowrap text-stone-200 hover:bg-stone-800 active:bg-stone-700"
				@click="onPick(f)"
			>
				{{ f }}
			</button>
		</span>
	</span>
</template>
