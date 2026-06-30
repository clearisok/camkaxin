import { useEffect, useState } from 'react';
import { getQuotations, getBrands, getFabrics, getAccessories } from '@/api';
import { getOfflineNotifications, getMonthlySummary, getStyles } from '@/api/styles';
import { useAuth } from '@/contexts/AuthContext';
import type { Quotation } from '@/types';
import type { MonthlySummaryItem, StyleRecord } from '@/types/style';

export interface DashboardStats {
  quotations: number;
  drafts: number;
  confirmed: number;
  brands: number;
  fabrics: number;
  accessories: number;
  styles: number;
  unscheduled: number;
  offlinePending: number;
  closingMonthCount: number;
  currentMonthOutput: number;
}

const EMPTY_STATS: DashboardStats = {
  quotations: 0,
  drafts: 0,
  confirmed: 0,
  brands: 0,
  fabrics: 0,
  accessories: 0,
  styles: 0,
  unscheduled: 0,
  offlinePending: 0,
  closingMonthCount: 0,
  currentMonthOutput: 0,
};

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

function currentClosingMonthLabel(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function useDashboardData() {
  const { hasPermission } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>(EMPTY_STATS);
  const [recentQuotations, setRecentQuotations] = useState<Quotation[]>([]);
  const [offlineStyles, setOfflineStyles] = useState<StyleRecord[]>([]);
  const [urgentStyles, setUrgentStyles] = useState<StyleRecord[]>([]);
  const [monthlySummary, setMonthlySummary] = useState<MonthlySummaryItem[]>([]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      const next = { ...EMPTY_STATS };
      let recent: Quotation[] = [];
      let offline: StyleRecord[] = [];
      let urgent: StyleRecord[] = [];
      let monthly: MonthlySummaryItem[] = [];

      const tasks: Promise<void>[] = [];

      if (hasPermission('menu.quotations.view')) {
        tasks.push(
          safe(async () => {
            const [all, drafts, confirmed, list] = await Promise.all([
              getQuotations({ pageSize: 1 }),
              getQuotations({ status: 'draft', pageSize: 1 }),
              getQuotations({ status: 'confirmed', pageSize: 1 }),
              getQuotations({ pageSize: 6 }),
            ]);
            next.quotations = all.total || 0;
            next.drafts = drafts.total || 0;
            next.confirmed = confirmed.total || 0;
            recent = list.data || [];
          }, undefined),
        );
      }

      if (hasPermission('menu.scheduling.view')) {
        tasks.push(
          safe(async () => {
            const [allStyles, unscheduled, offlineRes, monthlyRes] = await Promise.all([
              getStyles({ view: 'early_warning' }),
              getStyles({ view: 'early_warning', unscheduled_only: true }),
              getOfflineNotifications(),
              getMonthlySummary(),
            ]);
            const styleList = allStyles.data || [];
            next.styles = styleList.length;
            next.unscheduled = (unscheduled.data || []).length;
            offline = (offlineRes.data || []).slice(0, 5);
            next.offlinePending = offlineRes.data?.length || 0;
            monthly = monthlyRes.data || [];
            next.closingMonthCount = monthly.length;
            const currentMonth = currentClosingMonthLabel();
            const current = monthly.find((m) => m.closing_month === currentMonth);
            next.currentMonthOutput = current?.total_sales_output_value ?? 0;

            urgent = styleList
              .filter((s) => s.required_shipping_date && !s.group_name)
              .sort((a, b) =>
                String(a.required_shipping_date).localeCompare(String(b.required_shipping_date)),
              )
              .slice(0, 5);
          }, undefined),
        );
      }

      if (hasPermission('config.brands.manage')) {
        tasks.push(
          safe(async () => {
            const res = await getBrands();
            next.brands = res.data?.length || 0;
          }, undefined),
        );
      }

      if (hasPermission('config.fabrics.manage')) {
        tasks.push(
          safe(async () => {
            const res = await getFabrics();
            next.fabrics = res.data?.length || 0;
          }, undefined),
        );
      }

      if (hasPermission('config.accessories.manage')) {
        tasks.push(
          safe(async () => {
            const res = await getAccessories();
            next.accessories = res.data?.length || 0;
          }, undefined),
        );
      }

      await Promise.all(tasks);

      if (!cancelled) {
        setStats(next);
        setRecentQuotations(recent);
        setOfflineStyles(offline);
        setUrgentStyles(urgent);
        setMonthlySummary(monthly);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hasPermission]);

  return {
    loading,
    stats,
    recentQuotations,
    offlineStyles,
    urgentStyles,
    monthlySummary,
  };
}
