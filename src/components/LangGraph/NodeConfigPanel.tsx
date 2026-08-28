import React, { useState } from 'react';
import { X, ChevronDown, ChevronUp } from 'lucide-react';

interface NodeConfigPanelProps {
  isOpen: boolean;
  nodeId: string;
  nodeType: string;
  nodeLabel: string;
  nodeData: any;
  onClose: () => void;
  onSave: (data: any) => void;
  children?: React.ReactNode;
}

export const NodeConfigPanel: React.FC<NodeConfigPanelProps> = ({
  isOpen,
  nodeId,
  nodeType,
  nodeLabel,
  nodeData,
  onClose,
  onSave,
  children,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-white dark:bg-dark-surface border-l border-light-border dark:border-dark-border shadow-xl z-50 flex flex-col overflow-hidden">
      <div className="bg-black dark:bg-brand-black text-white px-6 py-4 flex items-center justify-between flex-shrink-0">
        <div className="flex-1">
          <h3 className="font-semibold text-lg">{nodeType}</h3>
          <p className="text-sm text-gray-300">{nodeLabel}</p>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-800 rounded transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="p-6 space-y-4">
          {children}
        </div>
      </div>

      <div className="border-t border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface-alt px-6 py-4 flex-shrink-0">
        <button
          onClick={onClose}
          className="w-full px-4 py-2 bg-black hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-100 text-white dark:text-black rounded-lg font-medium transition-colors"
        >
          Done
        </button>
      </div>
    </div>
  );
};
