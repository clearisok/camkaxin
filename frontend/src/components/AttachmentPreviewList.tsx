import { useState } from 'react';
import { Image, Modal } from 'antd';
import { DeleteOutlined, PlayCircleOutlined, FileOutlined } from '@ant-design/icons';

export function isImagePath(path: string): boolean {
  return /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(path);
}

export function isVideoPath(path: string): boolean {
  return /\.(mp4|webm|mov|avi|mkv)$/i.test(path);
}

interface AttachmentPreviewListProps {
  paths: string[];
  onRemove?: (index: number) => void;
  size?: number;
  variant?: 'thumb' | 'large';
}

function RemoveBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
    >
      <DeleteOutlined className="text-xs" />
    </button>
  );
}

export default function AttachmentPreviewList({
  paths,
  onRemove,
  size = 80,
  variant = 'thumb',
}: AttachmentPreviewListProps) {
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const removable = onRemove != null;
  const isLarge = variant === 'large';

  if (paths.length === 0) return null;

  const imageItems = paths
    .map((path, index) => ({ path, index }))
    .filter(({ path }) => isImagePath(path));

  const otherItems = paths
    .map((path, index) => ({ path, index }))
    .filter(({ path }) => !isImagePath(path));

  return (
    <>
      <div className={`flex flex-wrap gap-2 ${isLarge ? 'items-start' : ''}`}>
        <Image.PreviewGroup>
          {imageItems.map(({ path, index }) => {
            const url = `/${path}`;
            return (
              <div key={`${path}-${index}`} className="relative group inline-block">
                {isLarge ? (
                  <Image
                    src={url}
                    className="rounded-lg border border-gray-200 object-contain bg-gray-50"
                    style={{ maxHeight: 320, maxWidth: '100%' }}
                  />
                ) : (
                  <Image
                    src={url}
                    width={size}
                    height={size}
                    className="rounded-lg border border-gray-200"
                    style={{ objectFit: 'contain' }}
                  />
                )}
                {removable && <RemoveBtn onClick={() => onRemove!(index)} />}
              </div>
            );
          })}
        </Image.PreviewGroup>

        {otherItems.map(({ path, index }) => {
          const url = `/${path}`;
          const boxStyle = isLarge
            ? { width: Math.min(size * 2, 240), height: Math.min(size * 2, 180) }
            : { width: size, height: size };

          if (isVideoPath(path)) {
            return (
              <div key={`${path}-${index}`} className="relative group">
                <button
                  type="button"
                  onClick={() => setVideoPreview(url)}
                  className="rounded-lg border border-gray-200 bg-gray-900 flex items-center justify-center overflow-hidden hover:opacity-90 transition-opacity"
                  style={boxStyle}
                >
                  <video src={url} className="w-full h-full object-contain pointer-events-none" muted />
                  <PlayCircleOutlined className="absolute text-white text-2xl drop-shadow" />
                </button>
                {removable && <RemoveBtn onClick={() => onRemove!(index)} />}
              </div>
            );
          }

          return (
            <div key={`${path}-${index}`} className="relative group">
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center hover:bg-gray-100 transition-colors"
                style={boxStyle}
              >
                <FileOutlined className="text-2xl text-gray-400" />
              </a>
              {removable && <RemoveBtn onClick={() => onRemove!(index)} />}
            </div>
          );
        })}
      </div>

      <Modal
        open={!!videoPreview}
        footer={null}
        onCancel={() => setVideoPreview(null)}
        width={720}
        destroyOnClose
        centered
      >
        {videoPreview && (
          <video src={videoPreview} controls autoPlay className="w-full max-h-[70vh] rounded-lg bg-black" />
        )}
      </Modal>
    </>
  );
}
