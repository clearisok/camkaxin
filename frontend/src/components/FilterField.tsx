import type { ReactNode } from 'react';

interface FilterFieldProps {
  label: string;
  children: ReactNode;
  className?: string;
}

/** 带标签的筛选项，便于扫读 */
export default function FilterField({ label, children, className = '' }: FilterFieldProps) {
  return (
    <div className={`filter-field ${className}`.trim()}>
      <span className="filter-field-label">{label}</span>
      {children}
    </div>
  );
}
