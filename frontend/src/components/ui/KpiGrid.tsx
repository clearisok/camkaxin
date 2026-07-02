import type { ReactNode } from 'react';
import styles from './KpiGrid.module.css';

export type KpiItemWidth = 'default' | 'wide' | 'full';

export interface KpiGridItem {
  label: string;
  value?: ReactNode;
  itemWidth?: KpiItemWidth;
  /** @deprecated use itemWidth */
  wide?: boolean;
}

export interface KpiGridProps {
  items: KpiGridItem[];
  className?: string;
}

function resolveWidth(item: KpiGridItem): KpiItemWidth {
  if (item.itemWidth) return item.itemWidth;
  if (item.wide) return 'wide';
  return 'default';
}

export default function KpiGrid({ items, className }: KpiGridProps) {
  return (
    <div className={[styles.grid, className].filter(Boolean).join(' ')}>
      {items.map((item) => {
        const width = resolveWidth(item);
        const cellClass = [
          styles.cell,
          width === 'wide' ? styles.cellWide : '',
          width === 'full' ? styles.cellFull : '',
        ]
          .filter(Boolean)
          .join(' ');

        return (
          <div key={item.label} className={cellClass}>
            <span className={styles.label}>{item.label}</span>
            <span className={[styles.value, width === 'wide' ? styles.valueWide : ''].filter(Boolean).join(' ')}>
              {item.value ?? '—'}
            </span>
          </div>
        );
      })}
    </div>
  );
}
