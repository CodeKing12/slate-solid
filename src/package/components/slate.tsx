import { JSX, createEffect, createSignal, splitProps } from "solid-js";
import { Descendant, Editor, Node, Operation, Scrubber, Selection } from "slate";
import { FocusedContext } from "../hooks/use-focused";
import { useIsomorphicLayoutEffect } from "../hooks/use-isomorphic-layout-effect";
import { SlateContext, SlateContextValue } from "../hooks/use-slate";
import { useSelectorContext, SlateSelectorContext } from "../hooks/use-slate-selector";
import { EditorContext } from "../hooks/use-slate-static";
import { SolidEditor } from "../plugin/solid-editor";
import { EDITOR_TO_ON_CHANGE } from "../utils/weak-maps";

/**
 * A wrapper around the provider to handle `onChange` events, because the editor
 * is a mutable singleton so it won't ever register as "changed" otherwise.
 */

export const Slate = (props: {
	editor: SolidEditor;
	initialValue: Descendant[];
	children: JSX.Element;
	onChange?: (value: Descendant[]) => void;
	onSelectionChange?: (selection: Selection) => void;
	onValueChange?: (value: Descendant[]) => void;
}) => {
	const [split, rest] = splitProps(props, [
		"editor",
		"children",
		"onChange",
		"onSelectionChange",
		"onValueChange",
		"initialValue",
	]);

	// Beware createSignal<SlateContextValue>(() => {})
	function getInitialContextValue() {
		if (!Node.isNodeList(split.initialValue)) {
			throw new Error(
				`[Slate] initialValue is invalid! Expected a list of elements but got: ${Scrubber.stringify(
					split.initialValue
				)}`
			);
		}
		if (!Editor.isEditor(split.editor)) {
			throw new Error(`[Slate] editor is invalid! You passed: ${Scrubber.stringify(split.editor)}`);
		}
		split.editor.children = split.initialValue;
		Object.assign(split.editor, rest);
		return { v: 0, editor: () => split.editor } as SlateContextValue;
	}
	const [context, setContext] = createSignal<SlateContextValue>(getInitialContextValue());

	const selectorData = () => useSelectorContext(split.editor);

	const onContextChange = (options?: { operation?: Operation }) => {
		if (split.onChange) {
			split.onChange(split.editor.children);
		}

		switch (options?.operation?.type) {
			case "set_selection":
				split.onSelectionChange?.(split.editor.selection);
				break;
			default:
				split.onValueChange?.(split.editor.children);
		}

		setContext((prevContext) => ({
			v: prevContext.v + 1,
			editor: () => split.editor,
		}));
		selectorData()().onChange(split.editor);
	};

	createEffect(() => {
		EDITOR_TO_ON_CHANGE.set(split.editor, onContextChange);

		return () => {
			EDITOR_TO_ON_CHANGE.set(split.editor, () => {});
		};
	});

	const [isFocused, setIsFocused] = createSignal(SolidEditor.isFocused(split.editor));

	// createEffect(() => {
	// 	setIsFocused(SolidEditor.isFocused(split.editor));
	// });

	useIsomorphicLayoutEffect(() => {
		const fn = () => setIsFocused(SolidEditor.isFocused(split.editor));
		// if (REACT_MAJOR_VERSION >= 17) {
		// In React >= 17 onFocus and onBlur listen to the focusin and focusout events during the bubbling phase.
		// Therefore in order for <Editable />'s handlers to run first, which is necessary for ReactEditor.isFocused(editor)
		// to return the correct value, we have to listen to the focusin and focusout events without useCapture here.
		// Beware eventListeners
		document.addEventListener("focusin", fn);
		document.addEventListener("focusout", fn);
		return () => {
			document.removeEventListener("focusin", fn);
			document.removeEventListener("focusout", fn);
		};
		// } else {
		// 	document.addEventListener("focus", fn, true);
		// 	document.addEventListener("blur", fn, true);
		// 	return () => {
		// 		document.removeEventListener("focus", fn, true);
		// 		document.removeEventListener("blur", fn, true);
		// 	};
		// }
	}, []);

	const getSelectorContext = () => selectorData()().selectorContext();

	return (
		<SlateSelectorContext.Provider value={getSelectorContext}>
			<SlateContext.Provider value={context}>
				<EditorContext.Provider value={context}>
					<FocusedContext.Provider value={isFocused}>{split.children}</FocusedContext.Provider>
				</EditorContext.Provider>
			</SlateContext.Provider>
		</SlateSelectorContext.Provider>
	);
};

