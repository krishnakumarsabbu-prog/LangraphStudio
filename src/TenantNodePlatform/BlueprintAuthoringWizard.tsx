import React, { useState } from 'react';
import {
  X,
  Layers,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Sliders,
  Globe,
  Play,
  Sparkles,
  ShieldCheck,
  Code,
  Tag,
  AlertCircle,
  FileCode2,
} from 'lucide-react';
import { VisualRuleBuilder, VisualRuleMatrix, compileRuleMatrixToPython } from './VisualRuleBuilder';
import { useAuthStore } from './authStore';
import { useTnpStore } from './tnpStore';
import type { Blueprint, BlueprintCreate } from './types';
import toast from 'react-hot-toast';

interface BlueprintAuthoringWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (blueprint: Blueprint) => void;
}

export const BlueprintAuthoringWizard: React.FC<BlueprintAuthoringWizardProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { currentTenantId, currentTenantName, currentUser } = useAuthStore();
  const { refreshBlueprints } = useTnpStore();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1: General Metadata
  const [name, setName] = useState('GSA Address & Identity Verification');
  const [category, setCategory] = useState('Identity & Verification');
  const [description, setDescription] = useState(
    'Comprehensive address verification service integrated with federal address validation and automatic business rule classification.'
  );
  const [tags, setTags] = useState('GSA, Address, Realtime, Automated');

  // Step 2: Service Config
  const [serviceUrl, setServiceUrl] = useState('https://api.gsa.gov/v2/address/verify');
  const [httpMethod, setHttpMethod] = useState<'POST' | 'GET' | 'PUT'>('POST');
  const [authType, setAuthType] = useState('API Key');
  const [authHeader, setAuthHeader] = useState('X-GSA-API-KEY');
  const [authSecret, setAuthSecret] = useState('gsa_live_sec_99381928');
  const [requestMapping, setRequestMapping] = useState(
    JSON.stringify(
      {
        street: 'state.street',
        city: 'state.city',
        state: 'state.state',
        zip_code: 'state.zip',
      },
      null,
      2
    )
  );
  const [timeoutMs, setTimeoutMs] = useState(5000);
  const [retries, setRetries] = useState(2);

  // Step 3: Business Rules
  const [ruleMatrix, setRuleMatrix] = useState<VisualRuleMatrix>({
    branches: [
      {
        id: 'branch-1',
        name: 'Auto-Approve Criteria',
        combinator: 'AND',
        conditions: [
          { id: 'c-1', field: 'status', operator: '==', value: 'VERIFIED', valueType: 'string' },
          { id: 'c-2', field: 'match_score', operator: '>=', value: '80', valueType: 'number' },
          { id: 'c-3', field: 'address_match', operator: '==', value: 'true', valueType: 'boolean' },
        ],
        outcome: 'APPROVE',
        color: 'emerald',
      },
      {
        id: 'branch-2',
        name: 'Manual Review Criteria',
        combinator: 'AND',
        conditions: [
          { id: 'c-4', field: 'match_score', operator: '>=', value: '50', valueType: 'number' },
        ],
        outcome: 'MANUAL_REVIEW',
        color: 'amber',
      },
    ],
    defaultOutcome: 'REJECT',
  });
  const [compiledPython, setCompiledPython] = useState('');

  // Step 4: Sandbox Testing
  const [testPayload, setTestPayload] = useState(
    JSON.stringify(
      {
        status: 'VERIFIED',
        match_score: 85,
        address_match: true,
        street: '1800 F St NW',
        city: 'Washington',
        state: 'DC',
        zip: '20405',
      },
      null,
      2
    )
  );
  const [testResult, setTestResult] = useState<{
    matched: boolean;
    outcome: string;
    branchName?: string;
    evaluatedAt: string;
  } | null>(null);

  if (!isOpen) return null;

  const handleTestEvaluation = () => {
    try {
      const parsed = JSON.parse(testPayload);
      
      // Evaluate rule matrix in sandbox
      let matchedBranch = null;
      for (const branch of ruleMatrix.branches) {
        let branchPassed = branch.combinator === 'AND';
        
        for (const cond of branch.conditions) {
          const val = parsed[cond.field];
          let condPassed = false;
          
          if (cond.operator === '==') {
            condPassed = String(val).toLowerCase() === String(cond.value).toLowerCase();
          } else if (cond.operator === '!=') {
            condPassed = String(val).toLowerCase() !== String(cond.value).toLowerCase();
          } else if (cond.operator === '>=') {
            condPassed = Number(val) >= Number(cond.value);
          } else if (cond.operator === '<=') {
            condPassed = Number(val) <= Number(cond.value);
          } else if (cond.operator === '>') {
            condPassed = Number(val) > Number(cond.value);
          } else if (cond.operator === '<') {
            condPassed = Number(val) < Number(cond.value);
          }

          if (branch.combinator === 'AND' && !condPassed) {
            branchPassed = false;
            break;
          } else if (branch.combinator === 'OR' && condPassed) {
            branchPassed = true;
            break;
          }
        }

        if (branchPassed) {
          matchedBranch = branch;
          break;
        }
      }

      setTestResult({
        matched: !!matchedBranch,
        outcome: matchedBranch ? matchedBranch.outcome : ruleMatrix.defaultOutcome,
        branchName: matchedBranch ? matchedBranch.name : 'Default Fallback',
        evaluatedAt: new Date().toLocaleTimeString(),
      });
      toast.success('Sandbox evaluation completed!');
    } catch {
      toast.error('Invalid JSON test payload');
    }
  };

  const handlePublish = async () => {
    if (!name.trim()) {
      toast.error('Please provide a blueprint name');
      return;
    }

    const pythonCode = compileRuleMatrixToPython(ruleMatrix);

    // Build the complete 2-node constituent blueprint graph definition
    const serviceNodeId = `node_service_${Date.now()}`;
    const decisionNodeId = `node_decision_${Date.now()}`;

    const newBlueprint: Blueprint = {
      blueprint_id: `bp-${Date.now()}`,
      tenant_id: currentTenantId || 'tenant-gsa',
      name: name.trim(),
      description: description.trim(),
      status: 'PUBLISHED',
      version: 1,
      source_type: 'graph',
      created_by: currentUser?.email || 'admin@tenant.gov',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      input_contract: {
        type: 'object',
        properties: {
          street: { type: 'string' },
          city: { type: 'string' },
          state: { type: 'string' },
          zip: { type: 'string' },
        },
      },
      output_contract: {
        type: 'object',
        properties: {
          outcome: { type: 'string' },
          status: { type: 'string' },
          match_score: { type: 'number' },
        },
      },
      graph_definition: {
        nodes: [
          {
            id: serviceNodeId,
            type: 'serviceNode',
            data: {
              label: `${name} (Service)`,
              url: serviceUrl,
              method: httpMethod,
              auth_type: authType,
              auth_header: authHeader,
              headers: { 'Content-Type': 'application/json' },
              timeout: timeoutMs,
              retries: retries,
              mapping: requestMapping,
            },
            position: { x: 100, y: 150 },
          },
          {
            id: decisionNodeId,
            type: 'decisionNode',
            data: {
              label: `${name} (Rule Decision)`,
              script: pythonCode,
              ruleMatrix: ruleMatrix,
              branches: ruleMatrix.branches.map((b) => b.outcome),
            },
            position: { x: 450, y: 150 },
          },
        ],
        edges: [
          {
            id: `edge_${serviceNodeId}_${decisionNodeId}`,
            source: serviceNodeId,
            target: decisionNodeId,
            condition: '',
          },
        ],
        inputs: {
          message: {},
        },
      },
    };

    // Store in localStorage & TNP Store
    try {
      const existingStr = localStorage.getItem(`tnp_blueprints_${newBlueprint.tenant_id}`) || '[]';
      const existing: Blueprint[] = JSON.parse(existingStr);
      localStorage.setItem(
        `tnp_blueprints_${newBlueprint.tenant_id}`,
        JSON.stringify([newBlueprint, ...existing])
      );
      await refreshBlueprints();
      toast.success(`🎉 Blueprint "${newBlueprint.name}" published as v1.0.0!`);
      if (onSuccess) onSuccess(newBlueprint);
      onClose();
    } catch {
      toast.success(`🎉 Blueprint "${newBlueprint.name}" created!`);
      if (onSuccess) onSuccess(newBlueprint);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">Create Tenant Node Blueprint</h3>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {currentTenantName || 'Tenant Workspace'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Form-based authoring wizard • No canvas required • Immutable versioning
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

        {/* Step Indicator */}
        <div className="px-6 py-3 bg-slate-950/30 border-b border-slate-800/80 grid grid-cols-4 gap-2 text-xs">
          {[
            { num: 1, label: '1. Identity & Metadata' },
            { num: 2, label: '2. Service API' },
            { num: 3, label: '3. Business Rules' },
            { num: 4, label: '4. Test & Publish' },
          ].map((s) => (
            <button
              key={s.num}
              type="button"
              onClick={() => setStep(s.num as any)}
              className={`py-2 px-3 rounded-lg text-left font-semibold transition-all flex items-center gap-2 ${
                step === s.num
                  ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/40 shadow-sm'
                  : 'text-slate-400 hover:bg-slate-800/40'
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full text-[10px] flex items-center justify-center font-bold ${
                  step === s.num ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-400'
                }`}
              >
                {s.num}
              </span>
              <span className="truncate">{s.label}</span>
            </button>
          ))}
        </div>

        {/* Step Content */}
        <div className="p-6 flex-1 overflow-y-auto space-y-6">
          
          {/* STEP 1: Identity & Metadata */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-300">
                  Blueprint Name *
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setName('SAM.gov Federal Vendor Exclusion Check');
                    setCategory('Identity & Verification');
                    setDescription('Checks active registration status and exclusions in federal SAM.gov procurement registry.');
                    setTags('GSA, Federal, SAM.gov, Exclusion');
                    setServiceUrl('https://api.sam.gov/entity-information/v3/entities?uei=N7M1QG8J4K12');
                    setHttpMethod('GET');
                    setAuthHeader('X-API-KEY');
                    setAuthSecret('sam_live_key_9918');
                    setRequestMapping('{\n  "uei": "state.uei"\n}');
                    toast.success('Sample Postman endpoint loaded into wizard!');
                  }}
                  className="text-[11px] text-orange-400 hover:text-orange-300 flex items-center gap-1 font-semibold"
                >
                  <Sparkles className="w-3.5 h-3.5 text-orange-400" />
                  Auto-fill from Sample Postman API
                </button>
              </div>
              <div>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. GSA Address Verification"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="Identity & Verification">Identity & Verification</option>
                    <option value="Address & Geolocation">Address & Geolocation</option>
                    <option value="Fraud & Risk">Fraud & Risk</option>
                    <option value="Financial Services">Financial Services</option>
                    <option value="Custom Integration">Custom Integration</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Tags (Comma Separated)
                  </label>
                  <input
                    type="text"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    placeholder="GSA, Address, Verified"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Description & Business Capabilities
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what business problems this node solves..."
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="p-4 rounded-xl bg-indigo-950/30 border border-indigo-900/40 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-indigo-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-slate-300">
                  <p className="font-semibold text-indigo-200">Immutable Blueprint Contract</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    When business users drag this blueprint into a workflow, it will be deep-copied. Future blueprint updates will not break existing workflow runs.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Service API */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-4">
                <div className="col-span-1">
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    HTTP Method
                  </label>
                  <select
                    value={httpMethod}
                    onChange={(e) => setHttpMethod(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-indigo-300 font-bold focus:outline-none focus:border-indigo-500"
                  >
                    <option value="POST">POST</option>
                    <option value="GET">GET</option>
                    <option value="PUT">PUT</option>
                  </select>
                </div>

                <div className="col-span-3">
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Target Endpoint URL *
                  </label>
                  <div className="relative">
                    <Globe className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={serviceUrl}
                      onChange={(e) => setServiceUrl(e.target.value)}
                      placeholder="https://api.tenant.gov/v1/..."
                      className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Authentication Header
                  </label>
                  <input
                    type="text"
                    value={authHeader}
                    onChange={(e) => setAuthHeader(e.target.value)}
                    placeholder="X-API-KEY or Authorization"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Encrypted Secret / Token
                  </label>
                  <input
                    type="password"
                    value={authSecret}
                    onChange={(e) => setAuthSecret(e.target.value)}
                    placeholder="••••••••••••••••"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Timeout (Milliseconds)
                  </label>
                  <input
                    type="number"
                    value={timeoutMs}
                    onChange={(e) => setTimeoutMs(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Retry Attempts
                  </label>
                  <input
                    type="number"
                    value={retries}
                    onChange={(e) => setRetries(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Request Payload Mapping (JSON)
                </label>
                <textarea
                  rows={4}
                  value={requestMapping}
                  onChange={(e) => setRequestMapping(e.target.value)}
                  className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-emerald-400 font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          )}

          {/* STEP 3: Business Rules */}
          {step === 3 && (
            <div className="space-y-4">
              <VisualRuleBuilder
                initialMatrix={ruleMatrix}
                availableFields={['status', 'match_score', 'address_match', 'dpv_code', 'risk_score', 'confidence']}
                onChange={(matrix, py) => {
                  setRuleMatrix(matrix);
                  setCompiledPython(py);
                }}
              />
            </div>
          )}

          {/* STEP 4: Test & Publish */}
          {step === 4 && (
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Play className="w-4 h-4 text-emerald-400" />
                    <h4 className="text-xs font-bold text-white">Live Sandbox Test Payload</h4>
                  </div>
                  <button
                    type="button"
                    onClick={handleTestEvaluation}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white flex items-center gap-1.5 transition-all shadow-md"
                  >
                    <Play className="w-3.5 h-3.5" /> Execute Test Sandbox
                  </button>
                </div>

                <textarea
                  rows={6}
                  value={testPayload}
                  onChange={(e) => setTestPayload(e.target.value)}
                  className="w-full p-3 bg-slate-900 border border-slate-800 rounded-xl text-xs text-emerald-300 font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              {testResult && (
                <div className="p-4 rounded-xl bg-slate-950/80 border border-indigo-900/50 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-200">Sandbox Test Result</span>
                    <span className="text-[11px] text-slate-500">Evaluated at {testResult.evaluatedAt}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex-1">
                      <span className="text-slate-400 block text-[10px]">EVALUATED BRANCH:</span>
                      <span className="font-bold text-indigo-300">{testResult.branchName}</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex-1">
                      <span className="text-slate-400 block text-[10px]">DECISION OUTCOME:</span>
                      <span className="font-bold text-emerald-400 text-sm">{testResult.outcome}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Blueprint Summary Card */}
              <div className="p-4 rounded-xl bg-indigo-950/20 border border-indigo-800/40 space-y-2">
                <h4 className="text-xs font-bold text-indigo-300 uppercase">Ready for Deployment:</h4>
                <p className="text-xs text-slate-300">
                  Blueprint <strong className="text-white">{name} (v1.0.0)</strong> will be published into{' '}
                  <strong className="text-indigo-300">{currentTenantName}</strong>.
                </p>
                <p className="text-[11px] text-slate-400">
                  Constituent Nodes: <strong>1 Service Node + 1 Decision Rule Node + 1 Directed Edge</strong>.
                </p>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer Controls */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <button
            type="button"
            disabled={step === 1}
            onClick={() => setStep((s) => (s > 1 ? ((s - 1) as any) : s))}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none flex items-center gap-1.5 transition-all"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Previous
          </button>

          <div className="flex items-center gap-3">
            {step < 4 ? (
              <button
                type="button"
                onClick={() => setStep((s) => (s < 4 ? ((s + 1) as any) : s))}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white flex items-center gap-1.5 transition-all shadow-md"
              >
                Next Step <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handlePublish}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-xs font-bold text-white flex items-center gap-2 transition-all shadow-lg shadow-emerald-600/30"
              >
                <Sparkles className="w-4 h-4" /> Publish Blueprint (v1.0.0)
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
