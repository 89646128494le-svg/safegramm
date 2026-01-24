import React, { useRef, useEffect, useState, useCallback } from 'react';
import { throttle } from '../utils/performance';

interface Message {
  id: string;
  [key: string]: any;
}

interface Props<T extends Message> {
  messages: T[];
  renderMessage: (message: T, index: number) => React.ReactNode;
  estimatedItemHeight?: number;
  overscan?: number;
  className?: string;
  style?: React.CSSProperties;
  onLoadMore?: () => void;
  loadMoreThreshold?: number;
}

export function VirtualizedMessageList<T extends Message>({
  messages,
  renderMessage,
  estimatedItemHeight = 80,
  overscan = 3,
  className,
  style,
  onLoadMore,
  loadMoreThreshold = 500
}: Props<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 20 });
  const [heights, setHeights] = useState<Map<string, number>>(new Map());
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const lastScrollTop = useRef(0);
  
  // Вычисляем позиции элементов
  const getItemOffset = useCallback((index: number): number => {
    let offset = 0;
    for (let i = 0; i < index; i++) {
      const msg = messages[i];
      offset += heights.get(msg.id) || estimatedItemHeight;
    }
    return offset;
  }, [messages, heights, estimatedItemHeight]);
  
  // Получаем высоту элемента
  const getItemHeight = useCallback((index: number): number => {
    const msg = messages[index];
    return heights.get(msg.id) || estimatedItemHeight;
  }, [messages, heights, estimatedItemHeight]);
  
  // Обновляем видимый диапазон при скролле
  const updateVisibleRange = useCallback(
    throttle(() => {
      if (!containerRef.current) return;
      
      const scrollTop = containerRef.current.scrollTop;
      const containerHeight = containerRef.current.clientHeight;
      
      // Определяем видимые элементы
      let start = 0;
      let offset = 0;
      
      while (start < messages.length && offset < scrollTop) {
        offset += getItemHeight(start);
        start++;
      }
      
      start = Math.max(0, start - overscan);
      
      let end = start;
      offset = getItemOffset(start);
      
      while (end < messages.length && offset < scrollTop + containerHeight) {
        offset += getItemHeight(end);
        end++;
      }
      
      end = Math.min(messages.length, end + overscan);
      
      setVisibleRange({ start, end });
      
      // Load more если приближаемся к концу
      if (onLoadMore && scrollTop + containerHeight >= containerRef.current.scrollHeight - loadMoreThreshold) {
        onLoadMore();
      }
      
      lastScrollTop.current = scrollTop;
    }, 16), // ~60fps
    [messages, overscan, getItemHeight, getItemOffset, onLoadMore, loadMoreThreshold]
  );
  
  // Измеряем высоты элементов
  useEffect(() => {
    const newHeights = new Map(heights);
    let hasChanges = false;
    
    itemRefs.current.forEach((element, id) => {
      const height = element.getBoundingClientRect().height;
      if (heights.get(id) !== height) {
        newHeights.set(id, height);
        hasChanges = true;
      }
    });
    
    if (hasChanges) {
      setHeights(newHeights);
    }
  }, [messages, visibleRange]);
  
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    container.addEventListener('scroll', updateVisibleRange, { passive: true });
    
    // Initial update
    updateVisibleRange();
    
    return () => container.removeEventListener('scroll', updateVisibleRange);
  }, [updateVisibleRange]);
  
  // Пересчитываем при изменении размеров контейнера
  useEffect(() => {
    const resizeObserver = new ResizeObserver(() => {
      updateVisibleRange();
    });
    
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    
    return () => resizeObserver.disconnect();
  }, [updateVisibleRange]);
  
  const totalHeight = messages.reduce((acc, msg, idx) => {
    return acc + (heights.get(msg.id) || estimatedItemHeight);
  }, 0);
  
  const offsetY = getItemOffset(visibleRange.start);
  const visibleMessages = messages.slice(visibleRange.start, visibleRange.end);
  
  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        overflow: 'auto',
        WebkitOverflowScrolling: 'touch',
        ...style
      }}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleMessages.map((message, idx) => {
            const actualIndex = visibleRange.start + idx;
            return (
              <div
                key={message.id}
                ref={(el) => {
                  if (el) {
                    itemRefs.current.set(message.id, el);
                  } else {
                    itemRefs.current.delete(message.id);
                  }
                }}
              >
                {renderMessage(message, actualIndex)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Простая версия для небольших списков
export function SimpleVirtualList<T extends { id: string }>({
  items,
  renderItem,
  containerHeight,
  itemHeight = 60,
  className,
  style
}: {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  containerHeight: number;
  itemHeight?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [scrollTop, setScrollTop] = useState(0);
  
  const handleScroll = throttle((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, 16);
  
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - 5);
  const endIndex = Math.min(
    items.length,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + 5
  );
  
  const visibleItems = items.slice(startIndex, endIndex);
  const offsetY = startIndex * itemHeight;
  const totalHeight = items.length * itemHeight;
  
  return (
    <div
      className={className}
      onScroll={handleScroll}
      style={{
        height: containerHeight,
        overflow: 'auto',
        WebkitOverflowScrolling: 'touch',
        ...style
      }}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleItems.map((item, idx) => (
            <div key={item.id} style={{ height: itemHeight }}>
              {renderItem(item, startIndex + idx)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default VirtualizedMessageList;
