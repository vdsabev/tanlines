<script setup lang="ts">
withDefaults(
	defineProps<{
		as?: 'button' | 'label';
		on?: boolean;
	}>(),
	{ as: 'button' },
);
</script>

<template>
	<component
		:is="as"
		:type="as === 'button' ? 'button' : undefined"
		:class="
			on
				? 'border border-amber-400 bg-stone-800 px-2 py-1 whitespace-nowrap'
				: 'border border-stone-600 bg-stone-900 px-2 py-1 whitespace-nowrap hover:bg-stone-800 active:bg-stone-700'
		"
	>
		<slot />
	</component>
</template>
