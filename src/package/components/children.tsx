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
import {
  OutputElement,
  OutputText,
  TempOutputElement,
  TempOutputText,
} from "./output";
import { captureStoreUpdates } from "@solid-primitives/deep";

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

  const storeUpdates = captureStoreUpdates(props.reactive);
  // createRenderEffect(
  //   on([storeUpdates], () => {
  //     console.log("Finished <Children /> updates");
  //   })
  // );

  return (
    <>
      {/* <Key
				each={props.reactive?.children}
				by={(_, index) => SolidEditor.findKey(editor, props.node.children[index])}
			> */}
      <For each={props.reactive?.children}>
        {(reactiveItem, index) => {
          console.log(props.reactive?.children);
          if (props.node.children[index()]) {
            return (
              <Switch>
                <Match when={Element.isElement(props.node.children[index()])}>
                  <OutputElement
                    index={index()}
                    parent={props.node}
                    n={props.node.children[index()] as BaseElement}
                    reactive={reactiveItem}
                    path={path().concat(index())}
                    selection={props.selection}
                    decorations={props.decorations}
                    renderElement={props.renderElement}
                    renderPlaceholder={props.renderPlaceholder}
                    renderLeaf={props.renderLeaf}
                  />
                </Match>
                <Match when={!Element.isElement(props.node.children[index()])}>
                  <OutputText
                    index={index()}
                    text={props.node.children[index()] as SlateText}
                    reactive={reactiveItem}
                    isLast={
                      isLeafBlock() &&
                      index() === props.node.children.length - 1
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
            );
          }
        }}
      </For>
      {/* </Key> */}
    </>
  );
};

export default Children;
