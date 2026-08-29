import React, { useState } from 'react';
import { Menu, Building2, Shield, LogOut, ChevronDown, User, Sparkles, Users, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../TenantNodePlatform/authStore';
import { TenantUserManagementModal } from '../../TenantNodePlatform/TenantUserManagementModal';

interface HeaderProps {
  onMenuClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  const navigate = useNavigate();
  const [showManageModal, setShowManageModal] = useState(false);
  const [manageTab, setManageTab] = useState<'tenants' | 'users'>('tenants');

  const {
    currentUser,
    currentTenantName,
    currentTenantId,
    isAuthenticated,
    logout,
    isSuperAdmin,
    isTenantAdmin,
    switchActiveTenant,
    availableTenants,
    loadAvailableTenants,
  } = useAuthStore();

  React.useEffect(() => {
    if (availableTenants.length === 0) {
      loadAvailableTenants();
    }
  }, [availableTenants.length, loadAvailableTenants]);

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/30">
            <Sparkles className="w-3 h-3" /> SUPER ADMIN
          </span>
        );
      case 'TENANT_ADMIN':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-500 border border-indigo-500/30">
            <Shield className="w-3 h-3" /> TENANT ADMIN
          </span>
        );
      case 'TENANT_USER':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/30">
            <User className="w-3 h-3" /> BUSINESS USER
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-500/10 text-slate-500 border border-slate-500/30">
            VIEWER
          </span>
        );
    }
  };

  return (
    <>
      <header className="bg-white dark:bg-dark-surface border-b border-light-border dark:border-dark-border px-6 py-3 shadow-card backdrop-blur-sm">
        <div className="flex items-center justify-between">
          
          {/* Left Section: Menu button & Title */}
          <div className="flex items-center gap-4">
            <button
              onClick={onMenuClick}
              className="p-2 hover:bg-light-hover dark:hover:bg-dark-hover rounded-lg transition-all duration-200 lg:hidden hover:scale-110"
            >
              <Menu size={20} className="text-light-text-secondary dark:text-dark-text-secondary" />
            </button>

            <div className="hidden lg:block">
              <div className="flex items-center gap-3">
                <h2 className="text-base font-bold text-light-text-primary dark:text-dark-text-primary font-wells">
                  FlowForge Orchestration
                </h2>
                
                {/* Tenant Workspace Badge */}
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800/60 text-xs">
                  <Building2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span className="font-semibold text-indigo-900 dark:text-indigo-200">
                    {currentTenantName || 'Tenant Workspace'}
                  </span>

                  {/* Super Admin Tenant Switcher */}
                  {isSuperAdmin() && (
                    <select
                      value={currentTenantId}
                      onChange={(e) => switchActiveTenant(e.target.value)}
                      className="ml-2 bg-transparent text-indigo-700 dark:text-indigo-300 font-bold text-xs focus:outline-none cursor-pointer border-b border-indigo-400 dark:border-indigo-600"
                    >
                      <option value="all">🌐 All Tenants (Global View)</option>
                      {availableTenants.map((t) => (
                        <option key={t.tenant_id} value={t.tenant_id}>
                          🏢 {t.tenant_name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Manage Tenants & Users Button */}
                <button
                  onClick={() => {
                    setManageTab(isSuperAdmin() ? 'tenants' : 'users');
                    setShowManageModal(true);
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-200 dark:border-slate-700 transition-all shadow-sm"
                  title="Manage Tenants & Users"
                >
                  <Users size={13} className="text-indigo-600 dark:text-indigo-400" />
                  <span>Tenants & Access</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right Section: User Profile, Role Badge, Auth Actions */}
          <div className="flex items-center gap-4">
            {isAuthenticated && currentUser ? (
              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <div className="flex items-center justify-end gap-2">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {currentUser.name}
                    </span>
                    {getRoleBadge(currentUser.role)}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {currentUser.email}
                  </p>
                </div>

                <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/60 border border-indigo-300 dark:border-indigo-700 flex items-center justify-center text-sm shadow-sm">
                  {currentUser.avatar || '👤'}
                </div>

                <button
                  onClick={() => {
                    logout();
                    navigate('/login');
                  }}
                  className="p-2 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 rounded-lg transition-all"
                  title="Log Out"
                >
                  <LogOut size={16} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => navigate('/login')}
                className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white shadow-sm flex items-center gap-1.5 transition-all"
              >
                <User size={14} /> Sign In
              </button>
            )}
          </div>

        </div>
      </header>

      {/* Tenant & User Management Modal */}
      {showManageModal && (
        <TenantUserManagementModal
          isOpen={showManageModal}
          onClose={() => setShowManageModal(false)}
          defaultTab={manageTab}
        />
      )}
    </>
  );
};

export default Header;

