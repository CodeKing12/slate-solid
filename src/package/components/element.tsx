import getDirection from "direction";
import { JSX, createEffect, createRenderEffect, mergeProps } from "solid-js";
import { Editor, Element as SlateElement, Node, Range } from "slate";
// index index-fix
import { SolidEditor } from "../plugin/solid-editor";
import { useReadOnly } from "../hooks/use-read-only";
import { useSlateStatic } from "../hooks/use-slate-static";

// import useChildren from "../hooks/use-children";
import {
	EDITOR_TO_KEY_TO_ELEMENT,
	ELEMENT_TO_NODE,
	NODE_TO_ELEMENT,
	NODE_TO_INDEX,
	NODE_TO_PARENT,
} from "../utils/weak-maps";
import { RenderElementProps, RenderLeafProps, RenderPlaceholderProps } from "./editable";

import Text from "./text";
import { Dynamic } from "solid-js/web";
import Children from "./children";
import { unwrap } from "solid-js/store";

/**
 * Element.
 */

export interface ElementComponentProps {
	decorations: Range[];
	element: SlateElement;
	reactive: any;
	renderElement?: (props: RenderElementProps) => JSX.Element;
	renderPlaceholder: (props: RenderPlaceholderProps) => JSX.Element;
	renderLeaf?: (props: RenderLeafProps) => JSX.Element;
	selection: Range | null;
}

const Element = (props: ElementComponentProps) => {
	const merge = mergeProps(
		{
			renderElement: (p: RenderElementProps) => <DefaultElement {...p} />,
		},
		props
	);
	const editor = useSlateStatic();
	const readOnly = useReadOnly();
	const isInline = () => editor.isInline(merge.element);
	const key = () => SolidEditor.findKey(editor, merge.element);
	const ref = (ref: HTMLElement | null) => {
		// Update element-related weak maps with the DOM element ref.
		const KEY_TO_ELEMENT = EDITOR_TO_KEY_TO_ELEMENT.get(unwrap(editor));
		if (ref) {
			KEY_TO_ELEMENT?.set(key(), ref);
			NODE_TO_ELEMENT.set(merge.element, ref);
			ELEMENT_TO_NODE.set(ref, merge.element);
		} else {
			KEY_TO_ELEMENT?.delete(key());
			NODE_TO_ELEMENT.delete(merge.element);
		}
	};

	// let children: JSX.Element = useChildren({
	// 	decorations: merge.decorations,
	// 	node: merge.element,
	// 	renderElement: merge.renderElement,
	// 	renderPlaceholder: merge.renderPlaceholder,
	// 	renderLeaf: merge.renderLeaf,
	// 	selection: merge.selection,
	// });

	let children: JSX.Element = (
		<Children
			decorations={merge.decorations}
			node={merge.element}
			reactive={props.reactive}
			renderElement={merge.renderElement}
			renderPlaceholder={merge.renderPlaceholder}
			renderLeaf={merge.renderLeaf}
			selection={merge.selection}
		/>
	);

	// Attributes that the developer must mix into the element in their
	// custom node renderer component.
	const attributes: {
		"data-slate-node": "element";
		"data-slate-void"?: true;
		"data-slate-inline"?: true;
		contentEditable?: false;
		dir?: "rtl";
		ref: any;
	} = {
		"data-slate-node": "element",
		ref,
	};

	// If it's a block node with inline children, add the proper `dir` attribute
	// for text direction.
	createRenderEffect(() => {
		if (isInline()) {
			attributes["data-slate-inline"] = true;
		}

		if (!isInline() && Editor.hasInlines(editor, merge.element)) {
			const text = Node.string(merge.element);
			const dir = getDirection(text);

			if (dir === "rtl") {
				attributes.dir = dir;
			}
		}
	});

	// If it's a void node, wrap the children in extra void-specific elements.
	createRenderEffect(() => {
		if (Editor.isVoid(editor, merge.element)) {
			attributes["data-slate-void"] = true;

			if (!readOnly && isInline()) {
				attributes.contentEditable = false;
			}

			const Tag = isInline() ? "span" : "div";
			const [[text]] = Node.texts(merge.element);

			children = (
				<>
					<Tag
						data-slate-spacer
						style={{
							height: "0",
							color: "transparent",
							outline: "none",
							position: "absolute",
						}}
					>
						<Text
							renderPlaceholder={merge.renderPlaceholder}
							decorations={[]}
							isLast={false}
							parent={merge.element}
							text={text}
						/>
					</Tag>
				</>
			);

			NODE_TO_INDEX.set(text, 0);
			NODE_TO_PARENT.set(text, merge.element);
		}
	});

	return <>{merge.renderElement({ attributes, children: children, element: merge.element })}</>;
};

// Beware
// const MemoizedElement = React.memo(Element, (prev, next) => {
// 	return (
// 		prev.element === next.element &&
// 		prev.renderElement === next.renderElement &&
// 		prev.renderLeaf === next.renderLeaf &&
// 		prev.renderPlaceholder === next.renderPlaceholder &&
// 		isElementDecorationsEqual(prev.decorations, next.decorations) &&
// 		(prev.selection === next.selection ||
// 			(!!prev.selection && !!next.selection && Range.equals(prev.selection, next.selection)))
// 	);
// });

/**
 * The default element renderer.
 */

export const DefaultElement = (props: RenderElementProps) => {
	const editor = useSlateStatic();
	const tag = () => (editor.isInline(props.element) ? "span" : "div");

	return (
		<Dynamic component={tag()} {...props.attributes} style={{ position: "relative" }}>
			{props.children}
		</Dynamic>
	);
};

export default Element;
