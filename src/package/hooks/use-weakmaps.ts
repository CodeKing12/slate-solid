import { Ancestor, Element } from "slate";
import { createContext, useContext } from "solid-js";

export interface ElementContextValues {
  //   index?: number;
  //   node?: Element;
  //   parent?: Ancestor;
  setWeakmaps: () => void;
}

export const ElementContext = createContext<ElementContextValues>();

export function useElementContext() {
  const context = useContext(ElementContext);

  if (!context) {
    throw new Error(
      `The \`useEditor\` hook must be used inside the <Slate> component's context.`
    );
  }

  return context;
}
