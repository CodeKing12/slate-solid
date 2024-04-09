import {
  Ancestor,
  BaseElement,
  Descendant,
  Editor,
  Element,
  Range,
} from "slate";
import {
  RenderElementProps,
  RenderLeafProps,
  RenderPlaceholderProps,
} from "./editable";
import { createStore } from "solid-js/store";
import ElementComponent, { ElementComponentProps } from "./element";
import TextComponent, { TextComponentProps } from "./text";
import { SolidEditor } from "../plugin/solid-editor";
import { NODE_TO_INDEX, NODE_TO_PARENT } from "../utils/weak-maps";
import { useDecorate } from "../hooks/use-decorate";
import { SelectedContext } from "../hooks/use-selected";
import { useSlateStatic } from "../hooks/use-slate-static";
import {
  For,
  Index,
  JSX,
  Match,
  Switch,
  createEffect,
  createRenderEffect,
  createSignal,
  on,
} from "solid-js";
import { OutputElement, OutputText } from "./output";

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
    Element.isElement(props.node) &&
    !editor.isInline(props.node) &&
    Editor.hasInlines(editor, props.node);

  createEffect(() =>
    console.log("Reactive Children Updated: ", props.reactive?.children),
  );

  return (
    <>
      {/* <Key
				each={props.reactive?.children}
				by={(_, index) => SolidEditor.findKey(editor, props.node.children[index])}
			> */}
      <For each={props.reactive?.children}>
        {(_, index) => {
          // const p = path().concat(index());
          // console.log(
          //   "Running for: ",
          //   _,
          //   index(),
          //   editor,
          //   p,
          //   props.reactive?.children,
          // );
          const n = props.node.children[index()] as Descendant;
          // if (!n) {
          //   return;
          // }
          // const key = SolidEditor.findKey(editor, n);
          // const range = Editor.range(editor, p);
          // const sel =
          //   props.selection && Range.intersection(range, props.selection);
          // const ds = decorate()([n, p]);

          // for (const dec of props.decorations) {
          //   const d = Range.intersection(dec, range);

          //   if (d) {
          //     ds.push(d);
          //   }
          // }

          // Beware we moved this code to run before the component is pushed to the array so that when the component calls the hook, we will be able to find the path to the component node
          // NODE_TO_INDEX.set(n, index());
          // NODE_TO_PARENT.set(n, props.node);

          if (Element.isElement(n)) {
            return (
              <OutputElement
                index={index()}
                parent={props.node}
                n={props.node.children[index()] as BaseElement}
                reactive={props.reactive.children[index()]}
                path={path().concat(index())}
                selection={props.selection}
                decorations={props.decorations}
                renderElement={props.renderElement}
                renderPlaceholder={props.renderPlaceholder}
                renderLeaf={props.renderLeaf}
              ></OutputElement>
            );
          } else {
            return (
              <OutputText
                index={index()}
                text={n}
                reactive={props.reactive.children[index()]}
                isLast={
                  isLeafBlock() && index() === props.node.children.length - 1
                }
                parent={props.node}
                path={path().concat(index())}
                selection={props.selection}
                decorations={props.decorations}
                renderPlaceholder={props.renderPlaceholder}
                renderLeaf={props.renderLeaf}
              />
            );
          }
        }}
      </For>
      {/* </Key> */}
    </>
  );
};

export default Children;
