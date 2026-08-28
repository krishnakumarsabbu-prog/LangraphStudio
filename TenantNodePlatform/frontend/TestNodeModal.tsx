import React, { useState, useMemo } from 'react';
import { Play, Loader2, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import * as api from './tnpService';
import type { Blueprint } from './types';
import { ModalShell, SectionTitle, JsonViewer, EmptyHint } from './shared';

interface TestNodeModalProps {
  blueprint: Blueprint;
  onClose: () => void;
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
      // Materialize the blueprint to get the graph, then show the result
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
      if (err instanceof SyntaxError) {
        setError('Invalid JSON input. Please check your syntax.');
      } else {
        const msg =
          err instanceof Error ? err.message : 'Test failed';
        setError(msg);
      }
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
          <div className="flex items-start gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-yellow-700 dark:text-yellow-400 text-sm">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            <span>
              Only published blueprints can be materialized. This blueprint is{' '}
              <strong>{blueprint.status}</strong>. Publish it first to run a full test.
            </span>
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
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Play size={16} />
            )}
            Run Test
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
            <XCircle size={16} className="flex-shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        {/* Result */}
        {result && (
          <div>
            <SectionTitle>Result</SectionTitle>
            <div className="flex items-center gap-2 mb-3 text-green-700 dark:text-green-400">
              <CheckCircle size={18} />
              <span className="text-sm font-medium">Materialization successful</span>
            </div>
            <JsonViewer data={result} />
          </div>
        )}

        {/* Graph preview */}
        {graph?.nodes && graph.nodes.length > 0 && (
          <div>
            <SectionTitle>Graph Definition</SectionTitle>
            <JsonViewer data={graph} />
          </div>
        )}

        {!graph?.nodes && (
          <div>
            <SectionTitle>Graph Definition</SectionTitle>
            <EmptyHint>No graph definition available.</EmptyHint>
          </div>
        )}
      </div>
    </ModalShell>
  );
};
