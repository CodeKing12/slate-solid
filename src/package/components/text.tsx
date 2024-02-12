import { JSX } from "solid-js";
import { Element, Range, Text as SlateText } from "slate";
import { SolidEditor } from "../plugin/solid-editor";
import { useSlateStatic } from "../hooks/use-slate-static";
import { isTextDecorationsEqual } from "../utils/range-list";
import { EDITOR_TO_KEY_TO_ELEMENT, ELEMENT_TO_NODE, NODE_TO_ELEMENT } from "../utils/weak-maps";
import { RenderLeafProps, RenderPlaceholderProps } from "./editable";
import Leaf from "./leaf";

/**
 * Text.
 */

const Text = (props: {
	decorations: Range[];
	isLast: boolean;
	parent: Element;
	renderPlaceholder: (props: RenderPlaceholderProps) => JSX.Element;
	renderLeaf?: (props: RenderLeafProps) => JSX.Element;
	text: SlateText;
}) => {
	const editor = useSlateStatic();
	let ref: HTMLSpanElement | undefined | null;
	// May convert to functions and <For> loop (or mapArray)
	const leaves = SlateText.decorations(props.text, props.decorations);
	const key = SolidEditor.findKey(editor, props.text);
	const children = [];

	for (let i = 0; i < leaves.length; i++) {
		const leaf = leaves[i];

		children.push(
			<Leaf
				isLast={props.isLast && i === leaves.length - 1}
				// Beware key
				// key={`${key.id}-${i}`}
				renderPlaceholder={props.renderPlaceholder}
				leaf={leaf}
				text={props.text}
				parent={props.parent}
				renderLeaf={props.renderLeaf}
			/>
		);
	}

	// Update element-related weak maps with the DOM element ref.
	const callbackRef = (span: HTMLSpanElement | null) => {
		const KEY_TO_ELEMENT = EDITOR_TO_KEY_TO_ELEMENT.get(editor);
		if (span) {
			KEY_TO_ELEMENT?.set(key, span);
			NODE_TO_ELEMENT.set(props.text, span);
			ELEMENT_TO_NODE.set(span, props.text);
		} else {
			KEY_TO_ELEMENT?.delete(key);
			NODE_TO_ELEMENT.delete(props.text);
			if (ref) {
				ELEMENT_TO_NODE.delete(ref);
			}
		}
		ref = span;
	};
	return (
		<span data-slate-node="text" ref={callbackRef}>
			{children}
		</span>
	);
};

// Beware
// const MemoizedText = React.memo(Text, (prev, next) => {
// 	return (
// 		next.parent === prev.parent &&
// 		next.isLast === prev.isLast &&
// 		next.renderLeaf === prev.renderLeaf &&
// 		next.renderPlaceholder === prev.renderPlaceholder &&
// 		next.text === prev.text &&
// 		isTextDecorationsEqual(next.decorations, prev.decorations)
// 	);
// });

export default Text;

