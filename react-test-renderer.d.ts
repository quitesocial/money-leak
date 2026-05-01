declare module 'react-test-renderer' {
  import type { ReactElement } from 'react';

  export type ReactTestInstance = {
    children: (ReactTestInstance | string)[];
    props: Record<string, unknown>;
  };

  export type ReactTestRenderer = {
    root: ReactTestInstance & {
      find: (
        predicate: (
          node: ReactTestInstance & { props: Record<string, unknown> },
        ) => boolean,
      ) => ReactTestInstance & { props: Record<string, unknown> };
    };
  };

  export function act(
    callback: () => void | Promise<void>,
  ): Promise<void> | void;

  export function create(element: ReactElement): ReactTestRenderer;
}
