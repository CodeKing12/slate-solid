import { createContext, useContext, createMemo } from "solid-js";
import { createReducer } from "@solid-primitives/memo";
import { Editor } from "slate";
import { useIsomorphicLayoutEffect } from "./use-isomorphic-layout-effect";

function isError(error: any): error is Error {
	return error instanceof Error;
}

type EditorChangeHandler = (editor: Editor) => void;
/**
 * A React context for sharing the editor selector context in a way to control rerenders
 */

export const SlateSelectorContext = createContext<{
	getSlate: () => Editor;
	addEventListener: (callback: EditorChangeHandler) => () => void;
}>({} as any);

const refEquality = (a: any, b: any) => a === b;

/**
 * use redux style selectors to prevent rerendering on every keystroke.
 * Bear in mind rerendering can only prevented if the returned value is a value type or for reference types (e.g. objects and arrays) add a custom equality function.
 *
 * Example:
 * ```
 *  const isSelectionActive = useSlateSelector(editor => Boolean(editor.selection));
 * ```
 */
export function useSlateSelector<T>(
	selector: (editor: Editor) => T,
	equalityFn: (a: T, b: T) => boolean = refEquality
) {
	const [, forceRender] = createReducer((s) => s + 1, 0);
	const context = useContext(SlateSelectorContext);
	if (!context) {
		throw new Error(`The \`useSlateSelector\` hook must be used inside the <Slate> component's context.`);
	}
	const { getSlate, addEventListener } = context;

	let latestSubscriptionCallbackError: Error | undefined;
	let latestSelector: (editor: Editor) => T = () => null as any;
	let latestSelectedState: T = null as any as T;
	let selectedState: T;

	try {
		if (selector !== latestSelector || latestSubscriptionCallbackError) {
			selectedState = selector(getSlate());
		} else {
			selectedState = latestSelectedState;
		}
	} catch (err) {
		if (latestSubscriptionCallbackError && isError(err)) {
			err.message += `\nThe error may be correlated with this previous error:\n${latestSubscriptionCallbackError.stack}\n\n`;
		}

		throw err;
	}
	useIsomorphicLayoutEffect(() => {
		latestSelector = selector;
		latestSelectedState = selectedState;
		latestSubscriptionCallbackError = undefined;
	});

	useIsomorphicLayoutEffect(
		() => {
			function checkForUpdates() {
				try {
					const newSelectedState = latestSelector(getSlate());

					if (equalityFn(newSelectedState, latestSelectedState)) {
						return;
					}

					latestSelectedState = newSelectedState;
				} catch (err) {
					// we ignore all errors here, since when the component
					// is re-rendered, the selectors are called again, and
					// will throw again, if neither props nor store state
					// changed
					if (err instanceof Error) {
						latestSubscriptionCallbackError = err;
					} else {
						latestSubscriptionCallbackError = new Error(String(err));
					}
				}

				forceRender();
			}

			const unsubscribe = addEventListener(checkForUpdates);

			checkForUpdates();

			return () => unsubscribe();
		},
		// don't rerender on equalityFn change since we want to be able to define it inline
		[addEventListener, getSlate]
	);

	return selectedState;
}

/**
 * Create selector context with editor updating on every editor change
 */
export function useSelectorContext(editor: Editor) {
	const eventListeners: EditorChangeHandler[] = [];
	const slateRef: {
		editor: Editor;
	} = {
		editor,
	};
	const onChange = (editor: Editor) => {
		slateRef.editor = editor;
		eventListeners.forEach((listener: EditorChangeHandler) => listener(editor));
	};

	const selectorContext = createMemo(() => {
		return {
			getSlate: () => slateRef.editor,
			addEventListener: (callback: EditorChangeHandler) => {
				eventListeners.push(callback);
				return () => {
					eventListeners.splice(eventListeners.indexOf(callback), 1);
				};
			},
		};
	}, [eventListeners, slateRef]);
	return { selectorContext, onChange };
}

