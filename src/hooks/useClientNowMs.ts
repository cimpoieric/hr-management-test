"use client";

import { useEffect, useState } from "react";

/**
 * null during SSR and the first client paint; set to Date.now() after mount.
 * Use for durations / "now" that must match server HTML on hydration.
 */
export function useClientNowMs(): number | null {
	const [ms, setMs] = useState<number | null>(null);
	useEffect(() => {
		setMs(Date.now());
	}, []);
	return ms;
}
