<script setup lang="ts">
import { computed, ref } from 'vue';
import Prism from 'prismjs/components/prism-core';
import 'prismjs/components/prism-yaml';

const props = defineProps<{
	modelValue: string;
}>();

const emit = defineEmits<{
	'update:modelValue': [string];
	input: [];
}>();

const pre = ref<HTMLPreElement | null>(null);

const highlighted = computed(() => {
	const src = props.modelValue + (props.modelValue.endsWith('\n') ? ' ' : '');
	return Prism.highlight(src, Prism.languages.yaml, 'yaml');
});

function onInput(e: Event) {
	emit('update:modelValue', (e.target as HTMLTextAreaElement).value);
	emit('input');
}

function onScroll(e: Event) {
	const el = e.target as HTMLTextAreaElement;
	const p = pre.value;
	if (!p) return;
	p.scrollLeft = el.scrollLeft;
	p.scrollTop = el.scrollTop;
}
</script>

<template>
	<div
		class="relative min-h-0 flex-1 overflow-hidden border-l border-stone-700 bg-stone-900"
	>
		<pre
			ref="pre"
			class="pointer-events-none absolute inset-0 m-0 overflow-hidden whitespace-pre font-mono text-[13px] leading-normal text-stone-200"
			aria-hidden="true"
		><code class="language-yaml block min-w-full px-3 py-2 font-mono text-[13px] leading-normal whitespace-pre" v-html="highlighted" /></pre>
		<textarea
			class="absolute inset-0 resize-none overflow-auto whitespace-pre bg-transparent px-3 py-2 font-mono text-[13px] leading-normal text-transparent caret-amber-400 outline-none selection:bg-white/20 scrollbar-track-stone-900 scrollbar-thumb-stone-700"
			spellcheck="false"
			wrap="off"
			:value="modelValue"
			@input="onInput"
			@scroll="onScroll"
		/>
	</div>
</template>
