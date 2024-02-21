import { Match, Switch, createEffect, createMemo, createRenderEffect, createSignal } from "solid-js";
import isHotkey from "is-hotkey";
import { Editable, withSolid, useSlate, Slate, SolidEditor } from "./package";
import { Editor, Transforms, createEditor, Descendant, Element as SlateElement, BaseSelection } from "slate";
import { createStore, unwrap } from "solid-js/store";
import { Button, Icon, Toolbar } from "./components";

const HOTKEYS = {
	"mod+b": "bold",
	"mod+i": "italic",
	"mod+u": "underline",
	"mod+`": "code",
};

const LIST_TYPES = ["numbered-list", "bulleted-list"];
const TEXT_ALIGN_TYPES = ["left", "center", "right", "justify"];

const App = () => {
	const renderElement = (props: any) => <Element {...props} />;
	const renderLeaf = (props: any) => <Leaf {...props} />;
	const staticEditor = createMemo(() => withSolid(createEditor()));
	const [editor, setEditor] = createStore(staticEditor());

	// console.log("Just created", editor);

	createEffect(() => console.log("Selection changed effect", editor.selection));
	createEffect(() => console.log("Children Changed effect", editor.children));

	function testFunc() {
		console.log("This is the editor: ", editor, unwrap(editor), unwrap(unwrap(editor)));
		// setEditor("selection", {
		// 	anchor: {
		// 		path: [3, 0],
		// 		offset: 24,
		// 	},
		// 	focus: {
		// 		path: [3, 0],
		// 		offset: 24,
		// 	},
		// });
	}

	function onEditorChange(children: Descendant[]) {
		setEditor("children", children);
	}

	function onEditorSelectionChange(selection?: BaseSelection) {
		console.log("Running onEditorSelectionChange", selection);
		if (!selection) {
			console.log("No Selection changes");
			return;
		}
		console.log(
			"New selection",
			selection
			// ?? {
			// 	anchor: {
			// 		path: [Math.round((Math.random() * 10) / 3), 0],
			// 		offset: Math.round(Math.random() * 10),
			// 	},
			// 	focus: {
			// 		path: [Math.round((Math.random() * 10) / 3), 0],
			// 		offset: Math.round(Math.random() * 10),
			// 	},
			// }
		);
		// setEditor((prev) => ({ ...prev, selection }));
		setEditor("selection", (prev) => ({ ...prev, ...selection }));
		// setEditor("selection", "anchor", "path", selection.anchor.path);
		// setEditor("selection", "anchor", "offset", selection.anchor.offset);
		// setEditor("selection", "focus", "path", selection.focus.path);
		// setEditor("selection", "focus", "offset", selection.focus.offset);
		console.log(editor);
	}

	return (
		<Slate
			editor={editor}
			setEditor={setEditor}
			initialValue={initialValue}
			onChange={onEditorChange}
			onSelectionChange={onEditorSelectionChange}
		>
			<Toolbar>
				<MarkButton format="bold" icon="format_bold" />
				<MarkButton format="italic" icon="format_italic" />
				<MarkButton format="underline" icon="format_underlined" />
				<MarkButton format="code" icon="code" />
				<BlockButton format="heading-one" icon="looks_one" />
				<BlockButton format="heading-two" icon="looks_two" />
				<BlockButton format="block-quote" icon="format_quote" />
				<BlockButton format="numbered-list" icon="format_list_numbered" />
				<BlockButton format="bulleted-list" icon="format_list_bulleted" />
				<BlockButton format="left" icon="format_align_left" />
				<BlockButton format="center" icon="format_align_center" />
				<BlockButton format="right" icon="format_align_right" />
				<BlockButton format="justify" icon="format_align_justify" />
			</Toolbar>
			<Editable
				renderElement={renderElement}
				renderLeaf={renderLeaf}
				placeholder="Enter some rich text…"
				spellcheck
				autofocus
				onKeyDown={(event) => {
					for (const hotkey in HOTKEYS) {
						if (isHotkey(hotkey, event as any)) {
							event.preventDefault();
							const mark = HOTKEYS[hotkey];
							toggleMark(editor, mark);
						}
					}
				}}
			/>
			<button onClick={testFunc}>Test Button</button>
		</Slate>
	);
};

const toggleBlock = (editor: SolidEditor, format: any) => {
	const isActive = isBlockActive(editor, format, TEXT_ALIGN_TYPES.includes(format) ? "align" : "type");
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
	const isActive = isMarkActive(editor, format);

	if (isActive) {
		Editor.removeMark(editor, format);
	} else {
		Editor.addMark(editor, format, true);
	}
};

const isBlockActive = (editor: SolidEditor, format: any, blockType = "type") => {
	if (!editor.selection) return false;

	const [match] = Array.from(
		Editor.nodes(editor, {
			at: Editor.unhangRange(editor, editor.selection),
			match: (n) => !Editor.isEditor(n) && SlateElement.isElement(n) && n[blockType] === format,
		})
	);

	return !!match;
};

const isMarkActive = (editor: SolidEditor, format: any) => {
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
	let [children, setChildren] = createSignal(props.children);

	createRenderEffect(() => {
		if (props.leaf.bold) {
			setChildren(<strong>{props.children}</strong>);
		}

		if (props.leaf.code) {
			setChildren(<code>{props.children}</code>);
		}

		if (props.leaf.italic) {
			setChildren(<em>{props.children}</em>);
		}

		if (props.leaf.underline) {
			setChildren(<u>{props.children}</u>);
		}
	});

	return <span {...props.attributes}>{children()}</span>;
};

const BlockButton = (props: { format: any; icon: any }) => {
	const [editor] = useSlate();
	return (
		<Button
			active={isBlockActive(editor, props.format, TEXT_ALIGN_TYPES.includes(props.format) ? "align" : "type")}
			onMouseDown={(event: MouseEvent) => {
				event.preventDefault();
				toggleBlock(editor, props.format);
			}}
		>
			<Icon>{props.icon}</Icon>
		</Button>
	);
};

const MarkButton = (props: { format: any; icon: any }) => {
	const [editor] = useSlate();
	return (
		<Button
			active={isMarkActive(editor, props.format)}
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

