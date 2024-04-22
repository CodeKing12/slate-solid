import {
  For,
  Index,
  JSX,
  createEffect,
  createRenderEffect,
  createSignal,
  on,
} from "solid-js";
import { Element, Range, Text as SlateText } from "slate";
import { SolidEditor } from "../plugin/solid-editor";
import { useSlateStatic } from "../hooks/use-slate-static";
import {
  EDITOR_TO_KEY_TO_ELEMENT,
  ELEMENT_TO_NODE,
  NODE_TO_ELEMENT,
} from "../utils/weak-maps";
import { RenderLeafProps, RenderPlaceholderProps } from "./editable";
import Leaf, { LeafProps, TempLeaf } from "./leaf";
import { Key } from "@solid-primitives/keyed";
import { captureStoreUpdates, trackStore } from "@solid-primitives/deep";
import { type Key as WeakmapKey } from "../utils/key";
import String, { TextString } from "./string";
import { createStore, produce, reconcile } from "solid-js/store";

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
  reactive: SlateText;
}

const Text = (props: TextComponentProps) => {
  const editor = useSlateStatic();
  let ref: HTMLSpanElement | undefined | null;
  // const leaves = () => SlateText.decorations(props.text, props.decorations);
  const key = () => SolidEditor.findKey(editor, props.text);
  const [leaves, setLeaves] = createStore<SlateText[]>(
    SlateText.decorations(props.text, props.decorations)
  );
  const reactiveUpdates = captureStoreUpdates(props.reactive);

  // const [leaves, setLeaves] = createSignal<SlateText[]>([]);
  // const [key, setKey] = createSignal<WeakmapKey>();
  // console.log("Here are the Leaves: ", leaves());

  console.log("New Text element");
  createEffect(
    on([reactiveUpdates], () => {
      console.log(
        "<Text/> Updated",
        props.reactive.text,
        props.decorations,
        props.text
      );

      setLeaves(
        0,
        reconcile(SlateText.decorations(props.text, props.decorations)[0])
      );

      // setLeaves(SlateText.decorations(props.text, props.decorations));
      // setKey(SolidEditor.findKey(editor, props.text));
      console.log(SlateText.decorations(props.text, props.decorations));
    })
  );

  createEffect(() => {
    console.log("createEffect leaves updated: ", leaves[0]);
  });

  // Update element-related weak maps with the DOM element ref.
  function callbackRef(span: HTMLSpanElement | null) {
    const KEY_TO_ELEMENT = EDITOR_TO_KEY_TO_ELEMENT.get(editor);
    console.log("Calling TEXT.tsx callback");
    if (span) {
      console.log("Setting Text.tsx Key_To_Element: ", key(), span, props.text);
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
      {/* <Key each={leaves()} by={(leaf) => leaf.text}> */}
      <For each={leaves}>
        {(leaf, i) => {
          console.log("<FOR/> New Leaf from Text.tsx", leaf);
          return (
            <Leaf
              isLast={() => props.isLast && i() === leaves.length - 1}
              renderPlaceholder={props.renderPlaceholder}
              leaf={leaf}
              text={props.text}
              reactiveText={props.reactive}
              parent={props.parent}
              renderLeaf={props.renderLeaf}
            />
            // <String
            //   isLast={() => props.isLast && i === leaves().length - 1}
            //   leaf={leaf}
            //   parent={props.parent}
            //   text={props.text}
            //   reactiveText={props.reactive}
            // />
          );
        }}
      </For>
      {/* </Key> */}
    </span>
  );
};

export default Text;
