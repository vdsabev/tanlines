/** CSS 1–4 value expansion: TL TR BR BL. */
export function expand4(
	v: number | number[] | undefined,
): [number, number, number, number] {
	if (v == null) return [0, 0, 0, 0];
	if (typeof v === 'number') return [v, v, v, v];
	if (v.length === 0) return [0, 0, 0, 0];
	if (v.length === 1) return [v[0], v[0], v[0], v[0]];
	if (v.length === 2) return [v[0], v[1], v[0], v[1]];
	if (v.length === 3) return [v[0], v[1], v[2], v[1]];
	return [v[0], v[1], v[2], v[3]];
}

/** Clamp adjacent corner sizes so they do not overlap on an edge. */
export function clampCorners(
	w: number,
	h: number,
	c: [number, number, number, number],
): [number, number, number, number] {
	const [tl, tr, br, bl] = c.map((n) => Math.max(0, n)) as [
		number,
		number,
		number,
		number,
	];
	const scale = (a: number, b: number, max: number) => {
		const s = a + b;
		if (s <= max || s === 0) return 1;
		return max / s;
	};
	const sxTop = scale(tl, tr, w);
	const sxBot = scale(bl, br, w);
	const syLeft = scale(tl, bl, h);
	const syRight = scale(tr, br, h);
	return [
		tl * Math.min(sxTop, syLeft),
		tr * Math.min(sxTop, syRight),
		br * Math.min(sxBot, syRight),
		bl * Math.min(sxBot, syLeft),
	];
}
