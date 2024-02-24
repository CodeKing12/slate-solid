import { Ancestor, Descendant, Editor, Element, Range } from "slate";
import { RenderElementProps, RenderLeafProps, RenderPlaceholderProps } from "./editable";
import { createStore } from "solid-js/store";
import ElementComponent, { ElementComponentProps } from "./element";
import TextComponent, { TextComponentProps } from "./text";
import { SolidEditor } from "../plugin/solid-editor";
import { NODE_TO_INDEX, NODE_TO_PARENT } from "../utils/weak-maps";
import { useDecorate } from "../hooks/use-decorate";
import { SelectedContext } from "../hooks/use-selected";
import { useSlateStatic } from "../hooks/use-slate-static";
import { For, Index, JSX, Match, Switch, createEffect, createRenderEffect, createSignal } from "solid-js";
import { cloneDeep, toInteger } from "lodash";

/**
 * Children.
 */

const Children = (props: {
	decorations: Range[];
	node: Ancestor;
	reactive: any;
	renderElement?: (props: RenderElementProps) => JSX.Element;
	renderPlaceholder: (props: RenderPlaceholderProps) => JSX.Element;
	renderLeaf?: (props: RenderLeafProps) => JSX.Element;
	selection: Range | null;
}) => {
	const decorate = useDecorate();
	const editor = useSlateStatic();

	const path = () => SolidEditor.findPath(editor, props.node);
	const isLeafBlock = () =>
		Element.isElement(props.node) && !editor.isInline(props.node) && Editor.hasInlines(editor, props.node);

	return (
		<>
			<For each={props.reactive?.children}>
				{(_, index) => {
					const p = path().concat(index());
					const n = props.node.children[index()] as Descendant;
					const key = SolidEditor.findKey(editor, n);
					const range = Editor.range(editor, p);
					const sel =
						props.selection && Range.intersection(range, editor.selection || cloneDeep(props.selection));
					const ds = decorate()([n, p]);

					for (const dec of props.decorations) {
						const d = Range.intersection(dec, range);

						if (d) {
							ds.push(d);
						}
					}

					// Beware we moved this code to run before the component is pushed to the array so that when the component calls the hook, we will be able to find the path to the component node
					NODE_TO_INDEX.set(n, index());
					NODE_TO_PARENT.set(n, props.node);

					if (Element.isElement(n)) {
						return (
							<SelectedContext.Provider value={!!sel}>
								<ElementComponent
									decorations={ds}
									element={n}
									reactive={props.reactive.children[index()]}
									renderElement={props.renderElement}
									renderPlaceholder={props.renderPlaceholder}
									renderLeaf={props.renderLeaf}
									selection={sel}
								/>
							</SelectedContext.Provider>
						);
					} else {
						return (
							<TextComponent
								decorations={ds}
								reactive={props.reactive.children[index()]}
								isLast={isLeafBlock() && index() === props.node.children.length - 1}
								parent={props.node}
								renderPlaceholder={props.renderPlaceholder}
								renderLeaf={props.renderLeaf}
								text={n}
							/>
						);
					}
				}}
			</For>
		</>
	);
};

export default Children;
