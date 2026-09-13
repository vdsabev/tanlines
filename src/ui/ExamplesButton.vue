<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';

defineProps<{ filename: string; examples: string[] }>();

const emit = defineEmits<{
	pick: [string];
}>();

const open = ref(false);

function onPick(name: string) {
	open.value = false;
	emit('pick', name);
}

function onKey(e: KeyboardEvent) {
	if (e.key === 'Escape') open.value = false;
}

onMounted(() => window.addEventListener('keydown', onKey));
onUnmounted(() => window.removeEventListener('keydown', onKey));
</script>

<template>
	<span class="relative inline-flex min-w-0 max-w-[30vw] shrink-0">
		<button
			type="button"
			class="min-w-0 flex-1 truncate border border-stone-600 bg-stone-900 px-2 py-1 text-left whitespace-nowrap text-stone-400 hover:bg-stone-800 active:bg-stone-700"
			aria-haspopup="menu"
			:aria-expanded="open"
			:title="filename"
			@click="open = !open"
		>
			{{ filename }} ▾
		</button>
		<span v-if="open" class="fixed inset-0 z-10" @click="open = false" />
		<span
			v-if="open"
			role="menu"
			class="absolute top-full left-0 z-20 mt-1 min-w-full border border-stone-600 bg-stone-900 py-0.5"
		>
			<button
				v-for="name in examples"
				:key="name"
				type="button"
				role="menuitem"
				class="block w-full px-2 py-1 text-left whitespace-nowrap text-stone-200 hover:bg-stone-800 active:bg-stone-700"
				@click="onPick(name)"
			>
				{{ name }}
			</button>
		</span>
	</span>
</template>
