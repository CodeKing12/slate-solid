import { Match, Switch, batch, createEffect, createMemo } from "solid-js";
import isHotkey from "is-hotkey";
import { Editable, withSolid, useSlate, Slate, SolidEditor } from "./package";
import {
  Editor,
  Transforms,
  createEditor,
  Descendant,
  Element as SlateElement,
  BaseSelection,
} from "slate";
import { createStore } from "solid-js/store";
import { Button, ExampleContent, Icon, Toolbar } from "./components";

const HOTKEYS = {
  "mod+b": "bold",
  "mod+i": "italic",
  "mod+u": "underline",
  "mod+`": "code",
};

const LIST_TYPES = ["numbered-list", "bulleted-list"];
const TEXT_ALIGN_TYPES = ["left", "center", "right", "justify"];
export type EditorStoreObj = {
  children: Descendant[];
  selection: BaseSelection | null;
  version: number;
};

const App = () => {
  const renderElement = (props: any) => <Element {...props} />;
  const renderLeaf = (props: any) => <Leaf {...props} />;
  const editor = createMemo(() => withSolid(createEditor()));
  const [store, setStore] = createStore<EditorStoreObj>({
    children: [],
    selection: null,
    version: 0,
  });

  // For debugging purposes
  // const randLetters = ["a", "b", "c", "d", "e", "f", "g", "h", "i"];

  function onEditorSelectionChange(selection: BaseSelection) {
    batch(() => {
      setStore("selection", selection);
      setStore("version", (prev) => (prev += 1));
    });
  }

  function onEditorChange(children: Descendant[]) {
    batch(() => {
      setStore("children", children);
      setStore("version", (prev) => (prev += 1));
    });
  }

  function runMe() {
    console.log(
      "The Key: ",
      SolidEditor.findKey(editor(), editor().children?.[3]),
      editor().children?.[3],
    );

    Transforms.insertText(
      editor(),
      "abcdefghi"[Math.round(Math.random() * 10)],
      {
        at: [3, 0],
      },
    );

    console.log(
      "The Key: ",
      SolidEditor.findKey(editor(), editor().children?.[3]),
      editor().children?.[3],
    );
  }

  return (
    <ExampleContent>
      <Slate
        editor={editor}
        initialValue={initialValue}
        onValueChange={onEditorChange}
        onSelectionChange={onEditorSelectionChange}
      >
        <Toolbar>
          <MarkButton
            subscribe={store.version}
            format="bold"
            icon="format_bold"
          />
          <MarkButton
            subscribe={store.version}
            format="italic"
            icon="format_italic"
          />
          <MarkButton
            subscribe={store.version}
            format="underline"
            icon="format_underlined"
          />
          <MarkButton subscribe={store.version} format="code" icon="code" />
          <BlockButton
            subscribe={store.version}
            format="heading-one"
            icon="looks_one"
          />
          <BlockButton
            subscribe={store.version}
            format="heading-two"
            icon="looks_two"
          />
          <BlockButton
            subscribe={store.version}
            format="block-quote"
            icon="format_quote"
          />
          <BlockButton
            subscribe={store.version}
            format="numbered-list"
            icon="format_list_numbered"
          />
          <BlockButton
            subscribe={store.version}
            format="bulleted-list"
            icon="format_list_bulleted"
          />
          <BlockButton
            subscribe={store.version}
            format="left"
            icon="format_align_left"
          />
          <BlockButton
            subscribe={store.version}
            format="center"
            icon="format_align_center"
          />
          <BlockButton
            subscribe={store.version}
            format="right"
            icon="format_align_right"
          />
          <BlockButton
            subscribe={store.version}
            format="justify"
            icon="format_align_justify"
          />
        </Toolbar>
        <Editable
          renderElement={renderElement}
          renderLeaf={renderLeaf}
          reactive={store}
          placeholder="Enter some rich text…"
          spellcheck
          autofocus
          onKeyDown={(event) => {
            for (const hotkey in HOTKEYS) {
              if (isHotkey(hotkey, event as any)) {
                event.preventDefault();
                const mark = HOTKEYS[hotkey];
                toggleMark(editor(), mark);
              }
            }
          }}
        />
        <button onclick={runMe}>Test References</button>
      </Slate>
    </ExampleContent>
  );
};

const toggleBlock = (editor: SolidEditor, format: any) => {
  const isActive = isBlockActive(
    editor,
    null,
    format,
    TEXT_ALIGN_TYPES.includes(format) ? "align" : "type",
  );
  const isList = LIST_TYPES.includes(format);

  Transforms.unwrapNodes(editor, {
    match: (n) =>
      !Editor.isEditor(n) &&
      SlateElement.isElement(n) &&
      LIST_TYPES.includes(n.type) &&
      !TEXT_ALIGN_TYPES.includes(format),
    split: true,
  });
  let newProperties: Partial<SlateElement>;
  if (TEXT_ALIGN_TYPES.includes(format)) {
    newProperties = {
      align: isActive ? undefined : format,
    };
  } else {
    newProperties = {
      type: isActive ? "paragraph" : isList ? "list-item" : format,
    };
  }
  Transforms.setNodes<SlateElement>(editor, newProperties);

  if (!isActive && isList) {
    const block = { type: format, children: [] };
    Transforms.wrapNodes(editor, block);
  }
};

const toggleMark = (editor: any, format: any) => {
  const isActive = isMarkActive(editor, null, format);

  if (isActive) {
    Editor.removeMark(editor, format);
  } else {
    Editor.addMark(editor, format, true);
  }
};

const isBlockActive = (
  editor: SolidEditor,
  reactive: number | null,
  format: any,
  blockType = "type",
) => {
  if (!editor.selection) return false;

  const [match] = Array.from(
    Editor.nodes(editor, {
      at: Editor.unhangRange(editor, editor.selection),
      match: (n) =>
        !Editor.isEditor(n) &&
        SlateElement.isElement(n) &&
        n[blockType] === format,
    }),
  );

  return !!match;
};

const isMarkActive = (
  editor: SolidEditor,
  reactive: number | null,
  format: any,
) => {
  const marks = Editor.marks(editor);
  return marks ? marks[format] === true : false;
};

const Element = (props: { attributes: any; children: any; element: any }) => {
  const style = () => ({ "text-align": props.element.align });

  return (
    <Switch>
      <Match when={props.element.type === "block-quote"}>
        <blockquote style={style()} {...props.attributes}>
          {props.children}
        </blockquote>
      </Match>
      <Match when={props.element.type === "bulleted-list"}>
        <ul style={style()} {...props.attributes}>
          {props.children}
        </ul>
      </Match>
      <Match when={props.element.type === "heading-one"}>
        <h1 style={style()} {...props.attributes}>
          {props.children}
        </h1>
      </Match>
      <Match when={props.element.type === "heading-two"}>
        <h2 style={style()} {...props.attributes}>
          {props.children}
        </h2>
      </Match>
      <Match when={props.element.type === "list-item"}>
        <li style={style()} {...props.attributes}>
          {props.children}
        </li>
      </Match>
      <Match when={props.element.type === "numbered-list"}>
        <ol style={style()} {...props.attributes}>
          {props.children}
        </ol>
      </Match>
      <Match when={props.element.type}>
        <p style={style()} {...props.attributes}>
          {props.children}
        </p>
      </Match>
    </Switch>
  );
};

const Leaf = (props: { attributes: any; children: any; leaf: any }) => {
  return (
    <span {...props.attributes}>
      <Switch fallback={props.children}>
        <Match when={props.leaf.bold}>
          <strong>{props.children}</strong>
        </Match>
        <Match when={props.leaf.code}>
          <code>{props.children}</code>
        </Match>
        <Match when={props.leaf.italic}>
          <em>{props.children}</em>
        </Match>
        <Match when={props.leaf.underline}>
          <u>{props.children}</u>
        </Match>
      </Switch>
    </span>
  );
};

const BlockButton = (props: { format: any; icon: any; subscribe: number }) => {
  const editor = useSlate();

  return (
    <Button
      active={isBlockActive(
        editor,
        props.subscribe,
        props.format,
        TEXT_ALIGN_TYPES.includes(props.format) ? "align" : "type",
      )}
      onMouseDown={(event: MouseEvent) => {
        event.preventDefault();
        toggleBlock(editor, props.format);
      }}
    >
      <Icon>{props.icon}</Icon>
    </Button>
  );
};

const MarkButton = (props: { format: any; icon: any; subscribe: number }) => {
  const editor = useSlate();

  return (
    <Button
      active={isMarkActive(editor, props.subscribe, props.format)}
      onMouseDown={(event: MouseEvent) => {
        event.preventDefault();
        toggleMark(editor, props.format);
      }}
    >
      <Icon>{props.icon}</Icon>
    </Button>
  );
};

const initialValue: Descendant[] = [
  {
    type: "paragraph",
    children: [
      { text: "This is editable " },
      { text: "rich", bold: true },
      { text: " text, " },
      { text: "much", italic: true },
      { text: " better than a " },
      { text: "<textarea>", code: true },
      { text: "!" },
    ],
  },
  {
    type: "paragraph",
    children: [
      {
        text: "Since it's rich text, you can do things like turn a selection of text ",
      },
      { text: "bold", bold: true },
      {
        text: ", or add a semantically rendered block quote in the middle of the page, like this:",
      },
    ],
  },
  {
    type: "block-quote",
    children: [{ text: "A wise quote." }],
  },
  {
    type: "paragraph",
    align: "center",
    children: [{ text: "Try it out for yourself!" }],
  },
];

export default App;
