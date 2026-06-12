import { useState } from 'react';
import { Image, Modal } from 'antd';

interface StyleImageCellProps {
  src?: string;
  /** 固定正方形边长（表格等紧凑场景） */
  size?: number;
  /** 最大宽/高，保持原图比例（排单面板等） */
  maxSize?: number;
  /** 无图时仍保留占位，避免布局塌陷 */
  placeholder?: boolean;
}

export default function StyleImageCell({
  src,
  size = 48,
  maxSize,
  placeholder = false,
}: StyleImageCellProps) {
  const [open, setOpen] = useState(false);

  if (!src) {
    if (!placeholder) return <span className="text-gray-300">—</span>;
    const placeholderSize = maxSize ?? size;
    return (
      <span
        className="style-image-placeholder"
        style={{ width: placeholderSize, height: placeholderSize }}
        aria-hidden
      />
    );
  }

  const url = src.startsWith('http') || src.startsWith('/') ? src : `/${src}`;

  const imageProps = maxSize
    ? { style: { maxWidth: maxSize, maxHeight: maxSize } as const }
    : { width: size, height: size };

  return (
    <>
      <Image
        src={url}
        {...imageProps}
        className="rounded object-contain bg-gray-50 cursor-pointer style-image-cell-img"
        preview={false}
        onClick={() => setOpen(true)}
      />
      <Modal open={open} footer={null} onCancel={() => setOpen(false)} width={640} centered>
        <img src={url} alt="款式图" className="w-full max-h-[70vh] object-contain" />
      </Modal>
    </>
  );
}
