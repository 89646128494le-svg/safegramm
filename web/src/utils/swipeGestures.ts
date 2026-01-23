// Утилиты для обработки swipe жестов
import React from 'react';

export interface SwipeGestureCallbacks {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
}

export interface SwipeState {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  isSwiping: boolean;
}

const SWIPE_THRESHOLD = 50; // Минимальное расстояние для распознавания свайпа

export function useSwipeGesture(
  elementRef: React.RefObject<HTMLElement>,
  callbacks: SwipeGestureCallbacks
) {
  const swipeState = React.useRef<SwipeState>({
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    isSwiping: false,
  });

  const handleTouchStart = (e: TouchEvent) => {
    const touch = e.touches[0];
    swipeState.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      currentX: touch.clientX,
      currentY: touch.clientY,
      isSwiping: true,
    };
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (!swipeState.current.isSwiping) return;
    
    const touch = e.touches[0];
    swipeState.current.currentX = touch.clientX;
    swipeState.current.currentY = touch.clientY;

    // Применяем визуальную обратную связь
    const element = elementRef.current;
    if (element) {
      const deltaX = swipeState.current.currentX - swipeState.current.startX;
      const deltaY = swipeState.current.currentY - swipeState.current.startY;
      
      // Ограничиваем движение только по горизонтали для свайпов влево/вправо
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        element.style.transform = `translateX(${deltaX}px)`;
        element.style.transition = 'none';
      }
    }
  };

  const handleTouchEnd = () => {
    if (!swipeState.current.isSwiping) return;

    const deltaX = swipeState.current.currentX - swipeState.current.startX;
    const deltaY = swipeState.current.currentY - swipeState.current.startY;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const time = Date.now(); // Упрощенная проверка скорости

    const element = elementRef.current;
    if (element) {
      element.style.transition = 'transform 0.3s ease-out';
      element.style.transform = '';
    }

    // Определяем направление свайпа
    if (distance > SWIPE_THRESHOLD) {
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        // Горизонтальный свайп
        if (deltaX > 0 && callbacks.onSwipeRight) {
          callbacks.onSwipeRight();
        } else if (deltaX < 0 && callbacks.onSwipeLeft) {
          callbacks.onSwipeLeft();
        }
      } else {
        // Вертикальный свайп
        if (deltaY > 0 && callbacks.onSwipeDown) {
          callbacks.onSwipeDown();
        } else if (deltaY < 0 && callbacks.onSwipeUp) {
          callbacks.onSwipeUp();
        }
      }
    }

    swipeState.current.isSwiping = false;
  };

  React.useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    element.addEventListener('touchstart', handleTouchStart);
    element.addEventListener('touchmove', handleTouchMove);
    element.addEventListener('touchend', handleTouchEnd);

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [callbacks]);
}

// Хук для использования в компонентах
export function useSwipeActions(
  elementRef: React.RefObject<HTMLElement>,
  callbacks: SwipeGestureCallbacks
) {
  useSwipeGesture(elementRef, callbacks);
}
