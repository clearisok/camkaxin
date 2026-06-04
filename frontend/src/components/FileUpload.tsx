import { useState, useCallback } from 'react';
import { Upload, Progress, message } from 'antd';
import { InboxOutlined, DeleteOutlined, FileImageOutlined, VideoCameraOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd/es/upload/interface';
import { uploadFile } from '@/api';

interface FileUploadProps {
  value?: string[];
  onChange?: (paths: string[]) => void;
  accept?: string;
  maxCount?: number;
  listType?: 'picture' | 'text';
  hint?: string;
}

export default function FileUpload({
  value = [],
  onChange,
  accept = 'image/*,video/*,.pdf,.doc,.docx',
  maxCount = 5,
  listType = 'picture',
  hint = '点击或拖拽文件到此区域上传',
}: FileUploadProps) {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const fileList: UploadFile[] = value.map((path, i) => ({
    uid: `${i}`,
    name: path.split('/').pop() || path,
    status: 'done' as const,
    url: `/${path}`,
  }));

  const handleUpload = useCallback(
    async (file: File) => {
      if (value.length >= maxCount) {
        message.warning(`最多上传 ${maxCount} 个文件`);
        return false;
      }

      setUploading(true);
      setProgress(0);
      try {
        const result = await uploadFile(file, setProgress);
        onChange?.([...value, result.path]);
        message.success('上传成功');
      } catch (err) {
        message.error(String(err));
      } finally {
        setUploading(false);
        setProgress(0);
      }
      return false;
    },
    [value, maxCount, onChange]
  );

  const handleRemove = (uid: string) => {
    const idx = parseInt(uid, 10);
    onChange?.(value.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-3">
      <div
        className={`upload-dragger ${dragOver ? 'drag-over' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={() => setDragOver(false)}
      >
      <Upload.Dragger
        accept={accept}
        showUploadList={false}
        beforeUpload={handleUpload}
        disabled={uploading || value.length >= maxCount}
        className="border-none bg-transparent"
      >
        <p className="ant-upload-drag-icon">
          <InboxOutlined className="text-brand-500 text-3xl" />
        </p>
        <p className="text-gray-600">{hint}</p>
        <p className="text-gray-400 text-sm">图片≤5MB自动压缩，视频≤500MB</p>
      </Upload.Dragger>
      </div>

      {uploading && (
        <Progress percent={progress} size="small" strokeColor="#2563eb" />
      )}

      {fileList.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {fileList.map((file) => (
            <div
              key={file.uid}
              className="relative group border rounded-lg p-2 bg-gray-50 flex items-center gap-2"
            >
              {file.url?.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                <img src={file.url} alt="" className="w-12 h-12 object-cover rounded" />
              ) : file.url?.match(/\.(mp4|webm|mov)$/i) ? (
                <VideoCameraOutlined className="text-2xl text-brand-500" />
              ) : (
                <FileImageOutlined className="text-2xl text-gray-400" />
              )}
              <span className="text-sm text-gray-600 max-w-[120px] truncate">{file.name}</span>
              <button
                type="button"
                onClick={() => handleRemove(file.uid)}
                className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <DeleteOutlined className="text-xs" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
