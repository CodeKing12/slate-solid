import { Accessor, createContext, useContext } from "solid-js";
import { Editor } from "slate";
import { SolidEditor } from "../plugin/solid-editor";
import { SetStoreFunction } from "solid-js/store";

/**
 * A SolidJS context for sharing the editor object, in a way that re-renders the
 * context whenever changes occur.
 */

export interface SlateContextValue {
  v: number;
  editor: () => SolidEditor;
}

export const SlateContext = createContext<Accessor<SlateContextValue> | null>(
  null,
);

/**
 * Get the current editor object from the React context.
 */

export type useSlateResponse = SolidEditor;

// Beware
export const useSlate = (): useSlateResponse => {
  const context = useContext(SlateContext);

  if (!context) {
    throw new Error(
      `The \`useSlate\` hook must be used inside the <Slate> component's context.`,
    );
  }

  return context().editor();
};

export const useSlateWithV = () => {
  const context = useContext(SlateContext);

  if (!context) {
    throw new Error(
      `The \`useSlate\` hook must be used inside the <Slate> component's context.`,
    );
  }

  return context;
};
