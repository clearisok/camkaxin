import type { ReactNode } from 'react';
import styles from './DetailHero.module.css';
import KpiGrid, { type KpiGridItem } from './KpiGrid';
import StatCard, { type StatCardProps } from './StatCard';

export interface DetailHeroProps {
  image?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  tags?: ReactNode;
  kpiItems?: KpiGridItem[];
  stats?: StatCardProps[];
  className?: string;
}

export default function DetailHero({
  image,
  title,
  subtitle,
  tags,
  kpiItems,
  stats,
  className,
}: DetailHeroProps) {
  return (
    <div className={[styles.hero, className].filter(Boolean).join(' ')}>
      {image ? <div className={styles.image}>{image}</div> : null}
      <div className={styles.main}>
        <div className={styles.head}>
          <div className={styles.titles}>
            <h2 className={styles.title}>{title}</h2>
            {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
          </div>
          {tags ? <div className={styles.tags}>{tags}</div> : null}
        </div>
        {kpiItems?.length ? <KpiGrid items={kpiItems} /> : null}
      </div>
      {stats?.length ? (
        <div className={styles.stats}>
          {stats.map((stat) => (
            <StatCard key={stat.label} {...stat} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
