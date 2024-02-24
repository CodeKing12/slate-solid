import {
	createSignal,
	createEffect,
	JSX,
	mergeProps,
	createRenderEffect,
	on,
	onCleanup,
	Switch,
	Match,
	Show,
} from "solid-js";
import { Element, Text } from "slate";
import { ResizeObserver as ResizeObserverPolyfill } from "@juggle/resize-observer";
import String from "./string";
import { PLACEHOLDER_SYMBOL, EDITOR_TO_PLACEHOLDER_ELEMENT } from "../utils/weak-maps";
import { RenderLeafProps, RenderPlaceholderProps } from "./editable";
import { useSlateStatic } from "../hooks/use-slate-static";
import { IS_WEBKIT, IS_ANDROID } from "../utils/environment";
import { unwrap } from "solid-js/store";

// Delay the placeholder on Android to prevent the keyboard from closing.
// (https://github.com/ianstormtaylor/slate/pull/5368)
const PLACEHOLDER_DELAY = IS_ANDROID ? 300 : 0;

function disconnectPlaceholderResizeObserver(
	placeholderResizeObserver: ResizeObserver | null,
	releaseObserver: boolean
) {
	if (placeholderResizeObserver) {
		placeholderResizeObserver.disconnect();
		if (releaseObserver) {
			placeholderResizeObserver = null;
		}
	}
}

type TimerId = ReturnType<typeof setTimeout> | null;

function clearTimeoutRef(timeoutRef: TimerId) {
	if (timeoutRef) {
		clearTimeout(timeoutRef);
		timeoutRef = null;
	}
}

/**
 * Individual leaves in a text node with unique formatting.
 */
export interface LeafProps {
	isLast: boolean;
	leaf: Text;
	parent: Element;
	renderPlaceholder: (props: RenderPlaceholderProps) => JSX.Element;
	renderLeaf?: (props: RenderLeafProps) => JSX.Element;
	text: Text;
}

const Leaf = (props: LeafProps) => {
	const merge = mergeProps(
		{
			renderLeaf: (props: RenderLeafProps) => <DefaultLeaf {...props} />,
		},
		props
	);

	const editor = useSlateStatic();
	let placeholderResizeObserver: ResizeObserver | null = null;
	let placeholderRef: HTMLElement | null = null;
	const [showPlaceholder, setShowPlaceholder] = createSignal(false);
	let showPlaceholderTimeoutRef: TimerId = null;

	const callbackPlaceholderRef = (placeholderEl: HTMLElement | null) => {
		disconnectPlaceholderResizeObserver(placeholderResizeObserver, placeholderEl == null);

		if (placeholderEl == null) {
			EDITOR_TO_PLACEHOLDER_ELEMENT.delete(editor);
			merge.leaf.onPlaceholderResize?.(null);
		} else {
			EDITOR_TO_PLACEHOLDER_ELEMENT.set(editor, placeholderEl);

			if (!placeholderResizeObserver) {
				// Create a new observer and observe the placeholder element.
				const ResizeObserver = window.ResizeObserver || ResizeObserverPolyfill;
				placeholderResizeObserver = new ResizeObserver(() => {
					merge.leaf.onPlaceholderResize?.(placeholderEl);
				});
			}
			placeholderResizeObserver.observe(placeholderEl);
			placeholderRef = placeholderEl;
		}
	};

	const leafIsPlaceholder = () => Boolean(merge.leaf[PLACEHOLDER_SYMBOL]);

	createEffect(
		on([leafIsPlaceholder], () => {
			if (leafIsPlaceholder()) {
				if (!showPlaceholderTimeoutRef) {
					// Delay the placeholder, so it will not render in a selection
					showPlaceholderTimeoutRef = setTimeout(() => {
						setShowPlaceholder(true);
						showPlaceholderTimeoutRef = null;
					}, PLACEHOLDER_DELAY);
				}
			} else {
				clearTimeoutRef(showPlaceholderTimeoutRef);
				setShowPlaceholder(false);
			}
			onCleanup(() => clearTimeoutRef(showPlaceholderTimeoutRef));
		})
	);

	return (
		<>
			{merge.renderLeaf({
				attributes: {
					"data-slate-leaf": true,
				},
				children: (
					<Show
						when={leafIsPlaceholder() && showPlaceholder()}
						fallback={
							<String isLast={merge.isLast} leaf={merge.leaf} parent={merge.parent} text={merge.text} />
						}
					>
						{/* <p>Rendering</p> */}
						{merge.renderPlaceholder({
							children: merge.leaf.placeholder,
							attributes: {
								"data-slate-placeholder": true,
								style: {
									position: "absolute",
									top: 0,
									"pointer-events": "none",
									width: "100%",
									"max-width": "100%",
									display: "block",
									opacity: "0.333",
									"user-select": "none",
									"text-decoration": "none",
									// Fixes https://github.com/udecode/plate/issues/2315
									"-webkit-user-modify": IS_WEBKIT ? "inherit" : undefined,
								},
								contentEditable: false,
								ref: callbackPlaceholderRef,
							},
						})}
						<String isLast={merge.isLast} leaf={merge.leaf} parent={merge.parent} text={merge.text} />
					</Show>
				),
				leaf: merge.leaf,
				text: merge.text,
			})}
		</>
	);
};

export const DefaultLeaf = (props: RenderLeafProps) => {
	return <span {...props.attributes}>{props.children}</span>;
};

export default Leaf;

