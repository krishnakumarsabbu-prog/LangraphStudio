import React from 'react';
import { Handle, Position } from 'react-flow-renderer';
import { Settings, Trash2, Play, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { NodeExecutionStatus } from '../../stores/langGraphStore';

interface CompactNodeDisplayProps {
  id: string;
  label: string;
  icon: React.ReactNode;
  pattern?: 'solid' | 'striped' | 'dotted';
  onConfig: () => void;
  onDelete: () => void;
  onRun: () => void;
  executionStatus?: NodeExecutionStatus;
  borderColor?: string;
  bgColor?: string;
}

export const CompactNodeDisplay: React.FC<CompactNodeDisplayProps> = ({
  id,
  label,
  icon,
  pattern = 'solid',
  onConfig,
  onDelete,
  onRun,
  executionStatus = 'idle',
  borderColor = '#6B7280',
  bgColor = '#FFFFFF',
}) => {
  const getPatternStyle = () => {
    switch (pattern) {
      case 'striped':
        return {
          backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 8px, rgba(0,0,0,0.03) 8px, rgba(0,0,0,0.03) 16px)',
        };
      case 'dotted':
        return {
          backgroundImage: 'radial-gradient(circle, rgba(0,0,0,0.06) 1px, transparent 1px)',
          backgroundSize: '8px 8px',
        };
      default:
        return {};
    }
  };

  const getStatusBadge = () => {
    switch (executionStatus) {
      case 'running':
        return (
          <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center shadow-sm">
            <Loader2 className="w-3 h-3 text-white animate-spin" />
          </div>
        );
      case 'success':
        return (
          <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center shadow-sm">
            <CheckCircle className="w-3 h-3 text-white" />
          </div>
        );
      case 'failed':
        return (
          <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center shadow-sm">
            <XCircle className="w-3 h-3 text-white" />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div
      className="rounded-lg shadow-sm hover:shadow-md transition-all cursor-pointer relative"
      style={{
        backgroundColor: bgColor,
        border: `1px solid ${borderColor}`,
        minWidth: '120px',
        ...getPatternStyle(),
      }}
    >
      {getStatusBadge()}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2 !h-2 !bg-gray-400 !border-gray-500"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!w-2 !h-2 !bg-gray-400 !border-gray-500"
      />

      <div className="px-3 py-2.5">
        <div className="flex flex-col items-center gap-1.5">
          <div
            className="w-7 h-7 rounded-md flex items-center justify-center bg-gray-50"
            style={{ color: borderColor }}
          >
            {icon}
          </div>
          <p className="text-xs font-medium text-center truncate max-w-full text-gray-800 leading-tight">
            {label}
          </p>
        </div>

        <div className="flex gap-0.5 justify-center mt-2 pt-2 border-t border-gray-200">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRun();
            }}
            disabled={executionStatus === 'running'}
            className="p-1 hover:bg-emerald-50 rounded transition-colors disabled:opacity-50"
            title="Run Node"
          >
            {executionStatus === 'running' ? (
              <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5 text-emerald-600 hover:text-emerald-700" />
            )}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onConfig();
            }}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
            title="Configure"
          >
            <Settings className="w-3.5 h-3.5 text-gray-500 hover:text-gray-700" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-1 hover:bg-red-50 rounded transition-colors"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5 text-gray-400 hover:text-red-500" />
          </button>
        </div>
      </div>
    </div>
  );
};
