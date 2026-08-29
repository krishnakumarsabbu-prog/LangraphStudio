import React from 'react';
import { AlertTriangle, X, Building2 } from 'lucide-react';
import { useAuthStore } from '../TenantNodePlatform/authStore';
import toast from 'react-hot-toast';

export const ImpersonationBanner: React.FC = () => {
  const { impersonationContext, exitImpersonation } = useAuthStore();

  if (!impersonationContext) return null;

  const handleExit = async () => {
    await exitImpersonation();
    toast.success('Impersonation session ended. Returned to Super Admin view.');
  };

  const started = new Date(impersonationContext.started_at).toLocaleTimeString();

  return (
    <div className="
      relative flex items-center justify-between gap-4 px-5 py-2.5
      bg-amber-500 text-amber-950 text-sm font-semibold z-50
      border-b-2 border-amber-600
    ">
      {/* Animated stripe overlay */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: 'repeating-linear-gradient(-45deg, #000 0, #000 1px, transparent 0, transparent 50%)',
          backgroundSize: '8px 8px',
        }}
      />

      <div className="relative flex items-center gap-3">
        <div className="flex items-center gap-1.5 bg-amber-600/30 rounded-full px-2.5 py-1">
          <AlertTriangle size={14} className="animate-pulse" />
          <span className="text-[11px] uppercase tracking-widest font-black">Impersonating</span>
        </div>
        <Building2 size={16} />
        <span>
          You are viewing as <strong>{impersonationContext.target_tenant_name}</strong>
        </span>
        <span className="text-amber-700 text-xs font-normal">
          · Session started {started}
        </span>
      </div>

      <button
        onClick={handleExit}
        className="
          relative flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold
          bg-amber-900/20 hover:bg-amber-900/40 border border-amber-700/50
          transition-all duration-200
        "
      >
        <X size={12} />
        Exit Impersonation
      </button>
    </div>
  );
};
