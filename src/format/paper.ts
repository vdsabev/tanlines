import type { Paper } from './types';

export const PAPERS: Record<string, Paper> = {
	A5: { w: 148, h: 210, name: 'A5' },
	A4: { w: 210, h: 297, name: 'A4' },
	A3: { w: 297, h: 420, name: 'A3' },
};

export function parsePaper(raw: unknown): Paper {
	if (typeof raw === 'string' && PAPERS[raw]) return { ...PAPERS[raw] };
	if (raw && typeof raw === 'object' && 'w' in raw && 'h' in raw) {
		const o = raw as { w: number; h: number };
		return { w: Number(o.w), h: Number(o.h) };
	}
	return { ...PAPERS.A4 };
}

export type PaperPick = 'A3' | 'A4' | 'A5' | 'custom';

export function paperPick(p: Paper): PaperPick {
	if (p.name && PAPERS[p.name]) return p.name as PaperPick;
	for (const [k, v] of Object.entries(PAPERS)) {
		if (v.w === p.w && v.h === p.h) return k as PaperPick;
	}
	return 'custom';
}

/** Replace `layout.paper` in source text, keeping the rest of the file. */
export function setLayoutPaper(
	text: string,
	pick: PaperPick,
	custom?: { w: number; h: number },
): string {
	const value =
		pick === 'custom'
			? `{ w: ${Math.round(custom?.w ?? 210)}, h: ${Math.round(custom?.h ?? 297)} }`
			: pick;
	const inline = /^([ \t]*paper:\s*)(?:A[345]|\{[^}]*\})(.*)$/m;
	if (inline.test(text)) return text.replace(inline, `$1${value}$2`);
	const block = /^([ \t]*paper:\s*)\n(?:[ \t]+\S.*\n?)*/m;
	if (block.test(text)) return text.replace(block, `$1${value}\n`);
	if (/^layout:\s*$/m.test(text))
		return text.replace(/^(layout:\s*)$/m, `$1\n  paper: ${value}`);
	return `${text.replace(/\s*$/, '')}\nlayout:\n  paper: ${value}\n`;
}
