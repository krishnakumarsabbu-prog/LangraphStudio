import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Trash2, Upload, Loader2, Sparkles, Layers, Code } from 'lucide-react';
import { Button } from '../ui/button';
import { Tabs } from '../ui/tabs';
import toast from 'react-hot-toast';
import { VisualPayloadMapper } from './VisualPayloadMapper';

interface ServiceConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: ServiceConfig) => void;
  initialConfig: ServiceConfig;
  initialInputs: Record<string, any>;
}

export interface ServiceConfig {
  requestBody: string;
  headers: Array<{ key: string; value: string }>;
  authType: 'none' | 'bearer' | 'basic' | 'oauth2' | 'api-key';
  authConfig: {
    bearerToken?: string;
    basicUsername?: string;
    basicPassword?: string;
    oauth2ClientId?: string;
    oauth2ClientSecret?: string;
    oauth2TokenUrl?: string;
    oauth2Scope?: string;
    apiKeyHeader?: string;
    apiKeyValue?: string;
  };
  tlsConfig: {
    enabled: boolean;
    verifyCertificate: boolean;
    clientCertificate?: string;
    clientKey?: string;
    clientCertificatePath?: string;
    clientKeyPath?: string;
  };
  timeout: number;
  retryConfig: {
    enabled: boolean;
    maxRetries: number;
    retryDelay: number;
  };
}

export const ServiceConfigModal: React.FC<ServiceConfigModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialConfig,
  initialInputs,
}) => {
  const [config, setConfig] = useState<ServiceConfig>(initialConfig);
  const [draggedField, setDraggedField] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'request' | 'headers' | 'auth' | 'tls' | 'advanced'>('request');
  const [requestMode, setRequestMode] = useState<'visual' | 'raw'>('visual');
  const [uploadingCert, setUploadingCert] = useState(false);
  const [uploadingKey, setUploadingKey] = useState(false);

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

  const handleDrop = (e: React.DragEvent, fieldName: 'requestBody' | string) => {
    e.preventDefault();
    if (draggedField) {
      const cursorPosition = (e.target as HTMLTextAreaElement).selectionStart || 0;
      const currentValue = fieldName === 'requestBody' ? config.requestBody : '';
      const textBefore = currentValue.substring(0, cursorPosition);
      const textAfter = currentValue.substring(cursorPosition);
      const newText = `${textBefore}{${draggedField}}${textAfter}`;

      if (fieldName === 'requestBody') {
        setConfig({ ...config, requestBody: newText });
      }
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
    onSave(config);
    onClose();
  };

  const handleFileUpload = async (file: File, type: 'certificate' | 'key') => {
    const isKey = type === 'key';
    const setLoading = isKey ? setUploadingKey : setUploadingCert;

    try {
      setLoading(true);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', type);

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upload-certificate`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }

      const result = await response.json();

      if (isKey) {
        setConfig({
          ...config,
          tlsConfig: {
            ...config.tlsConfig,
            clientKey: result.content,
            clientKeyPath: result.filePath,
          }
        });
        toast.success('Private key uploaded successfully');
      } else {
        setConfig({
          ...config,
          tlsConfig: {
            ...config.tlsConfig,
            clientCertificate: result.content,
            clientCertificatePath: result.filePath,
          }
        });
        toast.success('Certificate uploaded successfully');
      }
    } catch (error: any) {
      toast.error(`Upload failed: ${error.message}`);
      console.error('Upload error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCertificateFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file, 'certificate');
    }
    e.target.value = '';
  };

  const handleKeyFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file, 'key');
    }
    e.target.value = '';
  };

  const modalContent = (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-6xl h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="bg-white text-slate-900 px-8 py-5 flex items-center justify-between border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold flex items-center gap-3 text-slate-900">
                Configure Service Request
                <span className="text-xs bg-amber-50 text-amber-700 font-mono font-semibold px-2.5 py-0.5 rounded-full border border-amber-200">
                  HTTP & Payload Node
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Map nested request payloads with dynamic upstream tokens, configure headers, auth, TLS certificates, and retry logic.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 hover:text-slate-900 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="bg-slate-100/80 border-b border-slate-200 px-8 pt-3 flex gap-2">
          {(['request', 'headers', 'auth', 'tls', 'advanced'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2.5 text-xs font-bold rounded-t-xl capitalize transition-all ${
                activeTab === tab
                  ? 'bg-white text-slate-950 border-t-2 border-x border-amber-500 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              {tab === 'request' && '📥 Service Request Payload'}
              {tab === 'headers' && '🔑 HTTP Headers'}
              {tab === 'auth' && '🔒 Authentication'}
              {tab === 'tls' && '🛡️ TLS / SSL Certificates'}
              {tab === 'advanced' && '⚙️ Timeouts & Retries'}
            </button>
          ))}
        </div>

        {/* Main Content Area (Full Width - Left Panel Removed) */}
        <div className="flex-1 p-8 overflow-y-auto bg-slate-50/40">
          {activeTab === 'request' && (
            <div className="space-y-6">
              {/* Request Mode Switcher */}
              <div className="flex items-center justify-between bg-white p-2 rounded-2xl border border-slate-200 shadow-xs">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setRequestMode('visual')}
                    className={`px-4 py-2 text-xs font-bold rounded-xl flex items-center gap-2 transition-all ${
                      requestMode === 'visual'
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <Layers className="w-4 h-4 text-amber-400" />
                    Visual Nested Field Mapper (Drag & Drop)
                  </button>
                  <button
                    type="button"
                    onClick={() => setRequestMode('raw')}
                    className={`px-4 py-2 text-xs font-bold rounded-xl flex items-center gap-2 transition-all ${
                      requestMode === 'raw'
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <Code className="w-4 h-4 text-blue-400" />
                    Raw JSON Textarea
                  </button>
                </div>
                <span className="text-xs text-slate-500 font-mono px-3">
                  Mode: <strong className="text-slate-800 uppercase">{requestMode}</strong>
                </span>
              </div>

              {requestMode === 'visual' ? (
                <VisualPayloadMapper
                  initialRequestBody={config.requestBody}
                  onChange={(newJson) => setConfig({ ...config, requestBody: newJson })}
                  initialInputs={initialInputs}
                />
              ) : (
                <div className="space-y-3 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <h3 className="text-sm font-bold text-slate-900">Raw Request Body JSON</h3>
                  <p className="text-xs text-slate-500">
                    Drop fields here or type manually. Use single braces <code className="bg-slate-100 text-slate-800 px-1 py-0.5 rounded font-mono">{'{input.field}'}</code> to wrap dynamic variable tokens.
                  </p>
                  <textarea
                    value={config.requestBody}
                    onChange={(e) => setConfig({ ...config, requestBody: e.target.value })}
                    onDrop={(e) => handleDrop(e, 'requestBody')}
                    onDragOver={handleDragOver}
                    className="w-full h-96 p-4 font-mono text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white resize-none"
                    placeholder='{\n  "user_id": "{input.user.id}",\n  "status": "ACTIVE"\n}'
                  />
                </div>
              )}
            </div>
          )}

          {activeTab === 'headers' && (
            <div className="space-y-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">HTTP Headers</h3>
                  <p className="text-xs text-slate-500">Configure key-value pairs for request headers.</p>
                </div>
                <Button
                  onClick={addHeader}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl"
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
                      placeholder="Header Name (e.g. Content-Type)"
                      value={header.key}
                      onChange={(e) => updateHeader(index, 'key', e.target.value)}
                      className="flex-1 px-3 py-2 text-xs font-mono border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                    <input
                      type="text"
                      placeholder="Header Value (e.g. application/json)"
                      value={header.value}
                      onChange={(e) => updateHeader(index, 'value', e.target.value)}
                      className="flex-1 px-3 py-2 text-xs font-mono border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                    <button
                      onClick={() => removeHeader(index)}
                      className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {config.headers.length === 0 && (
                  <p className="text-xs text-slate-500 italic p-4 text-center border border-dashed border-slate-200 rounded-xl">
                    No headers added yet. Click "+ Add Header" to include custom headers.
                  </p>
                )}
              </div>
            </div>
          )}

          {activeTab === 'auth' && (
            <div className="space-y-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm max-w-2xl">
              <h3 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-3">Authentication Settings</h3>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Auth Type</label>
                <select
                  value={config.authType}
                  onChange={(e) => setConfig({ ...config, authType: e.target.value as any })}
                  className="w-full px-3 py-2 text-xs font-semibold bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400"
                >
                  <option value="none">None (Public Endpoint)</option>
                  <option value="bearer">Bearer Token</option>
                  <option value="basic">Basic Auth</option>
                  <option value="oauth2">OAuth 2.0</option>
                  <option value="api-key">API Key Header</option>
                </select>
              </div>

              {config.authType === 'bearer' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Bearer Token</label>
                  <input
                    type="password"
                    placeholder="Enter bearer token"
                    value={config.authConfig.bearerToken || ''}
                    onChange={(e) => setConfig({
                      ...config,
                      authConfig: { ...config.authConfig, bearerToken: e.target.value }
                    })}
                    className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>
              )}

              {config.authType === 'basic' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Username</label>
                    <input
                      type="text"
                      placeholder="Enter username"
                      value={config.authConfig.basicUsername || ''}
                      onChange={(e) => setConfig({
                        ...config,
                        authConfig: { ...config.authConfig, basicUsername: e.target.value }
                      })}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Password</label>
                    <input
                      type="password"
                      placeholder="Enter password"
                      value={config.authConfig.basicPassword || ''}
                      onChange={(e) => setConfig({
                        ...config,
                        authConfig: { ...config.authConfig, basicPassword: e.target.value }
                      })}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>
                </div>
              )}

              {config.authType === 'oauth2' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Client ID</label>
                    <input
                      type="text"
                      placeholder="Enter client ID"
                      value={config.authConfig.oauth2ClientId || ''}
                      onChange={(e) => setConfig({
                        ...config,
                        authConfig: { ...config.authConfig, oauth2ClientId: e.target.value }
                      })}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Client Secret</label>
                    <input
                      type="password"
                      placeholder="Enter client secret"
                      value={config.authConfig.oauth2ClientSecret || ''}
                      onChange={(e) => setConfig({
                        ...config,
                        authConfig: { ...config.authConfig, oauth2ClientSecret: e.target.value }
                      })}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Token URL</label>
                    <input
                      type="text"
                      placeholder="https://oauth.example.com/token"
                      value={config.authConfig.oauth2TokenUrl || ''}
                      onChange={(e) => setConfig({
                        ...config,
                        authConfig: { ...config.authConfig, oauth2TokenUrl: e.target.value }
                      })}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Scope (optional)</label>
                    <input
                      type="text"
                      placeholder="read write"
                      value={config.authConfig.oauth2Scope || ''}
                      onChange={(e) => setConfig({
                        ...config,
                        authConfig: { ...config.authConfig, oauth2Scope: e.target.value }
                      })}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>
                </div>
              )}

              {config.authType === 'api-key' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Header Name</label>
                    <input
                      type="text"
                      placeholder="X-API-Key"
                      value={config.authConfig.apiKeyHeader || ''}
                      onChange={(e) => setConfig({
                        ...config,
                        authConfig: { ...config.authConfig, apiKeyHeader: e.target.value }
                      })}
                      className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">API Key</label>
                    <input
                      type="password"
                      placeholder="Enter API key"
                      value={config.authConfig.apiKeyValue || ''}
                      onChange={(e) => setConfig({
                        ...config,
                        authConfig: { ...config.authConfig, apiKeyValue: e.target.value }
                      })}
                      className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'tls' && (
            <div className="space-y-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm max-w-3xl">
              <h3 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-3">TLS / SSL Certificates</h3>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="tlsEnabled"
                  checked={config.tlsConfig.enabled}
                  onChange={(e) => setConfig({
                    ...config,
                    tlsConfig: { ...config.tlsConfig, enabled: e.target.checked }
                  })}
                  className="w-4 h-4 text-amber-600 rounded focus:ring-amber-400"
                />
                <label htmlFor="tlsEnabled" className="text-xs font-bold text-slate-800">
                  Enable Custom TLS/SSL Client Certificates
                </label>
              </div>

              {config.tlsConfig.enabled && (
                <div className="space-y-4 pt-2">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="verifyCert"
                      checked={config.tlsConfig.verifyCertificate}
                      onChange={(e) => setConfig({
                        ...config,
                        tlsConfig: { ...config.tlsConfig, verifyCertificate: e.target.checked }
                      })}
                      className="w-4 h-4 text-amber-600 rounded focus:ring-amber-400"
                    />
                    <label htmlFor="verifyCert" className="text-xs font-semibold text-slate-700">
                      Verify Server Certificate Authority (CA)
                    </label>
                  </div>

                  <div className="border border-slate-200 p-4 rounded-xl space-y-3 bg-slate-50/50">
                    <label className="block text-xs font-bold text-slate-800">Client Certificate (.pem / .crt)</label>

                    <input
                      type="text"
                      placeholder="/path/to/certificate.pem"
                      value={config.tlsConfig.clientCertificatePath || ''}
                      onChange={(e) => setConfig({
                        ...config,
                        tlsConfig: { ...config.tlsConfig, clientCertificatePath: e.target.value }
                      })}
                      className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                    />

                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-slate-500 font-medium">Or upload file directly:</span>
                      <input
                        type="file"
                        id="cert-file-upload"
                        accept=".pem,.crt,.cer"
                        onChange={handleCertificateFileSelect}
                        className="hidden"
                        disabled={uploadingCert}
                      />
                      <label
                        htmlFor="cert-file-upload"
                        className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-xl transition-colors cursor-pointer ${
                          uploadingCert
                            ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                            : 'bg-amber-600 hover:bg-amber-700 text-white shadow-xs'
                        }`}
                      >
                        {uploadingCert ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <Upload className="w-3.5 h-3.5" />
                            Upload Certificate File
                          </>
                        )}
                      </label>
                    </div>

                    <textarea
                      placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                      value={config.tlsConfig.clientCertificate || ''}
                      onChange={(e) => setConfig({
                        ...config,
                        tlsConfig: { ...config.tlsConfig, clientCertificate: e.target.value }
                      })}
                      className="w-full h-28 p-3 text-xs font-mono border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white resize-none"
                    />
                  </div>

                  <div className="border border-slate-200 p-4 rounded-xl space-y-3 bg-slate-50/50">
                    <label className="block text-xs font-bold text-slate-800">Client Private Key (.pem / .key)</label>

                    <input
                      type="text"
                      placeholder="/path/to/private-key.pem"
                      value={config.tlsConfig.clientKeyPath || ''}
                      onChange={(e) => setConfig({
                        ...config,
                        tlsConfig: { ...config.tlsConfig, clientKeyPath: e.target.value }
                      })}
                      className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                    />

                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-slate-500 font-medium">Or upload key file directly:</span>
                      <input
                        type="file"
                        id="key-file-upload"
                        accept=".pem,.key"
                        onChange={handleKeyFileSelect}
                        className="hidden"
                        disabled={uploadingKey}
                      />
                      <label
                        htmlFor="key-file-upload"
                        className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-xl transition-colors cursor-pointer ${
                          uploadingKey
                            ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                            : 'bg-amber-600 hover:bg-amber-700 text-white shadow-xs'
                        }`}
                      >
                        {uploadingKey ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <Upload className="w-3.5 h-3.5" />
                            Upload Key File
                          </>
                        )}
                      </label>
                    </div>

                    <textarea
                      placeholder="-----BEGIN PRIVATE KEY-----&#10;...&#10;-----END PRIVATE KEY-----"
                      value={config.tlsConfig.clientKey || ''}
                      onChange={(e) => setConfig({
                        ...config,
                        tlsConfig: { ...config.tlsConfig, clientKey: e.target.value }
                      })}
                      className="w-full h-28 p-3 text-xs font-mono border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white resize-none"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'advanced' && (
            <div className="space-y-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm max-w-xl">
              <h3 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-3">Advanced Request Settings</h3>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Request Timeout (milliseconds)
                </label>
                <input
                  type="number"
                  value={config.timeout}
                  onChange={(e) => setConfig({ ...config, timeout: parseInt(e.target.value) || 30000 })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="retryEnabled"
                  checked={config.retryConfig.enabled}
                  onChange={(e) => setConfig({
                    ...config,
                    retryConfig: { ...config.retryConfig, enabled: e.target.checked }
                  })}
                  className="w-4 h-4 text-amber-600 rounded focus:ring-amber-400"
                />
                <label htmlFor="retryEnabled" className="text-xs font-bold text-slate-800">
                  Enable Retry Strategy on Failure
                </label>
              </div>

              {config.retryConfig.enabled && (
                <div className="space-y-3 pl-7 pt-1">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Max Retry Attempts</label>
                    <input
                      type="number"
                      value={config.retryConfig.maxRetries}
                      onChange={(e) => setConfig({
                        ...config,
                        retryConfig: { ...config.retryConfig, maxRetries: parseInt(e.target.value) || 3 }
                      })}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Retry Delay (milliseconds)</label>
                    <input
                      type="number"
                      value={config.retryConfig.retryDelay}
                      onChange={(e) => setConfig({
                        ...config,
                        retryConfig: { ...config.retryConfig, retryDelay: parseInt(e.target.value) || 1000 }
                      })}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 px-8 py-4 flex items-center justify-between bg-slate-50">
          <div className="text-xs text-slate-500">
            Node Configuration: <span className="font-bold text-slate-900 uppercase">{activeTab}</span>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={onClose} className="px-5 py-2 text-xs font-bold rounded-xl">
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              className="bg-amber-600 hover:bg-amber-700 text-white px-6 py-2 text-xs font-bold shadow-md gap-2 rounded-xl"
            >
              Save Service Configuration
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

