import type { ReactNode } from 'react';
import styles from './StatCard.module.css';

export type StatCardVariant = 'default' | 'primary' | 'success';

export interface StatCardProps {
  label: string;
  value: ReactNode;
  unit?: string;
  trend?: ReactNode;
  variant?: StatCardVariant;
  className?: string;
}

export default function StatCard({
  label,
  value,
  unit,
  trend,
  variant = 'default',
  className,
}: StatCardProps) {
  return (
    <div className={[styles.card, styles[variant], className].filter(Boolean).join(' ')}>
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>{value}</span>
      {unit ? <span className={styles.unit}>{unit}</span> : null}
      {trend ? <span className={styles.trend}>{trend}</span> : null}
    </div>
  );
}
