import React, { useState } from 'react';
import {
  X,
  Upload,
  FileCode,
  Sparkles,
  CheckCircle2,
  Globe,
  Sliders,
  Play,
  ArrowRight,
  Boxes,
  Check,
  ChevronDown,
  ChevronUp,
  FileText,
  Layers,
} from 'lucide-react';
import {
  parsePostmanCollection,
  convertEndpointToBlueprint,
  DEMO_POSTMAN_COLLECTION_JSON,
  PostmanParsedEndpoint,
} from './postmanParser';
import { useAuthStore } from './authStore';
import { useTnpStore } from './tnpStore';
import type { Blueprint } from './types';
import toast from 'react-hot-toast';

interface PostmanImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (createdBlueprints: Blueprint[]) => void;
}

export const PostmanImportModal: React.FC<PostmanImportModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { currentTenantId, currentTenantName, currentUser } = useAuthStore();
  const { refreshBlueprints } = useTnpStore();

  const [jsonInput, setJsonInput] = useState(DEMO_POSTMAN_COLLECTION_JSON);
  const [parsedEndpoints, setParsedEndpoints] = useState<PostmanParsedEndpoint[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [step, setStep] = useState<'input' | 'review'>('input');

  if (!isOpen) return null;

  const handleParse = () => {
    try {
      const endpoints = parsePostmanCollection(jsonInput);
      setParsedEndpoints(endpoints);
      setSelectedIds(new Set(endpoints.map((e) => e.id)));
      setStep('review');
      toast.success(`Successfully extracted ${endpoints.length} endpoints from Postman collection!`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to parse Postman collection');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setJsonInput(content);
      try {
        const endpoints = parsePostmanCollection(content);
        setParsedEndpoints(endpoints);
        setSelectedIds(new Set(endpoints.map((e) => e.id)));
        setStep('review');
        toast.success(`Extracted ${endpoints.length} endpoints from "${file.name}"!`);
      } catch (err: any) {
        toast.error(err.message || 'Invalid Postman JSON');
      }
    };
    reader.readAsText(file);
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === parsedEndpoints.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(parsedEndpoints.map((e) => e.id)));
    }
  };

  const handleImportAndPublish = async () => {
    const chosen = parsedEndpoints.filter((e) => selectedIds.has(e.id));
    if (chosen.length === 0) {
      toast.error('Please select at least one endpoint to create nodes.');
      return;
    }

    setIsProcessing(true);
    try {
      const tenantId = currentTenantId || 'tenant-gsa';
      const userEmail = currentUser?.email || 'admin@tenant.gov';

      const newBlueprints: Blueprint[] = chosen.map((ep) =>
        convertEndpointToBlueprint(ep, tenantId, userEmail)
      );

      // Save to localStorage & sync store
      const existingStr = localStorage.getItem(`tnp_blueprints_${tenantId}`) || '[]';
      const existing: Blueprint[] = JSON.parse(existingStr);
      localStorage.setItem(
        `tnp_blueprints_${tenantId}`,
        JSON.stringify([...newBlueprints, ...existing])
      );

      await refreshBlueprints();
      toast.success(
        `🎉 Successfully created & published ${newBlueprints.length} Node Blueprints for ${currentTenantName}!`
      );
      if (onSuccess) onSuccess(newBlueprints);
      onClose();
    } catch {
      toast.error('Failed to save blueprints');
    } finally {
      setIsProcessing(false);
    }
  };

  const getMethodBadgeColor = (method: string) => {
    switch (method) {
      case 'GET':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
      case 'POST':
        return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40';
      case 'PUT':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 'DELETE':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
      default:
        return 'bg-slate-500/20 text-slate-300 border-slate-500/40';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="w-full max-w-5xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500/20 to-orange-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">Import Nodes from Postman Collection</h3>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {currentTenantName}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Automatically extracts URLs, Request payloads, Saved Responses, and generates Visual Business Rules.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex-1 overflow-y-auto space-y-6">
          
          {step === 'input' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300">
                  Paste Postman Collection JSON (v2.1 / v2.0) or upload a file:
                </span>
                
                <label className="cursor-pointer px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 text-xs font-semibold flex items-center gap-1.5 transition-all">
                  <Upload className="w-3.5 h-3.5" /> Upload .json File
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>

              <textarea
                rows={12}
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                placeholder="Paste Postman collection schema..."
                className="w-full p-3.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-emerald-400 font-mono focus:outline-none focus:border-indigo-500"
              />

              <div className="p-4 rounded-xl bg-indigo-950/30 border border-indigo-900/40 flex items-center justify-between">
                <div className="text-xs text-slate-300">
                  <p className="font-semibold text-indigo-200">5 Pre-configured Federal APIs Loaded</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Includes GSA Address, USPS DPV, SAM.gov Vendor Check, IRS TIN Match, and Fintech Screener.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setJsonInput(DEMO_POSTMAN_COLLECTION_JSON)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 border border-slate-700"
                >
                  Reset Demo Collection
                </button>
              </div>
            </div>
          )}

          {step === 'review' && (
            <div className="space-y-4">
              {/* Summary Bar */}
              <div className="flex items-center justify-between bg-slate-950 p-4 rounded-xl border border-slate-800">
                <div className="flex items-center gap-2 text-xs">
                  <Boxes className="w-4 h-4 text-indigo-400" />
                  <span className="font-bold text-white">
                    {parsedEndpoints.length} Endpoints Extracted ({selectedIds.size} Selected)
                  </span>
                </div>

                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="text-xs font-semibold text-indigo-400 hover:text-indigo-300"
                >
                  {selectedIds.size === parsedEndpoints.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>

              {/* Endpoints List */}
              <div className="space-y-3">
                {parsedEndpoints.map((ep, idx) => {
                  const isSelected = selectedIds.has(ep.id);
                  const isExpanded = expandedId === ep.id;

                  return (
                    <div
                      key={ep.id}
                      className={`p-4 rounded-xl border transition-all ${
                        isSelected
                          ? 'bg-slate-900/90 border-indigo-500/50 shadow-md'
                          : 'bg-slate-950/40 border-slate-800 opacity-60'
                      }`}
                    >
                      {/* Top Bar */}
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          {/* Checkbox */}
                          <button
                            type="button"
                            onClick={() => toggleSelect(ep.id)}
                            className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all ${
                              isSelected
                                ? 'bg-indigo-600 border-indigo-500 text-white'
                                : 'border-slate-700 hover:border-slate-500'
                            }`}
                          >
                            {isSelected && <Check className="w-3.5 h-3.5" />}
                          </button>

                          {/* Method Pill */}
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${getMethodBadgeColor(
                              ep.method
                            )}`}
                          >
                            {ep.method}
                          </span>

                          <div className="min-w-0 flex-1">
                            <h4 className="text-xs font-bold text-white truncate">{ep.name}</h4>
                            <p className="text-[11px] text-slate-400 font-mono truncate">{ep.url}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setExpandedId(isExpanded ? null : ep.id)}
                            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1 transition-all"
                          >
                            {isExpanded ? 'Hide Details' : 'View Payload & Rules'}
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>

                      {/* Expandable Details: Request & Saved Response */}
                      {isExpanded && (
                        <div className="mt-4 pt-4 border-t border-slate-800/80 space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            
                            {/* Request Body Payload */}
                            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                              <div className="flex items-center justify-between text-[11px] text-indigo-300 font-bold mb-1.5">
                                <span>Request Body Schema:</span>
                                <span className="font-mono text-slate-500">JSON</span>
                              </div>
                              <pre className="text-[11px] text-emerald-400 font-mono overflow-x-auto max-h-32 p-2 bg-slate-900 rounded">
                                {ep.requestBody || 'No request payload (GET Request)'}
                              </pre>
                            </div>

                            {/* Saved Response Example */}
                            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                              <div className="flex items-center justify-between text-[11px] text-teal-300 font-bold mb-1.5">
                                <span>Saved Response Example ({ep.savedResponseStatus} OK):</span>
                                <span className="font-mono text-slate-500">Postman Mock</span>
                              </div>
                              <pre className="text-[11px] text-teal-300 font-mono overflow-x-auto max-h-32 p-2 bg-slate-900 rounded">
                                {ep.savedResponse || 'No saved response available'}
                              </pre>
                            </div>
                          </div>

                          {/* Generated Visual Rule preview */}
                          <div className="p-3 rounded-lg bg-indigo-950/40 border border-indigo-900/60 flex items-start gap-2">
                            <Sliders className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
                            <div className="text-xs">
                              <span className="font-bold text-indigo-200">Auto-Generated Decision Rule: </span>
                              <span className="text-slate-300">
                                {ep.ruleMatrix.branches[0]?.name || 'Approval Branch'} &rarr; Return Outcome:{' '}
                                <strong className="text-emerald-400">{ep.ruleMatrix.branches[0]?.outcome || 'APPROVE'}</strong>
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          {step === 'review' ? (
            <button
              type="button"
              onClick={() => setStep('input')}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
            >
              Back to Collection Input
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-3">
            {step === 'input' ? (
              <button
                type="button"
                onClick={handleParse}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white flex items-center gap-1.5 transition-all shadow-md"
              >
                Analyze & Extract Endpoints <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                disabled={isProcessing || selectedIds.size === 0}
                onClick={handleImportAndPublish}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-xs font-bold text-white flex items-center gap-2 transition-all shadow-lg shadow-emerald-600/30 disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                {isProcessing
                  ? 'Publishing...'
                  : `Batch Import & Publish ${selectedIds.size} Node Blueprints`}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
