import { useState, useEffect } from 'react';
import api from '../services/api';
import { Navigate } from 'react-router-dom';
import {
  HiOutlineCurrencyDollar, HiOutlineTrendingDown,
  HiOutlineCash, HiOutlineClipboardList, HiOutlineExclamationCircle,
  HiOutlineCube, HiOutlineOfficeBuilding, HiOutlineChartSquareBar,
  HiOutlineScale, HiOutlineDatabase
} from 'react-icons/hi';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, PointElement, LineElement, Filler } from 'chart.js';
import { Doughnut, Bar } from 'react-chartjs-2';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, PointElement, LineElement, Filler);

const formatRWF = (value) => {
  const num = Number(value || 0);
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function Analytics() {
  const { user, hasRole } = useAuth();
  const { dark } = useTheme();

  // 🛡️ Backstop guard — should never reach here if route works,
  // but prevents rendering if a staff user somehow bypasses route protection
  if (!hasRole('super_admin', 'admin', 'stock_manager')) {
    return <Navigate to="/dashboard" replace />;
  }
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const { data: res } = await api.get('/dashboard');
      setData(res);
    } catch (err) {
      setError('Failed to load analytics data');
      // Error handled silently - UI shows fallback state
    } finally {
      setLoading(false);
    }
  };

  // --- Metric Cards Configuration ---
  const metricCards = [
    {
      id: 'inventory_value',
      label: 'Inventory Value (RWF)',
      value: data?.total_inventory_value,
      icon: HiOutlineCurrencyDollar,
      color: 'blue',
      subtext: `${data?.total_items || 0} items in stock`
    },
    {
      id: 'cogs',
      label: 'COGS This Month (RWF)',
      value: data?.cogs_this_month,
      icon: HiOutlineTrendingDown,
      color: 'orange',
      subtext: 'Cost of goods sold'
    },
    {
      id: 'stock_in_value',
      label: 'Stock In Value This Month (RWF)',
      value: data?.stock_in_value_month,
      icon: HiOutlineCash,
      color: 'indigo',
      subtext: 'Total incoming stock value'
    },
    {
      id: 'borrowed_asset',
      label: 'Borrowed Asset Value (RWF)',
      value: data?.borrowed_asset_value,
      icon: HiOutlineClipboardList,
      color: 'yellow',
      subtext: `${data?.borrowed_items || 0} items currently borrowed`
    },
    {
      id: 'damaged_cost',
      label: 'Damaged Item Cost (RWF)',
      value: data?.damaged_item_cost,
      icon: HiOutlineExclamationCircle,
      color: 'red',
      subtext: 'Items returned damaged'
    },
    {
      id: 'lost_cost',
      label: 'Lost Item Cost (RWF)',
      value: data?.lost_item_cost,
      icon: HiOutlineCube,
      color: 'pink',
      subtext: 'Items returned lost'
    },
    {
      id: 'adjustment_losses',
      label: 'Adjustment Losses This Month',
      value: data?.adjustment_decrease_month,
      icon: HiOutlineScale,
      color: 'gray',
      subtext: data?.adjustment_increase_month > 0 ? `+${formatRWF(data.adjustment_increase_month)} gains` : 'Stock decrease adjustments'
    },
    {
      id: 'total_budget',
      label: 'Total Budget (FY 2026)',
      value: data?.total_budget,
      icon: HiOutlineOfficeBuilding,
      color: 'purple',
      subtext: data?.total_budget_used > 0 ? `${formatRWF(data.total_budget_used)} used (${data.total_budget > 0 ? ((data.total_budget_used / data.total_budget) * 100).toFixed(1) : 0}%)` : 'No budget data'
    }
  ];

  // --- Chart Data ---
  const stockChartData = {
    labels: data?.stock_in_out_chart?.map(d => {
      const date = new Date(d.date);
      return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    }) || [],
    datasets: [
      {
        label: 'Stock In',
        data: data?.stock_in_out_chart?.map(d => d.stock_in) || [],
        backgroundColor: 'rgba(34, 197, 94, 0.8)',
        borderColor: '#16a34a',
        borderWidth: 1,
        borderRadius: 6,
      },
      {
        label: 'Stock Out',
        data: data?.stock_in_out_chart?.map(d => d.stock_out) || [],
        backgroundColor: 'rgba(239, 68, 68, 0.8)',
        borderColor: '#dc2626',
        borderWidth: 1,
        borderRadius: 6,
      }
    ]
  };

  const categoryChartData = {
    labels: data?.category_chart?.map(c => c.category) || [],
    datasets: [{
      data: data?.category_chart?.map(c => c.count) || [],
      backgroundColor: [
        '#8B9EFF', '#C4B5FD', '#A78BFA', '#22c55e',
        '#f59e0b', '#ef4444', '#f97316', '#14b8a6',
        '#6366f1', '#ec4899'
      ],
      borderWidth: 2,
      borderColor: '#ffffff',
      hoverOffset: 8,
    }]
  };

  const gridColor = dark ? 'rgba(148, 163, 184, 0.1)' : 'rgba(0,0,0,0.06)';
  const textColor = dark ? '#94A3B8' : '#64748B';

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: { color: textColor, usePointStyle: true, padding: 20, font: { size: 12, family: "'Inter', sans-serif" } }
      },
      tooltip: {
        backgroundColor: dark ? '#1E293B' : '#FFFFFF',
        titleColor: dark ? '#F8FAFC' : '#0F172A',
        bodyColor: dark ? '#CBD5E1' : '#475569',
        borderColor: dark ? '#334155' : '#E2E8F0',
        borderWidth: 1,
        titleFont: { size: 13 },
        bodyFont: { size: 12 },
        padding: 12,
        cornerRadius: 8,
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: textColor, font: { size: 11 } }
      },
      y: {
        grid: { color: gridColor },
        ticks: { color: textColor, font: { size: 11 } },
        beginAtZero: true
      }
    }
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '55%',
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        backgroundColor: dark ? '#1E293B' : '#FFFFFF',
        titleColor: dark ? '#F8FAFC' : '#0F172A',
        bodyColor: dark ? '#CBD5E1' : '#475569',
        borderColor: dark ? '#334155' : '#E2E8F0',
        borderWidth: 1,
        padding: 14,
        cornerRadius: 8,
        caretPadding: 12,
        caretSize: 8,
        yAlign: 'bottom',
        xAlign: 'center'
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10" style={{ border: '4px solid var(--border-color)', borderTopColor: 'var(--primary)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-20">
        <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-red)', padding: '1rem 1.5rem', borderRadius: '0.75rem', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
          <p className="font-medium">{error}</p>
          <button onClick={fetchAnalytics} className="mt-2 text-sm underline hover:no-underline">Try again</button>
        </div>
      </div>
    );
  }

  const getColorClasses = (color) => {
    const map = {
      blue: { icon: 'dash-icon-blue' },
      orange: { icon: 'dash-icon-orange' },
      teal: { icon: 'dash-icon-teal' },
      indigo: { icon: 'dash-icon-indigo' },
      yellow: { icon: 'dash-icon-yellow' },
      red: { icon: 'dash-icon-red' },
      pink: { icon: 'dash-icon-pink' },
      gray: { icon: 'dash-icon-blue' },
      purple: { icon: 'dash-icon-purple' },
    };
    return map[color] || map.blue;
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Financial Analytics</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Comprehensive financial overview and inventory metrics</p>
        </div>
        <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
          <HiOutlineDatabase className="w-4 h-4" />
          <span>Last updated: {new Date().toLocaleDateString()}</span>
        </div>
      </div>

      {/* Summary Banner */}
      <div className="gradient-banner p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.75)' }}>Total Inventory Value</p>
            <p className="text-4xl font-bold mt-2 tracking-tight">
              {formatRWF(data?.total_inventory_value)} <span className="text-lg font-normal" style={{ color: 'rgba(255,255,255,0.7)' }}>RWF</span>
            </p>
            <p className="text-sm mt-2" style={{ color: 'rgba(255,255,255,0.7)' }}>
              {data?.total_items || 0} items • {data?.total_stock_quantity || 0} total quantity
            </p>
          </div>
          <div className="bg-white/10 p-4 rounded-xl hidden sm:block">
            <HiOutlineCurrencyDollar className="w-10 h-10" style={{ color: 'rgba(255,255,255,0.6)' }} />
          </div>
        </div>
      </div>

      {/* Financial Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {metricCards.map((card) => {
          const Icon = card.icon;
          const colors = getColorClasses(card.color);
          return (
            <div key={card.id}
              className="card hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 p-5 cursor-default"
            >
              <div className={`p-2.5 rounded-lg ${colors.icon}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="mt-3">
                <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>{card.label}</p>
                <p className="text-2xl font-bold mt-1 tracking-tight" style={{ color: 'var(--text-primary)' }}>
                  {formatRWF(card.value)}
                </p>
                {card.subtext && (
                  <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>{card.subtext}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stock In vs Stock Out (7 Days) */}
        <div className="chart-container" style={{ height: '400px' }}>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Stock In vs Stock Out (7 Days)</h3>
            <HiOutlineChartSquareBar className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />
          </div>
          <div style={{ height: '300px' }}>
            {data?.stock_in_out_chart?.length > 0 ? (
              <Bar data={stockChartData} options={barOptions} />
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No stock activity data for the last 7 days</p>
              </div>
            )}
          </div>
        </div>

        {/* Inventory by Category */}
        <div className="chart-container" style={{ minHeight: '500px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div className="flex items-center justify-between mb-4 px-2">
            <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Inventory by Category</h3>
            <HiOutlineCube className="w-5 h-5 shrink-0" style={{ color: 'var(--text-muted)' }} />
          </div>
          <div className="flex-1 flex flex-col items-center justify-start overflow-hidden px-2 pb-2">
            {data?.category_chart?.length > 0 ? (
              <>
                <div className="w-full flex-1 flex items-center justify-center" style={{ minHeight: '260px', maxHeight: '320px' }}>
                  <div className="w-full h-full flex items-center justify-center" style={{ maxWidth: '340px' }}>
                    <Doughnut data={categoryChartData} options={doughnutOptions} />
                  </div>
                </div>
                {/* Custom legend grid for better wrap behavior */}
                <div className="w-full mt-auto pt-4 border-t" style={{ borderColor: 'var(--border-color)' }}>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2">
                    {data.category_chart.map((c, i) => {
                      const chartColors = categoryChartData.datasets[0].backgroundColor;
                      const color = Array.isArray(chartColors) ? chartColors[i % chartColors.length] : '#8B9EFF';
                      return (
                        <div key={c.category || i} className="flex items-center gap-2 text-xs sm:text-sm" style={{ color: 'var(--text-secondary)' }}>
                          <span className="shrink-0 rounded-full" style={{ width: 10, height: 10, backgroundColor: color }} />
                          <span className="truncate">{c.category}</span>
                          <span className="font-medium shrink-0 ml-auto" style={{ color: 'var(--text-primary)' }}>{c.count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No category data available</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Department Summary */}        <div className="chart-container">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Department Financial Summary</h3>
            <HiOutlineOfficeBuilding className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />
          </div>
          {data?.department_summary?.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b" style={{ borderColor: 'var(--border-color)' }}>
                    <th className="text-left py-3 px-4 font-medium" style={{ color: 'var(--text-muted)' }}>Department</th>
                    <th className="text-right py-3 px-4 font-medium" style={{ color: 'var(--text-muted)' }}>Items</th>
                    <th className="text-right py-3 px-4 font-medium" style={{ color: 'var(--text-muted)' }}>Total Qty</th>
                    <th className="text-right py-3 px-4 font-medium" style={{ color: 'var(--text-muted)' }}>Total Value (RWF)</th>
                  </tr>
                </thead>
                <tbody>
                  {data.department_summary.map((dept) => (
                    <tr key={dept.name} className="table-row" style={{ borderBottom: '1px solid var(--border-light)' }}>
                      <td className="py-3 px-4 font-medium" style={{ color: 'var(--text-primary)' }}>{dept.name}</td>
                      <td className="py-3 px-4 text-right" style={{ color: 'var(--text-secondary)' }}>{dept.items}</td>
                      <td className="py-3 px-4 text-right" style={{ color: 'var(--text-secondary)' }}>{dept.total_quantity}</td>
                      <td className="py-3 px-4 text-right font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {formatRWF(dept.total_value)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-center py-8" style={{ color: 'var(--text-muted)' }}>No department data available</p>
          )}
        </div>
    </div>
  );
}
