import { expect } from '@jest/globals';
import {
  act,
  type ReactTestInstance,
  type ReactTestRenderer,
} from 'react-test-renderer';

export type PressableNode = ReactTestInstance & {
  props: {
    accessibilityState?: { selected?: boolean };
    onPress: () => void;
  };
};

export type TextInputNode = ReactTestInstance & {
  props: {
    onChangeText: (value: string) => void;
  };
};

export type TestNode<TProps extends object> = ReactTestInstance & {
  props: TProps;
};

export function getNodeText(node: ReactTestInstance | string): string {
  return typeof node === 'string'
    ? node
    : node.children.map((child) => getNodeText(child)).join('');
}

export function findPressable(
  renderer: ReactTestRenderer,
  predicate: (node: ReactTestInstance) => boolean,
) {
  return renderer.root.find((node) => {
    return (
      typeof node.props.onPress === 'function' &&
      predicate(node as ReactTestInstance)
    );
  }) as PressableNode;
}

export function findAllNodes(
  node: ReactTestInstance,
  predicate: (node: ReactTestInstance) => boolean,
): ReactTestInstance[] {
  const matches = predicate(node) ? [node] : [];

  for (const child of node.children) {
    if (typeof child === 'string') continue;

    matches.push(...findAllNodes(child, predicate));
  }

  return matches;
}

export function findButton(renderer: ReactTestRenderer, label: string) {
  return findPressable(renderer, (node) => getNodeText(node).includes(label));
}

export function findAccessibleButton(
  renderer: ReactTestRenderer,
  label: string,
) {
  return findPressable(
    renderer,
    (node) => node.props.accessibilityLabel === label,
  );
}

export function findSelectedButton(renderer: ReactTestRenderer, label: string) {
  return findPressable(renderer, (node) => {
    const accessibilityState = node.props.accessibilityState as
      | { selected?: boolean }
      | undefined;

    return (
      accessibilityState?.selected === true && getNodeText(node).includes(label)
    );
  });
}

export function findTextInput(
  renderer: ReactTestRenderer,
  placeholder: string,
) {
  return renderer.root.find((node: ReactTestInstance) => {
    return (
      typeof node.props.onChangeText === 'function' &&
      node.props.placeholder === placeholder
    );
  }) as TextInputNode;
}

export function findByTestID<TProps extends object = Record<string, unknown>>(
  renderer: ReactTestRenderer,
  testID: string,
) {
  return renderer.root.find((node: ReactTestInstance) => {
    return node.props.testID === testID;
  }) as TestNode<TProps>;
}

export function findNodeByProp(
  renderer: ReactTestRenderer,
  propName: string,
  value: unknown,
) {
  const node = findAllNodes(renderer.root, (candidate) => {
    return candidate.props[propName] === value;
  })[0];

  if (!node) {
    throw new Error(`Could not find node with ${propName}.`);
  }

  return node;
}

export function findTextNode(renderer: ReactTestRenderer, text: string) {
  const node = findAllNodes(renderer.root, (candidate) => {
    return getNodeText(candidate) === text;
  })[0];

  if (!node) {
    throw new Error(`Could not find text node ${text}.`);
  }

  return node;
}

export function expectText(renderer: ReactTestRenderer, text: string) {
  expectScreenText(renderer, text, true);
}

export function expectNoText(renderer: ReactTestRenderer, text: string) {
  expectScreenText(renderer, text, false);
}

export function expectScreenText(
  renderer: ReactTestRenderer,
  text: string,
  shouldExist: boolean,
) {
  const matcher = expect(getNodeText(renderer.root));

  if (shouldExist) {
    matcher.toContain(text);
    return;
  }

  matcher.not.toContain(text);
}

export async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

export async function enterText(
  renderer: ReactTestRenderer,
  placeholder: string,
  value: string,
) {
  await act(async () => {
    findTextInput(renderer, placeholder).props.onChangeText(value);
    await flushPromises();
  });
}

export async function pressButton(renderer: ReactTestRenderer, label: string) {
  await pressFoundButton(() => findButton(renderer, label));
}

export async function pressAccessibleButton(
  renderer: ReactTestRenderer,
  label: string,
) {
  await pressFoundButton(() => findAccessibleButton(renderer, label));
}

export async function pressFoundButton(find: () => PressableNode) {
  await act(async () => {
    find().props.onPress();
    await flushPromises();
  });
}
