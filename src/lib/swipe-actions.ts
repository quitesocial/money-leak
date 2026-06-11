import { PanResponder } from 'react-native';

const HORIZONTAL_ACTIVATION_DISTANCE = 10;
const VERTICAL_SCROLL_DISTANCE = 8;
const HORIZONTAL_INTENT_RATIO = 0.75;
const SWIPE_OPEN_THRESHOLD = 44;
const SWIPE_VELOCITY_THRESHOLD = 0.35;

type SwipeGesture = {
  dx: number;
  dy: number;
  vx: number;
};

type CreateHorizontalSwipePanResponderParams = {
  close: () => void;
  isDisabled: boolean;
  lockRef: { current: boolean };
  onGrant: () => void;
  onMove: (dx: number) => void;
  revealLeading: () => void;
  revealTrailing: () => void;
};

export function clampSwipeTranslation(value: number, actionWidth: number) {
  return Math.max(-actionWidth, Math.min(actionWidth, value));
}

export function hasHorizontalSwipeIntent({
  dx,
  dy,
}: Pick<SwipeGesture, 'dx' | 'dy'>) {
  const absoluteDx = Math.abs(dx);
  const absoluteDy = Math.abs(dy);

  if (
    absoluteDx < HORIZONTAL_ACTIVATION_DISTANCE &&
    absoluteDy < VERTICAL_SCROLL_DISTANCE
  ) {
    return false;
  }

  if (absoluteDy >= VERTICAL_SCROLL_DISTANCE && absoluteDy > absoluteDx) {
    return false;
  }

  return (
    absoluteDx >= HORIZONTAL_ACTIVATION_DISTANCE &&
    absoluteDy <= absoluteDx * HORIZONTAL_INTENT_RATIO
  );
}

export function createHorizontalSwipePanResponder({
  close,
  isDisabled,
  lockRef,
  onGrant,
  onMove,
  revealLeading,
  revealTrailing,
}: CreateHorizontalSwipePanResponderParams) {
  return PanResponder.create({
    onMoveShouldSetPanResponder: (_event, gestureState) => {
      if (isDisabled) return false;

      const shouldLockSwipe = hasHorizontalSwipeIntent(gestureState);
      lockRef.current = shouldLockSwipe;

      return shouldLockSwipe;
    },
    onMoveShouldSetPanResponderCapture: (_event, gestureState) => {
      if (isDisabled) return false;

      const shouldLockSwipe = hasHorizontalSwipeIntent(gestureState);
      lockRef.current = shouldLockSwipe;

      return shouldLockSwipe;
    },
    onPanResponderGrant: onGrant,
    onPanResponderMove: (_event, gestureState) => {
      if (isDisabled || !lockRef.current) return;

      onMove(gestureState.dx);
    },
    onPanResponderRelease: (_event, gestureState) => {
      const wasHorizontallyLocked = lockRef.current;
      lockRef.current = false;

      if (!wasHorizontallyLocked) {
        close();

        return;
      }

      if (
        gestureState.dx > SWIPE_OPEN_THRESHOLD ||
        gestureState.vx > SWIPE_VELOCITY_THRESHOLD
      ) {
        revealLeading();

        return;
      }

      if (
        gestureState.dx < -SWIPE_OPEN_THRESHOLD ||
        gestureState.vx < -SWIPE_VELOCITY_THRESHOLD
      ) {
        revealTrailing();

        return;
      }

      close();
    },
    onPanResponderTerminationRequest: () => !lockRef.current,
    onPanResponderTerminate: () => {
      lockRef.current = false;
      close();
    },
  });
}
