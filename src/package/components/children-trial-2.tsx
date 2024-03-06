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
import { For, Index, JSX, Match, Switch, createEffect, createRenderEffect, createSignal, on } from "solid-js";
import { cloneDeep, toInteger } from "lodash";
import { Key } from "@solid-primitives/keyed";

/**
 * Children.
 */

const Children = (props: {
	decorations: Range[];
	node: Descendant;
	reactive: any;
	renderElement?: (props: RenderElementProps) => JSX.Element;
	renderPlaceholder: (props: RenderPlaceholderProps) => JSX.Element;
	renderLeaf?: (props: RenderLeafProps) => JSX.Element;
	selection: Range | null;
	index: number;
	parent: Ancestor;
	reactiveParent: Ancestor;
}) => {
	const decorate = useDecorate();
	const editor = useSlateStatic();

	const path = () => {
		const firstText = props.parent?.children[0]?.text;
		try {
			return SolidEditor.findPath(editor, props.parent);
		} catch {
			if (firstText === "This is editable ") {
				return [0];
			} else if (firstText === "Since it's rich text, you can do things like turn a selection of text ") {
				return [1];
			} else if (firstText === "A wise quote.") {
				return [2];
			} else if (firstText === "Try it out for yourself!") {
				return [3];
			} else {
				console.log(props.parent);
			}
		}
	};
	const isLeafBlock = () =>
		Element.isElement(props.parent) && !editor.isInline(props.parent) && Editor.hasInlines(editor, props.parent);
	const p = () => path().concat(props.index);
	const range = () => Editor.range(editor, p());
	const sel = () => props.selection && Range.intersection(range(), editor.selection || cloneDeep(props.selection));
	const [ds, setDs] = createSignal(decorate()([props.node, p()]));

	createRenderEffect(
		on([() => props.reactive, () => props.reactiveParent], () => {
			// for (let index = 0; index < props.reactiveParent?.children.length; index++) {
			// const key = SolidEditor.findKey(editor, props.node);

			for (const dec of props.decorations) {
				const d = Range.intersection(dec, range());

				if (d) {
					setDs((prev) => [...prev, d]);
				}
			}
			// console.log("Setting Children, Index, and Parents", p, props.node, key, sel(), ds, index);

			// Beware we moved this code to run before the component is pushed to the array so that when the component calls the hook, we will be able to find the path to the component node
			// NODE_TO_INDEX.set(props.node, props.index);
			// NODE_TO_PARENT.set(props.node, props.parent);
			// console.log("Setting Indexes & Parents", props.node, props.index, props.parent);
			// }
		})
	);

	return (
		<Switch>
			<Match when={Element.isElement(props.node)}>
				<SelectedContext.Provider value={!!sel}>
					<ElementComponent
						decorations={ds()}
						element={props.node}
						reactive={props.reactive}
						renderElement={props.renderElement}
						renderPlaceholder={props.renderPlaceholder}
						renderLeaf={props.renderLeaf}
						selection={sel()}
					/>
				</SelectedContext.Provider>
			</Match>
			<Match when={!Element.isElement(props.node)}>
				<TextComponent
					decorations={ds()}
					reactive={props.reactive}
					isLast={isLeafBlock() && props.index === props.parent.children.length - 1}
					parent={props.parent}
					renderPlaceholder={props.renderPlaceholder}
					renderLeaf={props.renderLeaf}
					text={props.node}
				/>
			</Match>
		</Switch>
	);

	// return (
	// 	<>
	// 		<Key
	// 			each={props.reactive?.children}
	// 			by={(_, index) => {
	// 				console.log(_, index, SolidEditor.findKey(editor, props.node.children[index]));
	// 				return SolidEditor.findKey(editor, props.node.children[index]);
	// 			}}
	// 		>
	// 			{(_, index) => {
	// 				console.log("Re-calling: ", _, index);
	// 				const p = path().concat(index());
	// 				const n = props.node.children[index()] as Descendant;
	// 				const key = SolidEditor.findKey(editor, n);
	// 				const range = Editor.range(editor, p);
	// 				const sel =
	// 					props.selection && Range.intersection(range, editor.selection || cloneDeep(props.selection));
	// 				const ds = decorate()([n, p]);

	// 				for (const dec of props.decorations) {
	// 					const d = Range.intersection(dec, range);

	// 					if (d) {
	// 						ds.push(d);
	// 					}
	// 				}

	// 				// Beware we moved this code to run before the component is pushed to the array so that when the component calls the hook, we will be able to find the path to the component node
	// 				NODE_TO_INDEX.set(n, index());
	// 				NODE_TO_PARENT.set(n, props.node);
	// 			}}
	// 		</Key>
	// 	</>
	// );
};

export default Children;
