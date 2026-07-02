import type { ReactNode } from 'react';
import styles from './DetailPageLayout.module.css';

export interface DetailPageLayoutProps {
  hero?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** 模板 B：详情页 — Hero → 折叠/区块 → SectionCard */
export default function DetailPageLayout({ hero, children, className }: DetailPageLayoutProps) {
  return (
    <div className={[styles.page, className].filter(Boolean).join(' ')}>
      <div className={`card-panel ${styles.panel}`}>
        {hero}
        {children}
      </div>
    </div>
  );
}
