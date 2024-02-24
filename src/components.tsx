import { JSX, ParentProps, splitProps } from "solid-js";
import { Portal } from "solid-js/web";
import { cx, css } from "@emotion/css";

interface BaseProps {
	class?: string;
	[key: string]: unknown;
}
type OrNull<T> = T | null;

export const Button = (
	props: ParentProps<
		{
			active: boolean;
			reversed?: boolean;
			ref?: HTMLSpanElement;
		} & BaseProps
	>
) => {
	const [local, attributes] = splitProps(props, ["class", "reversed", "active"]);
	return (
		<span
			{...attributes}
			ref={attributes?.ref}
			class={cx(
				local.class,
				css`
					cursor: pointer;
					color: ${local.reversed ? (local.active ? "white" : "#aaa") : local.active ? "black" : "#ccc"};
				`
			)}
		>
			{attributes.children}
		</span>
	);
};

export const EditorValue = (
	props: ParentProps<
		{
			value: any;
			ref?: HTMLDivElement;
		} & BaseProps
	>
) => {
	const [local, attributes] = splitProps(props, ["class", "value"]);

	// Beware any
	const textLines = () =>
		local.value.document.nodes
			.map((node: any) => node.text)
			.toArray()
			.join("\n");

	return (
		<div
			{...attributes}
			ref={attributes.ref}
			class={cx(
				local.class,
				css`
					margin: 30px -20px 0;
				`
			)}
		>
			<div
				class={css`
					font-size: 14px;
					padding: 5px 20px;
					color: #404040;
					border-top: 2px solid #eeeeee;
					background: #f8f8f8;
				`}
			>
				Slate's value as text
			</div>
			<div
				class={css`
					color: #404040;
					font: 12px monospace;
					white-space: pre-wrap;
					padding: 10px 20px;
					div {
						margin: 0 0 0.5em;
					}
				`}
			>
				{textLines()}
			</div>
			{/* Beware manual added-manually */}
			{attributes.children}
		</div>
	);
};

export const Icon = (props: ParentProps<{ ref?: HTMLSpanElement } & BaseProps>) => (
	<span
		{...props}
		ref={props?.ref}
		class={cx(
			"material-icons",
			props.class,
			css`
				font-size: 18px;
				vertical-align: text-bottom;
			`
		)}
	>
		{props.children}
	</span>
);

export const Instruction = (props: ParentProps<{ ref?: HTMLDivElement } & BaseProps>) => (
	<div
		{...props}
		ref={props.ref}
		class={cx(
			props.class,
			css`
				white-space: pre-wrap;
				margin: 0 -20px 10px;
				padding: 10px 20px;
				font-size: 14px;
				background: #f8f8e8;
			`
		)}
	>
		{props.children}
	</div>
);

export const Menu = (props: ParentProps<{ ref?: HTMLDivElement } & BaseProps>) => (
	<div
		{...props}
		data-test-id="menu"
		ref={props.ref}
		class={cx(
			props.class,
			css`
				& > * {
					display: inline-block;
				}

				& > * + * {
					margin-left: 15px;
				}
			`
		)}
	>
		{props.children}
	</div>
);

// export const Portal = (props: { children?: JSX.Element }) => {
// 	return typeof document === "object" ? <Portal>{props.children}</Portal> : null;
// };

export const Toolbar = (props: ParentProps<{ ref?: HTMLDivElement } & BaseProps>) => (
	<Menu
		{...props}
		ref={props.ref}
		class={cx(
			props.class,
			css`
				position: relative;
				padding: 1px 18px 17px;
				margin: 0 -20px;
				border-bottom: 2px solid #eee;
				margin-bottom: 20px;
			`
		)}
	/>
);

export const Wrapper = (props: BaseProps) => (
	<div
		{...props}
		class={cx(
			props.class,
			css`
				max-width: 42em;
				margin: 20px auto;
				padding: 20px;
			`
		)}
	/>
);

export const ExampleContent = (props: BaseProps) => (
	<Wrapper
		{...props}
		class={css`
			background: #fff;
		`}
	/>
);
