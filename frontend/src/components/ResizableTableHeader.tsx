import { useRef, useState } from 'react';
import { clampColumnWidth } from '@/utils/quotationListColumnPrefs';

export interface ResizableHeaderCellProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  width?: number;
  onResize?: (width: number) => void;
  onResizeStop?: (width: number) => void;
}

export default function ResizableTableHeader({
  width,
  onResize,
  onResizeStop,
  style,
  children,
  ...restProps
}: ResizableHeaderCellProps) {
  const [resizing, setResizing] = useState(false);
  const startRef = useRef({ x: 0, width: 0 });

  const textAlign = style?.textAlign ?? 'center';

  if (!width || !onResize) {
    return (
      <th {...restProps} style={{ ...style, textAlign }}>
        {children}
      </th>
    );
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    startRef.current = { x: e.clientX, width };
    setResizing(true);
    document.body.classList.add('table-col-resizing');

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startRef.current.x;
      const next = clampColumnWidth(startRef.current.width + delta, startRef.current.width);
      onResize(next);
    };

    const onMouseUp = (upEvent: MouseEvent) => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.classList.remove('table-col-resizing');
      setResizing(false);
      const delta = upEvent.clientX - startRef.current.x;
      const next = clampColumnWidth(startRef.current.width + delta, startRef.current.width);
      onResizeStop?.(next);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const lockedWidth = width != null
    ? { width, minWidth: width, maxWidth: width }
    : {};

  return (
    <th
      {...restProps}
      style={{ ...style, position: 'relative', textAlign, ...lockedWidth }}
    >
      <div className="table-col-header-content">{children}</div>
      <span
        className={`table-col-resize-handle${resizing ? ' is-resizing' : ''}`}
        onMouseDown={handleMouseDown}
        onClick={(e) => e.stopPropagation()}
      />
    </th>
  );
}
