// These helpers are recreations of the slate helpers but without types like the Editor object

import { Descendant, Path, Scrubber, Text, getDirtyPaths } from "slate";

export interface TempEditor {
  children: Descendant[];
}

function getNode(root: TempEditor | Element | Text, path: Path) {
  let node = root;

  for (let i = 0; i < path.length; i++) {
    const p = path[i];

    if (Text.isText(node) || !node.children[p]) {
      throw new Error(
        `Cannot find a descendant at path [${path}] in node: ${Scrubber.stringify(
          root
        )}`
      );
    }

    node = node.children[p];
  }
  return node;
}

function getNodeLeaf(root: TempEditor, path: Path) {
  const node = getNode(root, path);

  if (!Text.isText(node)) {
    throw new Error(
      `Cannot get the leaf node at path [${path}] because it refers to a non-leaf node: ${Scrubber.stringify(
        node
      )}`
    );
  }

  return node;
}

function getNodeParent(root: TempEditor, path: Path) {
  const parentPath = Path.parent(path);
  const p = getNode(root, parentPath);

  if (Text.isText(p)) {
    throw new Error(
      `Cannot get the parent of path [${path}] because it does not exist in the root.`
    );
  }

  return p;
}

export { getNode, getNodeLeaf, getNodeParent };

function getDirtySplitNodePaths() {
  const { path } = op;
  const levels = Path.levels(path);
  const nextPath = Path.next(path);
  return [...levels, nextPath];
}
