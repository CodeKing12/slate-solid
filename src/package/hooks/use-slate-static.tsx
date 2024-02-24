import { Accessor, createContext, useContext } from "solid-js";
import { Editor } from "slate";
import { SolidEditor } from "../plugin/solid-editor";
import { SlateContextValue } from "./use-slate";

/**
 * A React context for sharing the editor object.
 */

export const EditorContext = createContext<Accessor<SlateContextValue> | null>(null);

/**
 * Get the current editor object from the Solid context.
 */

export const useSlateStatic = (): Editor => {
	const context = useContext(EditorContext);

	if (!context) {
		throw new Error(`The \`useSlateStatic\` hook must be used inside the <Slate> component's context.`);
	}

	return context().editor();
};

