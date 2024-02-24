import { onMount } from "solid-js";

export function useIsMounted() {
	let isMountedRef = false;

	onMount(() => {
		isMountedRef = true;
		return () => {
			isMountedRef = false;
		};
	});

	return isMountedRef;
}

