import {
  Ancestor,
  BaseElement,
  Descendant,
  Editor,
  Element,
  Range,
  Text as SlateText,
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
        {(_, index) => (
          <Switch>
            <Match when={Element.isElement(props.node.children[index()])}>
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
            </Match>
            <Match when={!Element.isElement(props.node.children[index()])}>
              <OutputText
                index={index()}
                text={props.node.children[index()] as SlateText}
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
            </Match>
          </Switch>
        )}
      </For>
      {/* </Key> */}
    </>
  );
};

export default Children;
