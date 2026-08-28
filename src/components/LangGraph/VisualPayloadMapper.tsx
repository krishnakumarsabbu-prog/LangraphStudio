import React, { useState, useMemo } from 'react';
import { Sparkles, Layers, Wand2, Database, GripVertical, Check, RefreshCw, ArrowRight, CornerDownRight, FileCode, Package, Inbox, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '../ui/button';
import { useLangGraphStore } from '../../stores/langGraphStore';
import toast from 'react-hot-toast';

interface VisualPayloadMapperProps {
  initialRequestBody: string;
  onChange: (newJson: string) => void;
  initialInputs?: Record<string, any>;
}

export interface PayloadFieldItem {
  id: string;
  key: string;
  path: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  value: string;
  children?: PayloadFieldItem[];
}

export interface NodeVariableGroup {
  nodeId: string;
  nodeLabel: string;
  type: string;
  tokens: Array<{ fieldPath: string; token: string; label: string }>;
}

/**
 * Dynamically extracts all nested keys from a JSON object or stringified JSON
 */

const extractDynamicKeysFromObject = (obj: any, prefix = ''): string[] => {
  if (!obj) return [];
  let parsed = obj;
  if (typeof obj === 'string') {
    try {
      parsed = JSON.parse(obj);
    } catch {
      return [];
    }
  }
  if (typeof parsed !== 'object' || parsed === null) return [];

  let keys: string[] = [];
  for (const k in parsed) {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    keys.push(fullKey);

    const val = parsed[k];
    if (val && typeof val === 'object') {
      if (Array.isArray(val)) {
        val.forEach((item: any) => {
          if (item && typeof item === 'object') {
            const subKeys = extractDynamicKeysFromObject(item, fullKey);
            keys = keys.concat(subKeys);
          }
        });
      } else {
        keys = keys.concat(extractDynamicKeysFromObject(val, fullKey));
      }
    }
  }
  return Array.from(new Set(keys));
};

export const VisualPayloadMapper: React.FC<VisualPayloadMapperProps> = ({
  initialRequestBody,
  onChange,
  initialInputs,
}) => {
  const { nodes, edges, selectedNodeId, inputs } = useLangGraphStore();
  const [pasteInput, setPasteInput] = useState('');
  const [draggedToken, setDraggedToken] = useState<string | null>(null);

  // Group Upstream Preceding Node Variables Service-Wise (Strictly Dynamic)
  const upstreamGroupedVariables = useMemo<NodeVariableGroup[]>(() => {
    const groups: NodeVariableGroup[] = [];

    // 1. Initial Inputs Group (Dynamic from store inputs, initialInputs prop & workflowConfig)
    const inputTokens: Array<{ fieldPath: string; token: string; label: string }> = [];
    const inputSources: any[] = [];
    if (inputs && typeof inputs === 'object') {
      inputSources.push(inputs);
    }
    if (initialInputs && typeof initialInputs === 'object') {
      inputSources.push(initialInputs);
    }
    nodes.forEach((n) => {
      if (n.data?.workflowConfig?.requestMapping) {
        inputSources.push(n.data.workflowConfig.requestMapping);
      }
    });

    let allInputKeys: string[] = [];
    inputSources.forEach((src) => {
      const keys = extractDynamicKeysFromObject(src);
      allInputKeys = allInputKeys.concat(keys);
    });
    allInputKeys = Array.from(new Set(allInputKeys));

    allInputKeys.forEach((k) => {
      inputTokens.push({
        fieldPath: `input.${k}`,
        token: `{input.${k}}`,
        label: k,
      });
    });

    if (inputTokens.length > 0) {
      groups.push({
        nodeId: 'input',
        nodeLabel: '📥 Workflow Initial Inputs',
        type: 'input',
        tokens: inputTokens,
      });
    }

    // 2. Preceding Nodes connected strictly via incoming edges to selectedNodeId
    if (selectedNodeId) {
      const incomingEdges = edges.filter((e) => e.target === selectedNodeId);
      const incomingSourceIds = incomingEdges.map((e) => e.source);
      const precedingNodes = nodes.filter((n) => incomingSourceIds.includes(n.id) && n.id !== selectedNodeId);

      precedingNodes.forEach((n) => {
        const nodeTokens: Array<{ fieldPath: string; token: string; label: string }> = [];

        // Extract dynamic keys from requestBody, responseBody, workflowConfig, etc.
        const reqBodyKeys = extractDynamicKeysFromObject(n.data?.requestBody || n.data?.workflowConfig?.requestBody);
        const respBodyKeys = extractDynamicKeysFromObject(n.data?.responseBody || n.data?.outputs);

        const allNodeKeys = Array.from(new Set([...reqBodyKeys, ...respBodyKeys]));

        allNodeKeys.forEach((f) => {
          nodeTokens.push({
            fieldPath: `${n.id}.${f}`,
            token: `{${n.id}.${f}}`,
            label: `${f}`,
          });
        });

        groups.push({
          nodeId: n.id,
          nodeLabel: `🔹 ${n.data.label || n.id}`,
          type: n.type,
          tokens: nodeTokens,
        });
      });
    }

    return groups;
  }, [nodes, edges, selectedNodeId, inputs]);

  // Flat tokens list for easy dropdown mapping
  const allTokens = useMemo(() => {
    const flat: Array<{ token: string; nodeLabel: string }> = [];
    upstreamGroupedVariables.forEach((g) => {
      g.tokens.forEach((t) => {
        flat.push({ token: t.token, nodeLabel: g.nodeLabel });
      });
    });
    return flat;
  }, [upstreamGroupedVariables]);

  // Helper to parse JSON into PayloadFieldItem recursive tree
  const parseJsonToTree = (obj: any, pathPrefix = ''): PayloadFieldItem[] => {
    if (!obj || typeof obj !== 'object') return [];

    return Object.keys(obj).map((key, idx) => {
      const val = obj[key];
      const currentPath = pathPrefix ? `${pathPrefix}.${key}` : key;
      const itemId = `field-${currentPath}-${idx}`;

      if (Array.isArray(val)) {
        const arrayChildren: PayloadFieldItem[] = [];
        val.forEach((item, arrIdx) => {
          const itemPath = `${currentPath}[${arrIdx}]`;
          if (item !== null && typeof item === 'object') {
            arrayChildren.push({
              id: `field-${itemPath}-${arrIdx}`,
              key: `Item [${arrIdx + 1}]`,
              path: itemPath,
              type: 'object',
              value: '',
              children: parseJsonToTree(item, itemPath),
            });
          } else {
            arrayChildren.push({
              id: `field-${itemPath}-${arrIdx}`,
              key: `Item [${arrIdx + 1}]`,
              path: itemPath,
              type: typeof item as any,
              value: String(item),
            });
          }
        });

        return {
          id: itemId,
          key,
          path: currentPath,
          type: 'array',
          value: '',
          children: arrayChildren,
        };
      }

      if (val !== null && typeof val === 'object') {
        return {
          id: itemId,
          key,
          path: currentPath,
          type: 'object',
          value: '',
          children: parseJsonToTree(val, currentPath),
        };
      }

      let type: PayloadFieldItem['type'] = 'string';
      if (typeof val === 'number') type = 'number';
      else if (typeof val === 'boolean') type = 'boolean';

      return {
        id: itemId,
        key,
        path: currentPath,
        type,
        value: typeof val === 'string' ? val : JSON.stringify(val),
      };
    });
  };

  // Convert tree back into JSON object
  const compileTreeToJsonObj = (items: PayloadFieldItem[]): Record<string, any> => {
    const result: Record<string, any> = {};

    items.forEach((item) => {
      if (item.type === 'object' && item.children) {
        result[item.key] = compileTreeToJsonObj(item.children);
      } else if (item.type === 'array' && item.children) {
        result[item.key] = item.children.map((child) => {
          if (child.type === 'object' && child.children) {
            return compileTreeToJsonObj(child.children);
          }
          if (child.type === 'number') {
            const num = parseFloat(child.value);
            return isNaN(num) ? child.value : num;
          }
          if (child.type === 'boolean') {
            return child.value === 'true' || child.value === '1';
          }
          return child.value;
        });
      } else if (item.type === 'number') {
        const num = parseFloat(item.value);
        result[item.key] = isNaN(num) ? item.value : num;
      } else if (item.type === 'boolean') {
        result[item.key] = item.value === 'true' || item.value === '1';
      } else {
        result[item.key] = item.value;
      }
    });

    return result;
  };

  // Initial tree state from initialRequestBody - CLEAN default state
  const [treeData, setTreeData] = useState<PayloadFieldItem[]>(() => {
    try {
      if (initialRequestBody && initialRequestBody.trim()) {
        const parsed = JSON.parse(initialRequestBody);
        return parseJsonToTree(parsed);
      }
    } catch {
      // Invalid JSON -> return empty tree
    }
    return [];
  });

  // Sync tree modifications to parent JSON string
  const updateTreeAndSync = (newTree: PayloadFieldItem[]) => {
    setTreeData(newTree);
    const jsonObj = compileTreeToJsonObj(newTree);
    const jsonStr = JSON.stringify(jsonObj, null, 2);
    onChange(jsonStr);
  };

  // Recursive update helper for nested paths
  const updateFieldValueInTree = (
    items: PayloadFieldItem[],
    targetPath: string,
    newValue: string
  ): PayloadFieldItem[] => {
    return items.map((item) => {
      if (item.path === targetPath) {
        return { ...item, value: newValue };
      }
      if (item.children) {
        return { ...item, children: updateFieldValueInTree(item.children, targetPath, newValue) };
      }
      return item;
    });
  };

  // Parse pasted sample JSON
  const handleParseSampleJson = () => {
    if (!pasteInput.trim()) {
      toast.error('Please paste sample request JSON to parse');
      return;
    }

    try {
      const parsed = JSON.parse(pasteInput);
      const newTree = parseJsonToTree(parsed);
      updateTreeAndSync(newTree);
      toast.success('Sample JSON parsed into visual nested tree!');
    } catch (e: any) {
      toast.error(`Invalid JSON: ${e.message}`);
    }
  };

  // Auto-map matching field names
  const handleAutoMapMatchingFields = () => {
    if (treeData.length === 0) {
      toast.error('Tree is empty. Parse sample JSON first!');
      return;
    }

    let matchCount = 0;

    const autoMapRecursive = (items: PayloadFieldItem[]): PayloadFieldItem[] => {
      return items.map((item) => {
        if (item.children) {
          return { ...item, children: autoMapRecursive(item.children) };
        }

        const matchedVar = allTokens.find(
          (v) =>
            v.token.toLowerCase().endsWith(`.${item.key.toLowerCase()}}`) ||
            v.token.toLowerCase().includes(`.${item.key.toLowerCase()}`)
        );

        if (matchedVar) {
          matchCount++;
          return { ...item, value: matchedVar.token };
        }
        return item;
      });
    };

    const mappedTree = autoMapRecursive(treeData);
    updateTreeAndSync(mappedTree);

    if (matchCount > 0) {
      toast.success(`Auto-mapped ${matchCount} matching field(s)!`);
    } else {
      toast.error('No matching dynamic field names found to auto-map');
    }
  };

  // Drag & drop handlers
  const handleDragStartToken = (token: string) => {
    setDraggedToken(token);
  };

  const handleDropTokenOnField = (e: React.DragEvent, fieldPath: string) => {
    e.preventDefault();
    if (draggedToken) {
      const newTree = updateFieldValueInTree(treeData, fieldPath, draggedToken);
      updateTreeAndSync(newTree);
      toast.success(`Mapped ${draggedToken} to ${fieldPath}`);
      setDraggedToken(null);
    }
  };

  const [collapsedNodes, setCollapsedNodes] = useState<Record<string, boolean>>({});

  const toggleNodeCollapse = (nodeId: string) => {
    setCollapsedNodes((prev) => ({ ...prev, [nodeId]: !prev[nodeId] }));
  };

  // Recursive Tree Node Renderer component
  const renderTreeNodes = (items: PayloadFieldItem[], level = 0) => {
    return items.map((item) => {
      const isContainer = item.type === 'object' || item.type === 'array';
      const isCollapsed = !!collapsedNodes[item.id];
      const isArray = item.type === 'array';
      const indentOffset = Math.min(level * 16, 64);

      if (isContainer) {
        return (
          <div key={item.id} className="space-y-2">
            <div
              onClick={() => toggleNodeCollapse(item.id)}
              className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between gap-3 ${
                isArray
                  ? 'bg-indigo-50/80 text-indigo-950 border-indigo-200 shadow-sm hover:bg-indigo-100/90'
                  : 'bg-amber-50/80 text-amber-950 border-amber-200 shadow-sm hover:bg-amber-100/90'
              }`}
              style={{ marginLeft: `${indentOffset}px` }}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {isCollapsed ? (
                  <ChevronRight className={`w-4 h-4 shrink-0 ${isArray ? 'text-indigo-600' : 'text-amber-600'}`} />
                ) : (
                  <ChevronDown className={`w-4 h-4 shrink-0 ${isArray ? 'text-indigo-600' : 'text-amber-600'}`} />
                )}
                <span
                  title={item.key}
                  className={`font-mono text-xs font-bold px-2.5 py-0.5 rounded border truncate max-w-[180px] ${
                    isArray ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-amber-600 text-white border-amber-700'
                  }`}
                >
                  {item.key}
                </span>
                <span
                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border shrink-0 ${
                    isArray ? 'bg-indigo-100 text-indigo-800 border-indigo-200' : 'bg-amber-100 text-amber-800 border-amber-200'
                  }`}
                >
                  {isArray ? 'ARRAY' : 'OBJECT'} ({item.children?.length || 0} items)
                </span>
              </div>

              <div
                title={item.path}
                className={`text-[11px] font-mono font-medium truncate max-w-[220px] ${
                  isArray ? 'text-indigo-600' : 'text-amber-700'
                }`}
              >
                Path: {item.path}
              </div>
            </div>

            {!isCollapsed && item.children && item.children.length > 0 && (
              <div className="space-y-2 border-l-2 border-slate-200 pl-3 ml-2">
                {renderTreeNodes(item.children, level + 1)}
              </div>
            )}
          </div>
        );
      }

      return (
        <div key={item.id} className="space-y-2">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleDropTokenOnField(e, item.path)}
            className="p-3 rounded-xl border border-gray-200 bg-white hover:border-amber-400 hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-3"
            style={{ marginLeft: `${indentOffset}px` }}
          >
            {/* Left Side: Key Label & Type Pill */}
            <div className="flex items-center gap-2 min-w-[200px] shrink-0">
              {level > 0 && <CornerDownRight className="w-3.5 h-3.5 text-gray-400 shrink-0" />}
              <span
                title={item.path}
                className="font-mono text-xs font-bold text-gray-900 bg-gray-100 px-2.5 py-1 rounded-lg border border-gray-300 truncate max-w-[180px]"
              >
                {item.key}
              </span>
              <span className="text-[10px] font-mono text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded uppercase">
                {item.type}
              </span>
            </div>

            {/* Right Side: Token Dropdown & Value Input Box */}
            <div className="flex-1 flex flex-col sm:flex-row items-center gap-2 min-w-0">
              <select
                value={allTokens.some((v) => v.token === item.value) ? item.value : '__custom__'}
                onChange={(e) => {
                  const selectedVal = e.target.value;
                  if (selectedVal !== '__custom__') {
                    const newTree = updateFieldValueInTree(treeData, item.path, selectedVal);
                    updateTreeAndSync(newTree);
                  }
                }}
                className="w-full sm:w-56 px-2.5 py-1.5 text-xs font-mono font-semibold bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:ring-1 focus:ring-amber-500 truncate"
              >
                <option value="__custom__">⚙️ Custom / Static Value</option>
                {upstreamGroupedVariables.map((group) => (
                  <optgroup key={group.nodeId} label={group.nodeLabel}>
                    {group.tokens.map((v) => (
                      <option key={v.token} value={v.token}>
                        {v.token}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>

              <input
                type="text"
                value={item.value}
                onChange={(e) => {
                  const newTree = updateFieldValueInTree(treeData, item.path, e.target.value);
                  updateTreeAndSync(newTree);
                }}
                placeholder="Drop token or enter value..."
                className={`w-full flex-1 px-3 py-1.5 text-xs font-mono border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 ${
                  item.value.startsWith('{') && item.value.endsWith('}')
                    ? 'bg-amber-50 border-amber-300 text-amber-900 font-bold'
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
              />
            </div>
          </div>
        </div>
      );
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Actions */}
      <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 text-slate-900 border border-amber-200/80 p-5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center border border-amber-500/30">
            <Sparkles className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h3 className="text-base font-bold flex items-center gap-2 text-slate-900">
              Visual Service Payload Mapper
              <span className="text-[10px] bg-green-100 text-green-800 px-2 py-0.5 rounded font-bold border border-green-200">
                100% Dynamic Tokens
              </span>
            </h3>
            <p className="text-xs text-slate-600 mt-0.5">
              Paste target sample JSON to build nested fields, then drag dynamic output tokens from preceding connected nodes.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            onClick={handleAutoMapMatchingFields}
            className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs gap-1.5 px-4 py-2 shadow-sm"
          >
            <Wand2 className="w-3.5 h-3.5" />
            1-Click Auto-Map Fields
          </Button>
        </div>
      </div>

      {/* Main Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Sidebar: Preceding Connected Node Tokens */}
        <div className="lg:col-span-4 bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-gray-200 pb-3">
            <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
              <Database className="w-4 h-4 text-amber-600" />
              Dynamic Upstream Tokens
            </h4>
            <span className="text-[10px] bg-amber-100 text-amber-800 font-mono font-bold px-2 py-0.5 rounded">
              {allTokens.length} Tokens
            </span>
          </div>

          {upstreamGroupedVariables.length > 0 && allTokens.length > 0 ? (
            <div className="space-y-4 max-h-[460px] overflow-y-auto pr-1">
              {upstreamGroupedVariables.map((group) => {
                if (group.tokens.length === 0) return null;
                return (
                  <div key={group.nodeId} className="space-y-2 border-b border-gray-100 pb-3 last:border-0">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-gray-800 bg-gray-100 px-2.5 py-1 rounded-lg border border-gray-200">
                      <Package className="w-3.5 h-3.5 text-amber-600" />
                      {group.nodeLabel}
                    </div>

                    <div className="space-y-1.5 pl-1">
                      {group.tokens.map((v) => (
                        <div
                          key={v.token}
                          draggable
                          onDragStart={() => handleDragStartToken(v.token)}
                          className="p-2.5 bg-gray-50 hover:bg-amber-50 border border-gray-200 hover:border-amber-400 rounded-xl cursor-grab active:cursor-grabbing transition-all flex items-center justify-between group shadow-sm"
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <GripVertical className="w-3.5 h-3.5 text-gray-400 group-hover:text-amber-600 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <span
                                title={v.token}
                                className="font-mono text-xs font-bold text-gray-900 group-hover:text-amber-950 block truncate"
                              >
                                {v.token}
                              </span>
                              <span title={v.label} className="text-[10px] text-gray-500 font-mono block truncate">
                                {v.label}
                              </span>
                            </div>
                          </div>
                          <ArrowRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-amber-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-1" />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-6 text-center border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/50 space-y-2">
              <Inbox className="w-8 h-8 text-gray-400 mx-auto" />
              <h5 className="text-xs font-bold text-gray-700">No Upstream Connected Tokens</h5>
              <p className="text-[11px] text-gray-500">
                Connect preceding service nodes to this node in the graph, or configure global workflow inputs to pass dynamic output tokens.
              </p>
            </div>
          )}
        </div>

        {/* Right Section: Sample JSON Paste + Visual Nested Field Tree */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-gray-50 p-5 rounded-2xl border border-gray-200 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                <FileCode className="w-4 h-4 text-blue-600" />
                Paste Target Sample Request JSON
              </label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleParseSampleJson}
                className="text-xs font-bold gap-1 bg-white"
              >
                <RefreshCw className="w-3 h-3 text-blue-600" />
                Parse into Visual Tree
              </Button>
            </div>
            <textarea
              value={pasteInput}
              onChange={(e) => setPasteInput(e.target.value)}
              placeholder='Paste target request JSON e.g. { "user": { "id": "", "details": { "ssn": "" } } }'
              className="w-full h-24 p-3 font-mono text-xs border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white resize-none"
            />
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-gray-200 pb-3">
              <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-amber-500" />
                Nested Target Request Field Tree
              </h4>
              <span className="text-xs text-gray-500 font-mono">
                {treeData.length} Root Key(s)
              </span>
            </div>

            {treeData.length > 0 ? (
              <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
                {renderTreeNodes(treeData)}
              </div>
            ) : (
              <div className="p-10 text-center border-2 border-dashed border-gray-300 rounded-2xl bg-gray-50/50 space-y-3">
                <Inbox className="w-10 h-10 text-gray-400 mx-auto" />
                <h5 className="text-sm font-bold text-gray-800">No Request Body Schema Parsed Yet</h5>
                <p className="text-xs text-gray-500 max-w-md mx-auto">
                  Paste your target sample request JSON in the text area above and click{' '}
                  <span className="font-bold text-blue-600">"Parse into Visual Tree"</span> to generate your interactive target field tree.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
