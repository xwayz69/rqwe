import React, { RefObject, useEffect, useRef } from 'react';
import { DragLayerMonitor, useDragLayer, XYCoord } from 'react-dnd';
import { DragSource } from '../../typings';

interface DragLayerProps {
  data: DragSource;
  currentOffset: XYCoord | null;
  isDragging: boolean;
}

const subtract = (a: XYCoord, b: XYCoord): XYCoord => ({
  x: a.x - b.x,
  y: a.y - b.y,
});

const calculateParentOffset = (monitor: DragLayerMonitor): XYCoord => {
  const client = monitor.getInitialClientOffset();
  const source = monitor.getInitialSourceClientOffset();
  if (client === null || source === null) return { x: 0, y: 0 };
  return subtract(client, source);
};

export const calculatePointerPosition = (
  monitor: DragLayerMonitor,
  childRef: RefObject<Element>
): XYCoord | null => {
  const offset = monitor.getClientOffset();
  if (offset === null) return null;
  if (!childRef.current || !childRef.current.getBoundingClientRect) {
    return subtract(offset, calculateParentOffset(monitor));
  }
  const bb = childRef.current.getBoundingClientRect();
  const middle = { x: bb.width / 2, y: bb.height / 2 };
  return subtract(offset, middle);
};

const DragPreview: React.FC = () => {
  const element = useRef<HTMLDivElement>(null);

  const { data, isDragging, currentOffset } = useDragLayer<DragLayerProps>((monitor) => ({
    data: monitor.getItem(),
    currentOffset: calculatePointerPosition(monitor, element),
    isDragging: monitor.isDragging(),
  }));

  // ── Toggle class 'dragging' on .inv-root so SCSS can make panels opaque ──
  useEffect(() => {
    const root = document.querySelector('.inv-root');
    if (!root) return;
    if (isDragging) {
      root.classList.add('dragging');
    } else {
      root.classList.remove('dragging');
    }
  }, [isDragging]);

  return (
    <>
      {isDragging && currentOffset && data?.item && (
        <div
          className="item-drag-preview"
          ref={element}
          style={{
            transform: `translate(${currentOffset.x}px, ${currentOffset.y}px)`,
            backgroundImage: data.image,
          }}
        />
      )}
    </>
  );
};

export default DragPreview;