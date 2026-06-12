import { Button } from 'antd';
import FileUpload from '@/components/FileUpload';
import AttachmentPreviewList from '@/components/AttachmentPreviewList';

interface StyleImageUploadProps {
  value?: string;
  onChange: (path?: string) => void;
  readOnly?: boolean;
  compact?: boolean;
}

export default function StyleImageUpload({ value, onChange, readOnly, compact }: StyleImageUploadProps) {
  const previewVariant = compact ? 'thumb' : 'large';
  const previewSize = compact ? 56 : undefined;

  if (readOnly) {
    return value ? (
      <AttachmentPreviewList paths={[value]} variant={previewVariant} size={previewSize} />
    ) : (
      <span className="text-gray-400">—</span>
    );
  }

  if (value) {
    return (
      <div className={compact ? 'style-form-image-compact-preview' : 'space-y-2'}>
        <AttachmentPreviewList
          paths={[value]}
          variant={previewVariant}
          size={previewSize}
          onRemove={() => onChange(undefined)}
        />
        {!compact && (
          <Button type="link" size="small" className="!px-0" onClick={() => onChange(undefined)}>
            更换款式图
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="style-form-image-upload max-w-[180px]">
      <FileUpload
        value={[]}
        onChange={(paths) => onChange(paths[0])}
        maxCount={1}
        accept="image/*"
        hint="上传款式图 点击、拖拽或粘贴"
        compact
        mini
        hideDraggerWhenFull
        showPreview={false}
      />
    </div>
  );
}
