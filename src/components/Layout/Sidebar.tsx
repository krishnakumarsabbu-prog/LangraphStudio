import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  Workflow,
  ChevronLeft,
  ChevronRight,
  GitBranch,
  Sun,
  Moon,
  User,
  BarChart3,
  GitCompare,
  Boxes,
  Layers,
  Sparkles,
  Shield,
  Building2,
  LogIn,
} from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuthStore } from '../../TenantNodePlatform/authStore';

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isCollapsed, onToggle }) => {
  const { theme, toggleTheme } = useTheme();
  const { currentUser, currentTenantName, isSuperAdmin, isTenantAdmin } = useAuthStore();

  const navItems = [
    {
      path: '/my-nodes',
      label: isTenantAdmin() || isSuperAdmin() ? 'Tenant Node Library' : 'My Tenant Nodes',
      icon: Layers,
      badge: isTenantAdmin() || isSuperAdmin() ? 'Author' : 'Catalog',
    },
    {
      path: '/langgraph',
      label: 'Workflow Studio',
      icon: GitBranch,
      badge: 'Orchestrator',
    },
    {
      path: '/node-builder',
      label: 'Framework Node Studio',
      icon: Boxes,
    },
    {
      path: '/metrics',
      label: 'Metrics Dashboard',
      icon: BarChart3,
    },
    {
      path: '/champion-challenger',
      label: 'Champion vs Challenger',
      icon: GitCompare,
    },
  ];

  return (
    <div className={`
      bg-white dark:bg-dark-surface border-r border-light-border dark:border-dark-border
      transition-all duration-300 ease-in-out flex-shrink-0 flex flex-col
      ${isCollapsed ? 'w-16' : 'w-64'}
    `}>
      <div className="flex items-center justify-between p-4 border-b border-light-border dark:border-dark-border min-h-[73px]">
        {!isCollapsed && (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-r from-indigo-600 to-violet-600 rounded-xl flex items-center justify-center shadow-card text-white">
              <Workflow size={22} />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-light-text-primary dark:text-dark-text-primary font-wells leading-tight">
                FlowForge
              </h1>
              <p className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold truncate">
                {currentTenantName || 'Tenant Platform'}
              </p>
            </div>
          </div>
        )}

        {isCollapsed && (
          <div className="w-10 h-10 bg-gradient-to-r from-indigo-600 to-violet-600 rounded-xl flex items-center justify-center shadow-card mx-auto text-white">
            <Workflow size={22} />
          </div>
        )}

        <button
          onClick={onToggle}
          className="p-2 hover:bg-light-hover dark:hover:bg-dark-hover rounded-lg transition-all duration-200"
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? (
            <ChevronRight size={16} className="text-light-text-secondary dark:text-dark-text-secondary" />
          ) : (
            <ChevronLeft size={16} className="text-light-text-secondary dark:text-dark-text-secondary" />
          )}
        </button>
      </div>

      <nav className="flex-1 p-4">
        <ul className="space-y-1.5">
          {navItems.map(({ path, label, icon: Icon, badge }) => (
            <li key={path}>
              <NavLink
                to={path}
                className={({ isActive }) =>
                  `nav-item group flex items-center justify-between ${
                    isActive
                      ? 'nav-item-active'
                      : ''
                  }`
                }
                title={isCollapsed ? label : undefined}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon size={18} className="flex-shrink-0" />
                  {!isCollapsed && (
                    <span className="font-medium text-xs truncate transition-all duration-200">{label}</span>
                  )}
                </div>

                {!isCollapsed && badge && (
                  <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                    {badge}
                  </span>
                )}

                {isCollapsed && (
                  <div className="absolute left-16 bg-light-surface dark:bg-dark-surface-alt text-light-text-primary dark:text-dark-text-primary text-xs px-3 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none whitespace-nowrap z-50 shadow-card">
                    {label}
                  </div>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="p-4 border-t border-light-border dark:border-dark-border space-y-2">
        <NavLink
          to="/login"
          className={`w-full flex items-center gap-3 px-3 py-2 hover:bg-light-hover dark:hover:bg-dark-hover rounded-lg transition-all duration-200 ${
            isCollapsed ? 'justify-center' : ''
          }`}
          title="Switch Tenant / Persona"
        >
          <LogIn size={18} className="text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
          {!isCollapsed && (
            <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
              Switch Tenant / Persona
            </span>
          )}
        </NavLink>

        <button
          onClick={toggleTheme}
          className={`w-full flex items-center gap-3 px-3 py-2 hover:bg-light-hover dark:hover:bg-dark-hover rounded-lg transition-all duration-200 ${isCollapsed ? 'justify-center' : ''}`}
          title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
        >
          {theme === 'light' ? (
            <Moon size={18} className="text-light-text-secondary dark:text-dark-text-secondary flex-shrink-0" />
          ) : (
            <Sun size={18} className="text-light-text-secondary dark:text-dark-text-secondary flex-shrink-0" />
          )}
          {!isCollapsed && (
            <span className="text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary">
              {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
            </span>
          )}
        </button>

        {!isCollapsed && (
          <div className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary text-center p-2.5 bg-light-surface dark:bg-dark-surface-alt rounded-xl font-medium border border-light-border dark:border-dark-border">
            Role: <strong>{currentUser?.role || 'Guest'}</strong>
          </div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;
