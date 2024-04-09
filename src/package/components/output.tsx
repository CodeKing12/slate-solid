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
import { createEffect, createRenderEffect, onMount } from "solid-js";

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

  const range = () => Editor.range(editor, props.path);
  const sel = () =>
    props.selection && Range.intersection(range(), props.selection);

  const ds = () => {
    const ds = decorate()([props.n, props.path]);

    for (const dec of props.decorations) {
      const d = Range.intersection(dec, range());

      if (d) {
        ds.push(d);
      }
    }

    return ds;
  };

  createRenderEffect(() => {
    NODE_TO_INDEX.set(props.n, props.index);
    NODE_TO_PARENT.set(props.n, props.parent);
  });

  return (
    <SelectedContext.Provider value={!!sel()}>
      <ElementComponent
        decorations={ds()}
        element={props.n}
        reactive={props.reactive}
        renderElement={props.renderElement}
        renderPlaceholder={props.renderPlaceholder}
        renderLeaf={props.renderLeaf}
        selection={sel()}
      />
    </SelectedContext.Provider>
  );
}

export function OutputText(props: OutputTextProps) {
  const editor = useSlateStatic();
  const decorate = useDecorate();

  const range = () => Editor.range(editor, props.path);
  const ds = () => {
    const ds = decorate()([props.text, props.path]);

    for (const dec of props.decorations) {
      const d = Range.intersection(dec, range());

      if (d) {
        ds.push(d);
      }
    }

    return ds;
  };

  createRenderEffect(() => {
    NODE_TO_INDEX.set(props.text, props.index);
    NODE_TO_PARENT.set(props.text, props.parent);
  });

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
