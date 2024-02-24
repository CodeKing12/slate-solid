import { Match, Switch, createRenderEffect, createSignal, mergeProps } from "solid-js";
import { Editor, Text, Path, Element, Node } from "slate";
import { SolidEditor } from "../plugin/solid-editor";
import { useSlateStatic } from "../hooks/use-slate-static";
import { useIsomorphicLayoutEffect } from "../hooks/use-isomorphic-layout-effect";
import { IS_ANDROID } from "../utils/environment";
import { MARK_PLACEHOLDER_SYMBOL } from "../utils/weak-maps";

/**
 * Leaf content strings.
 */

const String = (props: { isLast: boolean; leaf: Text; parent: Element; text: Text }) => {
	const editor = useSlateStatic();
	const path = () => SolidEditor.findPath(editor, props.text);
	const parentPath = () => Path.parent(path());
	const isMarkPlaceholder = () => Boolean(props.leaf[MARK_PLACEHOLDER_SYMBOL]);

	const isLastNodeInEmptyBlock = () =>
		props.leaf.text === "" &&
		props.parent.children[props.parent.children.length - 1] === props.text &&
		!editor.isInline(props.parent) &&
		Editor.string(editor, parentPath()) === "";

	return (
		<>
			<Switch fallback={<TextString text={props.leaf.text} />}>
				<Match when={editor.isVoid(props.parent)}>
					{/* COMPAT: Render text inside void nodes with a zero-width space. So the node can contain
					selection but the text is not visible. */}
					<ZeroWidthString length={Node.string(props.parent).length} />
				</Match>
				<Match when={isLastNodeInEmptyBlock()}>
					{/* COMPAT: If this is the last text node in an empty block, render a zero-width space that will
					convert into a line break when copying and pasting // to support expected plain text. */}
					<ZeroWidthString isLineBreak isMarkPlaceholder={isMarkPlaceholder()} />
				</Match>
				<Match when={props.leaf.text === ""}>
					{/* COMPAT: If the text is empty, it's because it's on the edge of an inline
					node, so we render a zero-width space so that the selection can be
					inserted next to it still. */}
					<ZeroWidthString isMarkPlaceholder={isMarkPlaceholder()} />
				</Match>
				<Match when={props.isLast && props.leaf.text.slice(-1) === "\n"}>
					{/* COMPAT: Browsers will collapse trailing new lines at the end of blocks,
					so we need to add an extra trailing new lines to prevent that. */}
					<TextString isTrailing text={props.leaf.text} />
				</Match>
			</Switch>
		</>
	);
};

/**
 * Leaf strings with text in them.
 */
const TextString = (props: { text: string; isTrailing?: boolean }) => {
	const merge = mergeProps(
		{
			isTrailing: false,
		},
		props
	);
	let ref: HTMLSpanElement | undefined;

	return (
		<span
			data-slate-string="true"
			ref={ref}
			innerText={`${merge.text ?? ""}${merge.isTrailing ? "\n" : ""}`}
		></span>
	);
};

/**
 * Leaf strings without text, render as zero-width strings.
 */

export const ZeroWidthString = (props: { length?: number; isLineBreak?: boolean; isMarkPlaceholder?: boolean }) => {
	const merge = mergeProps(
		{
			length: 0,
			isLineBreak: false,
			isMarkPlaceholder: false,
		},
		props
	);

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

