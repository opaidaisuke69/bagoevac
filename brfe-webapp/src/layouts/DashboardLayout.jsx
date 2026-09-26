import { useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, LifeBuoy, Building2,
  BarChart3, MessageCircle, LogOut, Menu, PanelLeftClose, PanelLeft,
  Shield, Radio, UserPlus, Eye, FileText,
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { cn } from '../lib/utils';
import logoImg from '../assets/images/logo.png';

// LGU Admin navigation — categorized
const lguNavSections = [
  {
    label: 'Overview',
    items: [
      { to: '/lgu', icon: LayoutDashboard, label: 'Dashboard', end: true },
    ],
  },
  {
    label: 'Monitoring',
    items: [
      { to: '/lgu/evacuees', icon: Users, label: 'Evacuees' },
      { to: '/lgu/reports', icon: BarChart3, label: 'Flood Reports' },
      { to: '/lgu/rescue-monitor', icon: Eye, label: 'Rescue Monitor' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { to: '/lgu/centers', icon: Building2, label: 'Evac Centers' },
      { to: '/lgu/broadcast', icon: Radio, label: 'Broadcast' },
    ],
  },
  {
    label: 'Administration',
    items: [
      { to: '/lgu/accounts', icon: UserPlus, label: 'Accounts' },
      { to: '/lgu/generate-reports', icon: FileText, label: 'Generate Reports' },
    ],
  },
];

// Barangay Admin navigation — categorized
const brgyNavSections = [
  {
    label: 'Overview',
    items: [
      { to: '/brgy', icon: LayoutDashboard, label: 'Dashboard', end: true },
    ],
  },
  {
    label: 'Rescue Operations',
    items: [
      { to: '/brgy/rescue', icon: LifeBuoy, label: 'Rescue Requests' },
      { to: '/brgy/rescuers', icon: Shield, label: 'Rescuers' },
    ],
  },
  {
    label: 'Management',
    items: [
      { to: '/brgy/evacuees', icon: Users, label: 'Evacuees' },
      { to: '/brgy/centers', icon: Building2, label: 'Evac Centers' },
    ],
  },
  {
    label: 'Communication',
    items: [
      { to: '/brgy/chat', icon: MessageCircle, label: 'Broadcasts' },
    ],
  },
];

export default function DashboardLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const isLgu = user?.role === 'LGU_Admin';
  const navSections = isLgu ? lguNavSections : brgyNavSections;
  const allItems = navSections.flatMap((s) => s.items);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  const currentPage = allItems.find((item) =>
    item.end ? location.pathname === item.to : location.pathname.startsWith(item.to)
  );

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100">
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={cn(
        'fixed lg:static inset-y-0 left-0 z-50 flex flex-col bg-[#0f172a] transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]',
        collapsed ? 'w-[68px]' : 'w-[252px]',
        mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}>
        {/* Logo + toggle */}
        <div className={cn('h-16 flex items-center border-b border-slate-800/60', collapsed ? 'justify-center px-2' : 'justify-between px-4')}>
          {/* Logo — only show icon when collapsed */}
          {collapsed ? (
            <div className="w-8 h-8 rounded-md overflow-hidden shrink-0 bg-white/10">
              <img src={logoImg} alt="BRFE" className="w-full h-full object-contain" />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-md overflow-hidden shrink-0 bg-white/10">
                  <img src={logoImg} alt="BRFE" className="w-full h-full object-contain" />
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-white leading-none">BRFE</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{isLgu ? 'LGU Admin' : 'Barangay'}</p>
                </div>
              </div>
              <button
                onClick={() => setCollapsed(true)}
                className="hidden lg:flex items-center justify-center w-7 h-7 rounded-md text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
                title="Collapse sidebar"
              >
                <PanelLeftClose size={15} />
              </button>
            </>
          )}
        </div>

        {/* Navigation sections */}
        <nav className="flex-1 py-4 px-2.5 overflow-y-auto overflow-x-hidden space-y-5">
          {navSections.map((section) => (
            <div key={section.label}>
              {/* Category label */}
              {!collapsed && (
                <p className="px-2.5 mb-2 text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
                  {section.label}
                </p>
              )}
              {collapsed && <div className="mb-1.5 mx-2.5 h-px bg-slate-800/80" />}

              {/* Items */}
              <div className="space-y-0.5">
                {section.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={() => setMobileOpen(false)}
                    title={collapsed ? item.label : undefined}
                    className={({ isActive }) => cn(
                      'relative flex items-center gap-2.5 h-9 px-2.5 rounded-md text-[13px] font-medium transition-all duration-150 group',
                      collapsed && 'justify-center px-0',
                      isActive
                        ? cn('text-white', isLgu ? 'bg-blue-600/[0.15]' : 'bg-emerald-600/[0.15]')
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                    )}
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && (
                          <div className={cn(
                            'absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full',
                            isLgu ? 'bg-blue-500' : 'bg-emerald-500'
                          )} />
                        )}
                        <item.icon size={17} className={cn(
                          'shrink-0 transition-colors',
                          isActive ? (isLgu ? 'text-blue-400' : 'text-emerald-400') : ''
                        )} />
                        {!collapsed && <span className="truncate">{item.label}</span>}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* User + logout */}
        <div className="p-2.5 border-t border-slate-800/60 space-y-1">
          {/* Expand button when collapsed */}
          {collapsed && (
            <button
              onClick={() => setCollapsed(false)}
              className="hidden lg:flex items-center justify-center w-full h-9 rounded-md text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors mb-1"
              title="Expand sidebar"
            >
              <PanelLeft size={15} />
            </button>
          )}
          <div className={cn('flex items-center gap-2.5 px-2.5 py-2 rounded-md overflow-hidden', collapsed && 'justify-center px-0')}>
            <div className={cn('w-7 h-7 rounded-md flex items-center justify-center shrink-0 text-[11px] font-bold text-white', isLgu ? 'bg-blue-600/30' : 'bg-emerald-600/30')}>
              {user?.username?.[0]?.toUpperCase()}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-200 truncate">{user?.username}</p>
                <p className="text-[10px] text-slate-500 truncate">{isLgu ? 'Administrator' : 'Official'}</p>
              </div>
            )}
          </div>
          <button
            onClick={handleLogout}
            title={collapsed ? 'Sign out' : undefined}
            className={cn(
              'flex items-center gap-2.5 w-full h-9 px-2.5 rounded-md text-[13px] font-medium text-slate-500 hover:text-red-400 hover:bg-red-500/[0.08] transition-all duration-150',
              collapsed && 'justify-center px-0'
            )}
          >
            <LogOut size={17} className="shrink-0" />
            {!collapsed && <span>Sign out</span>}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center px-4 lg:px-6 gap-3 shrink-0">
          <button onClick={() => setMobileOpen(true)} className="lg:hidden p-2 -ml-1 rounded-md hover:bg-slate-100 transition-colors">
            <Menu size={18} className="text-slate-600" />
          </button>
          <h2 className="text-sm font-semibold text-slate-800 flex-1">{currentPage?.label || 'Dashboard'}</h2>
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-emerald-50 border border-emerald-100">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-bold text-emerald-700 uppercase">Live</span>
            </div>
            <div className={cn('hidden sm:flex h-7 px-2.5 items-center rounded-md text-[10px] font-bold uppercase tracking-wide', isLgu ? 'bg-blue-50 text-blue-700 border border-blue-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100')}>
              {isLgu ? 'LGU Admin' : 'Barangay'}
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto bg-slate-50">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
