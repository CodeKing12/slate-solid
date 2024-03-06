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
	const [children, setChildren] = createSignal([])


	createRenderEffect(() => {
		const newChildren = [];
		for (let i=0; i < props.reactive.children.length; i++) {
			const p = path().concat(i);
			const n = props.node.children[i] as Descendant;
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

			newChildren.push({
				key,
				range,
				descendant: n,
				selection: sel,
				decorations: ds,
				reactive: props.reactive.children[i]
			})
		}

		setChildren(newChildren)
	})

	return (
		<>
			<For each={children()}>
				{(child, index) => {

					// Beware we moved this code to run before the component is pushed to the array so that when the component calls the hook, we will be able to find the path to the component node
					NODE_TO_INDEX.set(child.descendant, index());
					NODE_TO_PARENT.set(child.descendant, props.node);

					if (Element.isElement(child.descendant)) {
						return (
							<SelectedContext.Provider value={!!child.selection}>
								<ElementComponent
									decorations={child.decorations}
									element={child.descendant}
									// reactive={props.reactive.children[index()]}
									reactive={child.reactive}
									renderElement={props.renderElement}
									renderPlaceholder={props.renderPlaceholder}
									renderLeaf={props.renderLeaf}
									selection={child.selection}
								/>
							</SelectedContext.Provider>
						);
					} else {
						return (
							<TextComponent
								decorations={child.decorations}
								// reactive={props.reactive.children[index()]}
								reactive={child.reactive}
								isLast={isLeafBlock() && index() === props.node.children.length - 1}
								parent={props.node}
								renderPlaceholder={props.renderPlaceholder}
								renderLeaf={props.renderLeaf}
								text={child.descendant}
							/>
						);
					}
				}}
			</For>
		</>
	);
};

export default Children;
