import { onMount, createEffect } from "solid-js";
import { SolidEditor } from "../plugin/solid-editor";
import { useSlateStatic } from "./use-slate-static";

export function useTrackUserInput() {
	const editor = useSlateStatic();

	let receivedUserInput: boolean = false;
	let animationFrameIdRef: number = 0;

	const onUserInput = () => {
		if (receivedUserInput) {
			return;
		}

		receivedUserInput = true;

		const window = SolidEditor.getWindow(editor());
		window.cancelAnimationFrame(animationFrameIdRef);

		animationFrameIdRef = window.requestAnimationFrame(() => {
			receivedUserInput = false;
		});
	};

	onMount(() => () => cancelAnimationFrame(animationFrameIdRef));

	return {
		receivedUserInput,
		onUserInput,
	};
}

