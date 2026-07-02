import type { ReactNode } from 'react';
import styles from './SectionCard.module.css';

export interface SectionCardProps {
  title: string;
  extra?: ReactNode;
  children: ReactNode;
  className?: string;
  /** 无顶部分割线（页面首区块） */
  flush?: boolean;
}

export default function SectionCard({
  title,
  extra,
  children,
  className,
  flush,
}: SectionCardProps) {
  return (
    <section className={[styles.section, flush ? styles.flush : '', className].filter(Boolean).join(' ')}>
      <div className={styles.header}>
        <h3 className={styles.title}>{title}</h3>
        {extra ? <div className={styles.extra}>{extra}</div> : null}
      </div>
      <div className={styles.body}>{children}</div>
    </section>
  );
}
