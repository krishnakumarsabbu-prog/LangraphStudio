import React, { useState, useMemo } from 'react';
import { Play, CheckCircle, XCircle, AlertCircle, Loader2, FileJson } from 'lucide-react';
import * as api from './tnpService';
import type { Blueprint } from './types';
import { ModalShell, SectionTitle, JsonViewer, EmptyHint, ErrorBanner } from './shared';

interface TestNodeModalProps {
  blueprint: Blueprint;
  onClose: () => void;
}

// Business-friendly error messages
function friendlyTestError(err: unknown): string {
  if (err instanceof SyntaxError) {
    return 'The test input is not valid JSON. Please check for missing commas, quotes, or brackets and try again.';
  }
  if (err instanceof Error) {
    const msg = err.message;
    if (msg.includes('422')) {
      return 'This blueprint cannot be tested because its configuration contains invalid fields. Please review the blueprint in the Node Builder.';
    }
    if (msg.includes('403') || msg.includes('forbidden')) {
      return 'You do not have permission to test this blueprint. Only published blueprints can be materialized.';
    }
    if (msg.includes('Network Error') || msg.includes('timeout')) {
      return 'Unable to reach the test server. Please check your connection and try again.';
    }
    return msg;
  }
  return 'Test failed unexpectedly. Please try again.';
}

export const TestNodeModal: React.FC<TestNodeModalProps> = ({
  blueprint,
  onClose,
}) => {
  const graph = blueprint.graph_definition;
  const inputs = (graph?.inputs ?? {}) as Record<string, unknown>;
  const inputContract = blueprint.input_contract;

  // Build sample input from graph inputs or input contract
  const sampleInput = useMemo(() => {
    const result: Record<string, unknown> = {};
    const source = Object.keys(inputs).length > 0 ? inputs : inputContract;
    for (const [key, val] of Object.entries(source)) {
      if (typeof val === 'object' && val !== null && 'type' in val) {
        const t = (val as Record<string, unknown>).type;
        if (t === 'string') result[key] = '';
        else if (t === 'number') result[key] = 0;
        else if (t === 'boolean') result[key] = false;
        else result[key] = null;
      } else {
        result[key] = val ?? '';
      }
    }
    return result;
  }, [inputs, inputContract]);

  const [inputJson, setInputJson] = useState(
    JSON.stringify(sampleInput, null, 2)
  );
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const canMaterialize = blueprint.status === 'PUBLISHED';

  const handleTest = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const parsed = JSON.parse(inputJson);
      const materialized = await api.materializeBlueprint(blueprint.blueprint_id);
      setResult({
        status: 'success',
        message: 'Blueprint materialized successfully.',
        graph: materialized.graph,
        blueprint_name: materialized.blueprint_name,
        version: materialized.version,
        input: parsed,
      });
    } catch (err: unknown) {
      setError(friendlyTestError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell
      title={`Test: ${blueprint.name}`}
      subtitle={`v${blueprint.version} · ${blueprint.status}`}
      onClose={onClose}
      maxWidth="max-w-3xl"
    >
      <div className="space-y-5">
        {/* Warning for non-published */}
        {!canMaterialize && (
          <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-amber-700 dark:text-amber-400 text-sm">
            <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold mb-0.5">Publishing required for full testing</p>
              <p>
                Only published blueprints can be materialized. This blueprint is currently{' '}
                <strong>{blueprint.status}</strong>. Publish it first to run a full materialization test.
              </p>
            </div>
          </div>
        )}

        {/* Input */}
        <div>
          <SectionTitle>Test Input (JSON)</SectionTitle>
          <textarea
            value={inputJson}
            onChange={(e) => setInputJson(e.target.value)}
            rows={8}
            className="w-full px-4 py-3 text-xs font-mono border border-light-border dark:border-dark-border rounded-lg bg-white dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent transition-all resize-none scrollbar-thin"
            placeholder="{}"
          />
        </div>

        {/* Run button */}
        <div className="flex justify-end">
          <button
            onClick={handleTest}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 bg-black dark:bg-white text-white dark:text-black rounded-lg text-sm font-medium hover:bg-gray-800 dark:hover:bg-gray-200 transition-all disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Running Test...
              </>
            ) : (
              <>
                <Play size={16} />
                Run Test
              </>
            )}
          </button>
        </div>

        {/* Error */}
        {error && (
          <ErrorBanner message={error} />
        )}

        {/* Result */}
        {result && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
              <CheckCircle size={18} />
              <span className="text-sm font-medium">Materialization successful</span>
            </div>
            <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-semibold text-light-text-secondary dark:text-dark-text-secondary">Blueprint:</span>
                <span className="text-light-text-primary dark:text-dark-text-primary">
                  {(result as Record<string, unknown>).blueprint_name as string}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="font-semibold text-light-text-secondary dark:text-dark-text-secondary">Version:</span>
                <span className="font-mono text-light-text-primary dark:text-dark-text-primary">
                  v{(result as Record<string, unknown>).version as number}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="font-semibold text-light-text-secondary dark:text-dark-text-secondary">Nodes:</span>
                <span className="text-light-text-primary dark:text-dark-text-primary">
                  {((result as Record<string, unknown>).graph as Record<string, unknown[]>)?.nodes?.length ?? 0} nodes,
                  {' '}{((result as Record<string, unknown>).graph as Record<string, unknown[]>)?.edges?.length ?? 0} edges
                </span>
              </div>
            </div>
            <JsonViewer data={result} label="View full result (JSON)" />
          </div>
        )}

        {/* Graph definition — collapsed by default (advanced/debug view) */}
        {graph?.nodes && graph.nodes.length > 0 ? (
          <div>
            <SectionTitle>Graph Definition (Advanced)</SectionTitle>
            <JsonViewer data={graph} label="Show graph JSON" />
          </div>
        ) : (
          <div>
            <SectionTitle>Graph Definition</SectionTitle>
            <EmptyHint icon={<FileJson size={24} />}>No graph definition available.</EmptyHint>
          </div>
        )}
      </div>
    </ModalShell>
  );
};
