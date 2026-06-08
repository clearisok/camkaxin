import { Button } from 'antd';
import FileUpload from '@/components/FileUpload';
import AttachmentPreviewList from '@/components/AttachmentPreviewList';

interface StyleImageUploadProps {
  value?: string;
  onChange: (path?: string) => void;
  readOnly?: boolean;
}

export default function StyleImageUpload({ value, onChange, readOnly }: StyleImageUploadProps) {
  if (readOnly) {
    return value ? (
      <AttachmentPreviewList paths={[value]} variant="large" />
    ) : (
      <span className="text-gray-400">—</span>
    );
  }

  if (value) {
    return (
      <div className="space-y-2">
        <AttachmentPreviewList
          paths={[value]}
          variant="large"
          onRemove={() => onChange(undefined)}
        />
        <Button type="link" size="small" className="!px-0" onClick={() => onChange(undefined)}>
          更换款式图
        </Button>
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
