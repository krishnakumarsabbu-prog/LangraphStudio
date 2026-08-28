import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Wand2, FileCode, Upload, Code2, Sparkles, Check, ArrowRight, Play } from 'lucide-react';
import { Button } from '../ui/button';
import { createCreditApprovalWorkflowSDK, createECommerceOrderWorkflowSDK, LangGraphSDK } from '../../utils/langGraphSDK';
import toast from 'react-hot-toast';

interface ProgrammaticGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportGraph: (jsonString: string) => void;
}

export const ProgrammaticGeneratorModal: React.FC<ProgrammaticGeneratorModalProps> = ({
  isOpen,
  onClose,
  onImportGraph,
}) => {
  const [activeTab, setActiveTab] = useState<'recipes' | 'openapi' | 'sdk_code'>('recipes');
  const [openApiInput, setOpenApiInput] = useState('');
  const [selectedRecipe, setSelectedRecipe] = useState<'credit' | 'ecommerce'>('credit');
  const [copiedCode, setCopiedCode] = useState(false);

  if (!isOpen) return null;

  const handleGenerateRecipe = (type: 'credit' | 'ecommerce') => {
    try {
      const json = type === 'credit' ? createCreditApprovalWorkflowSDK() : createECommerceOrderWorkflowSDK();
      onImportGraph(json);
      toast.success('95% Workflow generated & loaded onto canvas!');
      onClose();
    } catch (error: any) {
      toast.error(`Generation failed: ${error.message}`);
    }
  };

  const handleImportOpenAPI = () => {
    if (!openApiInput.trim()) {
      toast.error('Please paste an OpenAPI or Swagger JSON specification');
      return;
    }

    try {
      const spec = JSON.parse(openApiInput);
      const sdk = new LangGraphSDK('OpenAPI Generated Workflow');
      sdk.fromOpenAPI(spec);
      const json = sdk.exportJSON();
      onImportGraph(json);
      toast.success('OpenAPI endpoints converted & loaded onto canvas!');
      onClose();
    } catch (error: any) {
      toast.error(`OpenAPI import error: ${error.message}`);
    }
  };

  const sampleTypeScriptSnippet = `import { LangGraphSDK } from './utils/langGraphSDK';

// 1. Initialize SDK
const sdk = new LangGraphSDK('Automated Loan Approval');

// 2. Programmatically Define Nodes & Payload Mappings (95%)
const userNode = sdk.addServiceNode({
  label: '1. Get User Profile',
  url: 'https://api.company.com/v1/user/{input.userId}',
  method: 'GET'
});

const creditNode = sdk.addServiceNode({
  label: '2. Check Credit Rating',
  url: 'https://api.bureau.com/v1/score',
  method: 'POST',
  requestBody: JSON.stringify({ ssn: \`{\${userNode}.response.ssn}\` })
});

const decisionNode = sdk.addDecisionNode({
  label: '3. Risk Evaluator',
  script: 'state.get("score", 0) >= 700'
});

// 3. Connect Edges & Apply Auto-Layout
sdk.connect(userNode, creditNode);
sdk.connect(creditNode, decisionNode);
sdk.applyAutoLayout('LR');

// 4. Export JSON graph payload for canvas or backend execution
const graphPayload = sdk.exportGraph();`;

  const copyCodeToClipboard = () => {
    navigator.clipboard.writeText(sampleTypeScriptSnippet);
    setCopiedCode(true);
    toast.success('SDK snippet copied to clipboard');
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const sampleOpenAPISpec = `{
  "openapi": "3.0.0",
  "info": { "title": "Customer Verification API", "version": "1.0.0" },
  "servers": [{ "url": "https://api.enterprise.com/v1" }],
  "paths": {
    "/customers/{id}": {
      "get": {
        "summary": "1. Fetch Customer Record",
        "responses": { "200": { "description": "OK" } }
      }
    },
    "/kyc/verify": {
      "post": {
        "summary": "2. Run Identity & KYC Check",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": { "nationalId": "string", "name": "string" }
              }
            }
          }
        }
      }
    }
  }
}`;

  const loadSampleOpenAPI = () => {
    setOpenApiInput(sampleOpenAPISpec);
    toast.success('Sample OpenAPI specification loaded');
  };

  const modalContent = (
    <div className="fixed inset-0 bg-black/70 z-[9999] flex items-center justify-center p-6">
      <div className="bg-white rounded-xl max-w-4xl w-full h-[85vh] shadow-2xl flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 text-white px-6 py-5 flex items-center justify-between border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gray-700/80 flex items-center justify-center border border-gray-600">
              <Sparkles className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2">
                Programmatic Workflow Generator SDK
                <span className="text-xs bg-green-500/20 text-green-300 font-semibold px-2 py-0.5 rounded border border-green-500/30">
                  95% Automated
                </span>
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Generate nodes, dynamic input bindings, decision rules, and DAG layout programmatically.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-gray-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs Bar */}
        <div className="bg-gray-50 border-b border-gray-200 px-6 flex gap-4">
          <button
            onClick={() => setActiveTab('recipes')}
            className={`py-3 text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'recipes'
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Wand2 className="w-4 h-4" />
            Built-in SDK Recipes
          </button>
          <button
            onClick={() => setActiveTab('openapi')}
            className={`py-3 text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'openapi'
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Upload className="w-4 h-4" />
            OpenAPI / Swagger Spec
          </button>
          <button
            onClick={() => setActiveTab('sdk_code')}
            className={`py-3 text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'sdk_code'
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Code2 className="w-4 h-4" />
            TypeScript SDK Code
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
          {activeTab === 'recipes' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-1">
                  Select Enterprise Recipe Template
                </h3>
                <p className="text-xs text-gray-500">
                  Pre-configured 95% workflows featuring automated dynamic variable mappings (`{`fetchUser.response.ssn`}`) and auto-layout graph arrangement.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div
                  onClick={() => setSelectedRecipe('credit')}
                  className={`p-5 rounded-xl border-2 cursor-pointer transition-all bg-white shadow-sm hover:shadow-md ${
                    selectedRecipe === 'credit'
                      ? 'border-gray-900 ring-2 ring-gray-900/10'
                      : 'border-gray-200 hover:border-gray-400'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold px-2.5 py-1 rounded bg-blue-50 text-blue-700 border border-blue-200">
                      Financial Services
                    </span>
                    {selectedRecipe === 'credit' && <Check className="w-5 h-5 text-gray-900" />}
                  </div>
                  <h4 className="font-bold text-gray-900 text-base mb-1">
                    Credit Pre-Approval Engine
                  </h4>
                  <p className="text-xs text-gray-600 mb-4 line-clamp-2">
                    Fetches customer profile ➔ queries credit bureau ➔ executes Python risk rule (`score &gt;= 720`) ➔ generates AI loan offer letter ➔ issues token or rejection notice.
                  </p>
                  <div className="flex items-center justify-between pt-3 border-t border-gray-100 text-xs text-gray-500 font-mono">
                    <span>5 Nodes • 5 Edges</span>
                    <span className="text-green-600 font-semibold">DAG Auto-Laid Out</span>
                  </div>
                </div>

                <div
                  onClick={() => setSelectedRecipe('ecommerce')}
                  className={`p-5 rounded-xl border-2 cursor-pointer transition-all bg-white shadow-sm hover:shadow-md ${
                    selectedRecipe === 'ecommerce'
                      ? 'border-gray-900 ring-2 ring-gray-900/10'
                      : 'border-gray-200 hover:border-gray-400'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold px-2.5 py-1 rounded bg-purple-50 text-purple-700 border border-purple-200">
                      E-Commerce & Logistics
                    </span>
                    {selectedRecipe === 'ecommerce' && <Check className="w-5 h-5 text-gray-900" />}
                  </div>
                  <h4 className="font-bold text-gray-900 text-base mb-1">
                    Order Processing & Fulfillment
                  </h4>
                  <p className="text-xs text-gray-600 mb-4 line-clamp-2">
                    Checks warehouse stock ➔ evaluates stock availability decision rule ➔ processes card payment ➔ dispatches warehouse shipment or triggers backorder notification.
                  </p>
                  <div className="flex items-center justify-between pt-3 border-t border-gray-100 text-xs text-gray-500 font-mono">
                    <span>5 Nodes • 4 Edges</span>
                    <span className="text-green-600 font-semibold">DAG Auto-Laid Out</span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-gray-900 text-white rounded-xl font-mono text-xs space-y-2">
                <div className="text-gray-400 flex items-center justify-between">
                  <span>Automated Output Payload Structure Preview:</span>
                  <span className="text-yellow-400">95% Pre-Wired</span>
                </div>
                <pre className="text-gray-200 overflow-x-auto p-2 bg-gray-950 rounded border border-gray-800">
                  {selectedRecipe === 'credit'
                    ? `{\n  "service_1": "GET /v1/customers/{input.userId}",\n  "service_2": "POST /v1/credit-check (ssn: {service_1.ssn})",\n  "decision_3": "state['score'] >= 720",\n  "llm_4": "Generate letter for {service_1.name}",\n  "edges": ["True -> Approve", "False -> Reject"]\n}`
                    : `{\n  "service_1": "GET /v1/inventory/{input.itemId}",\n  "decision_2": "state['stock'] >= state['quantity']",\n  "service_3": "POST /v1/charges (amount: {input.amount})",\n  "service_4": "POST /v1/shipments (paymentId: {service_3.chargeId})"\n}`}
                </pre>
              </div>
            </div>
          )}

          {activeTab === 'openapi' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                    Import OpenAPI / Swagger Spec
                  </h3>
                  <p className="text-xs text-gray-500">
                    Paste a Swagger 2.0 or OpenAPI 3.0 JSON specification to convert REST endpoints into canvas nodes automatically.
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={loadSampleOpenAPI} className="text-xs">
                  Load Sample Spec
                </Button>
              </div>

              <textarea
                value={openApiInput}
                onChange={(e) => setOpenApiInput(e.target.value)}
                placeholder="Paste OpenAPI / Swagger JSON specification here..."
                className="w-full h-80 px-4 py-3 text-xs font-mono border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white resize-none shadow-inner"
              />
            </div>
          )}

          {activeTab === 'sdk_code' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                    TypeScript SDK Usage Example
                  </h3>
                  <p className="text-xs text-gray-500">
                    Import `LangGraphSDK` into your application or backend scripts to programmatically construct graphs.
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={copyCodeToClipboard} className="text-xs gap-1">
                  {copiedCode ? <Check className="w-3.5 h-3.5 text-green-600" /> : <FileCode className="w-3.5 h-3.5" />}
                  {copiedCode ? 'Copied' : 'Copy Code'}
                </Button>
              </div>

              <div className="relative rounded-xl overflow-hidden border border-gray-800 bg-gray-950">
                <pre className="p-4 text-xs font-mono text-gray-300 overflow-x-auto">
                  {sampleTypeScriptSnippet}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="border-t border-gray-200 px-6 py-4 flex justify-between items-center bg-white">
          <Button variant="outline" onClick={onClose} className="px-5">
            Cancel
          </Button>

          {activeTab === 'recipes' && (
            <Button
              onClick={() => handleGenerateRecipe(selectedRecipe)}
              className="bg-gray-900 hover:bg-gray-800 text-white px-6 gap-2"
            >
              <Sparkles className="w-4 h-4 text-yellow-400" />
              Generate 95% Workflow & Load Canvas
            </Button>
          )}

          {activeTab === 'openapi' && (
            <Button
              onClick={handleImportOpenAPI}
              className="bg-gray-900 hover:bg-gray-800 text-white px-6 gap-2"
            >
              <Upload className="w-4 h-4" />
              Import OpenAPI to Canvas
            </Button>
          )}

          {activeTab === 'sdk_code' && (
            <Button
              onClick={() => handleGenerateRecipe('credit')}
              className="bg-gray-900 hover:bg-gray-800 text-white px-6 gap-2"
            >
              <Play className="w-4 h-4" />
              Load Sample Code onto Canvas
            </Button>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
