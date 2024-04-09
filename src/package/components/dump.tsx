<Switch>
  <Match when={Element.isElement(n)}>
    <SelectedContext.Provider value={!!sel}>
      <ElementComponent
        decorations={ds}
        element={n}
        reactive={props.reactive.children[index()]}
        renderElement={props.renderElement}
        renderPlaceholder={props.renderPlaceholder}
        renderLeaf={props.renderLeaf}
        selection={sel}
      />
    </SelectedContext.Provider>
  </Match>

  <Match when={!Element.isElement(n)}>
    <TextComponent
      decorations={ds}
      reactive={props.reactive.children[index()]}
      isLast={isLeafBlock() && index() === props.node.children.length - 1}
      parent={props.node}
      renderPlaceholder={props.renderPlaceholder}
      renderLeaf={props.renderLeaf}
      text={n}
    />
  </Match>
</Switch>;
