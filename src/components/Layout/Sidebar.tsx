import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  Workflow,
  ChevronLeft,
  ChevronRight,
  GitBranch,
  Sun,
  Moon,
  BarChart3,
  Boxes,
  Layers,
  Shield,
  Building2,
  LogIn,
  LayoutDashboard,
  Zap,
  Settings,
} from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuthStore } from '../../TenantNodePlatform/authStore';
import { TenantUserManagementModal } from '../../TenantNodePlatform/TenantUserManagementModal';

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isCollapsed, onToggle }) => {
  const { theme, toggleTheme } = useTheme();
  const { currentUser, currentTenantName, isSuperAdmin, isTenantAdmin } = useAuthStore();
  const [showManageModal, setShowManageModal] = React.useState(false);

  const superAdminNav = [
    {
      path: '/framework/dashboard',
      label: 'Platform Overview',
      icon: LayoutDashboard,
      badge: 'Super Admin',
    },
    {
      path: '/framework/tenants',
      label: 'Tenant Management',
      icon: Building2,
      badge: 'Admin',
    },
    {
      path: '/framework/nodes',
      label: 'Framework Nodes',
      icon: Boxes,
      badge: 'Registry',
    },
    {
      path: '/framework/audit',
      label: 'Platform Audit Log',
      icon: Shield,
    },
    { divider: true } as any,
  ];

  const commonNav = [
    {
      path: '/tenant/dashboard',
      label: 'My Dashboard',
      icon: LayoutDashboard,
    },
    // Only Admin has access to Node Library
    ...((isTenantAdmin() || isSuperAdmin()) ? [
      {
        path: '/my-nodes',
        label: 'Tenant Node Library',
        icon: Layers,
        badge: 'Author',
      },
    ] : []),
    {
      path: '/langgraph',
      label: 'Workflow Studio',
      icon: GitBranch,
      badge: 'Orchestrator',
    },
    {
      path: '/tenant/executions',
      label: 'Execution History',
      icon: Zap,
    },
    ...((isTenantAdmin() || isSuperAdmin()) ? [
      {
        path: '/tenant/audit',
        label: 'Audit Log',
        icon: Shield,
      },
    ] : []),
  ];

  const navItems = isSuperAdmin()
    ? [...superAdminNav, ...commonNav]
    : commonNav;

  return (
    <>
      <div className={`
        bg-white dark:bg-dark-surface border-r border-light-border dark:border-dark-border
        transition-all duration-300 ease-in-out flex-shrink-0 flex flex-col
        ${isCollapsed ? 'w-16' : 'w-64'}
      `}>
        {/* Logo */}
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

        {/* Nav */}
        <nav className="flex-1 p-4 overflow-y-auto">
          <ul className="space-y-0.5">
            {navItems.map((item: any, idx) => {
              if (item.divider) {
                return (
                  <li key={`divider-${idx}`}>
                    <div className="my-3 border-t border-light-border dark:border-dark-border" />
                    {!isCollapsed && (
                      <p className="text-[9px] font-bold uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary px-2 mb-2">
                        Tenant View
                      </p>
                    )}
                  </li>
                );
              }
              const { path, label, icon: Icon, badge } = item;
              return (
                <li key={path}>
                  <NavLink
                    to={path}
                    className={({ isActive }) =>
                      `nav-item group flex items-center justify-between ${isActive ? 'nav-item-active' : ''}`
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
              );
            })}
          </ul>
        </nav>

        {/* Bottom Section */}
        <div className="p-4 border-t border-light-border dark:border-dark-border space-y-2">
          {(isSuperAdmin() || isTenantAdmin()) && (
            <button
              onClick={() => setShowManageModal(true)}
              className={`w-full flex items-center gap-3 px-3 py-2 hover:bg-light-hover dark:hover:bg-dark-hover rounded-lg transition-all duration-200 text-left ${
                isCollapsed ? 'justify-center' : ''
              }`}
              title={isSuperAdmin() ? "Tenants & Users Hub" : "Tenant Users & Roles"}
            >
              <Building2 size={18} className="text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
              {!isCollapsed && (
                <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                  {isSuperAdmin() ? "Tenants & Access Hub" : "Team & User Access"}
                </span>
              )}
            </button>
          )}

          <NavLink
            to="/login"
            className={`w-full flex items-center gap-3 px-3 py-2 hover:bg-light-hover dark:hover:bg-dark-hover rounded-lg transition-all duration-200 ${
              isCollapsed ? 'justify-center' : ''
            }`}
            title="Switch Tenant / Persona"
          >
            <LogIn size={18} className="text-slate-600 dark:text-slate-400 flex-shrink-0" />
            {!isCollapsed && (
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                Switch Identity
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
              Role: <strong>{currentUser?.role?.replace('_', ' ') || 'Guest'}</strong>
            </div>
          )}
        </div>
      </div>

      {/* Tenant & User Management Modal */}
      {showManageModal && (
        <TenantUserManagementModal
          isOpen={showManageModal}
          onClose={() => setShowManageModal(false)}
        />
      )}
    </>
  );
};

export default Sidebar;
