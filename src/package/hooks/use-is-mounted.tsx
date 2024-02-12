import { createEffect } from "solid-js";

export function useIsMounted() {
	let isMountedRef = false;

	createEffect(() => {
		isMountedRef = true;
		return () => {
			isMountedRef = false;
		};
	}, []);

	return isMountedRef;
}

