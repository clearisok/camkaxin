import type { ReactNode } from 'react';
import styles from './FormPageLayout.module.css';
import { PageHeader } from '@/components/ui';

export interface FormPageLayoutProps {
  title?: string;
  subtitle?: string;
  main: ReactNode;
  sidebar?: ReactNode;
  actions?: ReactNode;
  onBack?: () => void;
  className?: string;
}

/** 模板 C：表单编辑页 — 左主区 70% + 右侧栏 30% */
export default function FormPageLayout({
  title,
  subtitle,
  main,
  sidebar,
  actions,
  onBack,
  className,
}: FormPageLayoutProps) {
  return (
    <div className={[styles.page, className].filter(Boolean).join(' ')}>
      {(title || actions) && (
        <PageHeader title={title} subtitle={subtitle} onBack={onBack} actions={actions} />
      )}
      <div className={styles.body}>
        <div className={styles.main}>{main}</div>
        {sidebar ? <aside className={styles.sidebar}>{sidebar}</aside> : null}
      </div>
    </div>
  );
}
