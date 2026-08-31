import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import mizeroLogo from '../assets/logo/mizerologo.png';
import {
  Menu, X, ChevronRight, ArrowRight, Database, BarChart3, FileText,
  Bell, Shield, Activity, TrendingUp, Users, Layers, LayoutDashboard,
  Download, Search, Package, RefreshCw, AlertTriangle, PieChart,
  BookOpen, Code2, GitBranch, Globe, GraduationCap, Building2,
  MapPin, ExternalLink, Sun, Moon, Sparkles, CheckCircle, Zap,
  LineChart, Box, ClipboardList, DollarSign, Clock, Inbox,
  Send, Loader2, Mail
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { label: 'Features', href: '#features' },
  { label: 'Departments', href: '#departments' },
  { label: 'Reports', href: '#reports' },
  { label: 'Analytics', href: '#analytics' },
  { label: 'About', href: '#about' },
  { label: 'Contact', href: '#contact' },
];

const DEPARTMENTS = [
  { name: 'Finance', items: 412, value: '18.4M', lowStock: 4, color: '#8B9EFF', gradient: 'from-[#8B9EFF] to-[#A78BFA]' },
  { name: 'IT Department', items: 689, value: '12.1M', lowStock: 7, color: '#A78BFA', gradient: 'from-[#A78BFA] to-[#C084FC]' },
  { name: 'General Store', items: 1280, value: '8.6M', lowStock: 9, color: '#34D399', gradient: 'from-[#34D399] to-[#22C55E]' },
  { name: 'Facilities', items: 540, value: '5.3M', lowStock: 2, color: '#F59E0B', gradient: 'from-[#F59E0B] to-[#F97316]' },
  { name: 'Office Supplies', items: 591, value: '3.8M', lowStock: 1, color: '#06B6D4', gradient: 'from-[#06B6D4] to-[#22D3EE]' },
];

const FEATURES = [
  { icon: Package, title: 'Inventory Management', desc: 'Track every item across departments with real-time stock levels, automated alerts, and intelligent categorization.' },
  { icon: Building2, title: 'Department Intelligence', desc: 'Independent inventory intelligence per department with dedicated budgeting, reporting, and analytics.' },
  { icon: DollarSign, title: 'Budget Tracking', desc: 'Monitor allocations, expenditure, and variance in real-time with proactive budget alerts.' },
  { icon: ClipboardList, title: 'Borrowing & Returns', desc: 'End-to-end checkout flow with full accountability trails and automated reminders.' },
  { icon: FileText, title: 'PDF Reports', desc: 'One-click professional reports for any timeframe — inventory, budget, department, and audit reports.' },
  { icon: Activity, title: 'Activity Logs', desc: 'Complete audit trail of every action, change, and transaction across the entire system.' },
  { icon: Bell, title: 'Smart Notifications', desc: 'Intelligent alerts for low stock, pending approvals, return deadlines, and budget thresholds.' },
  { icon: BarChart3, title: 'Analytics Dashboard', desc: 'Visual KPIs that surface what matters most — trends, anomalies, and actionable insights.' },
  { icon: AlertTriangle, title: 'Low Stock Monitoring', desc: 'Automatic threshold-based alerts prevent shortages before they impact operations.' },
  { icon: Download, title: 'CSV Import/Export', desc: 'Seamlessly migrate and back up your data with bulk import/export capabilities.' },
];

const WORKFLOW_STEPS = [
  { title: 'Stock In', icon: Inbox, desc: 'Receive and log incoming inventory with supplier details', color: '#8B9EFF' },
  { title: 'Inventory Tracking', icon: Package, desc: 'Real-time tracking across all departments and locations', color: '#A78BFA' },
  { title: 'Department Allocation', icon: Layers, desc: 'Intelligent allocation to departments with budget tracking', color: '#34D399' },
  { title: 'Budget Monitoring', icon: DollarSign, desc: 'Live budget consumption alerts and variance analysis', color: '#F59E0B' },
  { title: 'Notifications', icon: Bell, desc: 'Automated alerts for thresholds, approvals, and deadlines', color: '#F97316' },
  { title: 'Reporting', icon: FileText, desc: 'Generate comprehensive PDF and analytics reports', color: '#EC4899' },
  { title: 'Analytics', icon: BarChart3, desc: 'Deep insights with visual dashboards and trend analysis', color: '#06B6D4' },
];

const IMPACT_ITEMS = [
  { icon: TrendingUp, title: 'Digital Transformation', desc: 'Replacing manual paper workflows with intelligent automation and real-time digital records.' },
  { icon: FileText, title: 'Reducing Paperwork', desc: 'End-to-end digital records with exportable reports eliminating paper-based tracking.' },
  { icon: Shield, title: 'Improving Accountability', desc: 'Complete audit trails with role-based responsibility and transparent operations.' },
  { icon: PieChart, title: 'Department Intelligence', desc: 'Tailored insights per department enabling data-driven decisions at every level.' },
  { icon: Code2, title: 'Real Engineering Experience', desc: 'Production-grade code, version control, peer review, and industry-standard practices.' },
  { icon: Globe, title: 'Modernizing School Operations', desc: 'A modern tech stack supporting daily school life with efficiency and precision.' },
];

const STATS = [
  { value: 3500, suffix: '+', label: 'Inventory Items', icon: Package },
  { value: 8, suffix: '', label: 'Departments', icon: Building2 },
  { value: 1200, suffix: '+', label: 'Reports Generated', icon: FileText },
  { value: 15000, suffix: '+', label: 'Transactions', icon: Activity },
];

// ─────────────────────────────────────────────────────────────────────────────
// Reusable Components
// ─────────────────────────────────────────────────────────────────────────────

function AnimatedCounter({ value, suffix = '', duration = 2 }) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const inView = useInView(ref);

  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const increment = value / (duration * 60);
    const timer = setInterval(() => {
      start += increment;
      if (start >= value) {
        setCount(value);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [inView, value, duration]);

  return (
    <span ref={ref} className="tabular-nums">
      {count.toLocaleString()}{suffix}
    </span>
  );
}

function useInView(ref, options = {}) {
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.1, ...options }
    );
    observer.observe(el);
    return () => observer.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref.current, options]);

  return inView;
}

function SectionHeading({ badge, title, subtitle, align = 'center' }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-100px' }}
      transition={{ duration: 0.6 }}
      className={`mb-16 ${align === 'center' ? 'text-center' : ''}`}
    >
      {badge && (
        <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold mb-6"
          style={{ backgroundColor: 'var(--badge-bg)', color: 'var(--primary-dark)' }}>
          <Sparkles className="w-4 h-4" />
          {badge}
        </span>
      )}
      <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4"
        style={{ color: 'var(--text-primary)' }}>
        {title}
      </h2>
      {subtitle && (
        <p className="text-lg md:text-xl max-w-3xl mx-auto leading-relaxed"
          style={{ color: 'var(--text-muted)' }}>
          {subtitle}
        </p>
      )}
    </motion.div>
  );
}

function GlassCard({ children, className = '', delay = 0, style = {} }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.5, delay }}
      className={`rounded-2xl backdrop-blur-xl border transition-all duration-300 ${className}`}
      style={{
        backgroundColor: 'var(--card-bg)',
        borderColor: 'var(--border-color)',
        ...style,
      }}
      whileHover={{ y: -4, boxShadow: '0 12px 48px rgba(0, 0, 0, 0.12)' }}
    >
      {children}
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Navbar
// ─────────────────────────────────────────────────────────────────────────────

function Navbar({ dark, toggleTheme, scrolled, mobileOpen, setMobileOpen }) {
  const navigate = useNavigate();

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'shadow-lg backdrop-blur-xl'
          : 'shadow-none'
      }`}
      style={{
        backgroundColor: scrolled
          ? (dark ? '#0B1020' : 'rgba(241, 244, 253, 0.85)')
          : 'transparent',
        borderBottom: scrolled ? '1px solid ' + (dark ? 'rgba(165, 180, 252, 0.15)' : 'rgba(139, 158, 255, 0.1)') : '1px solid transparent',
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <img
              src={mizeroLogo}
              alt="Mizero Inventory Hub"
              className="h-10 sm:h-14 w-auto object-contain transition-all duration-300 group-hover:scale-105"
              style={{
                filter: dark
                  ? 'brightness(1.15) drop-shadow(0 0 8px rgba(165, 180, 252, 0.4))'
                  : 'drop-shadow(0 2px 6px rgba(0,0,0,0.08))'
              }}
            />
            <div className="hidden sm:block">
              <span className="text-lg font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                Mizero
              </span>
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em]" style={{ color: 'var(--text-disabled)' }}>
                Inventory Hub
              </p>
            </div>
          </Link>

          {/* Center Nav */}
          <nav className="hidden lg:flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${dark ? 'hover:bg-[#1A2238]' : 'hover:bg-white/60'}`}
                style={{ color: scrolled ? 'var(--text-primary)' : (dark ? '#E2E8F0' : 'var(--text-secondary)') }}
              >
                {item.label}
              </a>
            ))}
          </nav>

          {/* Right */}
          <div className="flex items-center gap-3">
            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className={`p-2.5 rounded-xl transition-all duration-200 ${dark ? 'hover:bg-[#1A2238]' : 'hover:bg-white/60'}`}
              style={{ color: dark ? '#A0AEC0' : 'var(--text-muted)' }}
              title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {dark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            {/* Desktop buttons */}
            <div className="hidden md:flex items-center gap-2">
              <button
                onClick={() => navigate('/login')}
                className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${dark ? 'hover:bg-[#1A2238]' : 'hover:bg-white/60'}`}
                style={{ color: scrolled ? 'var(--text-primary)' : (dark ? '#E2E8F0' : 'var(--text-secondary)') }}
              >
                Login
              </button>
              <button
                onClick={() => navigate('/login')}
                className="px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all duration-200 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
                style={{
                  background: 'linear-gradient(135deg, #8B9EFF, #A78BFA)',
                  boxShadow: '0 4px 15px rgba(139, 158, 255, 0.35)',
                }}
              >
                Launch System
              </button>
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className={`lg:hidden p-2.5 rounded-xl transition-all duration-200 ${dark ? 'hover:bg-[#1A2238]' : 'hover:bg-white/60'}`}
              style={{ color: dark ? '#E2E8F0' : 'var(--text-secondary)' }}
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile overlay backdrop */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 lg:hidden"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(4px)' }}
            onClick={() => setMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="lg:hidden overflow-hidden border-t relative z-50"
            style={{
              backgroundColor: dark ? '#0B1020' : 'rgba(241, 244, 253, 0.98)',
              borderColor: dark ? 'rgba(165, 180, 252, 0.1)' : 'rgba(139, 158, 255, 0.1)',
            }}
          >
            <div className="px-4 py-6 space-y-1">
              {NAV_ITEMS.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`block px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${dark ? 'hover:bg-[#1A2238]' : 'hover:bg-white/60'}`}
                  style={{ color: dark ? '#E2E8F0' : 'var(--text-secondary)' }}
                >
                  {item.label}
                </a>
              ))}
              <hr className="my-4" style={{ borderColor: 'rgba(139, 158, 255, 0.1)' }} />
              <button
                onClick={() => { setMobileOpen(false); navigate('/login'); }}
                className={`w-full px-4 py-3 rounded-xl text-sm font-bold transition-all duration-200 ${dark ? 'hover:bg-[#1A2238]' : 'hover:bg-white/60'}`}
                style={{ color: dark ? '#E2E8F0' : 'var(--text-secondary)' }}
              >
                Login
              </button>
              <button
                onClick={() => { setMobileOpen(false); navigate('/login'); }}
                className="w-full px-4 py-3 rounded-xl text-sm font-bold text-white transition-all duration-200"
                style={{
                  background: 'linear-gradient(135deg, #8B9EFF, #A78BFA)',
                  boxShadow: '0 4px 15px rgba(139, 158, 255, 0.35)',
                }}
              >
                Launch System
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Hero Section
// ─────────────────────────────────────────────────────────────────────────────

function HeroSection({ dark }) {
  const navigate = useNavigate();
  const { scrollYProgress } = useScroll();
  const heroY = useTransform(scrollYProgress, [0, 0.3], [0, 100]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.3], [1, 0]);

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden pt-20">
      {/* Animated gradient background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div
          animate={{
            scale: [1, 1.1, 1],
            rotate: [0, 5, 0],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
          className="absolute -top-1/2 -left-1/4 w-[60%] h-[60%] rounded-full opacity-[0.08] dark:opacity-[0.04]"
          style={{ background: 'radial-gradient(circle, #8B9EFF 0%, transparent 70%)' }}
        />
        <motion.div
          animate={{
            scale: [1.1, 1, 1.1],
            rotate: [0, -5, 0],
          }}
          transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
          className="absolute -bottom-1/4 -right-1/4 w-[50%] h-[50%] rounded-full opacity-[0.06] dark:opacity-[0.03]"
          style={{ background: 'radial-gradient(circle, #A78BFA 0%, transparent 70%)' }}
        />
        <motion.div
          animate={{
            scale: [1, 1.15, 1],
            rotate: [0, 3, 0],
          }}
          transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
          className="absolute top-1/3 right-1/4 w-[30%] h-[30%] rounded-full opacity-[0.04] dark:opacity-[0.02]"
          style={{ background: 'radial-gradient(circle, #C084FC 0%, transparent 70%)' }}
        />
      </div>

      {/* Grid overlay */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(rgba(139, 158, 255, 0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(139, 158, 255, 0.3) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      <motion.div style={{ y: heroY, opacity: heroOpacity }} className="w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-32">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left: Content */}
            <div className="relative z-10">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
              >
                <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold mb-8"
                  style={{ backgroundColor: 'var(--badge-bg)', color: 'var(--primary-dark)' }}>
                  <Sparkles className="w-4 h-4" />
                  Built by Mizero TSS Software Development Students
                </span>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.3 }}
                className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.05] mb-6"
                style={{ color: 'var(--text-primary)' }}
              >
                <span className="bg-gradient-to-r from-[#8B9EFF] via-[#A78BFA] to-[#C084FC] bg-clip-text text-transparent">
                  Smart
                </span>{' '}
                Department-Centered<br />
                <span className="bg-gradient-to-r from-[#8B9EFF] to-[#6D7FF5] bg-clip-text text-transparent">
                  Inventory Intelligence
                </span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.4 }}
                className="text-lg md:text-xl leading-relaxed mb-10 max-w-xl"
                style={{ color: 'var(--text-muted)' }}
              >
                An enterprise inventory management and analytics platform developed by Mizero TSS Software Development
                students to modernize inventory operations, reporting, budgeting, and accountability.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.5 }}
                className="flex flex-wrap gap-4 mb-12"
              >
                <button
                  onClick={() => navigate('/login')}
                  className="group px-8 py-4 rounded-xl text-base font-bold text-white transition-all duration-200 hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2"
                  style={{
                    background: 'linear-gradient(135deg, #8B9EFF, #A78BFA)',
                    boxShadow: '0 8px 25px rgba(139, 158, 255, 0.35)',
                  }}
                >
                  Launch System
                  <ArrowRight className="w-5 h-5 transition-transform duration-200 group-hover:translate-x-1" />
                </button>
                <a
                  href="#features"
                  className="px-8 py-4 rounded-xl text-base font-bold transition-all duration-200 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2"
                  style={{
                    backgroundColor: dark ? 'var(--card-bg)' : 'rgba(255, 255, 255, 0.8)',
                    color: dark ? '#E2E8F0' : 'var(--text-secondary)',
                    border: '1px solid ' + (dark ? 'rgba(165, 180, 252, 0.2)' : 'rgba(139, 158, 255, 0.2)'),
                  }}
                >
                  Explore Features
                  <ChevronRight className="w-5 h-5" />
                </a>
              </motion.div>

              {/* Trust indicators */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.6 }}
                className="flex flex-wrap gap-6 mb-12"
              >
                {[
                  { icon: BarChart3, label: 'Department Analytics' },
                  { icon: Clock, label: 'Real-Time Reporting' },
                  { icon: DollarSign, label: 'Budget Intelligence' },
                  { icon: Box, label: 'Docker Deployed' },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: 'rgba(139, 158, 255, 0.1)' }}>
                      <item.icon className="w-4 h-4" style={{ color: '#6D7FF5' }} />
                    </div>
                    <span className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
                      {item.label}
                    </span>
                  </div>
                ))}
              </motion.div>

              {/* Animated stats */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.7 }}
                className="grid grid-cols-2 sm:grid-cols-4 gap-6 p-6 rounded-2xl"
                style={{
                  backgroundColor: dark ? 'rgba(165, 180, 252, 0.06)' : 'rgba(139, 158, 255, 0.05)',
                  border: '1px solid ' + (dark ? 'rgba(165, 180, 252, 0.12)' : 'rgba(139, 158, 255, 0.1)'),
                }}
              >
                {STATS.map((stat) => (
                  <div key={stat.label} className="text-center">
                    <div className="text-2xl sm:text-3xl font-extrabold tracking-tight"
                      style={{ color: 'var(--text-primary)' }}>
                      <AnimatedCounter value={stat.value} suffix={stat.suffix} />
                    </div>
                    <div className="text-xs font-semibold mt-1" style={{ color: 'var(--text-muted)' }}>
                      {stat.label}
                    </div>
                  </div>
                ))}
              </motion.div>
            </div>

            {/* Right: Dashboard Showcase */}
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 1, delay: 0.5 }}
              className="relative hidden lg:block"
            >
              {/* Main dashboard mockup */}
              <div className="relative rounded-2xl overflow-hidden shadow-2xl"
                style={{
                  transform: 'perspective(1000px) rotateY(-5deg) rotateX(2deg)',
                  boxShadow: '0 30px 80px rgba(139, 158, 255, 0.2), 0 10px 30px rgba(0, 0, 0, 0.1)',
                }}>
                <div className="relative aspect-[4/3] bg-gradient-to-br from-[#0B0D1A] to-[#141630] p-4 overflow-hidden rounded-2xl border border-[#262952]">
                  {/* Mock header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-500" />
                      <div className="w-3 h-3 rounded-full bg-yellow-500" />
                      <div className="w-3 h-3 rounded-full bg-green-500" />
                    </div>
                    <div className="flex gap-2">
                      <div className="w-16 h-4 rounded bg-[#1C1E45]" />
                      <div className="w-16 h-4 rounded bg-[#1C1E45]" />
                    </div>
                  </div>

                  {/* Mock sidebar + content */}
                  <div className="flex gap-4 h-[calc(100%-28px)]">
                    {/* Sidebar */}
                    <div className="w-1/5 space-y-2">
                      {[...Array(5)].map((_, i) => (
                        <div key={i} className="h-3 rounded bg-[#1C1E45] opacity-60"
                          style={{ width: `${60 + Math.random() * 30}%` }} />
                      ))}
                    </div>

                    {/* Main content */}
                    <div className="flex-1 space-y-3">
                      {/* Stats row */}
                      <div className="flex gap-2">
                        {[...Array(3)].map((_, i) => (
                          <div key={i} className="flex-1 h-16 rounded-xl bg-[#1C1E45] p-2">
                            <div className="h-2 w-2/3 rounded bg-[#262952] mb-1" />
                            <div className="h-4 w-1/2 rounded bg-gradient-to-r from-[#8B9EFF] to-[#A78BFA] opacity-60" />
                          </div>
                        ))}
                      </div>

                      {/* Chart area */}
                      <div className="h-24 rounded-xl bg-[#1C1E45] p-3">
                        <div className="flex items-end gap-1 h-full">
                          {[...Array(20)].map((_, i) => (
                            <div key={i}
                              className="flex-1 rounded-t"
                              style={{
                                height: `${20 + Math.random() * 80}%`,
                                background: `linear-gradient(to top, rgba(139, 158, 255, ${0.3 + Math.random() * 0.5}), rgba(167, 139, 250, ${0.2 + Math.random() * 0.4}))`,
                              }}
                            />
                          ))}
                        </div>
                      </div>

                      {/* Table preview */}
                      <div className="space-y-1.5">
                        {[...Array(3)].map((_, i) => (
                          <div key={i} className="flex gap-2 items-center">
                            <div className="w-1/4 h-3 rounded bg-[#1C1E45]" />
                            <div className="w-1/6 h-3 rounded bg-[#1C1E45]" />
                            <div className="w-1/6 h-3 rounded bg-[#1C1E45]" />
                            <div className={`w-12 h-3 rounded ${i === 1 ? 'bg-red-500/30' : 'bg-[#1C1E45]'}`} />
                          </div>
                        ))}
                      </div>

                      {/* Notification */}
                      <div className="flex items-center gap-2 p-2 rounded-lg bg-red-500/10 border border-red-500/20">
                        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        <div className="h-3 w-40 rounded bg-red-500/20" />
                      </div>
                    </div>
                  </div>

                  {/* Glossy overlay */}
                  <div className="absolute inset-0 pointer-events-none"
                    style={{
                      background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, transparent 50%, rgba(139,158,255,0.03) 100%)',
                    }}
                  />
                </div>
              </div>

              {/* Floating glass cards */}
              <motion.div
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute -top-6 -right-6 p-4 rounded-xl backdrop-blur-xl shadow-xl"
                style={{
                  backgroundColor: dark ? '#111827' : 'rgba(255, 255, 255, 0.9)',
                  border: '1px solid ' + (dark ? 'rgba(165, 180, 252, 0.15)' : 'rgba(139, 158, 255, 0.2)'),
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)' }}>
                    <AlertTriangle className="w-5 h-5 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>Low Stock Alert</p>
                    <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>23 items need restocking</p>
                  </div>
                </div>
              </motion.div>

              <motion.div
                animate={{ y: [0, 10, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
                className="absolute -bottom-4 -left-8 p-4 rounded-xl backdrop-blur-xl shadow-xl"
                style={{
                  backgroundColor: dark ? '#111827' : 'rgba(255, 255, 255, 0.9)',
                  border: '1px solid ' + (dark ? 'rgba(165, 180, 252, 0.15)' : 'rgba(139, 158, 255, 0.2)'),
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)' }}>
                    <TrendingUp className="w-5 h-5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>Budget Healthy</p>
                    <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>+12% this quarter</p>
                  </div>
                </div>
              </motion.div>

              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
                className="absolute top-1/3 -left-10 p-3 rounded-xl backdrop-blur-xl shadow-xl"
                style={{
                  backgroundColor: dark ? '#111827' : 'rgba(255, 255, 255, 0.9)',
                  border: '1px solid ' + (dark ? 'rgba(165, 180, 252, 0.15)' : 'rgba(139, 158, 255, 0.2)'),
                }}
              >
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4" style={{ color: '#8B9EFF' }} />
                  <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Report.pdf</span>
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Live System Showcase
// ─────────────────────────────────────────────────────────────────────────────

function SystemShowcase() {
  return (
    <section id="features" className="relative py-32 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading
          badge="Live System"
          title="Built for Real Operations"
          subtitle="A complete toolkit purpose-built for school operations and department intelligence."
        />

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <GlassCard key={feature.title} delay={i * 0.05} className="p-6 sm:p-8">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                  style={{
                    backgroundColor: `rgba(${i * 25 + 100}, ${i * 20 + 150}, 255, 0.1)`,
                  }}>
                  <Icon className="w-6 h-6" style={{ color: `var(--primary-dark)` }} />
                </div>
                <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                  {feature.title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  {feature.desc}
                </p>
              </GlassCard>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Department Intelligence
// ─────────────────────────────────────────────────────────────────────────────

function DepartmentIntelligence() {
  const ref = useRef(null);
  const inView = useInView(ref);

  return (
    <section id="departments" className="relative py-32 overflow-hidden">
      {/* Background accent */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[80%] rounded-full opacity-[0.03]"
          style={{ background: 'radial-gradient(circle, #8B9EFF 0%, transparent 70%)' }} />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" ref={ref}>
        <SectionHeading
          badge="Department Intelligence"
          title="Each Department, Fully Autonomous"
          subtitle="Each department operates independently with dedicated inventory intelligence, budgeting, and reporting."
        />

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {DEPARTMENTS.map((dept, i) => (
            <motion.div
              key={dept.name}
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              whileHover={{ y: -6, scale: 1.02 }}
              className="rounded-2xl p-6 sm:p-8 cursor-default transition-all duration-300 group relative overflow-hidden"
              style={{
                backgroundColor: 'var(--card-bg)',
                border: '1px solid var(--border-color)',
                boxShadow: 'var(--shadow-card)',
              }}
            >
              {/* Top gradient bar */}
              <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${dept.gradient}`} />

              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{dept.name}</h3>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider"
                  style={{
                    backgroundColor: 'rgba(34, 197, 94, 0.1)',
                    color: '#22C55E',
                  }}>
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  Active
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-disabled)' }}>Items</p>
                  <p className="text-2xl font-extrabold" style={{ color: 'var(--text-primary)' }}>{dept.items.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-disabled)' }}>Value</p>
                  <p className="text-2xl font-extrabold" style={{ color: 'var(--text-primary)' }}>₣ {dept.value}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-disabled)' }}>Low Stock</p>
                  <p className="text-2xl font-extrabold" style={{ color: dept.lowStock > 5 ? '#EF4444' : '#F59E0B' }}>
                    {dept.lowStock}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-disabled)' }}>Budget</p>
                  <div className="mt-1">
                    <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={inView ? { width: `${50 + Math.random() * 40}%` } : {}}
                        transition={{ duration: 1.5, delay: i * 0.1 }}
                        className="h-full rounded-full bg-gradient-to-r"
                        style={{ background: `linear-gradient(90deg, ${dept.color}, ${dept.color}88)` }}
                      />
                    </div>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Used</p>
                  </div>
                </div>
              </div>

              {/* Mini chart sparkline */}
              <div className="mt-4 flex items-end gap-0.5 h-8">
                {[...Array(12)].map((_, j) => (
                  <div key={j}
                    className="flex-1 rounded-t transition-all duration-300 group-hover:opacity-80"
                    style={{
                      height: `${20 + Math.random() * 80}%`,
                      backgroundColor: dept.color,
                      opacity: 0.3 + Math.random() * 0.4,
                    }}
                  />
                ))}
              </div>
            </motion.div>
          ))}
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center text-sm mt-10 max-w-2xl mx-auto"
          style={{ color: 'var(--text-muted)' }}
        >
          Each department operates independently with intelligent inventory tracking, budgeting, reporting, and analytics.
        </motion.p>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Reports & Analytics Section
// ─────────────────────────────────────────────────────────────────────────────

function ReportsSection() {
  const ref = useRef(null);
  const inView = useInView(ref);

  return (
    <section id="reports" className="relative py-32 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" ref={ref}>
        <SectionHeading
          badge="Reporting Suite"
          title="Professional Reporting & Business Intelligence"
          subtitle="Decision-grade insights, PDF exports, and live dashboards across every dimension of your operations."
        />

        <div className="grid lg:grid-cols-2 gap-8 mb-12">
          {/* Charts showcase */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6 }}
            className="rounded-2xl p-6 sm:p-8"
            style={{
              backgroundColor: 'var(--card-bg)',
              border: '1px solid var(--border-color)',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <h3 className="text-lg font-bold mb-6" style={{ color: 'var(--text-primary)' }}>
              Quarterly Inventory Trend
            </h3>
            <div className="flex items-end gap-2 h-40">
              {inView && [...Array(12)].map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ height: 0 }}
                  animate={{ height: `${30 + Math.random() * 70}%` }}
                  transition={{ duration: 0.8, delay: i * 0.05 }}
                  className="flex-1 rounded-t-lg relative group"
                  style={{
                    background: `linear-gradient(to top, rgba(139, 158, 255, 0.6), rgba(167, 139, 250, 0.4))`,
                    borderRadius: '4px 4px 0 0',
                  }}
                >
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-bold whitespace-nowrap"
                    style={{ color: 'var(--text-primary)' }}>
                    Q{i + 1}
                  </div>
                </motion.div>
              ))}
            </div>
            <div className="flex justify-between mt-2">
              {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map(m => (
                <span key={m} className="text-[10px]" style={{ color: 'var(--text-disabled)' }}>{m}</span>
              ))}
            </div>
          </motion.div>

          {/* Report previews */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="space-y-4"
          >
            {[
              { title: 'Department Inventory Report', pages: 12, tag: 'Monthly PDF', color: '#8B9EFF' },
              { title: 'Low Stock Report', pages: 5, tag: '23 items flagged', color: '#EF4444' },
              { title: 'Budget Intelligence Report', pages: 8, tag: '+12% growth', color: '#22C55E' },
              { title: 'Transaction Audit Log', pages: 24, tag: '15K transactions', color: '#F59E0B' },
            ].map((report, i) => (
              <motion.div
                key={report.title}
                initial={{ opacity: 0, x: 20 }}
                animate={inView ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.4, delay: 0.2 + i * 0.1 }}
                className="flex items-center gap-4 p-4 rounded-xl transition-all duration-200 hover:scale-[1.01]"
                style={{
                  backgroundColor: 'var(--card-bg)',
                  border: '1px solid var(--border-color)',
                }}
              >
                <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${report.color}15` }}>
                  <FileText className="w-5 h-5" style={{ color: report.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>{report.title}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{report.pages} pages · auto-generated</p>
                </div>
                <span className="px-3 py-1 rounded-full text-[10px] font-bold whitespace-nowrap"
                  style={{
                    backgroundColor: `${report.color}12`,
                    color: report.color,
                  }}>
                  {report.tag}
                </span>
              </motion.div>
            ))}
          </motion.div>
        </div>

        {/* Bottom stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4"
        >
          {[
            { label: 'Report Types', value: '8', icon: FileText },
            { label: 'Auto-generated', value: 'PDF', icon: Download },
            { label: 'Data Points', value: '50K+', icon: Database },
            { label: 'Export Formats', value: '3', icon: Layers },
          ].map((stat) => (
            <div key={stat.label} className="text-center p-4 rounded-xl"
              style={{ backgroundColor: 'var(--subtle-bg)' }}>
              <stat.icon className="w-5 h-5 mx-auto mb-2" style={{ color: 'var(--gradient-from)' }} />
              <p className="text-xl font-extrabold" style={{ color: 'var(--text-primary)' }}>{stat.value}</p>
              <p className="text-xs font-medium mt-1" style={{ color: 'var(--text-muted)' }}>{stat.label}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Workflow Timeline
// ─────────────────────────────────────────────────────────────────────────────

function WorkflowSection() {
  return (
    <section id="analytics" className="relative py-32 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading
          badge="Workflow"
          title="From Stock In to Analytics"
          subtitle="A seamless, intelligent workflow connecting every aspect of inventory management."
        />

        <div className="relative">
          {/* Connection line */}
          <div className="absolute left-8 top-0 bottom-0 w-0.5 hidden md:block"
            style={{
              background: 'linear-gradient(180deg, #8B9EFF, #A78BFA, #34D399, #F59E0B, #F97316, #EC4899, #06B6D4)',
              opacity: 0.3,
            }}
          />

          <div className="space-y-8 relative">
            {WORKFLOW_STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <motion.div
                  key={step.title}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: '-50px' }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  className="relative flex items-start gap-6 md:gap-8 pl-0 md:pl-16"
                >
                  {/* Circle indicator */}
                  <div className="hidden md:flex absolute left-0 top-1 w-16 items-center justify-center">
                    <motion.div
                      initial={{ scale: 0 }}
                      whileInView={{ scale: 1 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.3, delay: i * 0.1 }}
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-lg"
                      style={{
                        background: `linear-gradient(135deg, ${step.color}, ${step.color}88)`,
                        boxShadow: `0 4px 15px ${step.color}44`,
                      }}
                    >
                      {i + 1}
                    </motion.div>
                  </div>

                  <div className="flex-1 p-6 rounded-2xl transition-all duration-300 hover:scale-[1.01] group"
                    style={{
                      backgroundColor: 'var(--card-bg)',
                      border: '1px solid var(--border-color)',
                      boxShadow: 'var(--shadow-card)',
                    }}>
                    <div className="flex items-center gap-4 mb-3">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                        style={{ backgroundColor: `${step.color}15` }}>
                        <Icon className="w-6 h-6" style={{ color: step.color }} />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{step.title}</h3>
                        <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>{step.desc}</p>
                      </div>
                    </div>
                    {/* Progress indicator */}
                    <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                      <motion.div
                        initial={{ width: 0 }}
                        whileInView={{ width: `${((i + 1) / WORKFLOW_STEPS.length) * 100}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 1, delay: i * 0.1 }}
                        className="h-full rounded-full"
                        style={{ background: `linear-gradient(90deg, ${step.color}, ${step.color}88)` }}
                      />
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Student Innovation Section
// ─────────────────────────────────────────────────────────────────────────────

function StudentInnovation() {
  return (
    <section id="about" className="relative py-32 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 right-0 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(139, 158, 255, 0.3), transparent)' }} />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left: Content */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <SectionHeading
              badge="Student-Built"
              title="Built by Students. Engineered for Real Operations."
              subtitle=""
              align="left"
            />
            <p className="text-lg leading-relaxed mb-8" style={{ color: 'var(--text-muted)' }}>
              Mizero Inventory Hub was designed and developed by{' '}
              <strong style={{ color: 'var(--text-primary)' }}>Mugisha Chrispin</strong> and{' '}
              <strong style={{ color: 'var(--text-primary)' }}>Cyusa Lucky Eloi</strong>,
              Software Development students of Mizero Technical Secondary School, as part of
              practical software engineering and digital transformation initiatives.
            </p>

            <div className="flex flex-wrap gap-4 mb-8">
              <a
                href="https://www.mizerotss.org.rw/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 hover:shadow-lg"
                style={{
                  backgroundColor: 'rgba(139, 158, 255, 0.1)',
                  color: '#6D7FF5',
                }}
              >
                <GraduationCap className="w-4 h-4" />
                Visit Mizero TSS
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            {/* Stats */}
            <div className="flex flex-wrap gap-8">
              {[
                { icon: Code2, label: 'Production Code', value: '10K+ lines' },
                { icon: GitBranch, label: 'Git Commits', value: '200+' },
                { icon: Database, label: 'Database Tables', value: '25+' },
              ].map((s) => (
                <div key={s.label} className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: 'var(--badge-bg)' }}>
                    <s.icon className="w-5 h-5" style={{ color: 'var(--gradient-from)' }} />
                  </div>
                  <div>
                    <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{s.value}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Right: Code showcase */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative"
          >
            <div className="rounded-2xl overflow-hidden shadow-2xl"
              style={{
                backgroundColor: '#0B0D1A',
                border: '1px solid #262952',
              }}>
              {/* Terminal header */}
              <div className="flex items-center gap-2 px-4 py-3" style={{ backgroundColor: '#12142B', borderBottom: '1px solid #262952' }}>
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                </div>
                <span className="text-xs ml-2" style={{ color: '#5B60A0' }}>
                  mizero-inventory-hub — terminal
                </span>
              </div>

              {/* Terminal content */}
              <div className="p-6 font-mono text-sm leading-relaxed space-y-2">
                <p><span style={{ color: '#34D399' }}>$</span>{' '}<span style={{ color: '#8B9EFF' }}>git log --oneline -5</span></p>
                <p style={{ color: '#5B60A0' }}>a1b2c3d feat: implement department budget tracking</p>
                <p style={{ color: '#5B60A0' }}>e4f5g6h feat: add PDF report generation</p>
                <p style={{ color: '#5B60A0' }}>i7j8k9l feat: real-time notification system</p>
                <p style={{ color: '#5B60A0' }}>m0n1o2p feat: low stock alert thresholds</p>
                <p style={{ color: '#5B60A0' }}>q3r4s5t chore: docker compose setup</p>
                <p className="pt-2"><span style={{ color: '#34D399' }}>$</span>{' '}<span style={{ color: '#8B9EFF' }}>npm run build</span></p>
                <p style={{ color: '#34D399' }}>✓ Build complete (2.4s)</p>
                <p className="pt-2" style={{ color: '#5B60A0' }}>// Mizero TSS · pushed to main ✨</p>
              </div>
            </div>

            {/* Floating badge */}
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute -top-4 -right-4 p-3 rounded-xl backdrop-blur-xl shadow-xl"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                border: '1px solid rgba(139, 158, 255, 0.2)',
              }}
            >
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4" style={{ color: '#F59E0B' }} />
                <span className="text-xs font-bold">Production Ready</span>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Impact Section
// ─────────────────────────────────────────────────────────────────────────────

function ImpactSection() {
  return (
    <section className="relative py-32 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading
          badge="Why This Matters"
          title="Beyond Features — A Quiet Shift"
          subtitle="How a school works, learns, and accounts for what it owns."
        />

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {IMPACT_ITEMS.map((item, i) => {
            const Icon = item.icon;
            return (
              <GlassCard key={item.title} delay={i * 0.08} className="p-6 sm:p-8">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
                  style={{
                    background: 'linear-gradient(135deg, rgba(139, 158, 255, 0.1), rgba(167, 139, 250, 0.1))',
                  }}>
                  <Icon className="w-7 h-7" style={{ color: '#8B9EFF' }} />
                </div>
                <h3 className="text-lg font-bold mb-3" style={{ color: 'var(--text-primary)' }}>{item.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>{item.desc}</p>
              </GlassCard>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Contact Section
// ─────────────────────────────────────────────────────────────────────────────

function ContactSection() {
  const [formData, setFormData] = useState({ name: '', email: '', subject: '', message: '' });
  const [status, setStatus] = useState('idle'); // idle | sending | success | error
  const [errorMsg, setErrorMsg] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const validate = () => {
    const errors = {};
    if (!formData.name.trim() || formData.name.trim().length < 2) errors.name = 'Name is required (min 2 characters)';
    if (!formData.email.trim()) errors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) errors.email = 'Please enter a valid email';
    if (!formData.subject.trim() || formData.subject.trim().length < 3) errors.subject = 'Subject is required (min 3 characters)';
    if (!formData.message.trim() || formData.message.trim().length < 10) errors.message = 'Message is required (min 10 characters)';
    return errors;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear field error on change
    if (fieldErrors[name]) {
      setFieldErrors(prev => ({ ...prev, [name]: '' }));
    }
    if (errorMsg) setErrorMsg('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errors = validate();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    setStatus('sending');

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus('success');
        setFormData({ name: '', email: '', subject: '', message: '' });
        // Reset success state after 6 seconds
        setTimeout(() => setStatus('idle'), 6000);
      } else {
        setStatus('error');
        setErrorMsg(data.message || 'Something went wrong. Please try again.');
        if (data.errors) {
          const fieldErrs = {};
          data.errors.forEach(err => { fieldErrs[err.field] = err.message; });
          setFieldErrors(fieldErrs);
        }
      }
    } catch (err) {
      setStatus('error');
      setErrorMsg('Network error. Please check your connection and try again.');
    }
  };

  const inputClass = (field) => `
    w-full px-5 py-4 rounded-xl text-sm font-medium transition-all duration-200 outline-none
    ${fieldErrors[field] ? 'ring-2 ring-red-500/50' : 'focus:ring-2 focus:ring-[#8B9EFF]/50'}
  `;

  return (
    <section id="contact" className="relative py-32 overflow-hidden">
      {/* Background accents */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[40%] h-[40%] rounded-full opacity-[0.04]"
          style={{ background: 'radial-gradient(circle, #8B9EFF 0%, transparent 70%)' }} />
        <div className="absolute bottom-0 left-0 w-[30%] h-[30%] rounded-full opacity-[0.03]"
          style={{ background: 'radial-gradient(circle, #A78BFA 0%, transparent 70%)' }} />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading
          badge="Get in Touch"
          title="Let's Start a Conversation"
          subtitle="Have questions about Mizero Inventory Hub? Want a demo or partnership inquiry? We'd love to hear from you."
        />

        <div className="max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="rounded-2xl p-8 sm:p-10"
            style={{
              backgroundColor: 'var(--card-bg)',
              border: '1px solid var(--border-color)',
              boxShadow: 'var(--shadow-xl)',
            }}
          >
            {/* Success state */}
            {status === 'success' ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-8"
              >
                <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6"
                  style={{
                    background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.15), rgba(34, 197, 94, 0.05))',
                  }}>
                  <CheckCircle className="w-10 h-10 text-green-500" />
                </div>
                <h3 className="text-2xl font-extrabold mb-3" style={{ color: 'var(--text-primary)' }}>
                  Message Sent Successfully! 🎉
                </h3>
                <p className="text-sm max-w-md mx-auto leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  Thank you for reaching out! We have received your message and will get back to you
                  as soon as possible. A confirmation has been sent to your email.
                </p>
              </motion.div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Error banner */}
                {status === 'error' && errorMsg && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 rounded-xl text-sm font-semibold"
                    style={{
                      backgroundColor: 'rgba(239, 68, 68, 0.08)',
                      color: '#EF4444',
                      border: '1px solid rgba(239, 68, 68, 0.2)',
                    }}
                  >
                    {errorMsg}
                  </motion.div>
                )}

                <div className="grid sm:grid-cols-2 gap-5">
                  {/* Name */}
                  <div>
                    <label className="block text-sm font-bold mb-2" style={{ color: 'var(--text-secondary)' }}>
                      Full Name
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      placeholder="Enter your name"
                      className={inputClass('name')}
                      style={{
                        backgroundColor: 'var(--bg-secondary)',
                        color: 'var(--text-primary)',
                        border: fieldErrors.name ? '' : '1.5px solid var(--border-color)',
                      }}
                    />
                    {fieldErrors.name && (
                      <p className="text-xs mt-1.5 font-medium" style={{ color: '#EF4444' }}>{fieldErrors.name}</p>
                    )}
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-sm font-bold mb-2" style={{ color: 'var(--text-secondary)' }}>
                      Email Address
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="Enter your email"
                      className={inputClass('email')}
                      style={{
                        backgroundColor: 'var(--bg-secondary)',
                        color: 'var(--text-primary)',
                        border: fieldErrors.email ? '' : '1.5px solid var(--border-color)',
                      }}
                    />
                    {fieldErrors.email && (
                      <p className="text-xs mt-1.5 font-medium" style={{ color: '#EF4444' }}>{fieldErrors.email}</p>
                    )}
                  </div>
                </div>

                {/* Subject */}
                <div>
                  <label className="block text-sm font-bold mb-2" style={{ color: 'var(--text-secondary)' }}>
                    Subject
                  </label>
                  <input
                    type="text"
                    name="subject"
                    value={formData.subject}
                    onChange={handleChange}
                    placeholder="What is this regarding?"
                    className={inputClass('subject')}
                    style={{
                      backgroundColor: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      border: fieldErrors.subject ? '' : '1.5px solid var(--border-color)',
                    }}
                  />
                  {fieldErrors.subject && (
                    <p className="text-xs mt-1.5 font-medium" style={{ color: '#EF4444' }}>{fieldErrors.subject}</p>
                  )}
                </div>

                {/* Message */}
                <div>
                  <label className="block text-sm font-bold mb-2" style={{ color: 'var(--text-secondary)' }}>
                    Message
                  </label>
                  <textarea
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    placeholder="Tell us more about your inquiry..."
                    rows="5"
                    className={inputClass('message')}
                    style={{
                      backgroundColor: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      border: fieldErrors.message ? '' : '1.5px solid var(--border-color)',
                      resize: 'vertical',
                      minHeight: '120px',
                    }}
                  />
                  {fieldErrors.message && (
                    <p className="text-xs mt-1.5 font-medium" style={{ color: '#EF4444' }}>{fieldErrors.message}</p>
                  )}
                  <p className="text-xs mt-2" style={{ color: 'var(--text-disabled)' }}>
                    {formData.message.length}/2000 characters
                  </p>
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={status === 'sending'}
                  className="w-full px-8 py-4 rounded-xl text-base font-bold text-white transition-all duration-200 hover:shadow-2xl hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-3 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
                  style={{
                    background: 'linear-gradient(135deg, #8B9EFF, #A78BFA)',
                    boxShadow: '0 8px 25px rgba(139, 158, 255, 0.35)',
                  }}
                >
                  {status === 'sending' ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5" />
                      Send Message
                    </>
                  )}
                </button>

                {/* Trust note */}
                <p className="text-xs text-center" style={{ color: 'var(--text-disabled)' }}>
                  We typically respond within 24 hours. Your information is kept private.
                </p>
              </form>
            )}
          </motion.div>

          {/* Contact info cards */}
          <div className="grid sm:grid-cols-2 gap-4 mt-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="flex items-center gap-4 p-5 rounded-xl"
              style={{
                backgroundColor: 'var(--subtle-bg)',
                border: '1px solid var(--subtle-border)',
              }}
            >
              <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: 'var(--badge-bg)' }}>
                <Mail className="w-5 h-5" style={{ color: '#8B9EFF' }} />
              </div>
              <div>
                <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Email</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>info@mizerotss.org.rw</p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="flex items-center gap-4 p-5 rounded-xl"
              style={{
                backgroundColor: 'var(--subtle-bg)',
                border: '1px solid var(--subtle-border)',
              }}
            >
              <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: 'var(--badge-bg)' }}>
                <MapPin className="w-5 h-5" style={{ color: '#8B9EFF' }} />
              </div>
              <div>
                <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Location</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Rusizi, Rwanda</p>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Footer
// ─────────────────────────────────────────────────────────────────────────────

function FooterSection({ dark }) {
  return (
    <footer id="contact-footer" className="relative py-20" style={{
      backgroundColor: dark ? '#0B0D1A' : '#0F172A',
      color: '#FFFFFF',
    }}>
      {/* Top gradient line */}
      <div className="absolute top-0 left-0 right-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(139, 158, 255, 0.4), transparent)' }} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-12">
          {/* Brand */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-3 mb-6">
              <img
                src={mizeroLogo}
                alt="Mizero Inventory Hub"
                className="h-14 w-auto object-contain"
                style={{
                  filter: 'brightness(1.1) drop-shadow(0 0 6px rgba(165, 180, 252, 0.3))'
                }}
              />
              <div>
                <span className="text-xl font-bold tracking-tight">Mizero</span>
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-gray-400">
                  Inventory Hub
                </p>
              </div>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed max-w-md mb-6">
              An enterprise-grade department-centered inventory intelligence platform built with modern
              software engineering practices. Developed at Mizero Technical Secondary School,
              Rusizi, Rwanda.
            </p>
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <MapPin className="w-4 h-4" />
              Rusizi, Rwanda
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-sm font-bold uppercase tracking-wider mb-5 text-gray-300">Quick Links</h4>
            <ul className="space-y-3">
              {['Features', 'Departments', 'Reports', 'Analytics', 'About'].map((link) => (
                <li key={link}>
                  <a href={`#${link.toLowerCase()}`}
                    className="text-sm text-gray-400 hover:text-white transition-colors duration-200">
                    {link}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Connect */}
          <div>
            <h4 className="text-sm font-bold uppercase tracking-wider mb-5 text-gray-300">Connect</h4>
            <ul className="space-y-3">
              <li>
                <a href="https://www.mizerotss.org.rw/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-gray-400 hover:text-white transition-colors duration-200 inline-flex items-center gap-1">
                  <GraduationCap className="w-3.5 h-3.5" />
                  Mizero TSS
                </a>
              </li>
              <li>
                <span className="text-sm text-gray-400">
                  Mugisha Chrispin
                </span>
              </li>
              <li>
                <span className="text-sm text-gray-400">
                  Cyusa Lucky Eloi
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Divider */}
        <div className="my-12 h-px bg-gray-800" />

        {/* Bottom */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-gray-500">
            Developed by{' '}
            <span className="text-gray-300 font-semibold">Mugisha Chrispin</span> &{' '}
            <span className="text-gray-300 font-semibold">Cyusa Lucky Eloi</span>
          </p>
          <p className="text-xs text-gray-600">
            © {new Date().getFullYear()} Mizero Inventory Hub · Mizero Technical Secondary School
          </p>
        </div>
      </div>
    </footer>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Landing Page
// ─────────────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Sync with ThemeContext
  const localDark = document.documentElement.classList.contains('dark');
  const [dark, setDark] = useState(localDark);

  const toggleTheme = useCallback(() => {
    setDark(prev => {
      const next = !prev;
      localStorage.setItem('theme', next ? 'dark' : 'light');
      document.documentElement.classList.toggle('dark', next);
      return next;
    });
  }, []);

  // Track scroll for navbar
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Toggle body overflow for landing page (app needs overflow:hidden internally)
  useEffect(() => {
    document.body.style.overflowY = 'auto';
    document.body.style.overflowX = 'hidden';
    return () => {
      document.body.style.overflowY = '';
      document.body.style.overflowX = '';
    };
  }, []);

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <Navbar dark={dark} toggleTheme={toggleTheme} scrolled={scrolled} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />

      <main>
        <HeroSection dark={dark} />
        <SystemShowcase />
        <DepartmentIntelligence />
        <ReportsSection />
        <WorkflowSection />
        <StudentInnovation />
        <ImpactSection />
        <ContactSection />
      </main>

      <FooterSection dark={dark} />

      {/* Scroll to top button */}
      <ScrollToTop />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Scroll to Top
// ─────────────────────────────────────────────────────────────────────────────

function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => setVisible(window.scrollY > 400);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0 }}
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-8 right-8 z-40 w-12 h-12 rounded-xl flex items-center justify-center shadow-xl transition-all duration-200 hover:scale-105"
          style={{
            background: 'linear-gradient(135deg, #8B9EFF, #A78BFA)',
            boxShadow: '0 4px 15px rgba(139, 158, 255, 0.35)',
          }}
        >
          <ArrowRight className="w-5 h-5 text-white -rotate-90" />
        </motion.button>
      )}
    </AnimatePresence>
  );
}
