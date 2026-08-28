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
  Layers
} from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isCollapsed, onToggle }) => {
  const { theme, toggleTheme } = useTheme();

  const navItems = [
    { path: '/langgraph', label: 'LangGraph Builder', icon: GitBranch },
    { path: '/node-builder', label: 'Node Builder', icon: Boxes },
    { path: '/my-nodes', label: 'My Nodes', icon: Layers },
    { path: '/metrics', label: 'Metrics Dashboard', icon: BarChart3 },
    { path: '/champion-challenger', label: 'Champion vs Challenger', icon: GitCompare },
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
            <div className="w-10 h-10 bg-gradient-to-r from-gray-700 to-gray-600 rounded-xl flex items-center justify-center shadow-card">
              <Workflow size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary font-wells">
                FlowForge
              </h1>
              <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary font-medium">Workflow Platform</p>
            </div>
          </div>
        )}

        {isCollapsed && (
          <div className="w-10 h-10 bg-gradient-to-r from-gray-700 to-gray-600 rounded-xl flex items-center justify-center shadow-card mx-auto">
            <Workflow size={24} className="text-white" />
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
        <ul className="space-y-2">
          {navItems.map(({ path, label, icon: Icon }) => (
            <li key={path}>
              <NavLink
                to={path}
                className={({ isActive }) =>
                  `nav-item group ${
                    isActive
                      ? 'nav-item-active'
                      : ''
                  }`
                }
                title={isCollapsed ? label : undefined}
              >
                <Icon size={20} className="flex-shrink-0" />
                {!isCollapsed && (
                  <span className="font-medium truncate transition-all duration-200">{label}</span>
                )}

                {isCollapsed && (
                  <div className="absolute left-16 bg-light-surface dark:bg-dark-surface-alt text-light-text-primary dark:text-dark-text-primary text-sm px-3 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none whitespace-nowrap z-50 shadow-card">
                    {label}
                  </div>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="p-4 border-t border-light-border dark:border-dark-border space-y-2">
        <button
          onClick={toggleTheme}
          className={`w-full flex items-center gap-3 px-3 py-2 hover:bg-light-hover dark:hover:bg-dark-hover rounded-lg transition-all duration-200 ${isCollapsed ? 'justify-center' : ''}`}
          title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
        >
          {theme === 'light' ? (
            <Moon size={20} className="text-light-text-secondary dark:text-dark-text-secondary flex-shrink-0" />
          ) : (
            <Sun size={20} className="text-light-text-secondary dark:text-dark-text-secondary flex-shrink-0" />
          )}
          {!isCollapsed && (
            <span className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary">
              {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
            </span>
          )}
        </button>

        <button
          className={`w-full flex items-center gap-3 px-3 py-2 hover:bg-light-hover dark:hover:bg-dark-hover rounded-lg transition-all duration-200 ${isCollapsed ? 'justify-center' : ''}`}
          title="User profile"
        >
          <div className="w-8 h-8 bg-gradient-to-r from-gray-800 to-gray-600 rounded-full flex items-center justify-center shadow-card flex-shrink-0">
            <User size={16} className="text-white" />
          </div>
          {!isCollapsed && (
            <span className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary">
              Profile
            </span>
          )}
        </button>

        {!isCollapsed && (
          <div className="text-xs text-light-text-secondary dark:text-dark-text-secondary text-center p-3 bg-light-surface dark:bg-dark-surface-alt rounded-xl font-medium border border-light-border dark:border-dark-border mt-2">
            FlowForge Platform v1.0.0
          </div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;
