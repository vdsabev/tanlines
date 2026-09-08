const KEY = 'tanlines:doc';
const NAME_KEY = 'tanlines:filename';
const SIDEBAR_W_KEY = 'tanlines:sidebar-w';
const SIDEBAR_OPEN_KEY = 'tanlines:sidebar-open';

export const SIDEBAR_W_MIN = 160;
export const SIDEBAR_W_DEFAULT = 360;

export function loadStored(): { text: string; filename: string } | null {
	try {
		const text = localStorage.getItem(KEY);
		if (!text) return null;
		return { text, filename: localStorage.getItem(NAME_KEY) ?? 'pattern.tan' };
	} catch {
		return null;
	}
}

export function saveStored(text: string, filename: string) {
	try {
		localStorage.setItem(KEY, text);
		localStorage.setItem(NAME_KEY, filename);
	} catch {
		/* quota */
	}
}

export function loadSidebarW(): number {
	try {
		const n = Number(localStorage.getItem(SIDEBAR_W_KEY));
		if (Number.isFinite(n) && n >= SIDEBAR_W_MIN) return n;
	} catch {
		/* */
	}
	return SIDEBAR_W_DEFAULT;
}

export function saveSidebarW(w: number) {
	try {
		localStorage.setItem(SIDEBAR_W_KEY, String(Math.round(w)));
	} catch {
		/* quota */
	}
}

export function loadSidebarOpen(): boolean {
	try {
		const v = localStorage.getItem(SIDEBAR_OPEN_KEY);
		if (v === '0') return false;
		if (v === '1') return true;
	} catch {
		/* */
	}
	return true;
}

export function saveSidebarOpen(open: boolean) {
	try {
		localStorage.setItem(SIDEBAR_OPEN_KEY, open ? '1' : '0');
	} catch {
		/* quota */
	}
}

export function download(filename: string, data: BlobPart, type: string) {
	const blob = new Blob([data], { type });
	const a = document.createElement('a');
	a.href = URL.createObjectURL(blob);
	a.download = filename;
	a.click();
	URL.revokeObjectURL(a.href);
}
