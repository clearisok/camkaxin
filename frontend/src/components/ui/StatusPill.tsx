import type { ReactNode } from 'react';
import styles from './StatusPill.module.css';
import type { StatusTone } from '@/design/tokens';

export interface StatusPillProps {
  children: ReactNode;
  status?: StatusTone;
  className?: string;
}

export default function StatusPill({ children, status = 'default', className }: StatusPillProps) {
  return (
    <span className={[styles.pill, styles[status], className].filter(Boolean).join(' ')}>
      <span className={styles.dot} aria-hidden />
      {children}
    </span>
  );
}
