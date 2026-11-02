import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  FileCheck2,
  BookOpen,
  History,
  Settings,
  ShieldCheck,
  ShieldAlert,
  Rocket,
  ChevronRight,
  Sparkles,
  FileImage,
  GitPullRequest
} from 'lucide-react';
import { SystemStatus } from '../../types';
import { OmniGuideLogo } from '../common/OmniGuideLogo';

interface SidebarProps {
  status?: SystemStatus | null;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ status, onCloseMobile }) => {
  const coreNavItems = [
    { to: '/', label: 'Overview', icon: LayoutDashboard },
    { to: '/reviews/new', label: 'New Review', icon: FileCheck2 },
    { to: '/assets', label: 'Creative Assets', icon: FileImage, badge: 'Vision AI' },
    { to: '/simulator', label: 'Campaign Simulator', icon: Rocket, badge: 'Flagship' },
    { to: '/guidelines', label: 'Brand Guidelines', icon: BookOpen },
    { to: '/reviews', label: 'Review History', icon: History },
  ];

  const securityNavItems = [
    { to: '/integrations', label: 'CI/CD & Workflows', icon: GitPullRequest, badge: 'PR Gate' },
    { to: '/redteam', label: 'Red-Team Lab', icon: ShieldAlert, badge: 'v1.2' },
    { to: '/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col h-screen shrink-0 select-none">
      {/* Brand Header with Persistent Logo and Tagline */}
      <div className="p-5 border-b border-slate-100 flex flex-col items-center text-center bg-slate-50/40">
        <NavLink
          to="/"
          onClick={onCloseMobile}
          className="block group focus-ring rounded-lg py-1 px-2"
          title="OmniGuide — Governance, Guided by Intelligence"
        >
          <OmniGuideLogo size="sidebar" showTagline={true} />
        </NavLink>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto">
        {/* Core Governance */}
        <div className="space-y-1">
          <div className="px-3 pb-1.5 text-[10px] font-bold tracking-wider uppercase text-slate-400">
            Core Governance
          </div>
          {coreNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                onClick={onCloseMobile}
                className={({ isActive }) =>
                  `flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-teal-50 text-teal-800 font-semibold border-l-4 border-teal-600 shadow-2xs pl-3'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`
                }
              >
                <div className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </div>
                {item.badge ? (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-teal-100 text-teal-800">
                    {item.badge}
                  </span>
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 opacity-60" />
                )}
              </NavLink>
            );
          })}
        </div>

        {/* Assurance & Security */}
        <div className="space-y-1 pt-2 border-t border-slate-100">
          <div className="px-3 pb-1.5 text-[10px] font-bold tracking-wider uppercase text-slate-400">
            Assurance & Security
          </div>
          {securityNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onCloseMobile}
                className={({ isActive }) =>
                  `flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-rose-50 text-rose-800 font-semibold border-l-4 border-rose-600 shadow-2xs pl-3'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`
                }
              >
                <div className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </div>
                {item.badge ? (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-800">
                    {item.badge}
                  </span>
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 opacity-60" />
                )}
              </NavLink>
            );
          })}
        </div>
      </nav>

      {/* Engine Status Diagnostic Card */}
      <div className="p-4 border-t border-slate-200 bg-slate-50/70">
        <div className="p-3 rounded-lg bg-white border border-slate-200/80 text-xs shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-700 font-medium flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
              <span>Governance Engine</span>
            </span>
            <span className="flex items-center gap-1.5 text-emerald-700 font-semibold text-[11px]">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>{status?.status === 'operational' ? 'Operational' : 'Active'}</span>
            </span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500 flex items-center justify-between border-t border-slate-100 pt-1.5 font-mono">
            <span>Database:</span>
            <span className="text-slate-700 font-medium capitalize">
              {status?.database_dialect || 'sqlite'}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
};
