import React, { useState, useMemo, useEffect } from 'react';
import { X, Sparkles, Database, FileCode, Wand2, Package, CornerDownRight, ChevronRight, ChevronDown, Check, RefreshCw, Layers, FileOutput, Code2 } from 'lucide-react';
import { Button } from '../ui/button';
import { useLangGraphStore } from '../../stores/langGraphStore';
import toast from 'react-hot-toast';

interface ObjectMapperModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodeId: string;
  nodeLabel: string;
  initialMapperConfig?: {
    outputFormat?: 'json' | 'xml';
    sampleResponse?: string;
    template?: string;
    mappings?: Record<string, string>;
  };
  onSave: (mapperConfig: {
    outputFormat: 'json' | 'xml';
    sampleResponse: string;
    template: string;
    mappings: Record<string, string>;
  }) => void;
}

interface TreeFieldItem {
  id: string;
  key: string;
  path: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'xml_tag';
  value: string;
  children?: TreeFieldItem[];
}

// Simple XML to Tree Parser Helper
function parseXmlToTree(xmlStr: string): TreeFieldItem[] {
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlStr, 'text/xml');
    if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
      return [];
    }

    const traverseDom = (element: Element, pathPrefix: string): TreeFieldItem => {
      const tagName = element.tagName;
      const currentPath = pathPrefix ? `${pathPrefix}.${tagName}` : tagName;

      const childrenNodes = Array.from(element.children);
      if (childrenNodes.length > 0) {
        return {
          id: currentPath,
          key: tagName,
          path: currentPath,
          type: 'xml_tag',
          value: '',
          children: childrenNodes.map((child, idx) => traverseDom(child, `${currentPath}[${idx}]`)),
        };
      }

      return {
        id: currentPath,
        key: tagName,
        path: currentPath,
        type: 'string',
        value: element.textContent?.trim() || '',
      };
    };

    if (xmlDoc.documentElement) {
      return [traverseDom(xmlDoc.documentElement, '')];
    }
  } catch (err) {
    console.error('XML parsing error:', err);
  }
  return [];
}

// Simple JSON to Tree Parser Helper
function parseJsonToTree(obj: any, pathPrefix = '', parentKey = 'root'): TreeFieldItem[] {
  if (obj === null || obj === undefined) return [];

  if (Array.isArray(obj)) {
    return obj.map((item, index) => {
      const currentPath = pathPrefix ? `${pathPrefix}[${index}]` : `[${index}]`;
      const itemKey = `Item [${index + 1}]`;

      if (typeof item === 'object' && item !== null) {
        return {
          id: currentPath,
          key: itemKey,
          path: currentPath,
          type: Array.isArray(item) ? 'array' : 'object',
          value: '',
          children: parseJsonToTree(item, currentPath, itemKey),
        };
      }
      return {
        id: currentPath,
        key: itemKey,
        path: currentPath,
        type: typeof item as any,
        value: String(item),
      };
    });
  }

  if (typeof obj === 'object') {
    return Object.entries(obj).map(([key, val]) => {
      const currentPath = pathPrefix ? `${pathPrefix}.${key}` : key;

      if (val !== null && typeof val === 'object') {
        const isArr = Array.isArray(val);
        return {
          id: currentPath,
          key,
          path: currentPath,
          type: isArr ? 'array' : 'object',
          value: '',
          children: parseJsonToTree(val, currentPath, key),
        };
      }

      return {
        id: currentPath,
        key,
        path: currentPath,
        type: typeof val as any,
        value: String(val ?? ''),
      };
    });
  }

  return [];
}

// Rebuild JSON template from tree
function compileTreeToJson(items: TreeFieldItem[]): any {
  const result: any = {};
  items.forEach((item) => {
    if (item.type === 'object' && item.children) {
      result[item.key] = compileTreeToJson(item.children);
    } else if (item.type === 'array' && item.children) {
      result[item.key] = item.children.map((child) =>
        child.type === 'object' && child.children
          ? compileTreeToJson(child.children)
          : child.value
      );
    } else {
      result[item.key] = item.value;
    }
  });
  return result;
}

// Rebuild XML template string from tree
function compileTreeToXml(items: TreeFieldItem[]): string {
  const buildXmlString = (nodes: TreeFieldItem[]): string => {
    return nodes
      .map((node) => {
        const tag = node.key;
        if (node.children && node.children.length > 0) {
          return `<${tag}>\n${buildXmlString(node.children)}\n</${tag}>`;
        }
        return `<${tag}>${node.value}</${tag}>`;
      })
      .join('\n');
  };
  return `<?xml version="1.0" encoding="UTF-8"?>\n${buildXmlString(items)}`;
}

export const ObjectMapperModal: React.FC<ObjectMapperModalProps> = ({
  isOpen,
  onClose,
  nodeId,
  nodeLabel,
  initialMapperConfig,
  onSave,
}) => {
  const { nodes, edges, inputs } = useLangGraphStore();

  const [outputFormat, setOutputFormat] = useState<'json' | 'xml'>(
    initialMapperConfig?.outputFormat || 'json'
  );
  const [sampleResponse, setSampleResponse] = useState<string>(
    initialMapperConfig?.sampleResponse ||
      (outputFormat === 'xml'
        ? '<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n  <Status>SUCCESS</Status>\n  <TransactionId></TransactionId>\n</Response>'
        : '{\n  "status": "SUCCESS",\n  "transactionId": "",\n  "resultDetails": {}\n}')
  );

  const [treeData, setTreeData] = useState<TreeFieldItem[]>([]);
  const [draggedToken, setDraggedToken] = useState<string | null>(null);
  const [collapsedNodes, setCollapsedNodes] = useState<Record<string, boolean>>({});
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [viewTab, setViewTab] = useState<'visual' | 'code'>('visual');

  // Collect dynamic tokens from upstream nodes
  // Collect dynamic tokens from ALL graph state variables (requests, responses, configs, status, inputs)
  const upstreamGroupedVariables = useMemo(() => {
    const extractKeys = (obj: any, prefix = ''): Array<{ token: string; label: string }> => {
      if (!obj || typeof obj !== 'object') return [];
      let results: Array<{ token: string; label: string }> = [];

      if (Array.isArray(obj)) {
        obj.forEach((item, index) => {
          const currentPrefix = `${prefix}[${index}]`;
          if (item !== null && typeof item === 'object') {
            results = results.concat(extractKeys(item, currentPrefix));
          } else {
            results.push({ token: `{${currentPrefix}}`, label: currentPrefix });
          }
        });
        return results;
      }

      Object.entries(obj).forEach(([key, val]) => {
        const currentPrefix = prefix ? `${prefix}.${key}` : key;
        if (val !== null && typeof val === 'object') {
          results = results.concat(extractKeys(val, currentPrefix));
        } else {
          results.push({ token: `{${currentPrefix}}`, label: currentPrefix });
        }
      });
      return results;
    };

    const groups: Array<{
      nodeId: string;
      nodeLabel: string;
      tokens: Array<{ token: string; label: string }>;
    }> = [];

    // 1. Initial Workflow State & Inputs
    if (inputs && Object.keys(inputs).length > 0) {
      const inputTokens = extractKeys(inputs, 'input');
      groups.push({
        nodeId: 'workflow_inputs',
        nodeLabel: '📥 Workflow Initial Inputs (input)',
        tokens: inputTokens,
      });
    } else {
      groups.push({
        nodeId: 'workflow_inputs',
        nodeLabel: '📥 Workflow Initial Inputs (input)',
        tokens: [
          { token: '{input.payload}', label: 'input.payload' },
          { token: '{input.userId}', label: 'input.userId' },
          { token: '{input.headers}', label: 'input.headers' },
        ],
      });
    }

    // 2. All Nodes in the Graph (request, response, status, config)
    const otherNodes = nodes.filter((n) => n.id !== nodeId);

    otherNodes.forEach((node) => {
      const labelStr = (node.data as any).label || node.id;
      const tokens: Array<{ token: string; label: string }> = [];

      // Status State
      tokens.push({ token: `{${node.id}.status}`, label: `${node.id}.status` });

      // Request State
      let reqObj: any = null;
      const reqRaw = (node.data as any).config?.requestBody || (node.data as any).requestBody;
      if (reqRaw) {
        try {
          reqObj = typeof reqRaw === 'string' ? JSON.parse(reqRaw) : reqRaw;
        } catch {
          reqObj = { body: reqRaw };
        }
      }
      if (!reqObj) {
        reqObj = { payload: {}, params: {} };
      }
      const reqTokens = extractKeys(reqObj, `${node.id}.request`);
      tokens.push(...reqTokens);

      // Response State
      let respObj: any = null;
      const respRaw = (node.data as any).config?.responseBody || (node.data as any).responseBody || (node.data as any).outputs;
      if (respRaw) {
        try {
          respObj = typeof respRaw === 'string' ? JSON.parse(respRaw) : respRaw;
        } catch {
          respObj = { result: respRaw };
        }
      }
      if (!respObj) {
        if (node.type === 'serviceNode') {
          respObj = { status: 'SUCCESS', credit_score: 750, data: {} };
        } else if (node.type === 'decisionNode') {
          respObj = { selectedPath: 'default', score: 100, approved: true };
        } else if (node.type === 'llmNode') {
          respObj = { text: 'AI Response', usage: { promptTokens: 10, completionTokens: 20 } };
        } else if (node.type === 'formNode') {
          respObj = { formData: {}, submittedAt: '' };
        } else {
          respObj = { status: 'OK', result: {} };
        }
      }
      const respTokens = extractKeys(respObj, `${node.id}.response`);
      tokens.push(...respTokens);

      // Config & Custom Node State
      const nodeConfig = (node.data as any).config;
      if (nodeConfig && typeof nodeConfig === 'object') {
        const configTokens = extractKeys(nodeConfig, `${node.id}.config`);
        tokens.push(...configTokens);
      }

      groups.push({
        nodeId: node.id,
        nodeLabel: `🔹 ${labelStr} (${node.id})`,
        tokens,
      });
    });

    return groups;
  }, [nodes, inputs, nodeId]);

  const allTokens = useMemo(() => {
    return upstreamGroupedVariables.flatMap((g) => g.tokens);
  }, [upstreamGroupedVariables]);

  // Parse target sample response into visual tree
  const handleParseSampleToTree = () => {
    if (!sampleResponse.trim()) {
      toast.error('Please paste a sample JSON or XML payload first');
      return;
    }

    if (outputFormat === 'xml') {
      const parsedXml = parseXmlToTree(sampleResponse);
      if (parsedXml.length === 0) {
        toast.error('Invalid XML syntax. Please check your sample XML');
        return;
      }
      setTreeData(parsedXml);
      toast.success('Successfully parsed XML into visual tree!');
    } else {
      try {
        const parsedJson = JSON.parse(sampleResponse);
        const parsedTree = parseJsonToTree(parsedJson);
        setTreeData(parsedTree);
        toast.success('Successfully parsed JSON into visual tree!');
      } catch (err: any) {
        toast.error(`Invalid JSON: ${err.message}`);
      }
    }
  };

  useEffect(() => {
    if (sampleResponse) {
      handleParseSampleToTree();
    }
  }, [outputFormat]);

  const updateFieldValueInTree = (
    items: TreeFieldItem[],
    targetPath: string,
    newValue: string
  ): TreeFieldItem[] => {
    return items.map((item) => {
      if (item.path === targetPath) {
        return { ...item, value: newValue };
      }
      if (item.children) {
        return {
          ...item,
          children: updateFieldValueInTree(item.children, targetPath, newValue),
        };
      }
      return item;
    });
  };

  const handleDropTokenOnField = (e: React.DragEvent, fieldPath: string) => {
    e.preventDefault();
    if (draggedToken) {
      const newTree = updateFieldValueInTree(treeData, fieldPath, draggedToken);
      setTreeData(newTree);
      toast.success(`Mapped ${draggedToken} to ${fieldPath}`);
      setDraggedToken(null);
    }
  };

  const handleAutoMapMatchingFields = () => {
    if (allTokens.length === 0 || treeData.length === 0) {
      toast.error('No upstream tokens or tree fields to auto-map');
      return;
    }

    let matchCount = 0;
    const autoMap = (items: TreeFieldItem[]): TreeFieldItem[] => {
      return items.map((item) => {
        if (item.children && item.children.length > 0) {
          return { ...item, children: autoMap(item.children) };
        }
        const keyLower = item.key.toLowerCase();
        const matched = allTokens.find((t) => t.label.toLowerCase().endsWith(keyLower));
        if (matched) {
          matchCount++;
          return { ...item, value: matched.token };
        }
        return item;
      });
    };

    const newTree = autoMap(treeData);
    setTreeData(newTree);
    if (matchCount > 0) {
      toast.success(`Auto-mapped ${matchCount} matching field(s)!`);
    } else {
      toast.error('No matching field keys found to auto-map');
    }
  };

  const compiledTemplateString = useMemo(() => {
    if (outputFormat === 'xml') {
      return compileTreeToXml(treeData);
    }
    const compiledJson = compileTreeToJson(treeData);
    return JSON.stringify(compiledJson, null, 2);
  }, [treeData, outputFormat]);

  const handleSaveConfig = () => {
    const mappingsRecord: Record<string, string> = {};
    const extractMappings = (items: TreeFieldItem[]) => {
      items.forEach((item) => {
        if (item.value && item.value.startsWith('{') && item.value.endsWith('}')) {
          mappingsRecord[item.path] = item.value;
        }
        if (item.children) extractMappings(item.children);
      });
    };
    extractMappings(treeData);

    onSave({
      outputFormat,
      sampleResponse,
      template: compiledTemplateString,
      mappings: mappingsRecord,
    });
    toast.success('Response Object Mapper saved successfully!');
    onClose();
  };

  const toggleNodeCollapse = (nodeId: string) => {
    setCollapsedNodes((prev) => ({ ...prev, [nodeId]: !prev[nodeId] }));
  };

  const renderTreeNodes = (items: TreeFieldItem[], level = 0) => {
    return items.map((item) => {
      const isContainer = item.children && item.children.length > 0;
      const isCollapsed = !!collapsedNodes[item.id];
      const indentOffset = Math.min(level * 16, 64);
      const isXmlTag = item.type === 'xml_tag';

      if (isContainer) {
        return (
          <div key={item.id} className="space-y-2">
            <div
              onClick={() => toggleNodeCollapse(item.id)}
              className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between gap-3 ${
                isXmlTag
                  ? 'bg-indigo-50/80 text-indigo-950 border-indigo-200 shadow-sm hover:bg-indigo-100/90'
                  : item.type === 'array'
                  ? 'bg-slate-100 text-slate-950 border-slate-300 shadow-sm hover:bg-slate-200/80'
                  : 'bg-amber-50/80 text-amber-950 border-amber-200 shadow-sm hover:bg-amber-100/90'
              }`}
              style={{ marginLeft: `${indentOffset}px` }}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {isCollapsed ? (
                  <ChevronRight className="w-4 h-4 shrink-0 text-indigo-600" />
                ) : (
                  <ChevronDown className="w-4 h-4 shrink-0 text-indigo-600" />
                )}
                <span
                  title={item.key}
                  className={`font-mono text-xs font-bold px-2.5 py-0.5 rounded border truncate max-w-[180px] ${
                    isXmlTag
                      ? 'bg-indigo-600 text-white border-indigo-700'
                      : item.type === 'array'
                      ? 'bg-slate-800 text-white border-slate-900'
                      : 'bg-amber-600 text-white border-amber-700'
                  }`}
                >
                  {outputFormat === 'xml' ? `<${item.key}>` : item.key}
                </span>
                <span
                  className="text-[10px] font-mono font-bold px-2 py-0.5 rounded border shrink-0 bg-white/80 text-slate-800 border-slate-300"
                >
                  {outputFormat === 'xml' ? 'XML NODE' : item.type.toUpperCase()} ({item.children?.length || 0} items)
                </span>
              </div>

              <div className="text-[11px] font-mono font-medium truncate max-w-[220px] text-slate-500">
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
            className="p-3 rounded-2xl border border-slate-200 bg-white hover:border-indigo-400 hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-3"
            style={{ marginLeft: `${indentOffset}px` }}
          >
            {/* Left: Key Badge & Type */}
            <div className="flex items-center gap-2 min-w-[200px] shrink-0">
              {level > 0 && <CornerDownRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
              <span
                title={item.path}
                className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-300 truncate max-w-[180px]"
              >
                {outputFormat === 'xml' ? `<${item.key}>` : item.key}
              </span>
              <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded uppercase">
                {item.type}
              </span>
            </div>

            {/* Right: Token Selector & Value Input */}
            <div className="flex-1 flex flex-col sm:flex-row items-center gap-2 min-w-0">
              <select
                value={allTokens.some((v) => v.token === item.value) ? item.value : '__custom__'}
                onChange={(e) => {
                  const selectedVal = e.target.value;
                  if (selectedVal !== '__custom__') {
                    const newTree = updateFieldValueInTree(treeData, item.path, selectedVal);
                    setTreeData(newTree);
                  }
                }}
                className="w-full sm:w-56 px-2.5 py-1.5 text-xs font-mono font-semibold bg-slate-50 border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 truncate"
              >
                <option value="__custom__">⚙️ Static Value / Custom</option>
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
                  setTreeData(newTree);
                }}
                placeholder="Drop token or enter static value..."
                className={`w-full flex-1 px-3 py-1.5 text-xs font-mono border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 ${
                  item.value.startsWith('{') && item.value.endsWith('}')
                    ? 'bg-indigo-50 border-indigo-300 text-indigo-950 font-bold'
                    : 'bg-white border-slate-300 text-slate-900'
                }`}
              />
            </div>
          </div>
        </div>
      );
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-7xl h-[92vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="bg-white text-slate-900 px-8 py-5 flex items-center justify-between border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <FileOutput className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold flex items-center gap-3 text-slate-900">
                Configure Response Object Mapper
                <span className="text-xs bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full font-mono font-semibold border border-indigo-200">
                  {nodeLabel || nodeId}
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Map upstream node responses dynamically to format the final output payload in JSON or XML format.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Format Toggle Buttons */}
            <div className="bg-slate-200/70 p-1 rounded-xl flex items-center border border-slate-300">
              <button
                type="button"
                onClick={() => setOutputFormat('json')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  outputFormat === 'json'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                JSON Payload
              </button>
              <button
                type="button"
                onClick={() => setOutputFormat('xml')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  outputFormat === 'xml'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                XML Payload
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 hover:text-slate-900 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Main Body */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel: Available Upstream Tokens */}
          <div className="w-1/3 border-r border-slate-200 p-6 overflow-y-auto bg-slate-50/70 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Database className="w-4 h-4 text-indigo-600" />
                All Graph State Variables
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const allCollapsed = upstreamGroupedVariables.every((g) => collapsedGroups[g.nodeId]);
                    const nextState: Record<string, boolean> = {};
                    upstreamGroupedVariables.forEach((g) => {
                      nextState[g.nodeId] = !allCollapsed;
                    });
                    setCollapsedGroups(nextState);
                  }}
                  className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full"
                >
                  {upstreamGroupedVariables.every((g) => collapsedGroups[g.nodeId]) ? 'Expand All' : 'Collapse All'}
                </button>
                <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 font-mono font-bold px-2 py-0.5 rounded-full">
                  {allTokens.length} Available
                </span>
              </div>
            </div>

            {upstreamGroupedVariables.length > 0 && allTokens.length > 0 ? (
              <div className="space-y-3">
                {upstreamGroupedVariables.map((group) => {
                  if (group.tokens.length === 0) return null;
                  const isCollapsed = Boolean(collapsedGroups[group.nodeId]);
                  return (
                    <div key={group.nodeId} className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs transition-all">
                      <button
                        type="button"
                        onClick={() =>
                          setCollapsedGroups((prev) => ({
                            ...prev,
                            [group.nodeId]: !prev[group.nodeId],
                          }))
                        }
                        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 bg-slate-100/80 hover:bg-indigo-50/80 transition-colors text-left"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {isCollapsed ? (
                            <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-indigo-600 shrink-0" />
                          )}
                          <Package className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                          <span className="text-xs font-bold text-slate-800 truncate">
                            {group.nodeLabel}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono font-bold bg-white text-slate-600 px-2 py-0.5 rounded-md border border-slate-200 shrink-0">
                          {group.tokens.length}
                        </span>
                      </button>

                      {!isCollapsed && (
                        <div className="p-2 space-y-1.5 bg-slate-50/50 border-t border-slate-200">
                          {group.tokens.map((v) => (
                            <div
                              key={v.token}
                              draggable
                              onDragStart={() => setDraggedToken(v.token)}
                              className="p-2 bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 rounded-xl cursor-grab active:cursor-grabbing transition-all flex items-center justify-between group shadow-2xs"
                            >
                              <div className="min-w-0 flex-1">
                                <span
                                  title={v.token}
                                  className="font-mono text-xs font-bold text-slate-900 group-hover:text-indigo-950 block truncate"
                                >
                                  {v.token}
                                </span>
                                <span title={v.label} className="text-[10px] text-slate-500 font-mono block truncate">
                                  {v.label}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-6 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-white space-y-2">
                <Package className="w-8 h-8 text-slate-400 mx-auto" />
                <h5 className="text-xs font-bold text-slate-700">No Graph Tokens Available</h5>
                <p className="text-[11px] text-slate-500">
                  Add preceding nodes or initial input parameters to populate graph state variables.
                </p>
              </div>
            )}
          </div>

          {/* Right Panel: Sample Payload Paste & Interactive Mapper Tree */}
          <div className="flex-1 p-6 overflow-y-auto space-y-6 bg-slate-50/30">
            {/* Top Toolbar Banner */}
            <div className="bg-indigo-50/70 p-5 rounded-2xl border border-indigo-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  Visual Target {outputFormat.toUpperCase()} Response Transformer
                </h4>
                <p className="text-xs text-slate-600 mt-0.5">
                  Paste sample target output {outputFormat.toUpperCase()} below, parse into fields, and map dynamic node tokens.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  onClick={handleAutoMapMatchingFields}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs gap-1.5 px-4 py-2 shadow-sm rounded-xl"
                >
                  <Wand2 className="w-3.5 h-3.5" />
                  1-Click Auto-Map Fields
                </Button>
              </div>
            </div>

            {/* Paste Sample Input Section */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-indigo-600" />
                  Paste Target Sample Response ({outputFormat.toUpperCase()})
                </label>

                <Button
                  type="button"
                  onClick={handleParseSampleToTree}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs gap-1.5 px-3.5 py-1.5 rounded-xl shadow-xs"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Parse into Visual Tree
                </Button>
              </div>

              <textarea
                rows={4}
                value={sampleResponse}
                onChange={(e) => setSampleResponse(e.target.value)}
                placeholder={`Paste target sample ${outputFormat.toUpperCase()} response here...`}
                className="w-full p-3 font-mono text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-slate-50/50 text-slate-900"
              />
            </div>

            {/* View Tab Selector: Visual Tree vs Code Preview */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setViewTab('visual')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                    viewTab === 'visual'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  Interactive Mapper Tree
                </button>
                <button
                  type="button"
                  onClick={() => setViewTab('code')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                    viewTab === 'code'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <Code2 className="w-3.5 h-3.5" />
                  Compiled Template Preview
                </button>
              </div>

              <span className="text-xs text-slate-500 font-mono">
                {treeData.length} Root Key(s)
              </span>
            </div>

            {/* Tree View vs Code View */}
            {viewTab === 'visual' ? (
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3 min-h-[300px]">
                {treeData.length > 0 ? (
                  renderTreeNodes(treeData)
                ) : (
                  <div className="p-12 text-center text-slate-400 space-y-2">
                    <FileCode className="w-10 h-10 mx-auto text-slate-300" />
                    <p className="text-xs font-bold text-slate-700">No Parsed Tree Available</p>
                    <p className="text-[11px] text-slate-500">Paste target sample JSON/XML above and click "Parse into Visual Tree".</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 text-indigo-950 font-mono text-xs overflow-x-auto min-h-[300px] shadow-xs">
                <pre>{compiledTemplateString}</pre>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-8 py-4 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            Selected Format: <span className="font-bold uppercase text-slate-900">{outputFormat}</span>
          </div>

          <div className="flex items-center gap-3">
            <Button type="button" onClick={onClose} variant="outline" className="px-5 py-2 text-xs font-bold">
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSaveConfig}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-6 py-2 shadow-md gap-2 rounded-xl"
            >
              <Check className="w-4 h-4" />
              Save Response Mapper Configuration
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
