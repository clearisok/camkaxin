import type { ReactNode } from 'react';
import { Button } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  description?: string;
  extra?: ReactNode;
  onBack?: () => void;
}

export default function PageHeader({ title, subtitle, description, extra, onBack }: PageHeaderProps) {
  return (
    <div className="page-header">
      <div className="flex items-center gap-3 min-w-0">
        {onBack && (
          <Button size="small" icon={<ArrowLeftOutlined />} onClick={onBack}>
            返回
          </Button>
        )}
        <div className="min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <h1 className="page-header-title">{title}</h1>
            {subtitle && <span className="page-header-subtitle">{subtitle}</span>}
          </div>
          {description && <p className="page-header-desc">{description}</p>}
        </div>
      </div>
      {extra && <div className="page-header-extra">{extra}</div>}
    </div>
  );
}
