import { pathToD } from './pathD';
import { stitchPairs } from './thread';
import type { Hardware, Scene } from './types';

function svgOpen(w: number, h: number): string {
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}mm" height="${h}mm" viewBox="0 0 ${w} ${h}">`;
}

export function toPrintSvg(scene: Scene): string {
	const { w, h } = scene.paper;
	const parts: string[] = [svgOpen(w, h), calibBar(scene.margin)];
	for (const p of scene.pieces) {
		const { x, y, rotate } = p.place;
		parts.push(`<g transform="translate(${x} ${y}) rotate(${rotate})">`);
		const d = pathToD(p.outline) + p.holes.map((h) => ' ' + pathToD(h)).join('');
		parts.push(
			`<path d="${d}" fill="none" stroke="#111" stroke-width="0.3"/>`,
		);
		for (const s of p.stitchHoles) {
			parts.push(
				`<circle cx="${s.x}" cy="${s.y}" r="${s.d / 2}" fill="none" stroke="#111" stroke-width="0.2"/>`,
			);
		}
		parts.push('</g>');
	}
	parts.push('</svg>');
	return parts.join('');
}

export function toSvg(scene: Scene, selectedId?: string | null): string {
	const { w, h } = scene.paper;
	const parts: string[] = [
		svgOpen(w, h),
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
		for (const run of p.stitchRuns) {
			const pairs = stitchPairs(run.pts.length, run.closed, run.style);
			const segs = new Set(
				[...pairs.front, ...pairs.back].map(([i, j]) => `${i}-${j}`),
			);
			let d = '';
			for (const key of segs) {
				const [i, j] = key.split('-').map(Number);
				const a = run.pts[i];
				const b = run.pts[j];
				d += `M${a.x} ${a.y} L${b.x} ${b.y} `;
			}
			if (d)
				parts.push(
					`<path d="${d}" fill="none" stroke="${p.stitchColor}" stroke-width="0.35" stroke-linecap="round"/>`,
				);
		}
		for (const s of p.stitchHoles) {
			parts.push(
				`<circle cx="${s.x}" cy="${s.y}" r="${s.d / 2}" fill="none" stroke="#111" stroke-width="0.2"/>`,
			);
		}
		for (const h of p.hardware) parts.push(hardwareSvg(h));
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

function hardwareSvg(h: Hardware): string {
	const [x, y] = h.at;
	const r = h.size / 2;
	if (h.type === 'rivet') {
		return `<circle cx="${x}" cy="${y}" r="${r}" fill="#8a8680" stroke="#3f3c38" stroke-width="0.25"/>`;
	}
	if (h.type === 'button') {
		return `<g>
			<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="#3f3c38" stroke-width="0.35"/>
			<circle cx="${x}" cy="${y}" r="${r * 0.35}" fill="#3f3c38"/>
		</g>`;
	}
	if (h.type === 'stamp') {
		return `<rect x="${x - r}" y="${y - r}" width="${h.size}" height="${h.size}" fill="none" stroke="#5c5348" stroke-width="0.3" stroke-dasharray="1 0.6"/>`;
	}
	return `<g>
		<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="#6b7280" stroke-width="0.45"/>
		<circle cx="${x}" cy="${y}" r="${r * 0.45}" fill="none" stroke="#6b7280" stroke-width="0.3"/>
	</g>`;
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
