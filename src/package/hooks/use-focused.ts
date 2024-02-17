import { Accessor, createContext, useContext } from "solid-js";

/**
 * A React context for sharing the `focused` state of the editor.
 */

export const FocusedContext = createContext<Accessor<boolean>>(() => false);

/**
 * Get the current `focused` state of the editor.
 */

export const useFocused = (): (() => boolean) => {
	return useContext(FocusedContext);
};

