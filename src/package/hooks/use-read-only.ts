import { createContext, useContext } from "solid-js";

/**
 * A React context for sharing the `readOnly` state of the editor.
 */

export const ReadOnlyContext = createContext<() => boolean>(() => false);

/**
 * Get the current `readOnly` state of the editor.
 */

export const useReadOnly = (): (() => boolean) => {
	return useContext(ReadOnlyContext);
};

