import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import {
  Users,
  UserPlus,
  Clock,
  CheckCircle2,
  XCircle,
  RotateCcw,
  AlertTriangle,
  FileText,
  ShieldCheck,
  Building2,
  Filter,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  HardDrive,
  ArrowRight,
  ArrowUpRight,
  TrendingUp,
  Sparkles,
  Layers,
  Activity,
  Check
} from 'lucide-react';

export function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);
  const [masters, setMasters] = useState({ branches: [], departments: [], locations: [], reviewers: [] });
  const [loading, setLoading] = useState(true);

  // Time range selector for performance chart (matching reference 1D, 1W, 1M, 6M, 1Y)
  const [chartRange, setChartRange] = useState('6M');

  // Watchlist filter tabs (All, Critical, Cleared)
  const [watchlistTab, setWatchlistTab] = useState('all');

  // Filters
  const [selectedBranch, setSelectedBranch] = useState('ALL');
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [selectedLocation, setSelectedLocation] = useState('ALL');
  const [selectedReviewer, setSelectedReviewer] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    loadDashboardData();
    loadMasters();
  }, []);

  async function loadMasters() {
    try {
      const data = await api.masters.getAll();
      setMasters(data);
    } catch (err) {
      console.error('Failed to load masters:', err);
    }
  }

  async function loadDashboardData() {
    setLoading(true);
    try {
      const params = {};
      if (selectedBranch !== 'ALL') params.branch = selectedBranch;
      if (selectedDept !== 'ALL') params.department = selectedDept;
      if (selectedLocation !== 'ALL') params.location = selectedLocation;
      if (selectedReviewer !== 'ALL') params.reviewerId = selectedReviewer;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const data = await api.masters.getStats(params);
      setStats(data.stats);
      setRecentActivity(data.recentActivity || []);
    } catch (err) {
      console.error('Dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  }

  function handleFilterSubmit(e) {
    if (e) e.preventDefault();
    loadDashboardData();
  }

  function handleClearFilters() {
    setSelectedBranch('ALL');
    setSelectedDept('ALL');
    setSelectedLocation('ALL');
    setSelectedReviewer('ALL');
    setStartDate('');
    setEndDate('');
    setTimeout(() => {
      api.masters.getStats({}).then((data) => {
        setStats(data.stats);
        setRecentActivity(data.recentActivity || []);
      });
    }, 50);
  }

  // When clicking a card, route directly to the queue / employee master with matching status
  function handleCardClick(targetPath, filterParams = {}) {
    const query = new URLSearchParams(filterParams).toString();
    navigate(`${targetPath}${query ? `?${query}` : ''}`);
  }

  // Chart curves for different time ranges
  const chartPaths = {
    '1D': {
      d: "M 0 160 C 150 140, 300 170, 450 120 C 600 70, 750 110, 900 65 C 1050 20, 1150 70, 1200 40",
      fill: "M 0 160 C 150 140, 300 170, 450 120 C 600 70, 750 110, 900 65 C 1050 20, 1150 70, 1200 40 L 1200 220 L 0 220 Z",
      markerX: 900,
      markerY: 65,
      markerLabel: "Today 16:00 • 98.4% SLA"
    },
    '1W': {
      d: "M 0 140 C 180 180, 340 100, 520 130 C 680 160, 820 50, 950 80 C 1080 110, 1140 40, 1200 50",
      fill: "M 0 140 C 180 180, 340 100, 520 130 C 680 160, 820 50, 950 80 C 1080 110, 1140 40, 1200 50 L 1200 220 L 0 220 Z",
      markerX: 820,
      markerY: 50,
      markerLabel: "Thursday • 42 Cleared"
    },
    '1M': {
      d: "M 0 170 C 120 150, 240 120, 380 140 C 520 160, 680 90, 840 75 C 960 60, 1080 120, 1200 90",
      fill: "M 0 170 C 120 150, 240 120, 380 140 C 520 160, 680 90, 840 75 C 960 60, 1080 120, 1200 90 L 1200 220 L 0 220 Z",
      markerX: 840,
      markerY: 75,
      markerLabel: "Week 3 • 186 Submissions"
    },
    '6M': {
      d: "M 0 100 C 80 100, 140 130, 220 120 C 300 110, 380 145, 460 140 C 540 135, 580 80, 630 110 C 670 135, 730 85, 800 130 C 860 170, 920 125, 990 145 C 1060 165, 1140 120, 1200 155",
      fill: "M 0 100 C 80 100, 140 130, 220 120 C 300 110, 380 145, 460 140 C 540 135, 580 80, 630 110 C 670 135, 730 85, 800 130 C 860 170, 920 125, 990 145 C 1060 165, 1140 120, 1200 155 L 1200 220 L 0 220 Z",
      markerX: 630,
      markerY: 110,
      markerLabel: "1st Jun 2026 • 100% SLA"
    },
    '1Y': {
      d: "M 0 150 C 100 130, 200 110, 320 140 C 440 170, 580 90, 700 80 C 820 70, 940 130, 1060 100 C 1130 80, 1170 110, 1200 95",
      fill: "M 0 150 C 100 130, 200 110, 320 140 C 440 170, 580 90, 700 80 C 820 70, 940 130, 1060 100 C 1130 80, 1170 110, 1200 95 L 1200 220 L 0 220 Z",
      markerX: 700,
      markerY: 80,
      markerLabel: "H1 2026 • 1,280 Audited"
    }
  };

  const currentChart = chartPaths[chartRange] || chartPaths['6M'];

  // Watchlist items filtered based on active tab
  const allWatchlistItems = [
    {
      id: 'pending',
      tab: 'critical',
      name: 'Pending BGV Review',
      sub: 'Action required by reviewer',
      count: stats?.pendingBgvReview || 0,
      badgeText: 'Review Req.',
      badgeColor: '#C084FC',
      badgeBg: 'rgba(192, 132, 252, 0.15)',
      icon: <ShieldCheck size={18} color="#C084FC" />,
      iconBg: 'rgba(192, 132, 252, 0.14)',
      action: () => handleCardClick('/admin/queue', { status: 'Pending BGV Review' })
    },
    {
      id: 'verified',
      tab: 'cleared',
      name: 'Verified Candidates',
      sub: 'Successfully cleared BGV SLA',
      count: stats?.verified || 0,
      badgeText: '+ Cleared',
      badgeColor: '#34D399',
      badgeBg: 'rgba(52, 211, 153, 0.15)',
      icon: <CheckCircle2 size={18} color="#34D399" />,
      iconBg: 'rgba(52, 211, 153, 0.14)',
      action: () => handleCardClick('/admin/queue', { status: 'Verified' })
    },
    {
      id: 'reverification',
      tab: 'critical',
      name: 'Reverification Req.',
      sub: 'Attempt 2 re-triggered',
      count: stats?.reverificationRequired || 0,
      badgeText: 'Attempt 2',
      badgeColor: '#FBBF24',
      badgeBg: 'rgba(251, 191, 36, 0.15)',
      icon: <RotateCcw size={18} color="#FBBF24" />,
      iconBg: 'rgba(251, 191, 36, 0.14)',
      action: () => handleCardClick('/admin/reverification')
    },
    {
      id: 'failed',
      tab: 'critical',
      name: 'Verification Failed',
      sub: 'Address or documents mismatched',
      count: stats?.verificationFailed || 0,
      badgeText: 'Mismatch',
      badgeColor: '#F87171',
      badgeBg: 'rgba(248, 113, 113, 0.15)',
      icon: <XCircle size={18} color="#F87171" />,
      iconBg: 'rgba(248, 113, 113, 0.14)',
      action: () => handleCardClick('/admin/queue', { status: 'Verification Failed' })
    },
    {
      id: 'docsPending',
      tab: 'critical',
      name: 'Documents Pending',
      sub: 'Proof uploads incomplete',
      count: stats?.documentsPending || 0,
      badgeText: 'Incomplete',
      badgeColor: '#FBBF24',
      badgeBg: 'rgba(251, 191, 36, 0.12)',
      icon: <FileText size={18} color="#FBBF24" />,
      iconBg: 'rgba(251, 191, 36, 0.12)',
      action: () => handleCardClick('/admin/employees', { status: 'In Progress' })
    }
  ];

  const filteredWatchlist = allWatchlistItems.filter(item => {
    if (watchlistTab === 'all') return true;
    return item.tab === watchlistTab;
  });

  return (
    <div className="admin-content">
      {/* Top View Selector Pills & Actions Bar (Matching Reference Market / Wallet / Tools style) */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '20px',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        {/* Category Pills matching Reference */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(255, 255, 255, 0.03)',
          padding: '4px',
          borderRadius: 'var(--radius-full)',
          border: '1px solid rgba(255, 255, 255, 0.06)'
        }}>
          <button
            className="btn-ghost"
            style={{
              padding: '6px 16px',
              borderRadius: 'var(--radius-full)',
              fontSize: '0.82rem',
              fontWeight: 600,
              backgroundColor: 'var(--bg-pill-hover)',
              color: 'var(--text-main)'
            }}
          >
            Overview
          </button>
          <button
            className="btn-ghost"
            onClick={() => navigate('/admin/queue')}
            style={{
              padding: '6px 16px',
              borderRadius: 'var(--radius-full)',
              fontSize: '0.82rem',
              fontWeight: 500,
              color: 'var(--text-secondary)'
            }}
          >
            Review Queue
          </button>
          <button
            className="btn-ghost"
            onClick={() => navigate('/admin/reports')}
            style={{
              padding: '6px 16px',
              borderRadius: 'var(--radius-full)',
              fontSize: '0.82rem',
              fontWeight: 500,
              color: 'var(--text-secondary)'
            }}
          >
            SLA Analytics
          </button>
        </div>

        {/* Right Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={loadDashboardData}
            disabled={loading}
            title="Refresh dashboard metrics"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
          </button>

          <a
            href="/verify"
            target="_blank"
            rel="noreferrer"
            className="btn btn-primary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <span>Candidate Portal Link</span>
            <ExternalLink size={12} />
          </a>
        </div>
      </div>

      {/* =========================================================
          TOP SECTION: 3-COLUMN REFERENCE DASHBOARD GRID
          Col 1: Hero Total Count + Feature Card with purple glow
          Col 2: Verification Watchlist (tabs + glowing items)
          Col 3: SLA & Lifecycle Status (2x2 micro stat grid)
          ========================================================= */}
      <div className="dashboard-top-grid">
        {/* COLUMN 1: LEFT HERO STACK */}
        <div className="dashboard-col-left">
          {/* Top Hero Card: Total Employees */}
          <div
            className="dark-hero-card"
            onClick={() => handleCardClick('/admin/employees')}
            role="button"
            tabIndex={0}
            style={{ cursor: 'pointer' }}
          >
            <div className="hero-card-header">
              <span className="hero-card-label">Total Employees</span>
              <div className="hero-pill-dropdown">
                <span>All Active</span>
                <ChevronRight size={12} />
              </div>
            </div>

            <div>
              <div className="hero-stat-value">
                {stats?.totalEmployees ? stats.totalEmployees.toLocaleString() : '0'}
              </div>
              <div className="hero-trend-badge">
                <TrendingUp size={14} />
                <span>100% Monitored Candidates</span>
              </div>
            </div>
          </div>

          {/* Bottom Feature Card: AI Geolocation & BGV Verification Engine */}
          <div className="dark-feature-card">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <Sparkles size={16} color="#C084FC" />
                <h4 className="feature-card-title" style={{ margin: 0 }}>
                  Verification Powered by GPS
                </h4>
              </div>
              <p className="feature-card-desc">
                Real-time geo-coordinates validation, EXIF metadata checking, and automated SLA turnaround controls.
              </p>
            </div>

            <button
              className="btn-glowing-feature"
              onClick={() => handleCardClick('/admin/queue', { status: 'Pending BGV Review' })}
            >
              <span>Explore Review Queue</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>

        {/* COLUMN 2: CENTER VERIFICATION WATCHLIST */}
        <div className="dark-watchlist-card">
          <div className="watchlist-header">
            <h3 className="watchlist-title">Verification Watchlist</h3>
            <div className="watchlist-pill-tabs">
              <button
                className={`watchlist-pill-btn ${watchlistTab === 'all' ? 'active' : ''}`}
                onClick={() => setWatchlistTab('all')}
              >
                All
              </button>
              <button
                className={`watchlist-pill-btn ${watchlistTab === 'critical' ? 'active' : ''}`}
                onClick={() => setWatchlistTab('critical')}
              >
                Critical
              </button>
              <button
                className={`watchlist-pill-btn ${watchlistTab === 'cleared' ? 'active' : ''}`}
                onClick={() => setWatchlistTab('cleared')}
              >
                Cleared
              </button>
            </div>
          </div>

          <div className="watchlist-items-list">
            {filteredWatchlist.map((item) => (
              <div
                key={item.id}
                className="watchlist-item-row"
                onClick={item.action}
                role="button"
                tabIndex={0}
              >
                <div className="watchlist-item-left">
                  <div
                    className="watchlist-item-icon"
                    style={{ backgroundColor: item.iconBg }}
                  >
                    {item.icon}
                  </div>
                  <div>
                    <div className="watchlist-item-name">{item.name}</div>
                    <div className="watchlist-item-sub">{item.sub}</div>
                  </div>
                </div>

                <div className="watchlist-item-right">
                  <div className="watchlist-item-count">{item.count}</div>
                  <span
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      color: item.badgeColor,
                      backgroundColor: item.badgeBg,
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-full)'
                    }}
                  >
                    {item.badgeText}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* COLUMN 3: RIGHT SLA & LIFECYCLE 2x2 GRID */}
        <div className="dark-portfolio-card">
          <div className="portfolio-header">
            <h3 className="portfolio-title">SLA & Lifecycle Status</h3>
            <button
              className="portfolio-see-all"
              onClick={() => navigate('/admin/queue')}
            >
              <span>See all</span>
              <ArrowUpRight size={13} />
            </button>
          </div>

          <div className="portfolio-grid-2x2">
            {/* 1. Within TAT */}
            <div
              className="micro-stat-card"
              onClick={() => handleCardClick('/admin/queue', { tatStatus: 'Within TAT' })}
              role="button"
              tabIndex={0}
            >
              <div>
                <div className="micro-stat-value" style={{ color: '#34D399' }}>
                  {stats?.withinTat || 0}
                </div>
                <div className="micro-stat-label">Within TAT</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  color: '#34D399',
                  backgroundColor: 'rgba(52, 211, 153, 0.12)',
                  padding: '2px 6px',
                  borderRadius: 'var(--radius-full)'
                }}>
                  SLA Passed
                </span>
                <CheckCircle2 size={15} color="#34D399" />
              </div>
            </div>

            {/* 2. TAT Breached */}
            <div
              className="micro-stat-card"
              onClick={() => handleCardClick('/admin/queue', { tatStatus: 'TAT Breached' })}
              role="button"
              tabIndex={0}
            >
              <div>
                <div className="micro-stat-value" style={{ color: '#F87171' }}>
                  {stats?.tatBreached || 0}
                </div>
                <div className="micro-stat-label">TAT Breached</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  color: '#F87171',
                  backgroundColor: 'rgba(248, 113, 113, 0.12)',
                  padding: '2px 6px',
                  borderRadius: 'var(--radius-full)'
                }}>
                  Breached
                </span>
                <AlertTriangle size={15} color="#F87171" />
              </div>
            </div>

            {/* 3. In Progress */}
            <div
              className="micro-stat-card"
              onClick={() => handleCardClick('/admin/employees', { status: 'In Progress' })}
              role="button"
              tabIndex={0}
            >
              <div>
                <div className="micro-stat-value" style={{ color: '#38BDF8' }}>
                  {stats?.inProgress || 0}
                </div>
                <div className="micro-stat-label">In Progress</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  color: '#38BDF8',
                  backgroundColor: 'rgba(56, 189, 248, 0.12)',
                  padding: '2px 6px',
                  borderRadius: 'var(--radius-full)'
                }}>
                  Active Filling
                </span>
                <Clock size={15} color="#38BDF8" />
              </div>
            </div>

            {/* 4. Not Started */}
            <div
              className="micro-stat-card"
              onClick={() => handleCardClick('/admin/employees', { status: 'Not Started' })}
              role="button"
              tabIndex={0}
            >
              <div>
                <div className="micro-stat-value" style={{ color: '#94A3B8' }}>
                  {stats?.notStarted || 0}
                </div>
                <div className="micro-stat-label">Not Started</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  color: '#94A3B8',
                  backgroundColor: 'rgba(148, 163, 184, 0.12)',
                  padding: '2px 6px',
                  borderRadius: 'var(--radius-full)'
                }}>
                  Pending Login
                </span>
                <Users size={15} color="#94A3B8" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================
          MIDDLE SECTION: PERFORMANCE TREND CHART (MATCHING REFERENCE)
          ========================================================= */}
      <div className="dark-chart-card">
        <div className="chart-card-header">
          <div>
            <h3 className="chart-card-title">Verification Performance & TAT Trend</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '2px' }}>
              Monthly verification velocity, turnaround SLA adherence and volume curve
            </p>
          </div>

          <div className="chart-range-pills">
            {['1D', '1W', '1M', '6M', '1Y'].map((range) => (
              <button
                key={range}
                className={`chart-range-btn ${chartRange === range ? 'active' : ''}`}
                onClick={() => setChartRange(range)}
              >
                {range}
              </button>
            ))}
          </div>
        </div>

        {/* SVG Curve Chart with Glow and Floating Tooltip */}
        <div className="chart-canvas-container">
          {/* Tooltip Badge positioned at marker */}
          <div
            className="chart-tooltip-badge"
            style={{
              left: `${(currentChart.markerX / 1200) * 100}%`,
              top: `${(currentChart.markerY / 220) * 100}%`
            }}
          >
            <span>{currentChart.markerLabel}</span>
          </div>

          <svg
            viewBox="0 0 1200 220"
            preserveAspectRatio="none"
            style={{ width: '100%', height: '100%', overflow: 'visible' }}
          >
            <defs>
              {/* Soft purple gradient fill under curve */}
              <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#C084FC" stopOpacity="0.28" />
                <stop offset="85%" stopColor="#C084FC" stopOpacity="0.02" />
                <stop offset="100%" stopColor="#C084FC" stopOpacity="0" />
              </linearGradient>

              {/* Glowing stroke filter */}
              <filter id="glowEffect" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Horizontal Guide Gridlines */}
            <line x1="0" y1="50" x2="1200" y2="50" stroke="rgba(255, 255, 255, 0.04)" strokeDasharray="3 3" />
            <line x1="0" y1="100" x2="1200" y2="100" stroke="rgba(255, 255, 255, 0.04)" strokeDasharray="3 3" />
            <line x1="0" y1="150" x2="1200" y2="150" stroke="rgba(255, 255, 255, 0.04)" strokeDasharray="3 3" />

            {/* Vertical Marker Guide Line */}
            <line
              x1={currentChart.markerX}
              y1={currentChart.markerY}
              x2={currentChart.markerX}
              y2={220}
              stroke="rgba(216, 180, 254, 0.45)"
              strokeDasharray="4 4"
            />

            {/* Gradient Fill under curve */}
            <path
              d={currentChart.fill}
              fill="url(#chartGradient)"
            />

            {/* Glowing Smooth Curve Line */}
            <path
              d={currentChart.d}
              fill="none"
              stroke="#D8B4FE"
              strokeWidth="2.5"
              filter="url(#glowEffect)"
            />

            {/* Marker Halo & Dot */}
            <circle
              cx={currentChart.markerX}
              cy={currentChart.markerY}
              r="7"
              fill="#C084FC"
              fillOpacity="0.3"
            />
            <circle
              cx={currentChart.markerX}
              cy={currentChart.markerY}
              r="4.5"
              fill="#FFFFFF"
              stroke="#A855F7"
              strokeWidth="2"
            />
          </svg>
        </div>

        {/* X-Axis Labels */}
        <div className="chart-axis-labels">
          <span>Jan</span>
          <span>Feb</span>
          <span>Mar</span>
          <span>Apr</span>
          <span>May</span>
          <span style={{ color: '#E9D5FF', fontWeight: 700 }}>Jun</span>
          <span>Jul</span>
          <span>Aug</span>
          <span>Sep</span>
          <span>Oct</span>
          <span>Nov</span>
          <span>Dec</span>
        </div>
      </div>

      {/* =========================================================
          MODERN COMPACT PILL FILTER BAR
          ========================================================= */}
      <div className="modern-filter-bar">
        <form onSubmit={handleFilterSubmit}>
          <div className="filter-grid">
            {/* Branch */}
            <div className="filter-field">
              <label className="filter-label">Branch</label>
              <select
                className="form-control form-select"
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
              >
                <option value="ALL">All Branches</option>
                {masters.branches?.map((b) => (
                  <option key={b.id} value={b.branch_name}>{b.branch_name}</option>
                ))}
              </select>
            </div>

            {/* Department */}
            <div className="filter-field">
              <label className="filter-label">Department</label>
              <select
                className="form-control form-select"
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
              >
                <option value="ALL">All Departments</option>
                {masters.departments?.map((d) => (
                  <option key={d.id} value={d.department_name}>{d.department_name}</option>
                ))}
              </select>
            </div>

            {/* Location */}
            <div className="filter-field">
              <label className="filter-label">Location</label>
              <select
                className="form-control form-select"
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
              >
                <option value="ALL">All Locations</option>
                {masters.locations?.map((l) => (
                  <option key={l.id} value={l.location_name}>{l.location_name}</option>
                ))}
              </select>
            </div>

            {/* BGV Reviewer */}
            <div className="filter-field">
              <label className="filter-label">BGV Reviewer</label>
              <select
                className="form-control form-select"
                value={selectedReviewer}
                onChange={(e) => setSelectedReviewer(e.target.value)}
              >
                <option value="ALL">All Reviewers</option>
                {masters.reviewers?.map((r) => (
                  <option key={r.id} value={r.id}>{r.full_name}</option>
                ))}
              </select>
            </div>

            {/* DOJ From */}
            <div className="filter-field">
              <label className="filter-label">DOJ From</label>
              <input
                type="date"
                className="form-control"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            {/* DOJ To */}
            <div className="filter-field">
              <label className="filter-label">DOJ To</label>
              <input
                type="date"
                className="form-control"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            {/* Actions: Filter & Clear */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                id="btn-apply-filters"
                type="submit"
                className="btn btn-primary"
                style={{ flex: 1, padding: '7px 14px', height: 38, fontSize: '0.84rem' }}
              >
                <Filter size={13} />
                <span>Filter</span>
              </button>

              <button
                id="btn-clear-filters"
                type="button"
                className="btn btn-secondary"
                style={{ padding: '7px 14px', height: 38, fontSize: '0.84rem' }}
                onClick={handleClearFilters}
                title="Reset all filters"
              >
                Clear
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* =========================================================
          BOTTOM SECTION: QUICK OPERATIONS & RECENT SYSTEM EVENTS
          ========================================================= */}
      <div className="bottom-dashboard-grid">
        {/* Quick Operations Modern Card */}
        <div style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--radius-lg)',
          padding: '22px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', margin: 0, fontFamily: 'var(--font-heading)' }}>
                Quick Operations
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '2px' }}>
                Primary candidate management shortcuts
              </p>
            </div>
            <span style={{
              fontSize: '0.7rem',
              color: 'var(--text-secondary)',
              fontWeight: 600,
              background: 'rgba(255, 255, 255, 0.05)',
              padding: '2px 8px',
              borderRadius: 'var(--radius-full)'
            }}>
              4 ACTIONS
            </span>
          </div>

          <div className="quick-ops-grid">
            {/* Add Single Employee */}
            <div
              className="quick-op-card"
              onClick={() => navigate('/admin/employees?action=add')}
              role="button"
              tabIndex={0}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div className="quick-op-icon" style={{ backgroundColor: 'rgba(192, 132, 252, 0.15)', color: '#C084FC' }}>
                  <UserPlus size={18} />
                </div>
                <div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-main)' }}>Add Single Employee</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Manual single candidate onboarding & link generation</div>
                </div>
              </div>
              <ChevronRight size={16} color="var(--text-muted)" />
            </div>

            {/* Bulk Upload Employees */}
            <div
              className="quick-op-card"
              onClick={() => navigate('/admin/bulk-upload')}
              role="button"
              tabIndex={0}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div className="quick-op-icon" style={{ backgroundColor: 'rgba(168, 85, 247, 0.15)', color: '#C084FC' }}>
                  <Building2 size={18} />
                </div>
                <div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-main)' }}>Bulk Upload Employees (Excel/CSV)</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Batch import candidate profiles with custom column mapping</div>
                </div>
              </div>
              <ChevronRight size={16} color="var(--text-muted)" />
            </div>

            {/* Open BGV Verification Queue */}
            <div
              className="quick-op-card"
              onClick={() => navigate('/admin/queue?status=Pending BGV Review')}
              role="button"
              tabIndex={0}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div className="quick-op-icon" style={{ backgroundColor: 'rgba(52, 211, 153, 0.15)', color: '#34D399' }}>
                  <ShieldCheck size={18} />
                </div>
                <div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-main)' }}>Open BGV Verification Queue</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Direct access to candidate cases pending reviewer approval</div>
                </div>
              </div>
              <ChevronRight size={16} color="var(--text-muted)" />
            </div>

            {/* View Internal Download Area */}
            <div
              className="quick-op-card"
              onClick={() => navigate('/admin/downloads')}
              role="button"
              tabIndex={0}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div className="quick-op-icon" style={{ backgroundColor: 'rgba(56, 189, 248, 0.15)', color: '#38BDF8' }}>
                  <HardDrive size={18} />
                </div>
                <div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-main)' }}>View Internal Download Area</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Access generated BGV reports, audits and zip archives</div>
                </div>
              </div>
              <ChevronRight size={16} color="var(--text-muted)" />
            </div>
          </div>
        </div>

        {/* Recent System Events Activity Stream */}
        <div style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--radius-lg)',
          padding: '22px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', margin: 0, fontFamily: 'var(--font-heading)' }}>
                Recent System Events
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '2px' }}>
                Chronological audit stream of BGV submissions & reviews
              </p>
            </div>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => navigate('/admin/audit')}
              style={{ fontSize: '0.76rem', padding: '5px 12px' }}
            >
              View Full Audit Log
            </button>
          </div>

          <div className="activity-timeline">
            {recentActivity.length === 0 ? (
              <div style={{ padding: '36px 0', textAlign: 'center' }}>
                <Clock size={32} color="var(--text-muted)" style={{ margin: '0 auto 8px auto', display: 'block' }} />
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No recent system events logged yet.</p>
              </div>
            ) : (
              recentActivity.slice(0, 5).map((log) => {
                const isFailed = log.action?.includes('Failed') || log.action?.includes('Reject');
                const isSuccess = log.action?.includes('Verified') || log.action?.includes('Submitted') || log.action?.includes('Cleared');
                const dotColor = isFailed ? '#F87171' : isSuccess ? '#34D399' : '#C084FC';
                const dotBg = isFailed ? 'rgba(248, 113, 113, 0.2)' : isSuccess ? 'rgba(52, 211, 153, 0.2)' : 'rgba(192, 132, 252, 0.2)';

                return (
                  <div key={log.id} className="activity-item">
                    <div
                      className="activity-dot"
                      style={{
                        backgroundColor: dotBg,
                        borderColor: dotColor,
                        color: dotColor
                      }}
                    >
                      <Activity size={10} />
                    </div>
                    <div className="activity-content">
                      <div className="activity-header">
                        <span className="activity-name">
                          {log.action}
                        </span>
                        <span className="activity-time">
                          {log.created_at?.substring(11, 16) || 'Recent'}
                        </span>
                      </div>
                      <div className="activity-desc">
                        {log.details || `${log.actor_name || 'System'} performed ${log.action}`}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
