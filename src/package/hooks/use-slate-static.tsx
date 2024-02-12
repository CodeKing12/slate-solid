import { createContext, useContext } from "solid-js";
import { Editor } from "slate";
import { SolidEditor } from "../plugin/solid-editor";

/**
 * A React context for sharing the editor object.
 */

export const EditorContext = createContext<SolidEditor | null>(null);

/**
 * Get the current editor object from the Solid context.
 */

export const useSlateStatic = (): Editor => {
	const editor = useContext(EditorContext);

	if (!editor) {
		throw new Error(`The \`useSlateStatic\` hook must be used inside the <Slate> component's context.`);
	}

	return editor;
};

