import type { ReactNode } from 'react';
import { Button } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import styles from './PageHeader.module.css';

export interface PageHeaderProps {
  title?: string;
  subtitle?: string;
  description?: string;
  /** @deprecated use actions */
  extra?: ReactNode;
  actions?: ReactNode;
  onBack?: () => void;
}

export default function PageHeader({
  title,
  subtitle,
  description,
  extra,
  actions,
  onBack,
}: PageHeaderProps) {
  const actionSlot = actions ?? extra;
  const hasMain = Boolean(title || description || subtitle || onBack);
  if (!hasMain && !actionSlot) return null;

  return (
    <div className={styles.block}>
      {hasMain && (
        <div className={styles.main}>
          {onBack && (
            <Button icon={<ArrowLeftOutlined />} onClick={onBack} className={styles.back}>
              返回
            </Button>
          )}
          <div className={styles.text}>
            {title && <h2 className={styles.title}>{title}</h2>}
            {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
            {description && <p className={styles.desc}>{description}</p>}
          </div>
        </div>
      )}
      {actionSlot ? <div className={styles.actions}>{actionSlot}</div> : null}
    </div>
  );
}
