import {
  createSignal,
  createEffect,
  JSX,
  mergeProps,
  createRenderEffect,
  on,
  onCleanup,
  Switch,
  Match,
  Show,
  Accessor,
  createMemo,
  JSXElement,
  onMount,
} from "solid-js";
import { Element as SlateElement, Text } from "slate";
import { ResizeObserver as ResizeObserverPolyfill } from "@juggle/resize-observer";
import String from "./string";
import {
  PLACEHOLDER_SYMBOL,
  EDITOR_TO_PLACEHOLDER_ELEMENT,
} from "../utils/weak-maps";
import { RenderLeafProps, RenderPlaceholderProps } from "./editable";
import { useSlateStatic } from "../hooks/use-slate-static";
import { IS_WEBKIT, IS_ANDROID } from "../utils/environment";
import { captureStoreUpdates } from "@solid-primitives/deep";
import { createStore } from "solid-js/store";

// Delay the placeholder on Android to prevent the keyboard from closing.
// (https://github.com/ianstormtaylor/slate/pull/5368)
const PLACEHOLDER_DELAY = IS_ANDROID ? 300 : 0;

function disconnectPlaceholderResizeObserver(
  placeholderResizeObserver: ResizeObserver | null,
  releaseObserver: boolean
) {
  if (placeholderResizeObserver) {
    placeholderResizeObserver.disconnect();
    if (releaseObserver) {
      placeholderResizeObserver = null;
    }
  }
}

type TimerId = ReturnType<typeof setTimeout> | null;

function clearTimeoutRef(timeoutRef: TimerId) {
  if (timeoutRef) {
    clearTimeout(timeoutRef);
    timeoutRef = null;
  }
}

/**
 * Individual leaves in a text node with unique formatting.
 */
export interface LeafProps {
  isLast: Accessor<boolean>;
  leaf: Text;
  parent: SlateElement;
  renderPlaceholder: (props: RenderPlaceholderProps) => JSX.Element;
  renderLeaf?: (props: RenderLeafProps) => JSX.Element;
  text: Text;
  reactiveText: Text;
}

const Leaf = (props: LeafProps) => {
  const merge = mergeProps(
    {
      renderLeaf: (props: RenderLeafProps) => <DefaultLeaf {...props} />,
    },
    props
  );

  const [leafChildren, setLeafChildren] = createSignal<Element>();
  const leafIsPlaceholder = createMemo(() =>
    Boolean(merge.leaf[PLACEHOLDER_SYMBOL])
  );
  const [showPlaceholder, setShowPlaceholder] = createSignal(false);
  // using the ReactiveText store is more reactive than props.leaf. Props.leaf doesnt call the effect most times.
  const storeUpdates = captureStoreUpdates(merge.leaf);
  const textUpdates = captureStoreUpdates(merge.reactiveText);
  const [styles, setStyles] = createSignal<JSX.CSSProperties>({});
  // <>testing initial load signal</>

  // Using CSS to style the leafs because adding parent elements leads to re-rendering of the <String /> component
  const defaultStyles: {
    [formatting: string]: JSX.CSSProperties;
  } = {
    bold: {
      "font-weight": "bold",
    },
    italic: {
      "font-style": "italic",
    },
    code: {
      "font-family": "monospace",
      "background-color": "#eee",
      padding: "3px",
    },
    underline: {
      "text-decoration": "underline",
    },
  };

  createRenderEffect(
    on([storeUpdates], () => {
      let children: JSXElement;

      // if (leafIsPlaceholder() && showPlaceholder()) {
      //   children = (
      //     <>
      //       <DefaultLeaf
      //         attributes={{
      //           "data-slate-placeholder": true,
      //           style: {
      //             position: "absolute",
      //             top: 0,
      //             "pointer-events": "none",
      //             width: "100%",
      //             "max-width": "100%",
      //             display: "block",
      //             opacity: "0.333",
      //             "user-select": "none",
      //             "text-decoration": "none",
      //             // Fixes https://github.com/udecode/plate/issues/2315
      //             "-webkit-user-modify": IS_WEBKIT ? "inherit" : undefined,
      //           },
      //         }}
      //         contentEditable={false}
      //         ref={callbackPlaceholderRef}
      //       >
      //         {merge.leaf.placeholder}
      //       </DefaultLeaf>
      //       <String
      //         isLast={merge.isLast}
      //         leaf={merge.leaf}
      //         parent={merge.parent}
      //         text={merge.text}
      //         reactiveText={merge.reactiveText}
      //       />
      //     </>
      //   );
      // } else {
      //   children = (
      //     <String
      //       isLast={merge.isLast}
      //       leaf={merge.leaf}
      //       parent={merge.parent}
      //       text={merge.text}
      //       reactiveText={merge.reactiveText}
      //     />
      //   );
      // }

      const styles: JSX.CSSProperties = {};
      console.log("<Leaf/> Updated", props.leaf, props.reactiveText);

      if (merge.leaf.bold) {
        Object.assign(styles, defaultStyles.bold);
        children = <strong>{children}</strong>;
      }

      if (merge.leaf.code) {
        Object.assign(styles, defaultStyles.code);
        children = <code>{children}</code>;
      }

      if (merge.leaf.italic) {
        Object.assign(styles, defaultStyles.italic);
        children = <em>{children}</em>;
      }

      if (merge.leaf.underline) {
        Object.assign(styles, defaultStyles.underline);
        children = <u>{children}</u>;
      }

      console.log("New Children: ", children, merge.leaf, merge.reactiveText);
      setLeafChildren(children);
      setStyles(styles);
    })
  );

  onMount(() => {
    console.log("New Leaf Element");
  });

  createRenderEffect(
    on([storeUpdates, textUpdates], () => {
      console.log(
        "<Leaf/> Updated",
        merge.leaf,
        merge.text,
        merge.reactiveText
      );
    })
  );

  const editor = useSlateStatic();
  let placeholderResizeObserver: ResizeObserver | null = null;
  let placeholderRef: HTMLElement | null = null;
  let showPlaceholderTimeoutRef: TimerId = null;

  const callbackPlaceholderRef = (placeholderEl: HTMLElement | null) => {
    disconnectPlaceholderResizeObserver(
      placeholderResizeObserver,
      placeholderEl == null
    );

    if (placeholderEl == null) {
      EDITOR_TO_PLACEHOLDER_ELEMENT.delete(editor);
      merge.leaf.onPlaceholderResize?.(null);
    } else {
      EDITOR_TO_PLACEHOLDER_ELEMENT.set(editor, placeholderEl);

      if (!placeholderResizeObserver) {
        // Create a new observer and observe the placeholder element.
        const ResizeObserver = window.ResizeObserver || ResizeObserverPolyfill;
        placeholderResizeObserver = new ResizeObserver(() => {
          merge.leaf.onPlaceholderResize?.(placeholderEl);
        });
      }
      placeholderResizeObserver.observe(placeholderEl);
      placeholderRef = placeholderEl;
    }
  };

  createEffect(
    on([leafIsPlaceholder, showPlaceholder], () => {
      console.log("Is placeholder re-running", leafIsPlaceholder());
      if (leafIsPlaceholder()) {
        if (!showPlaceholderTimeoutRef) {
          // Delay the placeholder, so it will not render in a selection
          showPlaceholderTimeoutRef = setTimeout(() => {
            setShowPlaceholder(true);
            showPlaceholderTimeoutRef = null;
          }, PLACEHOLDER_DELAY);
        }
      } else {
        clearTimeoutRef(showPlaceholderTimeoutRef);
        setShowPlaceholder(false);
      }
      onCleanup(() => clearTimeoutRef(showPlaceholderTimeoutRef));
    })
  );

  const attributes = {
    "data-slate-leaf": true,
  };

  // const callbackRef = (el: HTMLElement | null) => {
  //   console.log("Running Leaf callback Ref")
  //   if (el) {
  //     el?.appendChild()
  //   } else {
  //     console.log("No EL")
  //   }
  // }

  return (
    <>
      <span {...attributes} style={styles()}>
        {/* {leafChildren()} */}
        <Show when={leafIsPlaceholder() && showPlaceholder()}>
          <DefaultLeaf
            attributes={{
              "data-slate-placeholder": true,
              style: {
                position: "absolute",
                top: 0,
                "pointer-events": "none",
                width: "100%",
                "max-width": "100%",
                display: "block",
                opacity: "0.333",
                "user-select": "none",
                "text-decoration": "none",
                // Fixes https://github.com/udecode/plate/issues/2315
                "-webkit-user-modify": IS_WEBKIT ? "inherit" : undefined,
              },
            }}
            contentEditable={false}
            ref={callbackPlaceholderRef}
          >
            {merge.leaf.placeholder}
          </DefaultLeaf>
        </Show>
        <String
          isLast={merge.isLast}
          leaf={merge.leaf}
          parent={merge.parent}
          text={merge.text}
          reactiveText={merge.reactiveText}
        />
      </span>
      {/* {merge.renderLeaf({
        attributes: {
          "data-slate-leaf": true,
        },
        children: (
          <Show
            when={leafIsPlaceholder() && showPlaceholder()}
            fallback={
              <String
                isLast={merge.isLast}
                leaf={merge.leaf}
                parent={merge.parent}
                text={merge.text}
              />
            }
          >
            {/* <p>Rendering</p> *}
            {merge.renderPlaceholder({
              children: merge.leaf.placeholder,
              attributes: {
                "data-slate-placeholder": true,
                style: {
                  position: "absolute",
                  top: 0,
                  "pointer-events": "none",
                  width: "100%",
                  "max-width": "100%",
                  display: "block",
                  opacity: "0.333",
                  "user-select": "none",
                  "text-decoration": "none",
                  // Fixes https://github.com/udecode/plate/issues/2315
                  "-webkit-user-modify": IS_WEBKIT ? "inherit" : undefined,
                },
                contentEditable: false,
                ref: callbackPlaceholderRef,
              },
            })}
            <String
              isLast={merge.isLast}
              leaf={merge.leaf}
              parent={merge.parent}
              text={merge.text}
            />
          </Show>
        ),
        leaf: merge.leaf,
        text: merge.text,
      })} */}
    </>
  );
};

export const DefaultLeaf = (props: RenderLeafProps) => {
  return <span {...props.attributes}>{props.children}</span>;
};

export function TempLeaf(props: LeafProps) {
  // const attributes = {
  //   "data-slate-leaf": true,
  // };

  console.log("NEW TEMP Leaf");

  createEffect(() => {
    console.log("Re-rending TEMP LEAF: ", props.reactiveText.text);
  });

  const children = (
    <String
      isLast={props.isLast}
      leaf={props.leaf}
      parent={props.parent}
      text={props.text}
      reactiveText={props.reactiveText}
    />
    // <span
    //   data-slate-string="true"
    //   innerText={props.reactiveText.text ?? ""}
    // ></span>
  );

  return (
    <span data-slate-leaf={true}>
      <Switch fallback={children}>
        <Match when={props.leaf.bold}>
          <strong>{children}</strong>
        </Match>
        <Match when={props.leaf.code}>
          <code>{children}</code>
        </Match>
        <Match when={props.leaf.italic}>
          <em>{children}</em>
        </Match>
        <Match when={props.leaf.underline}>
          <u>{children}</u>
        </Match>
      </Switch>
    </span>
  );
}

export default Leaf;
