import { createEffect, createRenderEffect, onMount } from "solid-js";
import { CAN_USE_DOM } from "../utils/environment";

/**
 * Prevent warning on SSR by falling back to useEffect when DOM isn't available
 */

export const useIsomorphicLayoutEffect = CAN_USE_DOM ? createRenderEffect : createEffect;
// export const useIsomorphicLayoutEffect = createRenderEffect;

