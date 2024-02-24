import { createEffect, createSignal, on } from "solid-js";
import { useIsomorphicLayoutEffect } from "./use-isomorphic-layout-effect";

export function useMutationObserver(
	node: HTMLElement | null,
	callback: MutationCallback,
	options: MutationObserverInit
) {
	const [mutationObserver] = createSignal(new MutationObserver(callback));

	useIsomorphicLayoutEffect(() => {
		// Discard mutations caused during render phase. This works due to react calling
		// useLayoutEffect synchronously after the render phase before the next tick.
		mutationObserver().takeRecords();
	});

	createEffect(
		on([mutationObserver, () => node, () => options], () => {
			if (!node) {
				throw new Error("Failed to attach MutationObserver, `node` is undefined");
			}

			mutationObserver().observe(node, options);
			return () => mutationObserver().disconnect();
		})
	);
}

