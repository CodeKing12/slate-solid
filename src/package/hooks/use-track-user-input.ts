import { onMount, createEffect, createSignal } from "solid-js";
import { SolidEditor } from "../plugin/solid-editor";
import { useSlateStatic } from "./use-slate-static";

export function useTrackUserInput() {
	const editor = useSlateStatic();

	const [receivedUserInput, setReceivedUserInput] = createSignal(false);
	const [animationFrameIdRef, setAnimationFrameIdRef] = createSignal(0);

	const onUserInput = () => {
		if (receivedUserInput()) {
			return;
		}

		setReceivedUserInput(true);

		const window = SolidEditor.getWindow(editor());
		window.cancelAnimationFrame(animationFrameIdRef());

		setAnimationFrameIdRef(
			window.requestAnimationFrame(() => {
				setReceivedUserInput(false);
			})
		);
	};

	onMount(() => () => cancelAnimationFrame(animationFrameIdRef()));

	return () => ({
		receivedUserInput,
		onUserInput,
	});
}

