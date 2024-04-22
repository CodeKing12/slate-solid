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
  Operation,
  Text,
  getDirtyPaths,
  Path,
  setSelection,
  Point,
  Range,
  NodeEntry,
  Node,
  Scrubber,
} from "slate";
import { createStore, produce, reconcile, unwrap } from "solid-js/store";
import { Button, ExampleContent, Icon, Toolbar } from "./components";
import { applyOperations } from "./package/utils/general";
import { cloneDeep, split } from "lodash";
import { getNode, getNodeLeaf, getNodeParent } from "./package/utils/helpers";
import { NODE_TO_INDEX, NODE_TO_PARENT } from "./package/utils/weak-maps";

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

// console.log = function () {};

const App = () => {
  const renderElement = (props: any) => <Element {...props} />;
  const renderLeaf = (props: any) => <Leaf {...props} />;
  // const dummyEditor = cloneDeep(createEditor());
  const editor = createMemo(() => withSolid(createEditor()));
  const testing = editor();
  const [store, setStore] = createStore<EditorStoreObj>({
    children: [],
    selection: null,
    version: 0,
  });

  // For debugging purposes
  // const randLetters = ["a", "b", "c", "d", "e", "f", "g", "h", "i"];

  function onEditorSelectionChange(selection: BaseSelection) {
    console.log("New Selection: ", selection);
    const root = SolidEditor.findDocumentOrShadowRoot(editor());
    const domSelection = root.getSelection();
    console.log("FROM APP: ", domSelection);
    batch(() => {
      setStore("selection", selection);
      setStore("version", (prev) => (prev += 1));
    });
  }

  createEffect(() => {
    console.log("OPERATION Updated Children: ", store.children);
  });

  const newNode = {
    type: "paragraph",
    children: [
      {
        text: "kokld",
      },
    ],
  };

  function onEditorChange(
    children: Descendant[],
    selection: BaseSelection,
    operations: Operation[]
  ) {
    console.log("Editor Change Called", operations, selection, children);
    batch(() => {
      console.log(
        "All Operations",
        operations,
        editor().children,
        editor().selection
      );
      for (let i = 0; i < operations.length; i++) {
        const operation = operations[i];
        setStore(
          produce((state) => {
            switch (operation.type) {
              case "insert_node": {
                const { path, node } = operation;
                const parent = getNodeParent(state, path);
                const index = path[path.length - 1];

                if (index > parent.children.length) {
                  throw new Error(
                    `Cannot apply an "insert_node" operation at path [${path}] because the destination is past the end of the node.`
                  );
                }

                parent.children.splice(index, 0, node);

                break;
              }

              case "split_node": {
                const { path, position, properties } = operation;

                if (path.length === 0) {
                  throw new Error(
                    `Cannot apply a "split_node" operation at path [${path}] because the root node cannot be split.`
                  );
                }

                const node = getNode(state, path);
                const parent = getNodeParent(state, path);
                const index = path[path.length - 1];
                let newNode: Descendant;
                console.log(node, parent);

                if (Text.isText(node)) {
                  const before = node.text.slice(0, position);
                  const after = node.text.slice(position);
                  node.text = before;
                  newNode = {
                    ...(properties as Partial<Text>),
                    text: after,
                  };
                } else {
                  const before = node.children.slice(0, position);
                  const after = node.children.slice(position);
                  node.children = before;

                  newNode = {
                    ...(properties as Partial<Element>),
                    children: after,
                  };
                }

                parent.children.splice(index + 1, 0, newNode);
                console.log(
                  "NoDE SPLIT COMPLETED: ",
                  cloneDeep(state.children)
                );

                break;
              }

              case "insert_text": {
                const { path, offset, text } = operation;
                if (text.length === 0) break;
                const node = getNodeLeaf(state, path);
                const before = node.text.slice(0, offset);
                const after = node.text.slice(offset);
                node.text = before + text + after;

                console.log(
                  "Completed Insert text: ",
                  state.children,
                  node,
                  parent
                );
                break;
              }

              case "set_node": {
                const { path, properties, newProperties } = operation;

                if (path.length === 0) {
                  throw new Error(`Cannot set properties on the root node!`);
                }

                const node = getNode(state, path);

                for (const key in newProperties) {
                  if (key === "children" || key === "text") {
                    throw new Error(
                      `Cannot set the "${key}" property of nodes!`
                    );
                  }

                  const value = newProperties[key];

                  if (value == null) {
                    delete node[key];
                  } else {
                    node[key] = value;
                  }
                }

                // properties that were previously defined, but are now missing, must be deleted
                for (const key in properties) {
                  if (!newProperties.hasOwnProperty(key)) {
                    delete node[key];
                  }
                }

                console.log("Done setting node: ", node);

                break;
              }

              case "move_node": {
                const { path, newPath } = operation;

                if (Path.isAncestor(path, newPath)) {
                  throw new Error(
                    `Cannot move a path [${path}] to new path [${newPath}] because the destination is inside itself.`
                  );
                }

                const node = getNode(state, path);
                const parent = getNodeParent(state, path);
                const index = path[path.length - 1];

                // This is tricky, but since the `path` and `newPath` both refer to
                // the same snapshot in time, there's a mismatch. After either
                // removing the original position, the second step's path can be out
                // of date. So instead of using the `op.newPath` directly, we
                // transform `op.path` to ascertain what the `newPath` would be after
                // the operation was applied.
                parent.children.splice(index, 1);
                const truePath = Path.transform(path, operation)!;
                const newParent = getNode(
                  state,
                  Path.parent(truePath)
                ) as Ancestor;
                const newIndex = truePath[truePath.length - 1];

                newParent.children.splice(newIndex, 0, node);

                break;
              }

              case "remove_node": {
                const { path } = operation;
                let { selection } = state;
                const index = path[path.length - 1];
                const parent = getNodeParent(state, path);
                parent.children.splice(index, 1);

                // Transform all the points in the value, but if the point was in the
                // node that was removed we need to update the range or remove it.
                if (selection) {
                  for (const [point, key] of Range.points(selection)) {
                    const result = Point.transform(point, operation);

                    if (selection != null && result != null) {
                      selection[key] = result;
                    } else {
                      let prev: NodeEntry<Text> | undefined;
                      let next: NodeEntry<Text> | undefined;

                      for (const [n, p] of Node.texts(state)) {
                        if (Path.compare(p, path) === -1) {
                          prev = [n, p];
                        } else {
                          next = [n, p];
                          break;
                        }
                      }

                      let preferNext = false;
                      if (prev && next) {
                        if (Path.equals(next[1], path)) {
                          preferNext = !Path.hasPrevious(next[1]);
                        } else {
                          preferNext =
                            Path.common(prev[1], path).length <
                            Path.common(next[1], path).length;
                        }
                      }

                      if (prev && !preferNext) {
                        point.path = prev[1];
                        point.offset = prev[0].text.length;
                      } else if (next) {
                        point.path = next[1];
                        point.offset = 0;
                      } else {
                        selection = null;
                      }
                    }
                  }
                }

                break;
              }

              case "remove_text": {
                const { path, offset, text } = operation;
                if (text.length === 0) break;
                const node = getNodeLeaf(state, path);
                const before = node.text.slice(0, offset);
                const after = node.text.slice(offset + text.length);
                node.text = before + after;

                break;
              }

              case "merge_node": {
                const { path } = operation;
                const node = getNode(state, path);
                const prevPath = Path.previous(path);
                const prev = getNode(state, prevPath);
                const parent = getNodeParent(state, path);
                const index = path[path.length - 1];
                console.log("Merge 1: ", node, path);
                console.log("Merge 2: ", prev, prevPath);
                console.log("Merge 3: ", parent, index);
                console.log(Text.isText(node), Text.isText(prev));

                if (Text.isText(node) && Text.isText(prev)) {
                  prev.text += node.text;
                } else if (!Text.isText(node) && !Text.isText(prev)) {
                  prev.children.push(...node.children);
                } else {
                  throw new Error(
                    `Cannot apply a "merge_node" operation at path [${path}] to nodes of different interfaces: ${Scrubber.stringify(
                      node
                    )} ${Scrubber.stringify(prev)}`
                  );
                }

                parent.children.splice(index, 1);
                console.log(
                  "After Merge Node: ",
                  node,
                  index,
                  parent,
                  prev,
                  prevPath
                );

                break;
              }

              case "set_selection": {
                console.log("Operation setSelection: ", selection);
                state.selection = selection;
                break;
              }
            }
          })
        );
      }
      setStore("version", (prev) => (prev += 1));

      console.log("Running Weakmap Updates");
      // This fixes the bug where selection is abnormal because the index of these elements are changed but the
      // weakmaps are not set because the effect in OutputElement is not called
      editor().children.forEach((n, index) => {
        if (SlateElement.isElement(n)) {
          console.log("Updating Element Weakmaps", n, index, editor());
          NODE_TO_INDEX.set(n, index);
          NODE_TO_PARENT.set(n, editor());
        }
      });
    });
  }

  function runMe() {
    Transforms.insertNodes(
      editor(),
      {
        type: "paragraph",
        children: [
          {
            text: "kokld - " + store.children.length,
          },
        ],
      },
      {
        at: [1],
      }
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
    TEXT_ALIGN_TYPES.includes(format) ? "align" : "type"
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
  blockType = "type"
) => {
  if (!editor.selection) return false;

  const [match] = Array.from(
    Editor.nodes(editor, {
      at: Editor.unhangRange(editor, editor.selection),
      match: (n) =>
        !Editor.isEditor(n) &&
        SlateElement.isElement(n) &&
        n[blockType] === format,
    })
  );

  return !!match;
};

const isMarkActive = (
  editor: SolidEditor,
  reactive: number | null,
  format: any
) => {
  const marks = Editor.marks(editor);
  return marks ? marks[format] === true : false;
};

export const Element = (props: {
  attributes: any;
  children: any;
  element: any;
}) => {
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

export const Leaf = (props: { attributes: any; children: any; leaf: any }) => {
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
        TEXT_ALIGN_TYPES.includes(props.format) ? "align" : "type"
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

const updatedData = [
  {
    type: "paragraph",
    children: [
      {
        text: "This is editable ",
      },
      {
        text: "rich",
        bold: true,
      },
      {
        text: " text, ",
      },
      {
        text: "much",
        italic: true,
      },
      {
        text: " better than a ",
      },
      {
        text: "<textarea>",
        code: true,
      },
      {
        text: "!",
      },
    ],
  },
  {
    type: "paragraph",
    children: [
      {
        text: "Since it's rich text, you can do things like turn a selection of text ",
      },
      {
        text: "bold",
        bold: true,
      },
      {
        text: ", or add a semantically rendered block quote in the middle of the page, like this:",
      },
    ],
  },
  {
    type: "paragraph",
    children: [
      {
        text: "",
      },
    ],
  },
  {
    type: "block-quote",
    children: [
      {
        text: "A wise quote.",
      },
    ],
  },
  {
    type: "paragraph",
    align: "center",
    children: [
      {
        text: "Try it out for yourself!",
      },
    ],
  },
];

export default App;
