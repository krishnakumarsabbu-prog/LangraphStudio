import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { Button } from '../ui/button';
import { useLangGraphStore } from '../../stores/langGraphStore';

export interface WorkflowConfig {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  requestMapping: string;
  headers: Array<{ key: string; value: string }>;
}

interface WorkflowConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: WorkflowConfig) => void;
  initialConfig: WorkflowConfig;
  initialInputs: Record<string, any>;
  workflowName: string;
  onBack: () => void;
}

export const WorkflowConfigModal: React.FC<WorkflowConfigModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialConfig,
  initialInputs,
  workflowName,
  onBack,
}) => {
  const [config, setConfig] = useState<WorkflowConfig>(initialConfig);
  const [draggedField, setDraggedField] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'request' | 'headers'>('request');

  useEffect(() => {
    if (isOpen) {
      setConfig(initialConfig);
    }
  }, [isOpen, initialConfig]);

  if (!isOpen) return null;

  const getFieldPaths = (obj: any, prefix = 'input'): string[] => {
    let paths: string[] = [];
    if (!obj || typeof obj !== 'object') return paths;

    for (const key in obj) {
      const newPath = `${prefix}.${key}`;
      paths.push(newPath);

      const val = obj[key];
      if (val && typeof val === 'object') {
        if (Array.isArray(val)) {
          val.forEach((item) => {
            if (item && typeof item === 'object') {
              const subPaths = getFieldPaths(item, newPath);
              paths = paths.concat(subPaths);
            }
          });
        } else {
          paths = paths.concat(getFieldPaths(val, newPath));
        }
      }
    }
    return Array.from(new Set(paths));
  };

  const fieldPaths = getFieldPaths(initialInputs);

  const handleDragStart = (field: string) => {
    setDraggedField(field);
  };

  const handleDragEnd = () => {
    setDraggedField(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (draggedField) {
      const cursorPosition = (e.target as HTMLTextAreaElement).selectionStart || 0;
      const textBefore = config.requestMapping.substring(0, cursorPosition);
      const textAfter = config.requestMapping.substring(cursorPosition);
      const newText = `${textBefore}{${draggedField}}${textAfter}`;
      setConfig({ ...config, requestMapping: newText });
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const addHeader = () => {
    setConfig({
      ...config,
      headers: [...config.headers, { key: '', value: '' }],
    });
  };

  const removeHeader = (index: number) => {
    setConfig({
      ...config,
      headers: config.headers.filter((_, i) => i !== index),
    });
  };

  const updateHeader = (index: number, field: 'key' | 'value', value: string) => {
    const newHeaders = [...config.headers];
    newHeaders[index][field] = value;
    setConfig({ ...config, headers: newHeaders });
  };

  const handleSave = () => {
    if (config.requestMapping && config.requestMapping.trim()) {
      try {
        const parsed = JSON.parse(config.requestMapping);
        useLangGraphStore.getState().setInputs(parsed);
      } catch {
        // Ignore parsing errors
      }
    }
    onSave(config);
    onClose();
  };

  const modalContent = (
    <div className="fixed inset-0 bg-black bg-opacity-70 z-[9999]">
      <div className="bg-white w-full h-full flex flex-col">
        <div className="bg-white border-b border-gray-300 px-8 py-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 hover:bg-gray-100 rounded transition-colors"
              title="Back to workflow"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Configure Workflow Request</h2>
              <p className="text-sm text-gray-600 mt-1">Workflow: {workflowName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          <div className="w-1/4 border-r border-gray-200 p-6 overflow-y-auto bg-gray-50">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Available Fields</h3>
            <p className="text-sm text-gray-600 mb-6">Drag fields to the inputs on the right</p>
            <div className="space-y-3">
              {fieldPaths.map((field) => (
                <div
                  key={field}
                  draggable
                  onDragStart={() => handleDragStart(field)}
                  onDragEnd={handleDragEnd}
                  className="bg-white border-2 border-gray-300 rounded-lg px-4 py-3 text-sm font-mono cursor-move hover:bg-gray-100 hover:border-gray-500 transition-all shadow-md hover:shadow-lg"
                >
                  {field}
                </div>
              ))}
            </div>
          </div>

          <div className="flex-1 p-6 overflow-y-auto">
            <div className="flex gap-2 mb-6 border-b border-gray-200">
              {(['request', 'headers'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 font-semibold text-sm capitalize transition-colors ${
                    activeTab === tab
                      ? 'text-gray-900 border-b-2 border-gray-700'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {activeTab === 'request' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Workflow URL</label>
                  <input
                    type="text"
                    value={config.url}
                    onChange={(e) => setConfig({ ...config, url: e.target.value })}
                    placeholder="https://api.example.com/workflow or leave empty for internal"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-400"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Optional: External API endpoint. Leave empty to execute internal workflow.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Method</label>
                  <select
                    value={config.method}
                    onChange={(e) => setConfig({ ...config, method: e.target.value as any })}
                    className="w-full px-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 font-semibold transition-all"
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="DELETE">DELETE</option>
                  </select>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-gray-800 mb-2">Request Body Mapping</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Map input fields to the workflow's expected input format. Use single braces {'{'} and {'}'} to wrap field references.
                  </p>
                  <textarea
                    value={config.requestMapping}
                    onChange={(e) => setConfig({ ...config, requestMapping: e.target.value })}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    className="w-full h-96 px-6 py-4 text-base font-mono border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-gray-400 bg-white resize-none"
                    placeholder='{\n  "input": {\n    "message": "{input.data}"\n  }\n}'
                  />
                </div>
              </div>
            )}

            {activeTab === 'headers' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-gray-800">HTTP Headers</h3>
                  <Button
                    onClick={addHeader}
                    className="bg-gray-700 hover:bg-gray-800 text-white"
                    size="sm"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add Header
                  </Button>
                </div>
                <div className="space-y-3">
                  {config.headers.map((header, index) => (
                    <div key={index} className="flex gap-3 items-center">
                      <input
                        type="text"
                        placeholder="Header Name"
                        value={header.key}
                        onChange={(e) => updateHeader(index, 'key', e.target.value)}
                        className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-400"
                      />
                      <input
                        type="text"
                        placeholder="Header Value"
                        value={header.value}
                        onChange={(e) => updateHeader(index, 'value', e.target.value)}
                        className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-400"
                      />
                      <button
                        onClick={() => removeHeader(index)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {config.headers.length === 0 && (
                    <p className="text-sm text-gray-500 italic">No headers added yet</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-gray-200 px-8 py-6 flex justify-end gap-4">
          <Button variant="outline" onClick={onClose} className="px-6 py-3 text-base">
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            className="bg-gray-700 hover:bg-gray-800 text-white px-8 py-3 text-base"
          >
            Save Configuration
          </Button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
