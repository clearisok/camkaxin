import { useState, useCallback, useRef, useEffect } from 'react';
import { Upload, Progress, message } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import { uploadFile } from '@/api';
import AttachmentPreviewList from '@/components/AttachmentPreviewList';

interface FileUploadProps {
  value?: string[];
  onChange?: (paths: string[]) => void;
  accept?: string;
  maxCount?: number;
  hint?: string;
  compact?: boolean;
  mini?: boolean;
  hideDraggerWhenFull?: boolean;
  showPreview?: boolean;
}

function isAcceptedFile(file: File, accept: string): boolean {
  const parts = accept.split(',').map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return true;
  return parts.some((part) => {
    if (part.startsWith('.')) {
      return file.name.toLowerCase().endsWith(part.toLowerCase());
    }
    if (part.endsWith('/*')) {
      return file.type.startsWith(part.slice(0, -1));
    }
    return file.type === part;
  });
}

function readClipboardFiles(data: DataTransfer | null): File[] {
  if (!data) return [];
  const files: File[] = [];
  if (data.files?.length) {
    for (let i = 0; i < data.files.length; i++) {
      files.push(data.files[i]);
    }
  }
  if (files.length === 0 && data.items) {
    for (let i = 0; i < data.items.length; i++) {
      const item = data.items[i];
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) files.push(file);
      }
    }
  }
  return files;
}

export default function FileUpload({
  value = [],
  onChange,
  accept = 'image/*,video/*,.pdf,.doc,.docx',
  maxCount = 5,
  hint = '点击、拖拽或粘贴文件到此处上传',
  compact = false,
  mini = false,
  hideDraggerWhenFull = false,
  showPreview = true,
}: FileUploadProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const valueRef = useRef(value);
  valueRef.current = value;

  const [dragOver, setDragOver] = useState(false);
  const [pasteReady, setPasteReady] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const uploadFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      let paths = [...valueRef.current];

      setUploading(true);
      try {
        for (const file of files) {
          if (paths.length >= maxCount) {
            message.warning(`最多上传 ${maxCount} 个文件`);
            break;
          }
          if (!isAcceptedFile(file, accept)) {
            message.warning(`不支持该文件类型：${file.name}`);
            continue;
          }
          setProgress(0);
          const result = await uploadFile(file, setProgress);
          paths = [...paths, result.path];
          onChange?.(paths);
        }
        if (paths.length > valueRef.current.length) {
          message.success('上传成功');
        }
      } catch (err) {
        message.error(String(err));
      } finally {
        setUploading(false);
        setProgress(0);
      }
    },
    [maxCount, onChange, accept]
  );

  const handleUpload = useCallback(
    async (file: File) => {
      await uploadFiles([file]);
      return false;
    },
    [uploadFiles]
  );

  useEffect(() => {
    const onDocumentPaste = (e: ClipboardEvent) => {
      if (!pasteReady || uploading) return;
      const files = readClipboardFiles(e.clipboardData);
      if (files.length === 0) return;
      e.preventDefault();
      uploadFiles(files);
    };
    document.addEventListener('paste', onDocumentPaste);
    return () => document.removeEventListener('paste', onDocumentPaste);
  }, [pasteReady, uploadFiles, uploading]);

  const handleRemove = (index: number) => {
    onChange?.(value.filter((_, i) => i !== index));
  };

  const disabled = uploading || value.length >= maxCount;
  const hideDragger = hideDraggerWhenFull && value.length >= maxCount;
  const draggerClass = [
    'upload-dragger',
    compact && 'upload-dragger-compact',
    mini && 'upload-dragger-mini',
    (dragOver || pasteReady) && 'drag-over',
  ].filter(Boolean).join(' ');

  return (
    <div ref={containerRef} className="space-y-2">
      {showPreview && value.length > 0 && (
        <AttachmentPreviewList paths={value} onRemove={handleRemove} />
      )}

      {!hideDragger && (
        <div
          className={draggerClass}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={() => setDragOver(false)}
          onMouseEnter={() => setPasteReady(true)}
          onMouseLeave={() => setPasteReady(false)}
          onFocus={() => setPasteReady(true)}
          onBlur={() => setPasteReady(false)}
          tabIndex={0}
        >
          <Upload.Dragger
            accept={accept}
            showUploadList={false}
            beforeUpload={handleUpload}
            disabled={disabled}
            className="border-none bg-transparent !p-0"
          >
            <p className={`ant-upload-drag-icon ${compact || mini ? '!mb-0' : ''}`}>
              <InboxOutlined className={`text-brand-500 ${mini ? 'text-base' : compact ? 'text-xl' : 'text-3xl'}`} />
            </p>
            <p className={`text-gray-600 ${mini ? 'text-xs leading-tight' : compact ? 'text-xs' : 'text-sm'}`}>{hint}</p>
          </Upload.Dragger>
        </div>
      )}

      {uploading && (
        <Progress percent={progress} size="small" strokeColor="#2563eb" />
      )}
    </div>
  );
}
