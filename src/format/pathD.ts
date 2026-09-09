import type { PathCmd } from './types';

export function pathToD(cmds: PathCmd[]): string {
	return cmds
		.map((c) => {
			if (c.op === 'M' || c.op === 'L') return `${c.op}${c.x} ${c.y}`;
			if (c.op === 'C') return `C${c.x1} ${c.y1} ${c.x2} ${c.y2} ${c.x} ${c.y}`;
			if (c.op === 'Q') return `Q${c.x1} ${c.y1} ${c.x} ${c.y}`;
			if (c.op === 'A')
				return `A${c.rx} ${c.ry} ${c.rot} ${c.large} ${c.sweep} ${c.x} ${c.y}`;
			return 'Z';
		})
		.join(' ');
}

export function parseD(d: string): PathCmd[] {
	const tokens = d.match(/[MmLlCcQqAaZz]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) ?? [];
	const cmds: PathCmd[] = [];
	let i = 0;
	let op = 'M';
	let cx = 0;
	let cy = 0;
	const num = () => Number(tokens[i++]);
	while (i < tokens.length) {
		const t = tokens[i];
		if (/^[MmLlCcQqAaZz]$/.test(t)) {
			op = t;
			i++;
			if (op === 'Z' || op === 'z') {
				cmds.push({ op: 'Z' });
				continue;
			}
		}
		if (op === 'M' || op === 'm') {
			const rel = op === 'm';
			const x = num() + (rel ? cx : 0);
			const y = num() + (rel ? cy : 0);
			cmds.push({ op: 'M', x, y });
			cx = x;
			cy = y;
			op = rel ? 'l' : 'L';
		} else if (op === 'L' || op === 'l') {
			const rel = op === 'l';
			const x = num() + (rel ? cx : 0);
			const y = num() + (rel ? cy : 0);
			cmds.push({ op: 'L', x, y });
			cx = x;
			cy = y;
		} else if (op === 'C' || op === 'c') {
			const rel = op === 'c';
			const x1 = num() + (rel ? cx : 0);
			const y1 = num() + (rel ? cy : 0);
			const x2 = num() + (rel ? cx : 0);
			const y2 = num() + (rel ? cy : 0);
			const x = num() + (rel ? cx : 0);
			const y = num() + (rel ? cy : 0);
			cmds.push({ op: 'C', x1, y1, x2, y2, x, y });
			cx = x;
			cy = y;
		} else if (op === 'Q' || op === 'q') {
			const rel = op === 'q';
			const x1 = num() + (rel ? cx : 0);
			const y1 = num() + (rel ? cy : 0);
			const x = num() + (rel ? cx : 0);
			const y = num() + (rel ? cy : 0);
			cmds.push({ op: 'Q', x1, y1, x, y });
			cx = x;
			cy = y;
		} else if (op === 'A' || op === 'a') {
			const rx = num();
			const ry = num();
			const rot = num();
			const large = num() as 0 | 1;
			const sweep = num() as 0 | 1;
			const rel = op === 'a';
			const x = num() + (rel ? cx : 0);
			const y = num() + (rel ? cy : 0);
			cmds.push({ op: 'A', rx, ry, rot, large, sweep, x, y });
			cx = x;
			cy = y;
		} else {
			i++;
		}
	}
	return cmds;
}

export function ptsToPath(
	pts: Array<[number, number] & { r?: number; chamfer?: number }>,
): PathCmd[] {
	if (pts.length === 0) return [];
	const cmds: PathCmd[] = [{ op: 'M', x: pts[0][0], y: pts[0][1] }];
	for (let i = 1; i < pts.length; i++) {
		const p = pts[i];
		const prev = pts[i - 1];
		const next = pts[(i + 1) % pts.length];
		const r = p.r ?? 0;
		const ch = p.chamfer ?? 0;
		if (r <= 0 && ch <= 0) {
			cmds.push({ op: 'L', x: p[0], y: p[1] });
			continue;
		}
		const v1x = p[0] - prev[0];
		const v1y = p[1] - prev[1];
		const v2x = next[0] - p[0];
		const v2y = next[1] - p[1];
		const l1 = Math.hypot(v1x, v1y) || 1;
		const l2 = Math.hypot(v2x, v2y) || 1;
		const turn = Math.atan2(v1x * v2y - v1y * v2x, v1x * v2x + v1y * v2y);
		const cut = r > 0 ? r * Math.tan(Math.abs(turn) / 2) : ch;
		const d1 = Math.min(cut, l1 / 2);
		const d2 = Math.min(cut, l2 / 2);
		const ax = p[0] - (v1x / l1) * d1;
		const ay = p[1] - (v1y / l1) * d1;
		const bx = p[0] + (v2x / l2) * d2;
		const by = p[1] + (v2y / l2) * d2;
		cmds.push({ op: 'L', x: ax, y: ay });
		if (r > 0)
			cmds.push({
				op: 'A',
				rx: r,
				ry: r,
				rot: 0,
				large: 0,
				sweep: 1,
				x: bx,
				y: by,
			});
		else cmds.push({ op: 'L', x: bx, y: by });
	}
	cmds.push({ op: 'Z' });
	return cmds;
}
