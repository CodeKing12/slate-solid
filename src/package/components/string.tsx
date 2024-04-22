import {
  Accessor,
  Match,
  Switch,
  createEffect,
  createRenderEffect,
  createSignal,
  mergeProps,
  on,
  onCleanup,
  onMount,
} from "solid-js";
import { Editor, Text, Path, Element, Node } from "slate";
import { SolidEditor } from "../plugin/solid-editor";
import { useSlateStatic } from "../hooks/use-slate-static";
import { useIsomorphicLayoutEffect } from "../hooks/use-isomorphic-layout-effect";
import { IS_ANDROID } from "../utils/environment";
import { MARK_PLACEHOLDER_SYMBOL } from "../utils/weak-maps";
import { captureStoreUpdates } from "@solid-primitives/deep";

/**
 * Leaf content strings.
 */

const String = (props: {
  isLast: Accessor<boolean>;
  leaf: Text;
  parent: Element;
  text: Text;
  reactiveText: Text;
}) => {
  const editor = useSlateStatic();
  const path = () => SolidEditor.findPath(editor, props.text);
  const parentPath = () => Path.parent(path());
  const isMarkPlaceholder = () => Boolean(props.leaf[MARK_PLACEHOLDER_SYMBOL]);

  const isLastNodeInEmptyBlock = () =>
    props.reactiveText.text === "" &&
    props.parent.children[props.parent.children.length - 1] === props.text &&
    !editor.isInline(props.parent) &&
    Editor.string(editor, parentPath()) === "";

  const storeReactive = captureStoreUpdates(props.reactiveText);

  onMount(() => {
    console.log("New String Element", props.text.text);
  });

  createEffect(() => {
    console.log("Updated createEffect String -- ", props.reactiveText.text);
  });

  createRenderEffect(() => {
    console.log(
      "Updated createRenderEffect String -- ",
      props.reactiveText.text
    );
  });

  // createRenderEffect(
  //   on([storeReactive], () => {
  //     console.log(
  //       "Updated String",
  //       props.reactiveText.text,
  //       props.reactiveText,
  //       props.leaf,
  //       props.leaf.text,
  //       storeReactive()
  //     );
  //   })
  // );

  onCleanup(() =>
    console.log("Removing: ", props.reactiveText.text, props.leaf.text)
  );

  return (
    <>
      <Switch
        fallback={
          <TextString text={props.leaf.text} reactive={props.reactiveText} />
        }
      >
        <Match when={editor.isVoid(props.parent)}>
          {/* COMPAT: Render text inside void nodes with a zero-width space. So the node can contain
					selection but the text is not visible. */}
          <ZeroWidthString length={Node.string(props.parent).length} />
        </Match>
        <Match when={isLastNodeInEmptyBlock()}>
          {/* COMPAT: If this is the last text node in an empty block, render a zero-width space that will
					convert into a line break when copying and pasting // to support expected plain text. */}
          <ZeroWidthString
            isLineBreak
            isMarkPlaceholder={isMarkPlaceholder()}
          />
        </Match>
        <Match when={props.reactiveText.text === ""}>
          {/* COMPAT: If the text is empty, it's because it's on the edge of an inline
					node, so we render a zero-width space so that the selection can be
        inserted next to it still. */}
          <ZeroWidthString isMarkPlaceholder={isMarkPlaceholder()} />
        </Match>
        <Match
          when={props.isLast() && props.reactiveText.text.slice(-1) === "\n"}
        >
          {/* COMPAT: Browsers will collapse trailing new lines at the end of blocks,
					so we need to add an extra trailing new lines to prevent that. */}
          <TextString
            isTrailing
            text={props.leaf.text}
            reactive={props.reactiveText}
          />
        </Match>
      </Switch>
    </>
  );
};

/**
 * Leaf strings with text in them.
 */
export const TextString = (props: {
  text: string;
  isTrailing?: boolean;
  reactive: Text;
}) => {
  const merge = mergeProps(
    {
      isTrailing: false,
    },
    props
  );
  let ref: HTMLSpanElement | undefined;
  const [initialText] = createSignal(
    `${merge.reactive.text ?? ""}${merge.isTrailing ? "\n" : ""}`
  );

  onMount(() => console.log("Creating new TextString  - special string"));

  const stringReactive = captureStoreUpdates(props.reactive);

  createRenderEffect(
    on([stringReactive, () => props.reactive.text], () => {
      // null coalescing text to make sure we're not outputing "null" as a string in the extreme case it is nullish at runtime
      console.log(
        "Updating string  - special string",
        props.text,
        props.reactive,
        props.reactive.text
      );
      const textWithTrailing = `${merge.reactive.text ?? ""}${merge.isTrailing ? "\n" : ""}`;
      console.log(
        "TextString Ref-special string",
        textWithTrailing,
        ref?.textContent,
        ref,
        initialText()
      );

      if (ref && ref.textContent !== textWithTrailing) {
        ref.textContent = textWithTrailing;
      }
      console.log(ref);

      // intentionally not specifying dependencies, so that this effect runs on every render
      // as this effectively replaces "specifying the text in the virtual DOM under the <span> below" on each render
    })
  );

  onCleanup(() =>
    console.log("Removing TextString - special string: ", props.reactive.text)
  );

  return (
    <span
      data-slate-string="true"
      ref={ref}
      // innerText={`${merge.text ?? ""}${merge.isTrailing ? "\n" : ""}`}
    >
      {initialText()}
    </span>
  );
};

/**
 * Leaf strings without text, render as zero-width strings.
 */

export const ZeroWidthString = (props: {
  length?: number;
  isLineBreak?: boolean;
  isMarkPlaceholder?: boolean;
}) => {
  const merge = mergeProps(
    {
      length: 0,
      isLineBreak: false,
      isMarkPlaceholder: false,
    },
    props
  );

  onMount(() => console.log("Creating new ZeroWidthString - special string"));
  onCleanup(() => console.log("Removing ZeroWidthString - special string"));

  const attributes: () => {
    "data-slate-zero-width": string;
    "data-slate-length": number;
    "data-slate-mark-placeholder"?: boolean;
  } = () => ({
    "data-slate-zero-width": merge.isLineBreak ? "n" : "z",
    "data-slate-length": length,
  });

  createRenderEffect(() => {
    if (merge.isMarkPlaceholder) {
      attributes()["data-slate-mark-placeholder"] = true;
    }
  });

  return (
    <span {...attributes()}>
      {!IS_ANDROID || !merge.isLineBreak ? "\uFEFF" : null}
      {merge.isLineBreak ? <br /> : null}
    </span>
  );
};

export default String;
