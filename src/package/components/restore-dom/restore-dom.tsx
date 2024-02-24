import { onMount, createEffect, createSignal, onCleanup, JSXElement, useContext } from "solid-js";
import { EditorContext } from "../../hooks/use-slate-static";
import { IS_ANDROID } from "../../utils/environment";
import { createRestoreDomManager, RestoreDOMManager } from "./restore-dom-manager";

const MUTATION_OBSERVER_CONFIG: MutationObserverInit = {
	subtree: true,
	childList: true,
	characterData: true,
	characterDataOldValue: true,
};

type RestoreDOMProps = {
	children?: JSXElement;
	receivedUserInput: boolean;
	node: HTMLDivElement | null;
};

// We're using SolidJS effect and cleanup functions to replicate the behavior of componentDidMount, componentDidUpdate, and componentWillUnmount
const RestoreDOMComponent = (props: RestoreDOMProps): JSXElement => {
	const editorContext = useContext(EditorContext);
	const [manager, setManager] = createSignal<RestoreDOMManager | null>(null);
	const [mutationObserver, setMutationObserver] = createSignal<MutationObserver | null>(null);

	const observe = () => {
		if (!props.node) {
			throw new Error("Failed to attach MutationObserver, `node` is undefined");
		}
		mutationObserver()?.observe(props.node, MUTATION_OBSERVER_CONFIG);
	};

	// Similar to componentDidMount
	onMount(() => {
		if (editorContext().editor) {
			const newManager = createRestoreDomManager(editorContext().editor, props.receivedUserInput);
			setManager(() => newManager);
			const newMutationObserver = new MutationObserver(newManager.registerMutations);
			setMutationObserver(() => newMutationObserver);
		}

		observe();
	});

	// Similar to componentWillUnmount
	onCleanup(() => {
		mutationObserver()?.disconnect();
	});

	// Similar to componentDidUpdate
	createEffect(() => {
		const pendingMutations = mutationObserver()?.takeRecords();
		if (pendingMutations?.length) {
			manager()?.registerMutations(pendingMutations);
		}

		mutationObserver()?.disconnect();
		manager()?.restoreDOM();

		observe();
	});

	// Render children
	return <>{props.children}</>;
};

// Exporting RestoreDOM as either a class component or a functional component based on IS_ANDROID
// Beware export const RestoreDOM = IS_ANDROID ? RestoreDOMComponent : (props: RestoreDOMProps) => <>{props.children}</>;
export const RestoreDOM = (props: RestoreDOMProps) => <>{props.children}</>;

