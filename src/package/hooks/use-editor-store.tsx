import { Accessor, createContext, useContext } from "solid-js";
import { Editor } from "slate";
import { SolidEditor } from "../plugin/solid-editor";
import { SetStoreFunction } from "solid-js/store";

/**
 * A SolidJS context for sharing the editor object, in a way that re-renders the
 * context whenever changes occur.
 */

export type EditorStoreContextValue = SolidEditor;

export const EditorStoreContext = createContext<(() => EditorStoreContextValue) | null>(null);

/**
 * Get the current editor object from the React context.
 */

export type useEditorStoreResponse = SolidEditor;

// Beware
export const useEditorStore = (): useEditorStoreResponse => {
	const editor = useContext(EditorStoreContext);

	if (!editor) {
		throw new Error(`The \`useSlate\` hook must be used inside the <Slate> component's context.`);
	}

	return editor();
};

