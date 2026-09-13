import tailwindcss from '@tailwindcss/vite';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

export default defineConfig({
	base: '/tanlines/',
	plugins: [vue(), tailwindcss()],
	server: {
		host: '0.0.0.0',
		port: 3000,
		allowedHosts: true,
	},
});
