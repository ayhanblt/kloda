// Test-only scroll driver for the capture entry (Faz3 P3-10). The product ScrollView exposes no ref, so
// the scrollable host node is found through the public DOM-like node API under one capture-owned view,
// scrolled with the ScrollView native command and measured from the committed scroll geometry.
export interface ScrollProof {
  offset: number;
  content: number;
  visible: number;
  atEnd: boolean;
}

/** Why a measurement is absent: nothing scrollable below the host, or no numeric geometry. */
export type ScrollNote = string;

interface ScrollNode {
  children?: ArrayLike<ScrollNode>;
  scrollTop?: number;
  scrollHeight?: number;
  clientHeight?: number;
}

// Internal RN module: the only way to send scrollToEnd to a host node without a product ref.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const commands = require('react-native/Libraries/Components/ScrollView/ScrollViewCommands').default as {
  scrollToEnd: (node: unknown, animated: boolean) => void;
};

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const scrollable = (node: ScrollNode) =>
  finite(node.scrollHeight) && finite(node.clientHeight) && node.clientHeight > 0 && node.scrollHeight > node.clientHeight + 1;

/** Outermost scrollable descendant of `host` (pre-order); the host itself is never a candidate. */
export function findScrollNode(host: unknown): ScrollNode | null {
  const root = host as ScrollNode | null;
  const stack: ScrollNode[] = root?.children ? [...Array.from(root.children)].reverse() : [];
  while (stack.length) {
    const node = stack.pop() as ScrollNode;
    if (scrollable(node)) return node;
    if (node.children) stack.push(...[...Array.from(node.children)].reverse());
  }
  return null;
}

export function scrollToEnd(node: ScrollNode): void {
  commands.scrollToEnd(node, false);
}

/** Diagnostic only: geometry of the host and the largest-scrollHeight descendant, as numbers. */
export function diagnose(host: unknown): string {
  const root = host as ScrollNode | null;
  let best: ScrollNode | null = null, count = 0;
  const stack: ScrollNode[] = root?.children ? Array.from(root.children) : [];
  while (stack.length) {
    const node = stack.pop() as ScrollNode;
    count += 1;
    if (finite(node.scrollHeight) && (!best || node.scrollHeight > (best.scrollHeight as number))) best = node;
    if (node.children) stack.push(...Array.from(node.children));
  }
  const g = (n: ScrollNode | null) => n ? `${n.scrollTop}/${n.scrollHeight}/${n.clientHeight}` : 'none';
  return `nodes=${count} host=${g(root)} best=${g(best)}`;
}

export function measureScroll(node: ScrollNode | null, host?: unknown): { scroll: ScrollProof | null; note: ScrollNote } {
  if (!node) return { scroll: null, note: `no-element ${diagnose(host)}` };
  const { scrollTop, scrollHeight, clientHeight } = node;
  if (!finite(scrollTop) || !finite(scrollHeight) || !finite(clientHeight)) return { scroll: null, note: 'no-geometry' };
  const atEnd = scrollTop > 0 && scrollHeight > clientHeight && scrollTop + clientHeight >= scrollHeight - 1;
  return { scroll: { offset: scrollTop, content: scrollHeight, visible: clientHeight, atEnd }, note: 'measured' };
}
