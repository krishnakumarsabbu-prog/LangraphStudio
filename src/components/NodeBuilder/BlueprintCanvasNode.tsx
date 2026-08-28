/**
 * Canvas node renderer for the Node Builder.
 *
 * Adapts the visual style of the existing CompactNodeDisplay but is
 * self-contained for the Node Builder (does not use the LangGraph store).
 */

import React from 'react';
import { Handle, Position } from 'react-flow-renderer';
import { Globe, GitBranch, Brain, FileText, Settings, Trash2 } from 'lucide-react';
import { FrameworkNodeType } from './types';

interface BlueprintCanvasNodeProps {
  id: string;
  type: FrameworkNodeType;
  label: string;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

const NODE_STYLES: Record<FrameworkNodeType, { icon: React.ReactNode; borderColor: string; bgColor: string }> = {
  service: {
    icon: <Globe className="w-5 h-5" />,
    borderColor: '#374151',
    bgColor: '#FFFFFF',
  },
  decision: {
    icon: <GitBranch className="w-5 h-5" />,
    borderColor: '#6B7280',
    bgColor: '#F9FAFB',
  },
  llm: {
    icon: <Brain className="w-5 h-5" />,
    borderColor: '#4A4A4A',
    bgColor: '#FFFFFF',
  },
  form: {
    icon: <FileText className="w-5 h-5" />,
    borderColor: '#5A5A5A',
    bgColor: '#FFFFFF',
  },
};

export const BlueprintCanvasNode: React.FC<BlueprintCanvasNodeProps> = ({
  type,
  label,
  selected,
  onSelect,
  onDelete,
}) => {
  const style = NODE_STYLES[type];

  return (
    <div
      onClick={onSelect}
      className="rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer relative"
      style={{
        backgroundColor: style.bgColor,
        border: `2px solid ${selected ? '#000000' : style.borderColor}`,
        minWidth: '140px',
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-gray-500 !border-gray-600"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-gray-500 !border-gray-600"
      />

      <div className="px-3 py-3">
        <div className="flex flex-col items-center gap-2">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center bg-gray-50 dark:bg-gray-800"
            style={{ color: style.borderColor }}
          >
            {style.icon}
          </div>
          <p className="text-xs font-semibold text-center truncate max-w-full text-gray-800 dark:text-gray-200">
            {label}
          </p>
          <span className="text-[9px] font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500">
            {type}
          </span>
        </div>

        <div className="flex gap-1 justify-center mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSelect();
            }}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title="Configure"
          >
            <Settings className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5 text-gray-400 hover:text-red-500" />
          </button>
        </div>
      </div>
    </div>
  );
};
