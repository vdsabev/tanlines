import { pathToD } from './pathD';
import type { Scene } from './types';

export function toSvg(scene: Scene, selectedId?: string | null): string {
	const { w, h } = scene.paper;
	const parts: string[] = [
		`<svg xmlns="http://www.w3.org/2000/svg" width="${w}mm" height="${h}mm" viewBox="0 0 ${w} ${h}">`,
		`<rect x="0" y="0" width="${w}" height="${h}" fill="#f4efe6" stroke="#222" stroke-width="0.2"/>`,
		grid(w, h),
		axes(),
		calibBar(scene.margin),
	];
	for (const p of scene.pieces) {
		const { x, y, rotate } = p.place;
		const hi = p.id === selectedId;
		parts.push(
			`<g transform="translate(${x} ${y}) rotate(${rotate})" data-piece="${esc(p.id)}">`,
		);
		const d =
			pathToD(p.outline) + p.holes.map((h) => ' ' + pathToD(h)).join('');
		parts.push(
			`<path d="${d}" fill="${p.color}" fill-rule="evenodd" fill-opacity="0.85" stroke="${hi ? '#111' : '#2a1c12'}" stroke-width="${hi ? 0.6 : 0.35}"/>`,
		);
		for (const s of p.stitchHoles) {
			parts.push(
				`<circle cx="${s.x}" cy="${s.y}" r="${s.d / 2}" fill="none" stroke="#111" stroke-width="0.2"/>`,
			);
		}
		for (const f of p.folds) {
			parts.push(
				`<line x1="${f.from[0]}" y1="${f.from[1]}" x2="${f.to[0]}" y2="${f.to[1]}" stroke="#a33" stroke-width="0.25" stroke-dasharray="1.4 1"/>`,
			);
		}
		parts.push(`</g>`);
	}
	parts.push('</svg>');
	return parts.join('');
}

function grid(w: number, h: number): string {
	let d = '';
	for (let x = 0; x <= w; x += 10) d += `M${x} 0 V${h} `;
	for (let y = 0; y <= h; y += 10) d += `M0 ${y} H${w} `;
	return `<path d="${d}" fill="none" stroke="#c9c0b0" stroke-width="0.1"/>`;
}

function axes(): string {
	return `<path d="M0 0 H30 M0 0 V30" fill="none" stroke="#a33" stroke-width="0.3"/>
    <text x="32" y="4" font-size="3" fill="#a33">X</text>
    <text x="2" y="34" font-size="3" fill="#a33">Y</text>`;
}

function calibBar(margin: number): string {
	const x = margin;
	const y = 4;
	return `<g>
    <path d="M${x} ${y} H${x + 50}" stroke="#111" stroke-width="0.4"/>
    <path d="M${x} ${y - 1.5} V${y + 1.5} M${x + 50} ${y - 1.5} V${y + 1.5}" stroke="#111" stroke-width="0.4"/>
    <text x="${x + 25}" y="${y + 4}" font-size="3" text-anchor="middle" fill="#111">50 mm</text>
  </g>`;
}

function esc(s: string) {
	return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}
