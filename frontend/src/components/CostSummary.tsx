import { useEffect, useRef } from 'react';
import { Divider } from 'antd';

interface CostSummaryProps {
  fabricTotal: number;
  accessoryTotal: number;
  laborRmb: number;
  otherCostRmb: number;
  shippingRmb: number;
  subtotalRmb: number;
  finalPrice: number;
  currency: 'RMB' | 'USD';
  profitMargin: number;
}

function AnimatedValue({ value, prefix = '', suffix = '' }: { value: number; prefix?: string; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.classList.remove('cost-value-animate');
      void ref.current.offsetWidth;
      ref.current.classList.add('cost-value-animate');
    }
  }, [value]);

  return (
    <span ref={ref} className="font-semibold tabular-nums">
      {prefix}{Number(value).toFixed(2)}{suffix}
    </span>
  );
}

export default function CostSummary({
  fabricTotal,
  accessoryTotal,
  laborRmb,
  otherCostRmb,
  shippingRmb,
  subtotalRmb,
  finalPrice,
  currency,
  profitMargin,
}: CostSummaryProps) {
  const rows = [
    { label: '面料总成本', value: fabricTotal, color: 'text-gray-700' },
    { label: '辅料总成本', value: accessoryTotal, color: 'text-gray-700' },
    { label: '工价 (RMB)', value: laborRmb, color: 'text-gray-700' },
    { label: '其他费用', value: otherCostRmb, color: 'text-gray-700' },
    { label: '运费', value: shippingRmb, color: 'text-gray-700' },
  ];

  return (
    <div className="cost-summary-panel">
      <h3 className="text-base font-semibold text-brand-800 mb-4">成本汇总</h3>

      <div className="space-y-2.5">
        {rows.map((row) => (
          <div key={row.label} className="flex justify-between items-center text-sm">
            <span className="text-gray-500">{row.label}</span>
            <AnimatedValue value={row.value} prefix="¥" />
          </div>
        ))}
      </div>

      <Divider className="my-3" />

      <div className="flex justify-between items-center text-sm mb-2">
        <span className="text-gray-600 font-medium">成本小计</span>
        <AnimatedValue value={subtotalRmb} prefix="¥" />
      </div>

      <div className="flex justify-between items-center text-sm mb-3">
        <span className="text-gray-500">利润率</span>
        <span className="text-gray-600">{profitMargin}%</span>
      </div>

      <div className="bg-brand-600 text-white rounded-lg p-4 flex justify-between items-center">
        <span className="font-medium">最终报价</span>
        <span className="text-xl font-bold tabular-nums cost-value-animate">
          {currency === 'USD' ? '$' : '¥'}{Number(finalPrice).toFixed(2)}
        </span>
      </div>
    </div>
  );
}
