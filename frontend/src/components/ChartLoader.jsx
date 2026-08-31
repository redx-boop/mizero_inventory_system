import { useMemo } from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement } from 'chart.js';
import { Doughnut, Bar } from 'react-chartjs-2';
import { HiOutlineSwitchHorizontal, HiOutlineChartBar } from 'react-icons/hi';

// Register Chart.js components once (module-level, runs once per chunk load)
ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement);

export default function ChartLoader({ stockChartData, categoryChartData, barOptions, doughnutOptions, data }) {
  const hasStockData = useMemo(() => data?.stock_in_out_chart?.length > 0, [data?.stock_in_out_chart]);
  const hasCategoryData = useMemo(() => data?.category_chart?.length > 0, [data?.category_chart]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="chart-container" style={{ height: '420px' }}>
        <div className="section-header">
          <h3>Stock In vs Stock Out (7 Days)</h3>
          <HiOutlineSwitchHorizontal className="section-icon" />
        </div>
        <div style={{ height: '330px' }}>
          {hasStockData ? (
            <Bar data={stockChartData} options={barOptions} />
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>No stock activity data</p>
            </div>
          )}
        </div>
      </div>

      <div className="chart-container" style={{ height: '420px' }}>
        <div className="section-header">
          <h3>Inventory by Category</h3>
          <HiOutlineChartBar className="section-icon" />
        </div>
        <div style={{ height: '330px' }} className="flex items-center justify-center">
          {hasCategoryData ? (
            <div className="w-full max-w-xs">
              <Doughnut data={categoryChartData} options={doughnutOptions} />
            </div>
          ) : (
            <p className="text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>No category data</p>
          )}
        </div>
      </div>
    </div>
  );
}
