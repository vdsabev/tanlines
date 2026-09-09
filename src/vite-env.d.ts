/// <reference types="vite/client" />

declare module '*.vue' {
	import type { DefineComponent } from 'vue';
	const component: DefineComponent<object, object, unknown>;
	export default component;
}

declare module '*.tan?raw' {
	const text: string;
	export default text;
}

declare module 'prismjs/components/prism-core' {
	import Prism from 'prismjs';
	export default Prism;
}

declare module 'prismjs/components/prism-yaml';
