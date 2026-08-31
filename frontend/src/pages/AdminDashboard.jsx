import { useState, useEffect, useMemo, lazy, Suspense, useRef } from 'react';
import api from '../services/api';
import { Link } from 'react-router-dom';
import {
  HiOutlineCube, HiOutlineArrowSmRight, HiOutlineExclamationCircle, HiOutlineClipboardCheck,
  HiOutlineTrendingUp, HiOutlineSwitchHorizontal, HiOutlineOfficeBuilding,
  HiOutlineCurrencyDollar, HiOutlineChartBar
} from 'react-icons/hi';
import { useTheme } from '../context/ThemeContext';

// Lazy load chart components — 50KB+ savings on initial load
const ChartLoader = lazy(() => import('../components/ChartLoader'));

const CACHE_TTL = 30000; // 30 seconds

function SkeletonDashboard() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="h-8 w-48 rounded skeleton" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-32 rounded-xl skeleton" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-[420px] rounded-xl skeleton" />
        ))}
      </div>
      <div className="h-64 rounded-xl skeleton" />
      <div className="h-48 rounded-xl skeleton" />
    </div>
  );
}

export default function AdminDashboard() {
  const { dark } = useTheme();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const cacheRef = useRef(null);
  const cachePromiseRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchDashboardData() {
      // Check useRef-based cache first (component-scoped, resets on unmount)
      if (cacheRef.current) {
        return cacheRef.current;
      }
      if (cachePromiseRef.current) {
        return cachePromiseRef.current;
      }
      cachePromiseRef.current = api.get('/dashboard').then(({ data }) => {
        cacheRef.current = data;
        cachePromiseRef.current = null;
        setTimeout(() => { cacheRef.current = null; }, CACHE_TTL);
        return data;
      }).catch((err) => {
        cachePromiseRef.current = null;
        throw err;
      });
      return cachePromiseRef.current;
    }

    fetchDashboardData().then((result) => {
      if (!cancelled) setData(result);
    }).catch(() => {
      // Error handled silently
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  // ── Format helpers ──
  const formatCurrency = (val) => {
    if (!val && val !== 0) return '-';
    const num = Number(val);
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toLocaleString();
  };

  // Memoize chart-dependent values
  const gridColor = useMemo(() =>
    dark ? 'rgba(149, 154, 200, 0.12)' : 'rgba(44, 40, 120, 0.07)',
  [dark]);

  const textColor = useMemo(() =>
    dark ? '#959AC8' : '#4A5B7A',
  [dark]);

  // Memoize chart options to prevent recreation on every render
  const barOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: { color: textColor, usePointStyle: true, padding: 16, font: { size: 12, weight: '600' } }
      },
      tooltip: {
          backgroundColor: dark ? '#141630' : '#FFFFFF',
          titleColor: dark ? '#FFFFFF' : '#0C0A2E',
          bodyColor: dark ? '#D6DAF0' : '#2D3A5C',
          borderColor: dark ? '#262952' : '#DDE3F5',
          borderWidth: 1,
          padding: 12,
          cornerRadius: 8,
          callbacks: {
            title: (items) => {
              if (!items?.length) return '';
              const date = new Date(items[0].label);
              return isNaN(date.getTime())
                ? items[0].label
                : date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
            }
          }
        }
    },
    scales: {
      x: {
        grid: { color: gridColor },
        ticks: {
          color: textColor,
          font: { size: 11, weight: '600' },
          callback: (value) => {
            const date = new Date(value);
            return isNaN(date.getTime())
              ? value
              : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          }
        }
      },
      y: {
        grid: { color: gridColor },
        ticks: { color: textColor, font: { size: 11, weight: '600' } },
        beginAtZero: true
      }
    }
  }), [dark, gridColor, textColor]);

  const doughnutOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    cutout: '65%',
    plugins: {
      legend: {
        position: 'bottom',
        labels: { color: textColor, usePointStyle: true, padding: 16, font: { size: 11, weight: '600' } }
      },
      tooltip: {
        backgroundColor: dark ? '#141630' : '#FFFFFF',
        titleColor: dark ? '#FFFFFF' : '#0C0A2E',
        bodyColor: dark ? '#D6DAF0' : '#2D3A5C',
        borderColor: dark ? '#262952' : '#DDE3F5',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 8,
      }
    }
  }), [dark, gridColor, textColor]);

  // Memoize chart data
  const stockChartData = useMemo(() => {
    if (!data?.stock_in_out_chart) return { labels: [], datasets: [] };
    return {
      labels: data.stock_in_out_chart.map(d => d.date) || [],
      datasets: [
        {
          label: 'Stock In',
          data: data.stock_in_out_chart.map(d => d.stock_in) || [],
          backgroundColor: '#22c55e',
          borderRadius: 4,
        },
        {
          label: 'Stock Out',
          data: data.stock_in_out_chart.map(d => d.stock_out) || [],
          backgroundColor: '#ef4444',
          borderRadius: 4,
        }
      ]
    };
  }, [data?.stock_in_out_chart]);

  const categoryChartData = useMemo(() => {
    if (!data?.category_chart) return { labels: [], datasets: [] };
    return {
      labels: data.category_chart.map(c => c.category) || [],
      datasets: [{
        data: data.category_chart.map(c => c.count) || [],
        backgroundColor: ['#8B9EFF', '#C4B5FD', '#22c55e', '#f59e0b', '#ef4444', '#f97316', '#14b8a6'],
      }]
    };
  }, [data?.category_chart]);

  if (loading) {
    return <SkeletonDashboard />;
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>Overview of your inventory system</p>
        </div>
        <p className="text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        </p>
      </div>

      {/* Primary KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <Link to="/inventory" className="main-kpi lg:col-span-1 lg:row-span-1 block">
          <div className="flex items-center gap-4">
            <div className="metric-icon">
              <HiOutlineCube className="w-7 h-7" />
            </div>
            <div>
              <p className="metric-label">Total Items</p>
              <p className="metric-value">{data?.total_items || 0}</p>
            </div>
          </div>
          <p className="metric-subtext mt-3">{data?.total_stock_quantity || 0} total stock quantity</p>
        </Link>

        <Link to="/inventory?filter=low-stock" className="metric-card">
          <div className="flex items-center gap-3">
            <div className="metric-icon metric-icon-red">
              <HiOutlineExclamationCircle className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <p className="metric-label">Low Stock Items</p>
              <p className="metric-value">{data?.low_stock_items || 0}</p>
            </div>
          </div>
        </Link>

        <Link to="/borrowings" className="metric-card">
          <div className="flex items-center gap-3">
            <div className="metric-icon metric-icon-amber">
              <HiOutlineArrowSmRight className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <p className="metric-label">Borrowed Items</p>
              <p className="metric-value">{data?.borrowed_items || 0}</p>
            </div>
          </div>
        </Link>

        <Link to="/requests" className="metric-card">
          <div className="flex items-center gap-3">
            <div className="metric-icon metric-icon-green">
              <HiOutlineClipboardCheck className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <p className="metric-label">Pending Requests</p>
              <p className="metric-value">{data?.pending_requests || 0}</p>
            </div>
          </div>
        </Link>
      </div>

      {/* Charts — Lazy loaded */}
      <Suspense fallback={
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="chart-container" style={{ height: '420px' }}>
              <div className="animate-pulse h-full flex items-center justify-center">
                <p className="text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>Loading chart...</p>
              </div>
            </div>
          ))}
        </div>
      }>
        <ChartLoader
          stockChartData={stockChartData}
          categoryChartData={categoryChartData}
          barOptions={barOptions}
          doughnutOptions={doughnutOptions}
          data={data}
        />
      </Suspense>

      {/* ── Department Analytics ── */}
      {data?.department_summary?.length > 0 && (
        <div className="card">
          <div className="section-header">
            <div className="flex items-center gap-2">
              <HiOutlineOfficeBuilding className="w-5 h-5" style={{ color: 'var(--primary)' }} />
              <h3>Department Overview</h3>
            </div>
            <HiOutlineChartBar className="section-icon" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.department_summary.map((dept) => {
              const budgetPct = dept.budget?.usage_pct || 0;
              const lowStock = Number(dept.low_stock_count) || 0;
              return (
                <Link
                  key={dept.id}
                  to={`/inventory?department_id=${dept.id}`}
                  className="p-4 rounded-xl border transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md"
                  style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)' }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>{dept.name}</h4>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(139, 158, 255, 0.1)', color: 'var(--primary)' }}>
                      {dept.items} items
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Total Qty</p>
                      <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{dept.total_quantity || 0}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Value</p>
                      <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{formatCurrency(dept.total_value)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Low Stock</p>
                      <p className="text-lg font-bold" style={{ color: lowStock > 0 ? 'var(--accent-red)' : 'var(--text-muted)' }}>{lowStock}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Budget</p>
                      <div className="flex items-center gap-1.5">
                        <div className="flex-1 h-1.5 rounded-full" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                          <div
                            className="h-1.5 rounded-full transition-all"
                            style={{
                              width: `${Math.min(budgetPct, 100)}%`,
                              backgroundColor: budgetPct > 90 ? '#ef4444' : budgetPct > 70 ? '#f59e0b' : '#22c55e'
                            }}
                          />
                        </div>
                        <span className="text-xs font-bold" style={{ color: budgetPct > 90 ? 'var(--accent-red)' : 'var(--text-secondary)' }}>
                          {budgetPct}%
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Activity */}
      <div className="card">
        <div className="section-header">
          <h3>Recent Activities</h3>
          <HiOutlineTrendingUp className="section-icon" />
        </div>
        <div className="space-y-3">
          {data?.recent_activities?.length > 0 ? (
            data.recent_activities.map((activity, index) => (
              <div key={activity?.id ?? `activity-${index}`} className="flex items-start gap-3 pb-3 border-b last:border-0" style={{ borderColor: 'var(--border-light)' }}>
                <div className="w-2.5 h-2.5 mt-1.5 rounded-full shrink-0" style={{ backgroundColor: 'var(--primary)', boxShadow: '0 0 6px rgba(139, 158, 255, 0.4)' }} />
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>{activity.description}</p>
                  <p className="text-xs font-medium mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {activity.user_name} • {new Date(activity.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <p className="text-center py-4 text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>No recent activities</p>
          )}
        </div>
      </div>


    </div>
  );
}
