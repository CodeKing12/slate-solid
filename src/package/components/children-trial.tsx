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
	index: number;
	decorations: Range[];
	node: Descendant;
	parent: Ancestor;
	reactive: any;
	renderElement?: (props: RenderElementProps) => JSX.Element;
	renderPlaceholder: (props: RenderPlaceholderProps) => JSX.Element;
	renderLeaf?: (props: RenderLeafProps) => JSX.Element;
	selection: Range | null;
}) => {
	const decorate = useDecorate();
	const editor = useSlateStatic();

	console.log(editor, props.parent);
	const path = () => SolidEditor.findPath(editor, props.parent);
	console.log(path());
	const isLeafBlock = () =>
		Element.isElement(props.parent) && !editor.isInline(props.parent) && Editor.hasInlines(editor, props.parent);
	const p = () => path().concat(props.index);
	const range = () => Editor.range(editor, p());
	const key = () => SolidEditor.findKey(editor, props.node);
	const sel = () => props.selection && Range.intersection(range(), editor.selection || cloneDeep(props.selection));
	const [ds, setDs] = createSignal(decorate()([props.node, p()]));

	createEffect(() => {
		for (const dec of props.decorations) {
			const d = Range.intersection(dec, range());

			if (d) {
				setDs((prev) => [...prev, d]);
			}
		}

		NODE_TO_INDEX.set(props.node, props.index);
		NODE_TO_PARENT.set(props.node, props.parent);
	});

	return (
		<Switch>
			<Match when={Element.isElement(props.node)}>
				<SelectedContext.Provider value={!!sel()}>
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
};

export default Children;
