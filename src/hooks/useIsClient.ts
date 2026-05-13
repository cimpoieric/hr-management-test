"use client";

import { useEffect, useState } from "react";

/**
 * `false` during SSR and the first client render; `true` after mount.
 * Use to defer client-only UI (e.g. values from `Date.now()` / `localStorage`).
 */
export function useIsClient(): boolean {
	const [isClient, setIsClient] = useState(false);
	useEffect(() => {
		setIsClient(true);
	}, []);
	return isClient;
}
