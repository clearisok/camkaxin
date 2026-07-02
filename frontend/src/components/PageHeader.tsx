import type { ReactNode } from 'react';
import { Button } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';

interface PageHeaderProps {
  title?: string;
  subtitle?: string;
  description?: string;
  extra?: ReactNode;
  onBack?: () => void;
}

export default function PageHeader({
  title,
  subtitle,
  description,
  extra,
  onBack,
}: PageHeaderProps) {
  const hasMain = Boolean(title || description || subtitle || onBack);
  if (!hasMain && !extra) return null;

  return (
    <div className="page-header-block">
      {hasMain && (
        <div className="page-header-main">
          {onBack && (
            <Button icon={<ArrowLeftOutlined />} onClick={onBack} className="page-header-back">
              返回
            </Button>
          )}
          <div className="page-header-text">
            {title && <h2 className="page-header-title">{title}</h2>}
            {subtitle && <p className="page-header-subtitle">{subtitle}</p>}
            {description && <p className="page-header-desc">{description}</p>}
          </div>
        </div>
      )}
      {extra && <div className="page-header-extra">{extra}</div>}
    </div>
  );
}
