import getDirection from "direction";
import debounce from "lodash/debounce";
import throttle from "lodash/throttle";
import {
	createEffect,
	createMemo,
	createRenderEffect,
	createSignal,
	JSX,
	mergeProps,
	onCleanup,
	onMount,
	splitProps,
	ValidComponent,
} from "solid-js";
import { createReducer } from "@solid-primitives/memo";
import scrollIntoView from "scroll-into-view-if-needed";
import { Editor, Element, Node, NodeEntry, Path, Range, Text, Transforms } from "slate";
import { useAndroidInputManager } from "../hooks/android-input-manager/use-android-input-manager";
import useChildren from "../hooks/use-children";
import { DecorateContext } from "../hooks/use-decorate";
import { useIsomorphicLayoutEffect } from "../hooks/use-isomorphic-layout-effect";
import { ReadOnlyContext } from "../hooks/use-read-only";
import { useSlate } from "../hooks/use-slate";
import { useTrackUserInput } from "../hooks/use-track-user-input";
import { SolidEditor } from "../plugin/solid-editor";
import { TRIPLE_CLICK } from "../utils/constants";
import {
	DOMElement,
	DOMRange,
	DOMText,
	getDefaultView,
	isDOMElement,
	isDOMNode,
	isPlainTextOnlyPaste,
} from "../utils/dom";
import {
	CAN_USE_DOM,
	HAS_BEFORE_INPUT_SUPPORT,
	IS_ANDROID,
	IS_CHROME,
	IS_FIREFOX,
	IS_FIREFOX_LEGACY,
	IS_IOS,
	IS_WEBKIT,
	IS_UC_MOBILE,
	IS_WECHATBROWSER,
} from "../utils/environment";
import Hotkeys from "../utils/hotkeys";
import {
	EDITOR_TO_ELEMENT,
	EDITOR_TO_FORCE_RENDER,
	EDITOR_TO_PENDING_INSERTION_MARKS,
	EDITOR_TO_USER_MARKS,
	EDITOR_TO_USER_SELECTION,
	EDITOR_TO_WINDOW,
	ELEMENT_TO_NODE,
	IS_COMPOSING,
	IS_FOCUSED,
	IS_READ_ONLY,
	MARK_PLACEHOLDER_SYMBOL,
	NODE_TO_ELEMENT,
	PLACEHOLDER_SYMBOL,
} from "../utils/weak-maps";
import { RestoreDOM } from "./restore-dom/restore-dom";
import { AndroidInputManager } from "../hooks/android-input-manager/android-input-manager";
import { Dynamic } from "solid-js/web";
import { BaseElement } from "slate";

type DeferredOperation = () => void;
type EventTargets = { currentTarget: HTMLDivElement; target: DOMElement };

const Children = (props: Parameters<typeof useChildren>[0]) => <>{useChildren(props)}</>;

/**
 * `RenderElementProps` are passed to the `renderElement` handler.
 */

export interface RenderElementProps {
	children: any;
	element: Element;
	attributes: {
		"data-slate-node": "element";
		"data-slate-inline"?: true;
		"data-slate-void"?: true;
		dir?: "rtl";
		ref: any;
	};
}

/**
 * `RenderLeafProps` are passed to the `renderLeaf` handler.
 */

export interface RenderLeafProps {
	children: any;
	leaf: Text;
	text: Text;
	attributes: {
		"data-slate-leaf": true;
	};
}

/**
 * `EditableProps` are passed to the `<Editable>` component.
 */

export type EditableProps = {
	decorate?: (entry: NodeEntry) => Range[];
	onDOMBeforeInput?: (event: InputEvent) => void;
	placeholder?: string;
	readOnly?: boolean;
	role?: string;
	style?: JSX.CSSProperties;
	renderElement?: (props: RenderElementProps) => JSX.Element;
	renderLeaf?: (props: RenderLeafProps) => JSX.Element;
	renderPlaceholder?: (props: RenderPlaceholderProps) => JSX.Element;
	scrollSelectionIntoView?: (editor: SolidEditor, domRange: DOMRange) => void;
	as?: ValidComponent;
	disableDefaultStyles?: boolean;
} & JSX.IntrinsicElements["input"];

/**
 * Editable.
 */

export const Editable = (props: EditableProps) => {
	const defaultRenderPlaceholder = (props: RenderPlaceholderProps) => <DefaultPlaceholder {...props} />;
	// {
	// 	autoFocus,
	// 	decorate = defaultDecorate,
	// 	onDOMBeforeInput: propsOnDOMBeforeInput,
	// 	placeholder,
	// 	readOnly = false,
	// 	renderElement,
	// 	renderLeaf,
	// 	renderPlaceholder = defaultRenderPlaceholder,
	// 	scrollSelectionIntoView = defaultScrollSelectionIntoView,
	// 	style: userStyle = {},
	// 	as: Component = "div",
	// 	disableDefaultStyles = false,
	// 	...attributes
	// }
	const [local, attributes] = splitProps(props, [
		"autofocus",
		"decorate",
		"onDOMBeforeInput",
		"placeholder",
		"readOnly",
		"renderElement",
		"renderLeaf",
		"renderPlaceholder",
		"scrollSelectionIntoView",
		"style",
		"as",
		"disableDefaultStyles",
	]);
	const merged = mergeProps(
		{
			decorate: defaultDecorate,
			propsOnDOMBeforeInput: local.onDOMBeforeInput,
			readOnly: false,
			renderPlaceholder: defaultRenderPlaceholder,
			scrollSelectionIntoView: defaultScrollSelectionIntoView,
			userStyle: local.style ?? {},
			Component: local.as ?? "div",
			disableDefaultStyles: false,
		},
		local
	);
	const editor = useSlate();
	createEffect(() => console.log("Editor Updated: ", editor()));
	// Rerender editor() when composition status changed
	const [isComposing, setIsComposing] = createSignal(false);
	let ref: HTMLDivElement | null = null;
	const [deferredOperations, setDeferredOperations] = createSignal<DeferredOperation[]>([]);
	const [placeholderHeight, setPlaceholderHeight] = createSignal<number | undefined>();

	const { onUserInput, receivedUserInput } = useTrackUserInput();

	const [, forceRender] = createReducer((s) => s + 1, 0);
	createRenderEffect(() => EDITOR_TO_FORCE_RENDER.set(editor(), forceRender));

	// Update internal state on each render.
	createRenderEffect(() => IS_READ_ONLY.set(editor(), merged.readOnly));

	// Keep track of some state for the event handler logic.
	const state = createMemo(() => ({
		isDraggingInternally: false,
		isUpdatingSelection: false,
		latestElement: null as DOMElement | null,
		hasMarkPlaceholder: false,
	}));

	// The autoFocus TextareaHTMLAttribute doesn't do anything on a div, so it
	// needs to be manually focused.
	createEffect(() => {
		if (ref && merged.autofocus) {
			console.log("Focusing Div");
			ref.focus();
		}
	});

	/**
	 * The AndroidInputManager object has a cyclical dependency on onDOMSelectionChange
	 *
	 * It is defined as a reference to simplify hook dependencies and clarify that
	 * it needs to be initialized.
	 */
	let androidInputManagerRef: AndroidInputManager | null | undefined = undefined;

	// Listen on the native `selectionchange` event to be able to update any time
	// the selection changes. This is required because React's `onSelect` is leaky
	// and non-standard so it doesn't fire until after a selection has been
	// released. This causes issues in situations where another change happens
	// while a selection is being dragged.

	// Clones the Selection object (which is usually prone to changes while making use of it)
	const cloneSelection = (sel: any) => {
		const cloned: any = {};

		for (const p in sel) cloned[p] = sel[p];

		return cloned;
	};

	const onDOMSelectionChange = createMemo(
		() =>
			throttle(() => {
				console.log("Called this throttler");
				const androidInputManager = androidInputManagerRef;
				if (
					(IS_ANDROID || !SolidEditor.isComposing(editor())) &&
					(!state().isUpdatingSelection || androidInputManager?.isFlushing()) &&
					!state().isDraggingInternally
				) {
					const root = SolidEditor.findDocumentOrShadowRoot(editor());
					const el = SolidEditor.toDOMNode(editor(), editor());
					const domSelection = cloneSelection(root.getSelection());

					if (root.activeElement === el) {
						console.log("Running activeElement === el", root.activeElement, el);
						console.log(state().latestElement);
						state().latestElement = root.activeElement;
						console.log(state().latestElement);
						IS_FOCUSED.set(editor(), true);
					} else {
						IS_FOCUSED.delete(editor());
					}

					if (!domSelection) {
						return Transforms.deselect(editor());
					}

					const anchorNodeSelectable =
						SolidEditor.hasEditableTarget(editor(), domSelection.anchorNode) ||
						SolidEditor.isTargetInsideNonReadonlyVoid(editor(), domSelection.anchorNode);

					const focusNodeSelectable =
						SolidEditor.hasEditableTarget(editor(), domSelection.focusNode) ||
						SolidEditor.isTargetInsideNonReadonlyVoid(editor(), domSelection.focusNode);

					if (anchorNodeSelectable && focusNodeSelectable) {
						const range = SolidEditor.toSlateRange(editor(), domSelection, {
							exactMatch: false,
							suppressThrow: true,
						});

						if (range) {
							if (
								!SolidEditor.isComposing(editor()) &&
								!androidInputManager?.hasPendingChanges() &&
								!androidInputManager?.isFlushing()
							) {
								console.log("Selecting a point now", range, domSelection, root);
								Transforms.select(editor(), range);
							} else {
								androidInputManager?.handleUserSelect(range);
							}
						}
					}

					// Deselect the editor() if the dom selection is not selectable in readonly mode
					if (merged.readOnly && (!anchorNodeSelectable || !focusNodeSelectable)) {
						console.log("Ran deselector");
						Transforms.deselect(editor());
					}
				}
			}, 100),
		[editor(), merged.readOnly, state()]
	);

	const scheduleOnDOMSelectionChange = createMemo(() => debounce(onDOMSelectionChange(), 0), [onDOMSelectionChange]);

	androidInputManagerRef = useAndroidInputManager({
		node: ref,
		onDOMSelectionChange: onDOMSelectionChange(),
		scheduleOnDOMSelectionChange: scheduleOnDOMSelectionChange(),
	})?.();

	// Confirm that the "DOM Node" error occurs before the "Path Node" error.
	createEffect(() => {
		// Update element-related weak maps with the DOM element ref.
		let window;
		if (ref && (window = getDefaultView(ref))) {
			EDITOR_TO_WINDOW.set(editor(), window);
			EDITOR_TO_ELEMENT.set(editor(), ref);
			NODE_TO_ELEMENT.set(editor(), ref);
			ELEMENT_TO_NODE.set(ref, editor());
		} else {
			NODE_TO_ELEMENT.delete(editor());
		}
	});

	createEffect(() => {
		// Make sure the DOM selection state is in sync.
		const root = SolidEditor.findDocumentOrShadowRoot(editor());
		const domSelection = root.getSelection();

		if (!domSelection || !SolidEditor.isFocused(editor()) || androidInputManagerRef?.hasPendingAction()) {
			return;
		}

		const setDomSelection = (forceChange?: boolean) => {
			const hasDomSelection = domSelection.type !== "None";

			// If the DOM selection is properly unset, we're done.
			if (!editor().selection && !hasDomSelection) {
				return;
			}

			// Get anchorNode and focusNode
			const focusNode = domSelection.focusNode;
			let anchorNode;

			// COMPAT: In firefox the normal seletion way does not work
			// (https://github.com/ianstormtaylor/slate/pull/5486#issue-1820720223)
			if (IS_FIREFOX && domSelection.rangeCount > 1) {
				const firstRange = domSelection.getRangeAt(0);
				const lastRange = domSelection.getRangeAt(domSelection.rangeCount - 1);

				// Right to left
				if (firstRange.startContainer === focusNode) {
					anchorNode = lastRange.endContainer;
				} else {
					// Left to right
					anchorNode = firstRange.startContainer;
				}
			} else {
				anchorNode = domSelection.anchorNode;
			}

			// verify that the dom selection is in the editor()
			const editorElement = EDITOR_TO_ELEMENT.get(editor())!;
			let hasDomSelectionInEditor = false;
			if (editorElement.contains(anchorNode) && editorElement.contains(focusNode)) {
				hasDomSelectionInEditor = true;
			}

			// If the DOM selection is in the editor() and the editor() selection is already correct, we're done.
			if (hasDomSelection && hasDomSelectionInEditor && editor().selection && !forceChange) {
				const slateRange = SolidEditor.toSlateRange(editor(), domSelection, {
					exactMatch: true,

					// domSelection is not necessarily a valid Slate range
					// (e.g. when clicking on contentEditable:false element)
					suppressThrow: true,
				});

				if (slateRange && Range.equals(slateRange, editor().selection)) {
					if (!state().hasMarkPlaceholder) {
						return;
					}

					// Ensure selection is inside the mark placeholder
					if (anchorNode?.parentElement?.hasAttribute("data-slate-mark-placeholder")) {
						return;
					}
				}
			}

			// when <Editable/> is being controlled through external value
			// then its children might just change - DOM responds to it on its own
			// but Slate's value is not being updated through any operation
			// and thus it doesn't transform selection on its own
			if (editor().selection && !SolidEditor.hasRange(editor(), editor().selection)) {
				editor().selection = SolidEditor.toSlateRange(editor(), domSelection, {
					exactMatch: false,
					suppressThrow: true,
				});
				return;
			}

			// Otherwise the DOM selection is out of sync, so update it.
			state().isUpdatingSelection = true;

			const newDomRange: DOMRange | null =
				editor().selection && SolidEditor.toDOMRange(editor(), editor().selection);

			if (newDomRange) {
				if (SolidEditor.isComposing(editor()) && !IS_ANDROID) {
					domSelection.collapseToEnd();
				} else if (Range.isBackward(editor().selection!)) {
					domSelection.setBaseAndExtent(
						newDomRange.endContainer,
						newDomRange.endOffset,
						newDomRange.startContainer,
						newDomRange.startOffset
					);
				} else {
					domSelection.setBaseAndExtent(
						newDomRange.startContainer,
						newDomRange.startOffset,
						newDomRange.endContainer,
						newDomRange.endOffset
					);
				}
				merged.scrollSelectionIntoView(editor(), newDomRange);
			} else {
				domSelection.removeAllRanges();
			}

			return newDomRange;
		};

		// In firefox if there is more then 1 range and we call setDomSelection we remove the ability to select more cells in a table
		if (domSelection.rangeCount <= 1) {
			setDomSelection();
		}

		const ensureSelection = androidInputManagerRef?.isFlushing() === "action";

		if (!IS_ANDROID || !ensureSelection) {
			setTimeout(() => {
				state().isUpdatingSelection = false;
			});
			return;
		}

		let timeoutId: ReturnType<typeof setTimeout> | null = null;
		const animationFrameId = requestAnimationFrame(() => {
			if (ensureSelection) {
				const ensureDomSelection = (forceChange?: boolean) => {
					try {
						const el = SolidEditor.toDOMNode(editor(), editor());
						console.log("Focusing el");
						el.focus();

						setDomSelection(forceChange);
					} catch (e) {
						// Ignore, dom and state might be out of sync
					}
				};

				// Compat: Android IMEs try to force their selection by manually re-applying it even after we set it.
				// This essentially would make setting the slate selection during an update meaningless, so we force it
				// again here. We can't only do it in the setTimeout after the animation frame since that would cause a
				// visible flicker.
				ensureDomSelection();

				timeoutId = setTimeout(() => {
					// COMPAT: While setting the selection in an animation frame visually correctly sets the selection,
					// it doesn't update GBoards spellchecker state. We have to manually trigger a selection change after
					// the animation frame to ensure it displays the correct state.
					ensureDomSelection(true);
					state().isUpdatingSelection = false;
				});
			}
		});

		return () => {
			cancelAnimationFrame(animationFrameId);
			if (timeoutId) {
				clearTimeout(timeoutId);
			}
		};
	});

	// Listen on the native `beforeinput` event to get real "Level 2" events. This
	// is required because React's `beforeinput` is fake and never really attaches
	// to the real event sadly. (2019/11/01)
	// https://github.com/facebook/react/issues/11211
	const onDOMBeforeInput = (event: InputEvent) => {
		onUserInput();

		if (
			!merged.readOnly &&
			SolidEditor.hasEditableTarget(editor(), event.target) &&
			!isDOMEventHandled(event, merged.propsOnDOMBeforeInput)
		) {
			// COMPAT: BeforeInput events aren't cancelable on android, so we have to handle them differently using the android input manager.
			if (androidInputManagerRef) {
				return androidInputManagerRef.handleDOMBeforeInput(event);
			}

			// Some IMEs/Chrome extensions like e.g. Grammarly set the selection immediately before
			// triggering a `beforeinput` expecting the change to be applied to the immediately before
			// set selection.
			scheduleOnDOMSelectionChange().flush();
			onDOMSelectionChange().flush();

			const { inputType: type } = event;
			console.log("Running handler", type);
			const data = (event as any).dataTransfer || event.data || undefined;

			const isCompositionChange = type === "insertCompositionText" || type === "deleteCompositionText";

			// COMPAT: use composition change events as a hint to where we should insert
			// composition text if we aren't composing to work around https://github.com/ianstormtaylor/slate/issues/5038
			if (isCompositionChange && SolidEditor.isComposing(editor())) {
				return;
			}

			let native = false;
			if (
				type === "insertText" &&
				editor().selection &&
				Range.isCollapsed(editor().selection) &&
				// Only use native character insertion for single characters a-z or space for now.
				// Long-press events (hold a + press 4 = ä) to choose a special character otherwise
				// causes duplicate inserts.
				event.data &&
				event.data.length === 1 &&
				/[a-z ]/i.test(event.data) &&
				// Chrome has issues correctly editing the start of nodes: https://bugs.chromium.org/p/chromium/issues/detail?id=1249405
				// When there is an inline element, e.g. a link, and you select
				// right after it (the start of the next node).
				editor().selection.anchor.offset !== 0
			) {
				native = true;

				// Skip native if there are marks, as
				// `insertText` will insert a node, not just text.
				if (editor().marks) {
					native = false;
				}

				// Chrome also has issues correctly editing the end of anchor elements: https://bugs.chromium.org/p/chromium/issues/detail?id=1259100
				// Therefore we don't allow native events to insert text at the end of anchor nodes.

				const [node, offset] = SolidEditor.toDOMPoint(editor(), editor().selection.anchor);
				const anchorNode = node.parentElement?.closest("a");

				const window = SolidEditor.getWindow(editor());

				if (native && anchorNode && SolidEditor.hasDOMNode(editor(), anchorNode)) {
					// Find the last text node inside the anchor.
					const lastText = window?.document
						.createTreeWalker(anchorNode, NodeFilter.SHOW_TEXT)
						.lastChild() as DOMText | null;

					if (lastText === node && lastText.textContent?.length === offset) {
						native = false;
					}
				}

				// Chrome has issues with the presence of tab characters inside elements with whiteSpace = 'pre'
				// causing abnormal insert behavior: https://bugs.chromium.org/p/chromium/issues/detail?id=1219139
				if (
					native &&
					node.parentElement &&
					window?.getComputedStyle(node.parentElement)?.whiteSpace === "pre"
				) {
					const block = Editor.above(editor(), {
						at: editor().selection.anchor.path,
						match: (n) => Element.isElement(n) && Editor.isBlock(editor(), n),
					});

					if (block && Node.string(block[0]).includes("\t")) {
						native = false;
					}
				}
			}

			// COMPAT: For the deleting forward/backward input types we don't want
			// to change the selection because it is the range that will be deleted,
			// and those commands determine that for themselves.
			if (!type.startsWith("delete") || type.startsWith("deleteBy")) {
				const [targetRange] = (event as any).getTargetRanges();

				if (targetRange) {
					const range = SolidEditor.toSlateRange(editor(), targetRange, {
						exactMatch: false,
						suppressThrow: false,
					});

					if (!editor().selection || !Range.equals(editor().selection, range)) {
						native = false;

						const selectionRef =
							!isCompositionChange && editor().selection && Editor.rangeRef(editor(), editor().selection);

						console.log("manual-3");
						Transforms.select(editor(), range);

						if (selectionRef) {
							EDITOR_TO_USER_SELECTION.set(editor(), selectionRef);
						}
					}
				}
			}

			// Composition change types occur while a user is composing text and can't be
			// cancelled. Let them through and wait for the composition to end.
			if (isCompositionChange) {
				return;
			}

			if (!native) {
				event.preventDefault();
			}

			// COMPAT: If the selection is expanded, even if the command seems like
			// a delete forward/backward command it should delete the selection.
			if (editor().selection && Range.isExpanded(editor().selection) && type.startsWith("delete")) {
				const direction = type.endsWith("Backward") ? "backward" : "forward";
				Editor.deleteFragment(editor(), { direction });
				return;
			}

			switch (type) {
				case "deleteByComposition":
				case "deleteByCut":
				case "deleteByDrag": {
					Editor.deleteFragment(editor());
					break;
				}

				case "deleteContent":
				case "deleteContentForward": {
					Editor.deleteForward(editor());
					break;
				}

				case "deleteContentBackward": {
					Editor.deleteBackward(editor());
					break;
				}

				case "deleteEntireSoftLine": {
					Editor.deleteBackward(editor(), { unit: "line" });
					Editor.deleteForward(editor(), { unit: "line" });
					break;
				}

				case "deleteHardLineBackward": {
					Editor.deleteBackward(editor(), { unit: "block" });
					break;
				}

				case "deleteSoftLineBackward": {
					Editor.deleteBackward(editor(), { unit: "line" });
					break;
				}

				case "deleteHardLineForward": {
					Editor.deleteForward(editor(), { unit: "block" });
					break;
				}

				case "deleteSoftLineForward": {
					Editor.deleteForward(editor(), { unit: "line" });
					break;
				}

				case "deleteWordBackward": {
					Editor.deleteBackward(editor(), { unit: "word" });
					break;
				}

				case "deleteWordForward": {
					Editor.deleteForward(editor(), { unit: "word" });
					break;
				}

				case "insertLineBreak":
					Editor.insertSoftBreak(editor());
					break;

				case "insertParagraph": {
					Editor.insertBreak(editor());
					break;
				}

				case "insertFromComposition":
				case "insertFromDrop":
				case "insertFromPaste":
				case "insertFromYank":
				case "insertReplacementText":
				case "insertText": {
					if (type === "insertFromComposition") {
						// COMPAT: in Safari, `compositionend` is dispatched after the
						// `beforeinput` for "insertFromComposition". But if we wait for it
						// then we will abort because we're still composing and the selection
						// won't be updated properly.
						// https://www.w3.org/TR/input-events-2/
						if (SolidEditor.isComposing(editor())) {
							setIsComposing(false);
							IS_COMPOSING.set(editor(), false);
						}
					}

					// use a weak comparison instead of 'instanceof' to allow
					// programmatic access of paste events coming from external windows
					// like cypress where cy.window does not work realibly
					console.log("got here in inserttext: ", data, typeof data);
					if (data?.constructor.name === "DataTransfer") {
						SolidEditor.insertData(editor(), data);
					} else if (typeof data === "string") {
						// Only insertText operations use the native functionality, for now.
						// Potentially expand to single character deletes, as well.
						if (native) {
							console.log("Should do this");
							setDeferredOperations((prev) => [...prev, () => Editor.insertText(editor(), data)]);
						} else {
							console.log("Just insert text", editor(), data);
							Editor.insertText(editor(), data);
						}
					}

					break;
				}
			}

			// Restore the actual user section if nothing manually set it.
			const toRestore = EDITOR_TO_USER_SELECTION.get(editor())?.unref();
			EDITOR_TO_USER_SELECTION.delete(editor());

			if (toRestore && (!editor().selection || !Range.equals(editor().selection, toRestore))) {
				console.log("Selecting Transform toRestore");
				Transforms.select(editor(), toRestore);
			}
		}
	};

	const callbackRef = (node: HTMLDivElement | null) => {
		console.log("Callback Ref is called successfully");
		if (node == null) {
			onDOMSelectionChange().cancel();
			scheduleOnDOMSelectionChange().cancel();

			EDITOR_TO_ELEMENT.delete(editor());
			NODE_TO_ELEMENT.delete(editor());

			if (ref && HAS_BEFORE_INPUT_SUPPORT) {
				// @ts-expect-error The `beforeinput` event isn't recognized.
				ref.removeEventListener("beforeinput", onDOMBeforeInput);
			}
		} else {
			// Attach a native DOM event handler for `beforeinput` events, because React's
			// built-in `onBeforeInput` is actually a leaky polyfill that doesn't expose
			// real `beforeinput` events sadly... (2019/11/04)
			// https://github.com/facebook/react/issues/11211
			if (HAS_BEFORE_INPUT_SUPPORT) {
				// @ts-expect-error The `beforeinput` event isn't recognized.
				node.addEventListener("beforeinput", onDOMBeforeInput);
			}
		}

		ref = node;
	};

	// // Attach a native DOM event handler for `selectionchange`, because React's
	// // built-in `onSelect` handler doesn't fire for all selection changes. It's a
	// // leaky polyfill that only fires on keypresses or clicks. Instead, we want to
	// // fire for any change to the selection inside the editor(). (2019/11/04)
	// // https://github.com/facebook/react/issues/5785

	// // Beware effect, renderEffect, onMount
	onMount(() => {
		const window = SolidEditor.getWindow(editor());

		window.document.addEventListener("selectionchange", () => {
			console.log("Selection called");
			return scheduleOnDOMSelectionChange()();
		});
	});

	onCleanup(() => {
		window.document.removeEventListener("selectionchange", scheduleOnDOMSelectionChange);
	});

	const decorations = () => merged.decorate([editor(), []]);

	const showPlaceholder = () =>
		merged.placeholder &&
		editor().children.length === 1 &&
		Array.from(Node.texts(editor())).length === 1 &&
		Node.string(editor()) === "" &&
		!isComposing;

	const placeHolderResizeHandler = (placeholderEl: HTMLElement | null) => {
		if (placeholderEl && showPlaceholder()) {
			setPlaceholderHeight(placeholderEl.getBoundingClientRect()?.height);
		} else {
			setPlaceholderHeight(undefined);
		}
	};

	createRenderEffect(() => {
		if (showPlaceholder()) {
			const start = Editor.start(editor(), []);
			decorations().push({
				[PLACEHOLDER_SYMBOL]: true,
				placeholder: merged.placeholder,
				onPlaceholderResize: placeHolderResizeHandler,
				anchor: start,
				focus: start,
			});
		}
	});

	createRenderEffect(() => {
		state().hasMarkPlaceholder = false;
		if (editor().selection && Range.isCollapsed(editor().selection) && editor().marks) {
			const leaf = Node.leaf(editor(), editor().selection.anchor.path);
			const { text, ...rest } = leaf;

			// While marks isn't a 'complete' text, we can still use loose Text.equals
			// here which only compares marks anyway.
			if (!Text.equals(leaf, editor().marks as Text, { loose: true })) {
				state().hasMarkPlaceholder = true;

				const unset = Object.fromEntries(Object.keys(rest).map((mark) => [mark, null]));

				decorations().push({
					[MARK_PLACEHOLDER_SYMBOL]: true,
					...unset,
					...editor().marks,

					anchor: editor().selection.anchor,
					focus: editor().selection.anchor,
				});
			}
		}
	});

	// Update EDITOR_TO_MARK_PLACEHOLDER_MARKS in setTimeout useEffect to ensure we don't set it
	// before we receive the composition end event.
	createEffect(() => {
		setTimeout(() => {
			if (editor().selection) {
				const text = Node.leaf(editor(), editor().selection.anchor.path);

				// While marks isn't a 'complete' text, we can still use loose Text.equals
				// here which only compares marks anyway.
				if (editor().marks && !Text.equals(text, editor().marks as Text, { loose: true })) {
					EDITOR_TO_PENDING_INSERTION_MARKS.set(editor(), editor().marks);
					return;
				}
			}

			EDITOR_TO_PENDING_INSERTION_MARKS.delete(editor());
		});
	});

	const getReadOnly = () => merged.readOnly;
	const getDecorate = () => merged.decorate;

	return (
		<ReadOnlyContext.Provider value={getReadOnly}>
			<DecorateContext.Provider value={getDecorate}>
				<RestoreDOM node={ref} receivedUserInput={receivedUserInput}>
					<Dynamic
						component={merged.Component}
						role={merged.readOnly ? undefined : "textbox"}
						aria-multiline={merged.readOnly ? undefined : true}
						{...attributes}
						// COMPAT: Certain browsers don't support the `beforeinput` event, so we'd
						// have to use hacks to make these replacement-based features work.
						// For SSR situations HAS_BEFORE_INPUT_SUPPORT is false and results in prop
						// mismatch warning app moves to browser. Pass-through consumer props when
						// not CAN_USE_DOM (SSR) and default to falsy value
						spellCheck={HAS_BEFORE_INPUT_SUPPORT || !CAN_USE_DOM ? attributes.spellcheck : false}
						autoCorrect={HAS_BEFORE_INPUT_SUPPORT || !CAN_USE_DOM ? attributes.autocorrect : "false"}
						autoCapitalize={HAS_BEFORE_INPUT_SUPPORT || !CAN_USE_DOM ? attributes.autocapitalize : "false"}
						data-slate-editor
						data-slate-node="value"
						// explicitly set this
						contentEditable={!merged.readOnly}
						// in some cases, a decoration needs access to the range / selection to decorate a text node,
						// then you will select the whole text node when you select part the of text
						// this magic zIndex="-1" will fix it
						zindex={-1}
						suppressContentEditableWarning
						ref={callbackRef}
						style={{
							...(merged.disableDefaultStyles
								? {}
								: {
										// Allow positioning relative to the editable element.
										position: "relative",
										// Preserve adjacent whitespace and new lines.
										"white-space": "pre-wrap",
										// Allow words to break if they are too long.
										"word-wrap": "break-word",
										// Make the minimum height that of the placeholder.
										...(placeholderHeight() ? { "min-height": placeholderHeight() } : {}),
								  }),
							// Allow for passed-in styles to override anything.
							...merged.userStyle,
						}}
						onBeforeInput={(event: InputEvent) => {
							// COMPAT: Certain browsers don't support the `beforeinput` event, so we
							// fall back to React's leaky polyfill instead just for it. It
							// only works for the `insertText` input type.
							if (
								!HAS_BEFORE_INPUT_SUPPORT &&
								!merged.readOnly &&
								!isEventHandled(event, attributes.onBeforeInput) &&
								SolidEditor.hasSelectableTarget(editor(), event.target)
							) {
								event.preventDefault();
								if (!SolidEditor.isComposing(editor())) {
									const text = (event as any).data as string;
									Editor.insertText(editor(), text);
								}
							}
						}}
						onInput={(event: InputEvent & EventTargets) => {
							if (isEventHandled(event, attributes.onInput)) {
								return;
							}

							if (androidInputManagerRef) {
								androidInputManagerRef.handleInput();
								return;
							}

							// Flush native operations, as native events will have propogated
							// and we can correctly compare DOM text values in components
							// to stop rendering, so that browser functions like autocorrect
							// and spellcheck work as expected.
							for (const op of deferredOperations()) {
								console.log("Running this");
								op();
							}
							setDeferredOperations([]);
						}}
						onBlur={(event: FocusEvent) => {
							if (
								merged.readOnly ||
								state().isUpdatingSelection ||
								!SolidEditor.hasSelectableTarget(editor(), event.target) ||
								isEventHandled(event, attributes.onBlur)
							) {
								return;
							}

							// COMPAT: If the current `activeElement` is still the previous
							// one, this is due to the window being blurred when the tab
							// itself becomes unfocused, so we want to abort early to allow to
							// editor() to stay focused when the tab becomes focused again.
							const root = SolidEditor.findDocumentOrShadowRoot(editor());
							if (state().latestElement === root.activeElement) {
								return;
							}

							const { relatedTarget } = event;
							const el = SolidEditor.toDOMNode(editor(), editor());

							// COMPAT: The event should be ignored if the focus is returning
							// to the editor() from an embedded editable element (eg. an <input>
							// element inside a void node).
							if (relatedTarget === el) {
								return;
							}

							// COMPAT: The event should be ignored if the focus is moving from
							// the editor() to inside a void node's spacer element.
							if (isDOMElement(relatedTarget) && relatedTarget.hasAttribute("data-slate-spacer")) {
								return;
							}

							// COMPAT: The event should be ignored if the focus is moving to a
							// non- editable section of an element that isn't a void node (eg.
							// a list item of the check list example).
							if (
								relatedTarget != null &&
								isDOMNode(relatedTarget) &&
								SolidEditor.hasDOMNode(editor(), relatedTarget)
							) {
								const node = SolidEditor.toSlateNode(editor(), relatedTarget);

								if (Element.isElement(node) && !editor().isVoid(node)) {
									return;
								}
							}

							// COMPAT: Safari doesn't always remove the selection even if the content-
							// editable element no longer has focus. Refer to:
							// https://stackoverflow.com/questions/12353247/force-contenteditable-div-to-stop-accepting-input-after-it-loses-focus-under-web
							if (IS_WEBKIT) {
								const domSelection = root.getSelection();
								domSelection?.removeAllRanges();
							}

							IS_FOCUSED.delete(editor());
						}}
						onClick={(event: MouseEvent) => {
							if (
								SolidEditor.hasTarget(editor(), event.target) &&
								!isEventHandled(event, attributes.onClick) &&
								isDOMNode(event.target)
							) {
								const node = SolidEditor.toSlateNode(editor(), event.target);
								const path = SolidEditor.findPath(editor(), node);
								console.log("Clicked textbox at", event.target, path, node);

								// At this time, the Slate document may be arbitrarily different,
								// because onClick handlers can change the document before we get here.
								// Therefore we must check that this path actually exists,
								// and that it still refers to the same node.
								if (!Editor.hasPath(editor(), path) || Node.get(editor(), path) !== node) {
									return;
								}

								if (event.detail === TRIPLE_CLICK && path.length >= 1) {
									let blockPath = path;
									if (!(Element.isElement(node) && Editor.isBlock(editor(), node))) {
										const block = Editor.above(editor(), {
											match: (n) => Element.isElement(n) && Editor.isBlock(editor(), n),
											at: path,
										});

										blockPath = block?.[1] ?? path.slice(0, 1);
									}

									const range = Editor.range(editor(), blockPath);
									console.log("manual-1");
									Transforms.select(editor(), range);
									return;
								}

								if (merged.readOnly) {
									return;
								}

								const start = Editor.start(editor(), path);
								const end = Editor.end(editor(), path);
								const startVoid = Editor.void(editor(), { at: start });
								const endVoid = Editor.void(editor(), { at: end });

								if (startVoid && endVoid && Path.equals(startVoid[1], endVoid[1])) {
									const range = Editor.range(editor(), start);
									console.log("manual-2");
									Transforms.select(editor(), range);
								}
							}
						}}
						onCompositionEnd={(event: CompositionEvent) => {
							if (SolidEditor.hasSelectableTarget(editor(), event.target)) {
								if (SolidEditor.isComposing(editor())) {
									Promise.resolve().then(() => {
										setIsComposing(false);
										IS_COMPOSING.set(editor(), false);
									});
								}

								androidInputManagerRef?.handleCompositionEnd(event);

								if (isEventHandled(event, attributes.onCompositionEnd) || IS_ANDROID) {
									return;
								}

								// COMPAT: In Chrome, `beforeinput` events for compositions
								// aren't correct and never fire the "insertFromComposition"
								// type that we need. So instead, insert whenever a composition
								// ends since it will already have been committed to the DOM.
								if (
									!IS_WEBKIT &&
									!IS_FIREFOX_LEGACY &&
									!IS_IOS &&
									!IS_WECHATBROWSER &&
									!IS_UC_MOBILE &&
									event.data
								) {
									const placeholderMarks = EDITOR_TO_PENDING_INSERTION_MARKS.get(editor());
									EDITOR_TO_PENDING_INSERTION_MARKS.delete(editor());

									// Ensure we insert text with the marks the user was actually seeing
									if (placeholderMarks !== undefined) {
										EDITOR_TO_USER_MARKS.set(editor(), editor().marks);
										editor().marks = placeholderMarks;
									}

									Editor.insertText(editor(), event.data);

									const userMarks = EDITOR_TO_USER_MARKS.get(editor());
									EDITOR_TO_USER_MARKS.delete(editor());
									if (userMarks !== undefined) {
										editor().marks = userMarks;
									}
								}
							}
						}}
						onCompositionUpdate={(event: CompositionEvent) => {
							if (
								SolidEditor.hasSelectableTarget(editor(), event.target) &&
								!isEventHandled(event, attributes.onCompositionUpdate)
							) {
								if (!SolidEditor.isComposing(editor())) {
									setIsComposing(true);
									IS_COMPOSING.set(editor(), true);
								}
							}
						}}
						onCompositionStart={(event: CompositionEvent) => {
							console.log("Composed", event);
							if (SolidEditor.hasSelectableTarget(editor(), event.target)) {
								androidInputManagerRef?.handleCompositionStart(event);

								if (isEventHandled(event, attributes.onCompositionStart) || IS_ANDROID) {
									return;
								}

								setIsComposing(true);

								if (editor().selection) {
									if (Range.isExpanded(editor().selection)) {
										Editor.deleteFragment(editor());
										return;
									}
									const inline = Editor.above(editor(), {
										match: (n) => Element.isElement(n) && Editor.isInline(editor(), n),
										mode: "highest",
									});
									if (inline) {
										const [, inlinePath] = inline;
										if (Editor.isEnd(editor(), editor().selection.anchor, inlinePath)) {
											const point = Editor.after(editor(), inlinePath)!;
											console.log("Setting Selection", point);
											Transforms.setSelection(editor(), {
												anchor: point,
												focus: point,
											});
										}
									}
								}
							}
						}}
						onCopy={(event: ClipboardEvent) => {
							if (
								SolidEditor.hasSelectableTarget(editor(), event.target) &&
								!isEventHandled(event, attributes.onCopy) &&
								!isDOMEventTargetInput(event)
							) {
								event.preventDefault();
								SolidEditor.setFragmentData(editor(), event.clipboardData, "copy");
							}
						}}
						onCut={(event: ClipboardEvent) => {
							if (
								!merged.readOnly &&
								SolidEditor.hasSelectableTarget(editor(), event.target) &&
								!isEventHandled(event, attributes.onCut) &&
								!isDOMEventTargetInput(event)
							) {
								event.preventDefault();
								SolidEditor.setFragmentData(editor(), event.clipboardData, "cut");

								if (editor().selection) {
									if (Range.isExpanded(editor().selection)) {
										Editor.deleteFragment(editor());
									} else {
										const node = Node.parent(editor(), editor().selection.anchor.path);
										if (Editor.isVoid(editor(), node)) {
											Transforms.delete(editor());
										}
									}
								}
							}
						}}
						onDragOver={(event: DragEvent) => {
							if (
								SolidEditor.hasTarget(editor(), event.target) &&
								!isEventHandled(event, attributes.onDragOver)
							) {
								// Only when the target is void, call `preventDefault` to signal
								// that drops are allowed. Editable content is droppable by
								// default, and calling `preventDefault` hides the cursor.
								const node = SolidEditor.toSlateNode(editor(), event.target);

								if (Element.isElement(node) && Editor.isVoid(editor(), node)) {
									event.preventDefault();
								}
							}
						}}
						onDragStart={(event: DragEvent) => {
							if (
								!merged.readOnly &&
								SolidEditor.hasTarget(editor(), event.target) &&
								!isEventHandled(event, attributes.onDragStart)
							) {
								const node = SolidEditor.toSlateNode(editor(), event.target);
								const path = SolidEditor.findPath(editor(), node);
								const voidMatch =
									(Element.isElement(node) && Editor.isVoid(editor(), node)) ||
									Editor.void(editor(), { at: path, voids: true });

								// If starting a drag on a void node, make sure it is selected
								// so that it shows up in the selection's fragment.
								if (voidMatch) {
									const range = Editor.range(editor(), path);
									Transforms.select(editor(), range);
								}

								state().isDraggingInternally = true;

								SolidEditor.setFragmentData(editor(), event.dataTransfer, "drag");
							}
						}}
						onDrop={(event: DragEvent) => {
							if (
								!merged.readOnly &&
								SolidEditor.hasTarget(editor(), event.target) &&
								!isEventHandled(event, attributes.onDrop)
							) {
								event.preventDefault();

								// Keep a reference to the dragged range before updating selection
								const draggedRange = editor().selection;

								// Find the range where the drop happened
								const range = SolidEditor.findEventRange(editor(), event);
								const data = event.dataTransfer;

								Transforms.select(editor(), range);

								if (state().isDraggingInternally) {
									if (
										draggedRange &&
										!Range.equals(draggedRange, range) &&
										!Editor.void(editor(), { at: range, voids: true })
									) {
										Transforms.delete(editor(), {
											at: draggedRange,
										});
									}
								}

								SolidEditor.insertData(editor(), data);

								// When dragging from another source into the editor(), it's possible
								// that the current editor() does not have focus.
								if (!SolidEditor.isFocused(editor())) {
									SolidEditor.focus(editor());
								}
							}

							state().isDraggingInternally = false;
						}}
						onDragEnd={(event: DragEvent) => {
							if (
								!merged.readOnly &&
								state().isDraggingInternally &&
								attributes.onDragEnd &&
								SolidEditor.hasTarget(editor(), event.target)
							) {
								attributes.onDragEnd(event);
							}

							// When dropping on a different droppable element than the current editor(),
							// `onDrop` is not called. So we need to clean up in `onDragEnd` instead.
							// Note: `onDragEnd` is only called when `onDrop` is not called
							state().isDraggingInternally = false;
						}}
						onFocus={(event: FocusEvent & EventTargets) => {
							if (
								!merged.readOnly &&
								!state().isUpdatingSelection &&
								SolidEditor.hasEditableTarget(editor(), event.target) &&
								!isEventHandled(event, attributes.onFocus)
							) {
								const el = SolidEditor.toDOMNode(editor(), editor());
								const root = SolidEditor.findDocumentOrShadowRoot(editor());
								state().latestElement = root.activeElement;

								// COMPAT: If the editor() has nested editable elements, the focus
								// can go to them. In Firefox, this must be prevented because it
								// results in issues with keyboard navigation. (2017/03/30)
								if (IS_FIREFOX && event.target !== el) {
									el.focus();
									return;
								}

								IS_FOCUSED.set(editor(), true);
							}
						}}
						onKeyDown={(event: KeyboardEvent) => {
							if (!merged.readOnly && SolidEditor.hasEditableTarget(editor(), event.target)) {
								androidInputManagerRef?.handleKeyDown(event);

								// COMPAT: The composition end event isn't fired reliably in all browsers,
								// so we sometimes might end up stuck in a composition state even though we
								// aren't composing any more.
								if (SolidEditor.isComposing(editor()) && event.isComposing === false) {
									IS_COMPOSING.set(editor(), false);
									setIsComposing(false);
								}

								if (isEventHandled(event, attributes.onKeyDown) || SolidEditor.isComposing(editor())) {
									return;
								}

								const element =
									editor().children[
										editor().selection !== null ? editor().selection.focus.path[0] : 0
									];
								const isRTL = getDirection(Node.string(element)) === "rtl";

								// COMPAT: Since we prevent the default behavior on
								// `beforeinput` events, the browser doesn't think there's ever
								// any history stack to undo or redo, so we have to manage these
								// hotkeys ourselves. (2019/11/06)
								if (Hotkeys.isRedo(event)) {
									event.preventDefault();
									const maybeHistoryEditor: any = editor();

									if (typeof maybeHistoryEditor.redo === "function") {
										maybeHistoryEditor.redo();
									}

									return;
								}

								if (Hotkeys.isUndo(event)) {
									event.preventDefault();
									const maybeHistoryEditor: any = editor();

									if (typeof maybeHistoryEditor.undo === "function") {
										maybeHistoryEditor.undo();
									}

									return;
								}

								// COMPAT: Certain browsers don't handle the selection updates
								// properly. In Chrome, the selection isn't properly extended.
								// And in Firefox, the selection isn't properly collapsed.
								// (2017/10/17)
								if (Hotkeys.isMoveLineBackward(event)) {
									event.preventDefault();
									Transforms.move(editor(), { unit: "line", reverse: true });
									return;
								}

								if (Hotkeys.isMoveLineForward(event)) {
									event.preventDefault();
									Transforms.move(editor(), { unit: "line" });
									return;
								}

								if (Hotkeys.isExtendLineBackward(event)) {
									event.preventDefault();
									Transforms.move(editor(), {
										unit: "line",
										edge: "focus",
										reverse: true,
									});
									return;
								}

								if (Hotkeys.isExtendLineForward(event)) {
									event.preventDefault();
									Transforms.move(editor(), { unit: "line", edge: "focus" });
									return;
								}

								// COMPAT: If a void node is selected, or a zero-width text node
								// adjacent to an inline is selected, we need to handle these
								// hotkeys manually because browsers won't be able to skip over
								// the void node with the zero-width space not being an empty
								// string.
								if (Hotkeys.isMoveBackward(event)) {
									event.preventDefault();

									if (editor().selection && Range.isCollapsed(editor().selection)) {
										Transforms.move(editor(), { reverse: !isRTL });
									} else {
										Transforms.collapse(editor(), {
											edge: isRTL ? "end" : "start",
										});
									}

									return;
								}

								if (Hotkeys.isMoveForward(event)) {
									event.preventDefault();

									if (editor().selection && Range.isCollapsed(editor().selection)) {
										Transforms.move(editor(), { reverse: isRTL });
									} else {
										Transforms.collapse(editor(), {
											edge: isRTL ? "start" : "end",
										});
									}

									return;
								}

								if (Hotkeys.isMoveWordBackward(event)) {
									event.preventDefault();

									if (editor().selection && Range.isExpanded(editor().selection)) {
										Transforms.collapse(editor(), { edge: "focus" });
									}

									Transforms.move(editor(), { unit: "word", reverse: !isRTL });
									return;
								}

								if (Hotkeys.isMoveWordForward(event)) {
									event.preventDefault();

									if (editor().selection && Range.isExpanded(editor().selection)) {
										Transforms.collapse(editor(), { edge: "focus" });
									}

									Transforms.move(editor(), { unit: "word", reverse: isRTL });
									return;
								}

								// COMPAT: Certain browsers don't support the `beforeinput` event, so we
								// fall back to guessing at the input intention for hotkeys.
								// COMPAT: In iOS, some of these hotkeys are handled in the
								if (!HAS_BEFORE_INPUT_SUPPORT) {
									// We don't have a core behavior for these, but they change the
									// DOM if we don't prevent them, so we have to.
									if (
										Hotkeys.isBold(event) ||
										Hotkeys.isItalic(event) ||
										Hotkeys.isTransposeCharacter(event)
									) {
										event.preventDefault();
										return;
									}

									if (Hotkeys.isSoftBreak(event)) {
										event.preventDefault();
										Editor.insertSoftBreak(editor());
										return;
									}

									if (Hotkeys.isSplitBlock(event)) {
										event.preventDefault();
										Editor.insertBreak(editor());
										return;
									}

									if (Hotkeys.isDeleteBackward(event)) {
										event.preventDefault();

										if (editor().selection && Range.isExpanded(editor().selection)) {
											Editor.deleteFragment(editor(), { direction: "backward" });
										} else {
											Editor.deleteBackward(editor());
										}

										return;
									}

									if (Hotkeys.isDeleteForward(event)) {
										event.preventDefault();

										if (editor().selection && Range.isExpanded(editor().selection)) {
											Editor.deleteFragment(editor(), { direction: "forward" });
										} else {
											Editor.deleteForward(editor());
										}

										return;
									}

									if (Hotkeys.isDeleteLineBackward(event)) {
										event.preventDefault();

										if (editor().selection && Range.isExpanded(editor().selection)) {
											Editor.deleteFragment(editor(), { direction: "backward" });
										} else {
											Editor.deleteBackward(editor(), { unit: "line" });
										}

										return;
									}

									if (Hotkeys.isDeleteLineForward(event)) {
										event.preventDefault();

										if (editor().selection && Range.isExpanded(editor().selection)) {
											Editor.deleteFragment(editor(), { direction: "forward" });
										} else {
											Editor.deleteForward(editor(), { unit: "line" });
										}

										return;
									}

									if (Hotkeys.isDeleteWordBackward(event)) {
										event.preventDefault();

										if (editor().selection && Range.isExpanded(editor().selection)) {
											Editor.deleteFragment(editor(), { direction: "backward" });
										} else {
											Editor.deleteBackward(editor(), { unit: "word" });
										}

										return;
									}

									if (Hotkeys.isDeleteWordForward(event)) {
										event.preventDefault();

										if (editor().selection && Range.isExpanded(editor().selection)) {
											Editor.deleteFragment(editor(), { direction: "forward" });
										} else {
											Editor.deleteForward(editor(), { unit: "word" });
										}

										return;
									}
								} else {
									if (IS_CHROME || IS_WEBKIT) {
										// COMPAT: Chrome and Safari support `beforeinput` event but do not fire
										// an event when deleting backwards in a selected void inline node
										if (
											editor().selection &&
											(Hotkeys.isDeleteBackward(event) || Hotkeys.isDeleteForward(event)) &&
											Range.isCollapsed(editor().selection)
										) {
											const currentNode = Node.parent(editor(), editor().selection.anchor.path);

											if (
												Element.isElement(currentNode) &&
												Editor.isVoid(editor(), currentNode) &&
												(Editor.isInline(editor(), currentNode) ||
													Editor.isBlock(editor(), currentNode))
											) {
												event.preventDefault();
												Editor.deleteBackward(editor(), { unit: "block" });

												return;
											}
										}
									}
								}
							}
						}}
						onPaste={(event: ClipboardEvent) => {
							if (
								!merged.readOnly &&
								SolidEditor.hasEditableTarget(editor(), event.target) &&
								!isEventHandled(event, attributes.onPaste)
							) {
								// COMPAT: Certain browsers don't support the `beforeinput` event, so we
								// fall back to React's `onPaste` here instead.
								// COMPAT: Firefox, Chrome and Safari don't emit `beforeinput` events
								// when "paste without formatting" is used, so fallback. (2020/02/20)
								// COMPAT: Safari InputEvents generated by pasting won't include
								// application/x-slate-fragment items, so use the
								// ClipboardEvent here. (2023/03/15)
								if (!HAS_BEFORE_INPUT_SUPPORT || isPlainTextOnlyPaste(event) || IS_WEBKIT) {
									event.preventDefault();
									SolidEditor.insertData(editor(), event.clipboardData);
								}
							}
						}}
					>
						{/* {useChildren({
							decorations: decorations(),
							node: editor(),
							renderElement: merged.renderElement,
							renderPlaceholder: merged.renderPlaceholder,
							renderLeaf: merged.renderLeaf,
							selection: editor().selection,
						})} */}
						<Children
							decorations={decorations()}
							node={editor()}
							renderElement={merged.renderElement}
							renderPlaceholder={merged.renderPlaceholder}
							renderLeaf={merged.renderLeaf}
							selection={editor().selection}
						/>
					</Dynamic>
				</RestoreDOM>
			</DecorateContext.Provider>
		</ReadOnlyContext.Provider>
	);
};

/**
 * The props that get passed to renderPlaceholder
 */
export type RenderPlaceholderProps = {
	children: any;
	attributes: {
		"data-slate-placeholder": boolean;
		dir?: "rtl";
		contentEditable: boolean;
		ref: any;
		style: JSX.CSSProperties;
	};
};

/**
 * The default placeholder element
 */

export const DefaultPlaceholder = (props: RenderPlaceholderProps) => (
	// COMPAT: Artificially add a line-break to the end on the placeholder element
	// to prevent Android IMEs to pick up its content in autocorrect and to auto-capitalize the first letter
	<span {...props.attributes}>
		{props.children}
		{IS_ANDROID && <br />}
	</span>
);

/**
 * A default memoized decorate function.
 */

export const defaultDecorate: (entry: NodeEntry) => Range[] = () => [];

/**
 * A default implement to scroll dom range into view.
 */

const defaultScrollSelectionIntoView = (editor: SolidEditor, domRange: DOMRange) => {
	// This was affecting the selection of multiple blocks and dragging behavior,
	// so enabled only if the selection has been collapsed.
	if (
		domRange.getBoundingClientRect &&
		(!editor.selection || (editor.selection && Range.isCollapsed(editor.selection)))
	) {
		const leafEl = domRange.startContainer.parentElement!;
		leafEl.getBoundingClientRect = domRange.getBoundingClientRect.bind(domRange);
		scrollIntoView(leafEl, {
			scrollMode: "if-needed",
		});

		// @ts-expect-error an unorthodox delete D:
		delete leafEl.getBoundingClientRect;
	}
};

/**
 * Check if an event is overrided by a handler.
 */

// Beware
// export const isEventHandled = <EventType extends Event>(event: EventType, handler?: (event: EventType) => void) => {
export const isEventHandled = (event: any, handler?: any) => {
	if (!handler) {
		return false;
	}
	// The custom event handler may return a boolean to specify whether the event
	// shall be treated as being handled or not.
	const shouldTreatEventAsHandled = handler(event);

	if (shouldTreatEventAsHandled != null) {
		return shouldTreatEventAsHandled;
	}

	// return event.isDefaultPrevented() || event.isPropagationStopped();
	return false;
};

/**
 * Check if the event's target is an input element
 */
export const isDOMEventTargetInput = (event: Event) => {
	return (
		isDOMNode(event.target) &&
		(event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)
	);
};

/**
 * Check if a DOM event is overrided by a handler.
 */

export const isDOMEventHandled = <E extends Event>(event: E, handler?: (event: E) => void | boolean) => {
	if (!handler) {
		return false;
	}

	// The custom event handler may return a boolean to specify whether the event
	// shall be treated as being handled or not.
	const shouldTreatEventAsHandled = handler(event);

	if (shouldTreatEventAsHandled != null) {
		return shouldTreatEventAsHandled;
	}

	return event.defaultPrevented;
};

