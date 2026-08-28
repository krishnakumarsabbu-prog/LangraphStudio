import React from 'react';
import { Handle, Position } from 'react-flow-renderer';
import { GitMerge } from 'lucide-react';

interface MergeNodeProps {
  id: string;
  data: {
    label: string;
  };
  selected: boolean;
}

export const MergeNode: React.FC<MergeNodeProps> = ({ id, data, selected }) => {
  return (
    <div
      className={`bg-white border-2 rounded-lg shadow-md transition-all ${
        selected ? 'border-blue-500 shadow-lg' : 'border-gray-300'
      }`}
      style={{ minWidth: '180px' }}
    >
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        className="w-3 h-3 bg-gray-400"
        style={{ top: '30%' }}
      />
      <Handle
        type="target"
        position={Position.Left}
        id="left-2"
        className="w-3 h-3 bg-gray-400"
        style={{ top: '70%' }}
      />

      <div className="px-4 py-3">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded bg-slate-50 flex items-center justify-center flex-shrink-0 border border-slate-200">
            <GitMerge className="w-4 h-4 text-slate-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm text-gray-900 truncate">{data.label}</div>
            <div className="text-xs text-gray-500">Merge</div>
          </div>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-gray-400"
      />
    </div>
  );
};
