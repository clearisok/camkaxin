import { useState } from 'react';
import { Image, Modal } from 'antd';

interface StyleImageCellProps {
  src?: string;
  size?: number;
}

export default function StyleImageCell({ src, size = 48 }: StyleImageCellProps) {
  const [open, setOpen] = useState(false);
  if (!src) return <span className="text-gray-300">—</span>;
  const url = src.startsWith('http') || src.startsWith('/') ? src : `/${src}`;

  return (
    <>
      <Image
        src={url}
        width={size}
        height={size}
        className="rounded object-contain bg-gray-50 cursor-pointer"
        preview={false}
        onClick={() => setOpen(true)}
      />
      <Modal open={open} footer={null} onCancel={() => setOpen(false)} width={640} centered>
        <img src={url} alt="款式图" className="w-full max-h-[70vh] object-contain" />
      </Modal>
    </>
  );
}
