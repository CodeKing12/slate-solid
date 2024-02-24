import { For, JSX, createEffect, createRenderEffect, createSignal } from "solid-js";
import { Element, Range, Text as SlateText } from "slate";
import { SolidEditor } from "../plugin/solid-editor";
import { useSlateStatic } from "../hooks/use-slate-static";
import { EDITOR_TO_KEY_TO_ELEMENT, ELEMENT_TO_NODE, NODE_TO_ELEMENT } from "../utils/weak-maps";
import { RenderLeafProps, RenderPlaceholderProps } from "./editable";
import Leaf, { LeafProps } from "./leaf";

/**
 * Text.
 */

export interface TextComponentProps {
	decorations: Range[];
	isLast: boolean;
	parent: Element;
	renderPlaceholder: (props: RenderPlaceholderProps) => JSX.Element;
	renderLeaf?: (props: RenderLeafProps) => JSX.Element;
	text: SlateText;
	reactive: any;
}

const Text = (props: TextComponentProps) => {
	const editor = useSlateStatic();
	let ref: HTMLSpanElement | undefined | null;
	const leaves = () => SlateText.decorations(props.text, props.decorations);
	const key = () => SolidEditor.findKey(editor, props.text);

	// Update element-related weak maps with the DOM element ref.
	function callbackRef(span: HTMLSpanElement | null) {
		const KEY_TO_ELEMENT = EDITOR_TO_KEY_TO_ELEMENT.get(editor);
		if (span) {
			KEY_TO_ELEMENT?.set(key(), span);
			NODE_TO_ELEMENT.set(props.text, span);
			ELEMENT_TO_NODE.set(span, props.text);
		} else {
			KEY_TO_ELEMENT?.delete(key());
			NODE_TO_ELEMENT.delete(props.text);
			if (ref) {
				ELEMENT_TO_NODE.delete(ref);
			}
		}
		ref = span;
	}

	return (
		<span data-slate-node="text" ref={callbackRef}>
			<For each={leaves()}>
				{(leaf, i) => (
					<Leaf
						isLast={props.isLast && i() === leaves().length - 1}
						renderPlaceholder={props.renderPlaceholder}
						leaf={leaf}
						text={props.text}
						parent={props.parent}
						renderLeaf={props.renderLeaf}
					/>
				)}
			</For>
		</span>
	);
};

export default Text;

