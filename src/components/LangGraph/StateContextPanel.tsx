import React, { useState, useCallback, useEffect } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Copy,
  CheckCircle2,
  AlertCircle,
  Play,
  Loader2,
  Layers,
  GitBranch,
  Globe,
  Bot,
  FileText,
  Workflow,
  Zap,
  Info,
  Search,
  X,
  RefreshCw,
} from 'lucide-react';

interface StateContextPanelProps {
  currentNodeId: string;
  nodes: Array<{ id: string; type?: string; data: any }>;
  edges: Array<{ source: string; target: string; data?: any }>;
  inputs: Record<string, any>;
  nodeExecutionStates: Record<string, { status: string; logs: string[]; lastRun?: Date }>;
  onRunUpstreamNode?: (nodeId: string) => void;
  onFieldInsert?: (fieldPath: string) => void;
}

interface StateNode {
  nodeId: string;
  nodeType: string;
  label: string;
  depth: number;
  hasOutput: boolean;
  output: any;
}

const NODE_ICONS: Record<string, React.ReactNode> = {
  serviceNode: <Globe className="w-3.5 h-3.5" />,
  decisionNode: <GitBranch className="w-3.5 h-3.5" />,
  llmNode: <Bot className="w-3.5 h-3.5" />,
  formNode: <FileText className="w-3.5 h-3.5" />,
  workflowNode: <Workflow className="w-3.5 h-3.5" />,
  parallelNode: <Layers className="w-3.5 h-3.5" />,
  mergeNode: <Zap className="w-3.5 h-3.5" />,
};

const NODE_COLORS: Record<string, string> = {
  serviceNode: 'bg-blue-100 text-blue-700 border-blue-200',
  decisionNode: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  llmNode: 'bg-green-100 text-green-700 border-green-200',
  formNode: 'bg-orange-100 text-orange-700 border-orange-200',
  workflowNode: 'bg-teal-100 text-teal-700 border-teal-200',
  parallelNode: 'bg-gray-100 text-gray-700 border-gray-200',
  mergeNode: 'bg-gray-100 text-gray-700 border-gray-200',
};

const getUpstreamNodes = (
  currentNodeId: string,
  nodes: StateContextPanelProps['nodes'],
  edges: StateContextPanelProps['edges']
): string[] => {
  const visited = new Set<string>();
  const order: string[] = [];

  const traverse = (nodeId: string, depth = 0) => {
    if (visited.has(nodeId) || depth > 20) return;
    visited.add(nodeId);

    const incomingEdges = edges.filter(e => e.target === nodeId);
    for (const edge of incomingEdges) {
      traverse(edge.source, depth + 1);
    }

    if (nodeId !== currentNodeId) {
      order.push(nodeId);
    }
  };

  traverse(currentNodeId);
  return order;
};

const extractOutputFromLogs = (logs: string[]): any => {
  for (let i = logs.length - 1; i >= 0; i--) {
    const line = logs[i];
    if (line.includes('Response:') || line.includes('Result:')) continue;
    try {
      const parsed = JSON.parse(line);
      return parsed;
    } catch {}
    const trimmed = line.replace(/^\[\d{4}-\d{2}-\d{2}T.*?\]\s*/, '').trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        return JSON.parse(trimmed);
      } catch {}
    }
  }
  return null;
};

const getFieldPaths = (obj: any, prefix = ''): Array<{ path: string; value: any; type: string }> => {
  if (!obj || typeof obj !== 'object') return [];
  const result: Array<{ path: string; value: any; type: string }> = [];

  const traverse = (current: any, currentPath: string) => {
    for (const key in current) {
      const fullPath = currentPath ? `${currentPath}.${key}` : key;
      const val = current[key];
      const type = Array.isArray(val) ? 'array' : typeof val;

      result.push({ path: fullPath, value: val, type });

      if (val && typeof val === 'object' && !Array.isArray(val) && Object.keys(val).length > 0) {
        traverse(val, fullPath);
      }
    }
  };

  traverse(obj, prefix);
  return result;
};

const ValuePreview: React.FC<{ value: any; type: string }> = ({ value, type }) => {
  if (value === null || value === undefined) {
    return <span className="text-gray-400 italic text-xs">null</span>;
  }
  if (type === 'string') {
    const truncated = value.length > 30 ? value.substring(0, 30) + '...' : value;
    return <span className="text-green-600 text-xs font-mono">"{truncated}"</span>;
  }
  if (type === 'number' || type === 'boolean') {
    return <span className="text-blue-600 text-xs font-mono">{String(value)}</span>;
  }
  if (type === 'array') {
    return <span className="text-orange-500 text-xs font-mono">[{(value as any[]).length} items]</span>;
  }
  if (type === 'object') {
    const keys = Object.keys(value);
    return <span className="text-gray-500 text-xs font-mono">{`{${keys.slice(0, 2).join(', ')}${keys.length > 2 ? '...' : ''}}`}</span>;
  }
  return <span className="text-gray-600 text-xs">{String(value)}</span>;
};

const JsonTreeNode: React.FC<{
  keyName: string;
  value: any;
  depth: number;
  pathPrefix: string;
  onCopyPath: (path: string) => void;
  onInsertField?: (path: string) => void;
  searchTerm: string;
}> = ({ keyName, value, depth, pathPrefix, onCopyPath, onInsertField, searchTerm }) => {
  const [isOpen, setIsOpen] = useState(depth < 2);
  const fullPath = pathPrefix ? `${pathPrefix}.${keyName}` : keyName;
  const isObject = value && typeof value === 'object' && !Array.isArray(value);
  const isArray = Array.isArray(value);
  const isComplex = isObject || isArray;
  const matchesSearch = searchTerm
    ? fullPath.toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(value).toLowerCase().includes(searchTerm.toLowerCase())
    : true;

  if (!matchesSearch && !isComplex) return null;

  return (
    <div className={`${depth > 0 ? 'ml-3 border-l border-gray-100' : ''}`}>
      <div
        className={`group flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-50 cursor-pointer transition-colors ${
          matchesSearch && searchTerm ? 'bg-yellow-50' : ''
        }`}
        onClick={() => isComplex && setIsOpen(!isOpen)}
      >
        {isComplex ? (
          isOpen ? (
            <ChevronDown className="w-3 h-3 text-gray-400 flex-shrink-0" />
          ) : (
            <ChevronRight className="w-3 h-3 text-gray-400 flex-shrink-0" />
          )
        ) : (
          <span className="w-3 h-3 flex-shrink-0" />
        )}

        <span className="text-xs font-medium text-gray-700 font-mono">{keyName}</span>
        <span className="text-gray-400 text-xs">:</span>

        {!isComplex && (
          <ValuePreview value={value} type={Array.isArray(value) ? 'array' : typeof value} />
        )}

        {isArray && (
          <span className="text-xs text-orange-500 font-mono">[{value.length}]</span>
        )}

        {isObject && (
          <span className="text-xs text-gray-400 font-mono">{`{${Object.keys(value).length}}`}</span>
        )}

        <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCopyPath(`{input.${fullPath}}`);
            }}
            className="p-0.5 hover:bg-gray-200 rounded transition-colors"
            title="Copy path"
          >
            <Copy className="w-3 h-3 text-gray-500" />
          </button>
          {onInsertField && !isComplex && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onInsertField(`{input.${fullPath}}`);
              }}
              className="px-1.5 py-0.5 bg-blue-500 hover:bg-blue-600 text-white rounded text-xs font-medium transition-colors"
              title="Insert into request body"
            >
              Insert
            </button>
          )}
        </div>
      </div>

      {isComplex && isOpen && (
        <div className="pl-1">
          {isObject &&
            Object.entries(value).map(([k, v]) => (
              <JsonTreeNode
                key={k}
                keyName={k}
                value={v}
                depth={depth + 1}
                pathPrefix={fullPath}
                onCopyPath={onCopyPath}
                onInsertField={onInsertField}
                searchTerm={searchTerm}
              />
            ))}
          {isArray &&
            (value as any[]).slice(0, 10).map((item, i) => (
              <JsonTreeNode
                key={i}
                keyName={String(i)}
                value={item}
                depth={depth + 1}
                pathPrefix={fullPath}
                onCopyPath={onCopyPath}
                onInsertField={onInsertField}
                searchTerm={searchTerm}
              />
            ))}
          {isArray && value.length > 10 && (
            <div className="ml-4 py-1 text-xs text-gray-400 italic">
              ...{value.length - 10} more items
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const StateContextPanel: React.FC<StateContextPanelProps> = ({
  currentNodeId,
  nodes,
  edges,
  inputs,
  nodeExecutionStates,
  onRunUpstreamNode,
  onFieldInsert,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const [activeSource, setActiveSource] = useState<'inputs' | string>('inputs');
  const [runningNodeId, setRunningNodeId] = useState<string | null>(null);

  const upstreamNodeIds = getUpstreamNodes(currentNodeId, nodes, edges);

  const upstreamNodes: StateNode[] = upstreamNodeIds.map((nodeId, idx) => {
    const node = nodes.find(n => n.id === nodeId);
    const execState = nodeExecutionStates[nodeId];
    const output = execState?.logs ? extractOutputFromLogs(execState.logs) : null;

    return {
      nodeId,
      nodeType: node?.type || 'serviceNode',
      label: (node?.data as any)?.label || nodeId,
      depth: idx,
      hasOutput: !!output,
      output,
    };
  });

  const handleCopyPath = useCallback((path: string) => {
    navigator.clipboard.writeText(path).catch(() => {});
    setCopiedPath(path);
    setTimeout(() => setCopiedPath(null), 2000);
  }, []);

  const handleRunNode = useCallback(
    async (nodeId: string) => {
      if (!onRunUpstreamNode) return;
      setRunningNodeId(nodeId);
      await onRunUpstreamNode(nodeId);
      setRunningNodeId(null);
    },
    [onRunUpstreamNode]
  );

  const activeData =
    activeSource === 'inputs'
      ? inputs
      : upstreamNodes.find(n => n.nodeId === activeSource)?.output || null;

  const allFields = activeData ? getFieldPaths(activeData) : [];
  const visibleLeafFields = allFields.filter(
    f =>
      f.type !== 'object' &&
      (searchTerm
        ? f.path.toLowerCase().includes(searchTerm.toLowerCase()) ||
          String(f.value).toLowerCase().includes(searchTerm.toLowerCase())
        : true)
  );

  return (
    <div className="flex flex-col h-full bg-white border-r border-gray-200 select-none" style={{ width: 280 }}>
      <div className="px-4 pt-4 pb-3 border-b border-gray-100">
        <div className="flex items-center gap-2 mb-1">
          <Layers className="w-4 h-4 text-blue-600" />
          <h3 className="text-sm font-bold text-gray-800">State Context</h3>
          <div className="ml-auto">
            {copiedPath && (
              <span className="flex items-center gap-1 text-xs text-green-600 font-medium animate-fade-in">
                <CheckCircle2 className="w-3 h-3" /> Copied!
              </span>
            )}
          </div>
        </div>
        <p className="text-xs text-gray-500 leading-tight">
          Data available <strong>before</strong> this node runs
        </p>
      </div>

      <div className="px-3 py-2 border-b border-gray-100">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="Search fields..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-7 pr-7 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400 bg-gray-50"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="absolute right-2 top-1/2 -translate-y-1/2">
              <X className="w-3 h-3 text-gray-400 hover:text-gray-600" />
            </button>
          )}
        </div>
      </div>

      <div className="px-3 py-2 border-b border-gray-100">
        <p className="text-xs text-gray-400 uppercase font-semibold tracking-wide mb-2">Sources</p>
        <div className="space-y-1">
          <button
            onClick={() => setActiveSource('inputs')}
            className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-left transition-colors ${
              activeSource === 'inputs'
                ? 'bg-blue-50 border border-blue-200 text-blue-700'
                : 'hover:bg-gray-50 text-gray-600 border border-transparent'
            }`}
          >
            <div className="w-5 h-5 rounded bg-blue-100 flex items-center justify-center flex-shrink-0">
              <Layers className="w-3 h-3 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate">Workflow Input</p>
              <p className="text-xs text-gray-400 truncate">
                {Object.keys(inputs).length} root keys
              </p>
            </div>
            <span className="px-1.5 py-0.5 bg-blue-100 text-blue-600 text-xs rounded font-medium">
              base
            </span>
          </button>

          {upstreamNodes.length === 0 ? (
            <div className="flex items-center gap-2 px-2.5 py-2 rounded-md text-gray-400">
              <Info className="w-3.5 h-3.5 flex-shrink-0" />
              <p className="text-xs italic">No upstream nodes yet</p>
            </div>
          ) : (
            upstreamNodes.map((sn, idx) => {
              const execState = nodeExecutionStates[sn.nodeId];
              const isRunning = runningNodeId === sn.nodeId || execState?.status === 'running';
              const hasSucceeded = execState?.status === 'success';
              const hasFailed = execState?.status === 'failed';

              return (
                <div key={sn.nodeId} className="group">
                  <button
                    onClick={() => setActiveSource(sn.nodeId)}
                    className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-left transition-colors ${
                      activeSource === sn.nodeId
                        ? 'bg-blue-50 border border-blue-200 text-blue-700'
                        : 'hover:bg-gray-50 text-gray-600 border border-transparent'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border ${
                        NODE_COLORS[sn.nodeType] || 'bg-gray-100 text-gray-600 border-gray-200'
                      }`}
                    >
                      {NODE_ICONS[sn.nodeType] || <Globe className="w-3.5 h-3.5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate">{sn.label}</p>
                      <p className="text-xs text-gray-400 truncate capitalize">
                        {sn.nodeType.replace('Node', '')} node
                      </p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {isRunning && <Loader2 className="w-3 h-3 text-blue-500 animate-spin" />}
                      {!isRunning && hasSucceeded && sn.hasOutput && (
                        <CheckCircle2 className="w-3 h-3 text-green-500" />
                      )}
                      {!isRunning && hasSucceeded && !sn.hasOutput && (
                        <CheckCircle2 className="w-3 h-3 text-green-400 opacity-60" />
                      )}
                      {!isRunning && hasFailed && (
                        <AlertCircle className="w-3 h-3 text-red-500" />
                      )}
                      {!isRunning && !execState && onRunUpstreamNode && (
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            handleRunNode(sn.nodeId);
                          }}
                          className="p-0.5 rounded hover:bg-blue-100 text-gray-400 hover:text-blue-600 transition-colors opacity-0 group-hover:opacity-100"
                          title={`Run ${sn.label} to see output`}
                        >
                          <Play className="w-3 h-3" />
                        </button>
                      )}
                      {!isRunning && execState && onRunUpstreamNode && (
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            handleRunNode(sn.nodeId);
                          }}
                          className="p-0.5 rounded hover:bg-blue-100 text-gray-400 hover:text-blue-600 transition-colors opacity-0 group-hover:opacity-100"
                          title="Re-run node"
                        >
                          <RefreshCw className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {!activeData ? (
          <div className="flex flex-col items-center justify-center h-40 px-4 text-center">
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mb-3">
              <Play className="w-5 h-5 text-gray-400" />
            </div>
            <p className="text-xs font-semibold text-gray-600 mb-1">No Output Yet</p>
            <p className="text-xs text-gray-400 leading-tight">
              {upstreamNodes.length > 0
                ? 'Run the upstream node to see its output data here'
                : 'Only workflow input is available'}
            </p>
          </div>
        ) : (
          <div className="p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-gray-400 uppercase font-semibold tracking-wide">
                {activeSource === 'inputs' ? 'Workflow Input' : 'Node Output'}
              </p>
              {visibleLeafFields.length > 0 && (
                <span className="text-xs text-gray-400">{visibleLeafFields.length} fields</span>
              )}
            </div>

            {Object.keys(activeData).length === 0 ? (
              <div className="text-xs text-gray-400 italic text-center py-4">Empty object</div>
            ) : (
              <div className="rounded-md border border-gray-100 bg-gray-50 overflow-hidden">
                {Object.entries(activeData).map(([key, value]) => (
                  <JsonTreeNode
                    key={key}
                    keyName={key}
                    value={value}
                    depth={0}
                    pathPrefix=""
                    onCopyPath={handleCopyPath}
                    onInsertField={onFieldInsert}
                    searchTerm={searchTerm}
                  />
                ))}
              </div>
            )}

            {searchTerm && visibleLeafFields.length === 0 && (
              <div className="text-xs text-gray-400 italic text-center py-4">
                No fields match "{searchTerm}"
              </div>
            )}
          </div>
        )}

        {activeData && (
          <div className="px-3 pb-4">
            <div className="mt-1 p-2.5 bg-blue-50 rounded-md border border-blue-100">
              <p className="text-xs text-blue-700 font-semibold mb-1">How to use</p>
              <p className="text-xs text-blue-600 leading-tight">
                Click <strong>Insert</strong> to add a field reference, or drag a field to the request body. Use format:{' '}
                <code className="bg-blue-100 px-1 rounded font-mono">{'{input.field}'}</code>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
