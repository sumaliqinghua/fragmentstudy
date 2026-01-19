import { useRef, useCallback, useState } from 'react';

interface GestureState {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  startTime: number;
  isLongPress: boolean;
}

interface UseGestureOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  onLongPress?: () => void;
  onTap?: () => void;
  swipeThreshold?: number;
  longPressDelay?: number;
}

export function useGesture(options: UseGestureOptions) {
  const {
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    onLongPress,
    onTap,
    swipeThreshold = 50,
    longPressDelay = 500,
  } = options;

  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const gestureState = useRef<GestureState | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleStart = useCallback((clientX: number, clientY: number) => {
    gestureState.current = {
      startX: clientX,
      startY: clientY,
      currentX: clientX,
      currentY: clientY,
      startTime: Date.now(),
      isLongPress: false,
    };
    setIsDragging(true);

    longPressTimer.current = setTimeout(() => {
      if (gestureState.current) {
        gestureState.current.isLongPress = true;
        onLongPress?.();
      }
    }, longPressDelay);
  }, [longPressDelay, onLongPress]);

  const handleMove = useCallback((clientX: number, clientY: number) => {
    if (!gestureState.current) return;

    const deltaX = clientX - gestureState.current.startX;
    const deltaY = clientY - gestureState.current.startY;

    if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
      clearLongPressTimer();
    }

    gestureState.current.currentX = clientX;
    gestureState.current.currentY = clientY;

    setOffset({ x: deltaX, y: deltaY });
  }, [clearLongPressTimer]);

  const handleEnd = useCallback(() => {
    clearLongPressTimer();

    if (!gestureState.current) {
      setIsDragging(false);
      setOffset({ x: 0, y: 0 });
      return;
    }

    const { startX, startY, currentX, currentY, startTime, isLongPress } = gestureState.current;
    const deltaX = currentX - startX;
    const deltaY = currentY - startY;
    const elapsed = Date.now() - startTime;

    setIsDragging(false);
    setOffset({ x: 0, y: 0 });

    if (isLongPress) {
      gestureState.current = null;
      return;
    }

    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    if (absX < 10 && absY < 10 && elapsed < 300) {
      onTap?.();
    } else if (absX > absY && absX > swipeThreshold) {
      if (deltaX > 0) {
        onSwipeRight?.();
      } else {
        onSwipeLeft?.();
      }
    } else if (absY > absX && absY > swipeThreshold) {
      if (deltaY > 0) {
        onSwipeDown?.();
      } else {
        onSwipeUp?.();
      }
    }

    gestureState.current = null;
  }, [clearLongPressTimer, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, onTap, swipeThreshold]);

  const handlers = {
    onTouchStart: (e: React.TouchEvent) => {
      const touch = e.touches[0];
      handleStart(touch.clientX, touch.clientY);
    },
    onTouchMove: (e: React.TouchEvent) => {
      const touch = e.touches[0];
      handleMove(touch.clientX, touch.clientY);
    },
    onTouchEnd: handleEnd,
    onMouseDown: (e: React.MouseEvent) => {
      handleStart(e.clientX, e.clientY);
    },
    onMouseMove: (e: React.MouseEvent) => {
      if (isDragging) {
        handleMove(e.clientX, e.clientY);
      }
    },
    onMouseUp: handleEnd,
    onMouseLeave: () => {
      if (isDragging) {
        handleEnd();
      }
    },
  };

  return { handlers, offset, isDragging };
}
