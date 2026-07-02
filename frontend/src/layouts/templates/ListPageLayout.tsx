import type { ReactNode } from 'react';
import styles from './ListPageLayout.module.css';
import { PageHeader } from '@/components/ui';

export interface ListPageLayoutProps {
  title?: string;
  subtitle?: string;
  filters?: ReactNode;
  toolbar?: ReactNode;
  children: ReactNode;
  onBack?: () => void;
  className?: string;
}

/** 模板 A：列表页 — 筛选 → 工具栏 → 表格 */
export default function ListPageLayout({
  title,
  subtitle,
  filters,
  toolbar,
  children,
  onBack,
  className,
}: ListPageLayoutProps) {
  return (
    <div className={[styles.page, className].filter(Boolean).join(' ')}>
      {(title || toolbar) && (
        <PageHeader title={title} subtitle={subtitle} onBack={onBack} actions={toolbar} />
      )}
      {filters ? <div className={styles.filters}>{filters}</div> : null}
      <div className={styles.content}>{children}</div>
    </div>
  );
}
