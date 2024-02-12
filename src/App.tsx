import { createMemo, onMount } from "solid-js";
import isHotkey from "is-hotkey";
import { Editable, withSolid, useSlate, Slate } from "./package";
import { Editor, Transforms, createEditor, Descendant, Element as SlateElement } from "slate";

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
	const editor = createMemo(() => withSolid(createEditor()));
	console.log(editor());

	onMount(() => {
		const channel = new BroadcastChannel("debug");
		channel.addEventListener("message", (e) => console.log(e));
	});

	return (
		<Slate editor={editor()} initialValue={initialValue}>
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
							toggleMark(editor(), mark);
						}
					}
				}}
			/>
		</Slate>
	);
};

const toggleBlock = (editor: any, format: any) => {
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

const isBlockActive = (editor: any, format: any, blockType = "type") => {
	if (!editor.selection) return false;

	const [match] = Array.from(
		Editor.nodes(editor, {
			at: Editor.unhangRange(editor, editor.selection),
			match: (n) => !Editor.isEditor(n) && SlateElement.isElement(n) && n[blockType] === format,
		})
	);

	return !!match;
};

const isMarkActive = (editor: any, format: any) => {
	const marks = Editor.marks(editor);
	return marks ? marks[format] === true : false;
};

const Element = (props: { attributes: any; children: any; element: any }) => {
	const style = { textAlign: props.element.align };
	switch (props.element.type) {
		case "block-quote":
			return (
				<blockquote style={style} {...props.attributes}>
					{props.children}
				</blockquote>
			);
		case "bulleted-list":
			return (
				<ul style={style} {...props.attributes}>
					{props.children}
				</ul>
			);
		case "heading-one":
			return (
				<h1 style={style} {...props.attributes}>
					{props.children}
				</h1>
			);
		case "heading-two":
			return (
				<h2 style={style} {...props.attributes}>
					{props.children}
				</h2>
			);
		case "list-item":
			return (
				<li style={style} {...props.attributes}>
					{props.children}
				</li>
			);
		case "numbered-list":
			return (
				<ol style={style} {...props.attributes}>
					{props.children}
				</ol>
			);
		default:
			return (
				<p style={style} {...props.attributes}>
					{props.children}
				</p>
			);
	}
};

const Leaf = (props: { attributes: any; children: any; leaf: any }) => {
	let children = props.children;

	if (props.leaf.bold) {
		children = <strong>{props.children}</strong>;
	}

	if (props.leaf.code) {
		children = <code>{props.children}</code>;
	}

	if (props.leaf.italic) {
		children = <em>{props.children}</em>;
	}

	if (props.leaf.underline) {
		children = <u>{props.children}</u>;
	}

	return <span {...props.attributes}>{children}</span>;
};

const BlockButton = (props: { format: any; icon: any }) => {
	const editor = useSlate();
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
	const editor = useSlate();
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

