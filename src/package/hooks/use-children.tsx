import { Ancestor, Descendant, Editor, Element, Range } from "slate";
import { RenderElementProps, RenderLeafProps, RenderPlaceholderProps } from "../components/editable";
import { createStore } from "solid-js/store";
import ElementComponent, { ElementComponentProps } from "../components/element";
import TextComponent, { TextComponentProps } from "../components/text";
import { SolidEditor } from "../plugin/solid-editor";
import { NODE_TO_INDEX, NODE_TO_PARENT } from "../utils/weak-maps";
import { useDecorate } from "./use-decorate";
import { SelectedContext } from "./use-selected";
import { useSlateStatic } from "./use-slate-static";
import { For, Index, JSX, Match, Switch, createEffect, createRenderEffect, createSignal } from "solid-js";
import { toInteger } from "lodash";

/**
 * Children.
 */

const Children = (props: {
	decorations: Range[];
	node: Ancestor;
	renderElement?: (props: RenderElementProps) => JSX.Element;
	renderPlaceholder: (props: RenderPlaceholderProps) => JSX.Element;
	renderLeaf?: (props: RenderLeafProps) => JSX.Element;
	selection: Range | null;
}) => {
	const decorate = useDecorate();
	const editor = useSlateStatic();
	// createEffect((formerProps) => {
	// 	console.log("Editor Changed: ", props, formerProps);
	// 	return props;
	// });

	const path = () => SolidEditor.findPath(editor(), props.node);
	const children: (ElementComponentProps | TextComponentProps)[] = [];
	// const [children, setChildren] = createStore<(ElementComponentProps | TextComponentProps)[]>([]);
	const isLeafBlock = () =>
		Element.isElement(props.node) && !editor().isInline(props.node) && Editor.hasInlines(editor(), props.node);

	// createEffect(() => console.log("Children Updated", children));

	// Beware all createRenderEffects run before createEffects.
	createRenderEffect(() => {
		// console.log("Should be fired on input: ", props);
		for (let i = 0; i < props.node.children.length; i++) {
			const p = path().concat(i);
			const n = props.node.children[i] as Descendant;
			const key = SolidEditor.findKey(editor(), n);
			const range = Editor.range(editor(), p);
			const sel = props.selection && Range.intersection(range, props.selection);
			const ds = decorate()([n, p]);

			for (const dec of props.decorations) {
				const d = Range.intersection(dec, range);

				if (d) {
					ds.push(d);
				}
			}

			// Beware we moved this code to run before the component is pushed to the array so that when the component calls the hook, we will be able to find the path to the component node
			NODE_TO_INDEX.set(n, i);
			NODE_TO_PARENT.set(n, props.node);
			console.log("Set Parent", props.node, n);

			if (Element.isElement(n)) {
				// console.log("Didn;t reach here");
				// setChildren((prev) => [
				children.push(
					// Beware key={`provider-${key.id}`}
					// <SelectedContext.Provider value={!!sel}>
					// 	<ElementComponent
					// 		decorations={ds}
					// 		element={n}
					// 		// Beware key
					// 		// key={key.id}
					// 		renderElement={props.renderElement}
					// 		renderPlaceholder={props.renderPlaceholder}
					// 		renderLeaf={props.renderLeaf}
					// 		selection={sel}
					// 	/>
					// </SelectedContext.Provider>
					{
						id: toInteger(key.id),
						decorations: ds,
						element: n,
						renderElement: props.renderElement,
						renderPlaceholder: props.renderPlaceholder,
						renderLeaf: props.renderLeaf,
						selection: sel,
					}
				);
				// console.log("I DID REACH reach here");
			} else {
				// setChildren((prev) => [
				children.push(
					// <TextComponent
					// 	decorations={ds}
					// 	// Beware Key
					// 	// key={key.id}
					// 	isLast={isLeafBlock() && i === props.node.children.length - 1}
					// 	parent={props.node}
					// 	renderPlaceholder={props.renderPlaceholder}
					// 	renderLeaf={props.renderLeaf}
					// 	text={n}
					// />
					{
						id: toInteger(key.id),
						decorations: ds,
						isLast: isLeafBlock() && i === props.node.children.length - 1,
						parent: props.node,
						renderPlaceholder: props.renderPlaceholder,
						renderLeaf: props.renderLeaf,
						text: n,
					}
				);
			}
		}
	});

	return (
		<>
			<For each={children}>
				{(item) => (
					<Switch>
						<Match when={item.text}>
							<TextComponent
								decorations={item.decorations}
								isLast={item.isLast}
								parent={item.parent}
								renderPlaceholder={item.renderPlaceholder}
								renderLeaf={item.renderLeaf}
								text={item.text}
							/>
							{/* {console.log("Text Re-rendered by useChildren")} */}
						</Match>
						<Match when={!item.text}>
							<SelectedContext.Provider value={!!item.sel}>
								<ElementComponent
									decorations={item.decorations}
									element={item.element}
									renderElement={item.renderElement}
									renderPlaceholder={item.renderPlaceholder}
									renderLeaf={item.renderLeaf}
									selection={item.sel}
								/>
							</SelectedContext.Provider>
						</Match>
					</Switch>
				)}
			</For>
		</>
	);
	// return children;
};

export default Children;

