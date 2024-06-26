import { createSignal, splitProps } from "solid-js";
import { useSlateStatic } from "../use-slate-static";
import { IS_ANDROID } from "../../utils/environment";
import { EDITOR_TO_SCHEDULE_FLUSH } from "../../utils/weak-maps";
import {
  createAndroidInputManager,
  CreateAndroidInputManagerOptions,
} from "./android-input-manager";
import { useIsMounted } from "../use-is-mounted";
import { useMutationObserver } from "../use-mutation-observer";

type UseAndroidInputManagerOptions = {
  node: HTMLElement | null;
} & Omit<
  CreateAndroidInputManagerOptions,
  "editor" | "onUserInput" | "receivedUserInput"
>;

const MUTATION_OBSERVER_CONFIG: MutationObserverInit = {
  subtree: true,
  childList: true,
  characterData: true,
};

export const useAndroidInputManager = !IS_ANDROID
  ? () => null
  : (props: UseAndroidInputManagerOptions) => {
      const [split, options] = splitProps(props, ["node"]);
      if (!IS_ANDROID) {
        return null;
      }

      const editor = useSlateStatic();
      const isMounted = useIsMounted();

      const [inputManager] = createSignal(
        createAndroidInputManager({
          editor: editor,
          ...options,
        }),
      );

      useMutationObserver(
        split.node,
        inputManager().handleDomMutations,
        MUTATION_OBSERVER_CONFIG,
      );

      EDITOR_TO_SCHEDULE_FLUSH.set(editor, inputManager().scheduleFlush);
      if (isMounted) {
        inputManager().flush();
      }

      return inputManager;
    };
