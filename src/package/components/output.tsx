import ElementComponent from "./element";
import TextComponent from "./text";
import { BaseElement, Editor, Range, Text as SlateText } from "slate";
import { SelectedContext } from "../hooks/use-selected";
import { useSlateStatic } from "../hooks/use-slate-static";
import { useDecorate } from "../hooks/use-decorate";
import {
  RenderElementProps,
  RenderLeafProps,
  RenderPlaceholderProps,
} from "./editable";
import { JSX } from "solid-js/jsx-runtime";
import { Element } from "slate";
import { NODE_TO_INDEX, NODE_TO_PARENT } from "../utils/weak-maps";
import {
  For,
  Match,
  Switch,
  createRenderEffect,
  createSignal,
  on,
  useContext,
} from "solid-js";
import Children from "./children";
import String from "./string";
import { Node } from "slate";
import { captureStoreUpdates, trackStore } from "@solid-primitives/deep";
import { ElementContext, useElementContext } from "../hooks/use-weakmaps";

interface OutputElementProps {
  index: number;
  parent: Element;
  n: BaseElement;
  reactive: any;
  path: number[];
  selection: Range | null;
  decorations: Range[];
  renderElement?: (props: RenderElementProps) => JSX.Element;
  renderPlaceholder: (props: RenderPlaceholderProps) => JSX.Element;
  renderLeaf?: (props: RenderLeafProps) => JSX.Element;
}

interface OutputTextProps {
  index: number;
  text: SlateText;
  reactive: any;
  isLast: boolean;
  parent: Element;
  path: number[];
  selection: Range | null;
  decorations: Range[];
  renderPlaceholder: (props: RenderPlaceholderProps) => JSX.Element;
  renderLeaf?: (props: RenderLeafProps) => JSX.Element;
}

export function OutputElement(props: OutputElementProps) {
  const editor = useSlateStatic();
  const decorate = useDecorate();

  const [sel, setSel] = createSignal<Selection>();
  const [ds, setDs] = createSignal<Range[]>([]);
  const storeUpdates = captureStoreUpdates(props.reactive);
  const elementContext = useContext(ElementContext);

  function setWeakmaps() {
    console.log("Setting Weakmaps using: ", props.n, props.index, props.parent);
    NODE_TO_INDEX.set(props.n, props.index);
    NODE_TO_PARENT.set(props.n, props.parent);

    try {
      // The purpose of this is to check if the Weakmaps for the parents have been set and if not, properly set them
      const test = props.path;
    } catch (error) {
      if (elementContext) {
        elementContext.setWeakmaps();
        console.log("Recursively setting Set Weakmaps from Child");
        console.log(error);
      } else {
        console.log("Not Recursive Setting: Is child of Root Node");
      }
    }
  }

  createRenderEffect(
    on(
      [
        () => {
          const updates = storeUpdates();
          console.log("Up Element: ", updates);
          return updates;
        },
      ],
      () => {
        // trackStore(props.reactive);
        console.log("Updating OutputElement Weakmaps: ", props.n, props.index);
        setWeakmaps();
        // Check if there is a way to make the OutputElement Effect run before the OutputText Effect so that you don't have to redefine the weakmap keys and values again in the Text effects
        // We need to loop through and set it in the element effect so that all the text nodes that are not changed will have an up-to-date reference in their weakmaps
        props.n.children.forEach((child, index) => {
          NODE_TO_INDEX.set(child, index);
          NODE_TO_PARENT.set(child, props.n);
        });
        // Maybe add an if-statement to check if the weakmaps are already set

        const range = Editor.range(editor, props.path);
        const sel =
          props.selection && Range.intersection(range, props.selection);
        console.log(props.selection, sel);
        setSel(sel);

        const ds = decorate()([props.n, props.path]);

        for (const dec of props.decorations) {
          const d = Range.intersection(dec, range);

          if (d) {
            ds.push(d);
          }
        }

        console.log("Decorations: ", ds);
        setDs(ds);
      }
    )
  );

  return (
    <ElementContext.Provider
      value={{
        setWeakmaps,
        // index: props.index,
        // node: props.n,
        // parent: props.parent,
      }}
    >
      <SelectedContext.Provider value={!!sel()}>
        <ElementComponent
          index={props.index}
          decorations={ds()}
          element={props.n}
          reactive={props.reactive}
          renderElement={props.renderElement}
          renderPlaceholder={props.renderPlaceholder}
          renderLeaf={props.renderLeaf}
          selection={sel()}
        />
      </SelectedContext.Provider>
    </ElementContext.Provider>
  );
}

export function OutputText(props: OutputTextProps) {
  const editor = useSlateStatic();
  const decorate = useDecorate();
  const [run, setRun] = createSignal(0);
  const elementContext = useElementContext();

  const [ds, setDs] = createSignal<Range[]>([]);
  const storeUpdates = captureStoreUpdates(props.reactive);

  createRenderEffect(
    on(
      [
        () => {
          const updates = storeUpdates();
          console.log("Up Text: ", updates);
          return updates.length;
        },
      ],
      () => {
        console.log(
          "Updating Text Weakmaps: ",
          props.text,
          props.index,
          props.parent
        );
        // console.log(
        //   "Updating Text Weakmaps",
        //   props.reactive,
        //   props.text,
        //   props.parent
        // );
        // console.log(props.parentIndex, run());
        // if (props.parentIndex && run() > 0) {
        //   console.log(path(), path().slice(0, -1));
        //   const parentParent = Node.parent(props.parent, path().slice(0, -1));
        //   console.log(props.parent, props.parentIndex, parentParent);
        //   NODE_TO_INDEX.set(props.parent, props.parentIndex);
        //   NODE_TO_PARENT.set(props.parent, parentParent);
        // }

        NODE_TO_INDEX.set(props.text, props.index);
        NODE_TO_PARENT.set(props.text, props.parent);
        try {
          // The purpose of this is to check if the Weakmaps for the parents have been set and if not, properly set them
          const test = props.path;
        } catch (error) {
          elementContext.setWeakmaps();
          console.log("Manually Set Weakmaps from Child");
          console.log(error);
        }

        const range = Editor.range(editor, props.path);

        const ds = decorate()([props.text, props.path]);

        for (const dec of props.decorations) {
          const d = Range.intersection(dec, range);

          if (d) {
            ds.push(d);
          }
        }

        setDs(ds);
      }
    )
  );

  return (
    <TextComponent
      decorations={ds()}
      reactive={props.reactive}
      isLast={props.isLast}
      parent={props.parent}
      renderPlaceholder={props.renderPlaceholder}
      renderLeaf={props.renderLeaf}
      text={props.text}
    />
  );
}

export function TempOutputElement(props: OutputElementProps) {
  const editor = useSlateStatic();
  const decorate = useDecorate();
  const style = () => ({ "text-align": props.n?.align || "" });

  const [sel, setSel] = createSignal<Selection | null>(null);
  const [ds, setDs] = createSignal<Range[]>([]);
  const storeUpdates = captureStoreUpdates(props.reactive);

  const renderElement = (props: any) => (
    <Switch fallback={"nothing matched"}>
      <Match when={props.element?.type === "block-quote"}>
        <blockquote style={style()} {...props.attributes()}>
          {props.children}
        </blockquote>
      </Match>
      <Match when={props.element?.type === "bulleted-list"}>
        <ul style={style()} {...props.attributes()}>
          {props.children}
        </ul>
      </Match>
      <Match when={props.element?.type === "heading-one"}>
        <h1 style={style()} {...props.attributes()}>
          {props.children}
        </h1>
      </Match>
      <Match when={props.element?.type === "heading-two"}>
        <h2 style={style()} {...props.attributes()}>
          {props.children}
        </h2>
      </Match>
      <Match when={props.element?.type === "list-item"}>
        <li style={style()} {...props.attributes()}>
          {props.children}
        </li>
      </Match>
      <Match when={props.element?.type === "numbered-list"}>
        <ol style={style()} {...props.attributes()}>
          {props.children}
        </ol>
      </Match>
      <Match when={props.element?.type}>
        <p style={style()} {...props.attributes()}>
          {props.children}
        </p>
      </Match>
    </Switch>
  );

  createRenderEffect(() => {
    const range = () => Editor.range(editor, props.path);
    const sel = setSel(
      props.selection && Range.intersection(range(), props.selection)
    );

    const ds = decorate()([props.n, props.path]);

    for (const dec of props.decorations) {
      const d = Range.intersection(dec, range());

      if (d) {
        ds.push(d);
      }
    }

    setDs(ds);
    NODE_TO_INDEX.set(props.n, props.index);
    NODE_TO_PARENT.set(props.n, props.parent);
  });

  const ref = (ref: HTMLElement | null) => {};

  const [attributes, setAttributes] = createSignal<{
    "data-slate-node": "element";
    "data-slate-void"?: true;
    "data-slate-inline"?: true;
    contentEditable?: false;
    dir?: "rtl";
    ref: any;
  }>({
    "data-slate-node": "element",
    ref,
  });
  console.log(props.n);

  const children = (
    <Children
      decorations={ds()}
      node={props.n}
      reactive={props.reactive}
      renderElement={props.renderElement}
      renderPlaceholder={props.renderPlaceholder}
      renderLeaf={props.renderLeaf}
      selection={sel()}
    />
  );

  return (
    <div class="">
      {/* {renderElement({
        attributes: attributes,
        children: children,
        element: props.n,
      })} */}
      <Switch>
        <Match when={props.n?.type === "block-quote"}>
          <blockquote style={style()} {...attributes()}>
            {children}
          </blockquote>
        </Match>
        <Match when={props.n?.type === "bulleted-list"}>
          <ul style={style()} {...attributes()}>
            {children}
          </ul>
        </Match>
        <Match when={props.n?.type === "heading-one"}>
          <h1 style={style()} {...attributes()}>
            {children}
          </h1>
        </Match>
        <Match when={props.n?.type === "heading-two"}>
          <h2 style={style()} {...attributes()}>
            {children}
          </h2>
        </Match>
        <Match when={props.n?.type === "list-item"}>
          <li style={style()} {...attributes()}>
            {children}
          </li>
        </Match>
        <Match when={props.n?.type === "numbered-list"}>
          <ol style={style()} {...attributes()}>
            {children}
          </ol>
        </Match>
        <Match when={props.n?.type}>
          <p style={style()} {...attributes()}>
            {children}
          </p>
        </Match>
      </Switch>
    </div>
  );
}

export function TempOutputText(props: OutputTextProps) {
  const editor = useSlateStatic();
  const decorate = useDecorate();
  const [ds, setDs] = createSignal<Range[]>([]);

  createRenderEffect(() => {
    console.log(
      "Updating Text Weakmaps",
      props.reactive.text,
      props.reactive,
      props.text,
      props.parent
    );

    const range = Editor.range(editor, props.path);
    const ds = decorate()([props.text, props.path]);

    for (const dec of props.decorations) {
      const d = Range.intersection(dec, range);

      if (d) {
        ds.push(d);
      }
    }

    NODE_TO_INDEX.set(props.text, props.index);
    NODE_TO_PARENT.set(props.text, props.parent);
  });

  const leaves = () => SlateText.decorations(props.text, ds());
  console.log(leaves(), props.text);

  const attributes = {
    "data-slate-leaf": true,
  };

  const children = (
    <For each={leaves()}>
      {(leaf) => (
        // <String
        //   isLast={props.isLast}
        //   leaf={leaf}
        //   parent={props.parent}
        //   text={props.text}
        // />
        <span
          data-slate-string="true"
          innerText={`${props.text?.text ?? ""}${props.isLast && leaf.text.slice(-1) === "\n" ? "\n" : ""}`}
        ></span>
      )}
    </For>
  );
  return (
    <For each={leaves()}>
      {(leaf) => (
        <span {...attributes}>
          <Switch fallback={children}>
            <Match when={leaf?.bold}>
              <strong>{children}</strong>
            </Match>
            <Match when={leaf?.code}>
              <code>{children}</code>
            </Match>
            <Match when={leaf?.italic}>
              <em>{children}</em>
            </Match>
            <Match when={leaf?.underline}>
              <u>{children}</u>
            </Match>
          </Switch>
        </span>
      )}
    </For>
  );
}

// We are looking for the element/text update that will make the TempOutput update store elements exactly as the normal Output
