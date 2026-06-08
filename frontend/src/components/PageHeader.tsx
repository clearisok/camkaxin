import type { ReactNode } from 'react';
import { Button } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';

interface PageHeaderProps {
  /** @deprecated 界面名称已全局隐藏，保留参数仅为兼容旧调用 */
  title?: string;
  subtitle?: string;
  description?: string;
  extra?: ReactNode;
  onBack?: () => void;
}

export default function PageHeader({ extra, onBack }: PageHeaderProps) {
  if (!extra && !onBack) return null;

  return (
    <div className="page-header">
      <div className="flex items-center gap-3 min-w-0">
        {onBack && (
          <Button size="small" icon={<ArrowLeftOutlined />} onClick={onBack}>
            返回
          </Button>
        )}
      </div>
      {extra && <div className="page-header-extra">{extra}</div>}
    </div>
  );
}
