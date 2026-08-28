/**
 * Service Node configuration panel.
 *
 * Adapts the configuration concepts from the existing LangGraph
 * ServiceConfigModal (auth types, headers, timeout, retry) into a
 * panel format for the Node Builder properties sidebar.
 */

import React from 'react';
import { Plus, Trash2, Globe, Lock, Clock, RefreshCw, ArrowRightLeft } from 'lucide-react';
import { ServiceNodeConfig, HttpMethod, AuthType } from './types';

interface ServiceConfigPanelProps {
  config: ServiceNodeConfig;
  onChange: (config: Partial<ServiceNodeConfig>) => void;
}

const HTTP_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
const AUTH_TYPES: AuthType[] = ['none', 'bearer', 'basic', 'api-key'];

export const ServiceConfigPanel: React.FC<ServiceConfigPanelProps> = ({ config, onChange }) => {
  const addHeader = () =>
    onChange({ headers: [...config.headers, { key: '', value: '' }] });

  const removeHeader = (index: number) =>
    onChange({ headers: config.headers.filter((_, i) => i !== index) });

  const updateHeader = (index: number, field: 'key' | 'value', value: string) => {
    const newHeaders = [...config.headers];
    newHeaders[index][field] = value;
    onChange({ headers: newHeaders });
  };

  return (
    <div className="space-y-5">
      {/* Basic */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-light-text-primary dark:text-dark-text-primary uppercase tracking-wide">
          <Globe className="w-3.5 h-3.5" />
          Service Configuration
        </div>

        <div>
          <label className="block text-[11px] font-bold text-light-text-secondary dark:text-dark-text-secondary mb-1">
            Service Name
          </label>
          <input
            type="text"
            value={config.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="GSA Address Verification"
            className="w-full px-3 py-2 text-xs border border-light-border dark:border-dark-border bg-white dark:bg-dark-surface text-light-text-primary dark:text-dark-text-default rounded-lg focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent transition-all"
          />
        </div>

        <div>
          <label className="block text-[11px] font-bold text-light-text-secondary dark:text-dark-text-secondary mb-1">
            API URL
          </label>
          <input
            type="text"
            value={config.apiUrl}
            onChange={(e) => onChange({ apiUrl: e.target.value })}
            placeholder="https://api.gsa.gov/address/verify"
            className="w-full px-3 py-2 text-xs font-mono border border-light-border dark:border-dark-border bg-white dark:bg-dark-surface text-light-text-primary dark:text-dark-text-default rounded-lg focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent transition-all"
          />
        </div>

        <div>
          <label className="block text-[11px] font-bold text-light-text-secondary dark:text-dark-text-secondary mb-1">
            HTTP Method
          </label>
          <select
            value={config.httpMethod}
            onChange={(e) => onChange({ httpMethod: e.target.value as HttpMethod })}
            className="w-full px-3 py-2 text-xs font-semibold border border-light-border dark:border-dark-border bg-white dark:bg-dark-surface text-light-text-primary dark:text-dark-text-default rounded-lg focus:ring-2 focus:ring-black dark:focus:ring-white"
          >
            {HTTP_METHODS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="border-t border-light-border dark:border-dark-border" />

      {/* Authentication */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-light-text-primary dark:text-dark-text-primary uppercase tracking-wide">
          <Lock className="w-3.5 h-3.5" />
          Authentication
        </div>

        <select
          value={config.authType}
          onChange={(e) => onChange({ authType: e.target.value as AuthType, authConfig: {} })}
          className="w-full px-3 py-2 text-xs font-semibold border border-light-border dark:border-dark-border bg-white dark:bg-dark-surface text-light-text-primary dark:text-dark-text-default rounded-lg focus:ring-2 focus:ring-black dark:focus:ring-white"
        >
          {AUTH_TYPES.map((a) => (
            <option key={a} value={a}>
              {a === 'none' ? 'None (Public)' : a === 'bearer' ? 'Bearer Token' : a === 'basic' ? 'Basic Auth' : 'API Key'}
            </option>
          ))}
        </select>

        {config.authType === 'bearer' && (
          <input
            type="password"
            placeholder="Bearer token"
            value={config.authConfig.bearerToken || ''}
            onChange={(e) => onChange({ authConfig: { ...config.authConfig, bearerToken: e.target.value } })}
            className="w-full px-3 py-2 text-xs font-mono border border-light-border dark:border-dark-border bg-white dark:bg-dark-surface text-light-text-primary dark:text-dark-text-default rounded-lg focus:ring-2 focus:ring-black dark:focus:ring-white"
          />
        )}

        {config.authType === 'basic' && (
          <div className="space-y-2">
            <input
              type="text"
              placeholder="Username"
              value={config.authConfig.basicUsername || ''}
              onChange={(e) => onChange({ authConfig: { ...config.authConfig, basicUsername: e.target.value } })}
              className="w-full px-3 py-2 text-xs border border-light-border dark:border-dark-border bg-white dark:bg-dark-surface text-light-text-primary dark:text-dark-text-default rounded-lg focus:ring-2 focus:ring-black dark:focus:ring-white"
            />
            <input
              type="password"
              placeholder="Password"
              value={config.authConfig.basicPassword || ''}
              onChange={(e) => onChange({ authConfig: { ...config.authConfig, basicPassword: e.target.value } })}
              className="w-full px-3 py-2 text-xs border border-light-border dark:border-dark-border bg-white dark:bg-dark-surface text-light-text-primary dark:text-dark-text-default rounded-lg focus:ring-2 focus:ring-black dark:focus:ring-white"
            />
          </div>
        )}

        {config.authType === 'api-key' && (
          <div className="space-y-2">
            <input
              type="text"
              placeholder="Header name (e.g. X-API-Key)"
              value={config.authConfig.apiKeyHeader || ''}
              onChange={(e) => onChange({ authConfig: { ...config.authConfig, apiKeyHeader: e.target.value } })}
              className="w-full px-3 py-2 text-xs font-mono border border-light-border dark:border-dark-border bg-white dark:bg-dark-surface text-light-text-primary dark:text-dark-text-default rounded-lg focus:ring-2 focus:ring-black dark:focus:ring-white"
            />
            <input
              type="password"
              placeholder="API key value"
              value={config.authConfig.apiKeyValue || ''}
              onChange={(e) => onChange({ authConfig: { ...config.authConfig, apiKeyValue: e.target.value } })}
              className="w-full px-3 py-2 text-xs font-mono border border-light-border dark:border-dark-border bg-white dark:bg-dark-surface text-light-text-primary dark:text-dark-text-default rounded-lg focus:ring-2 focus:ring-black dark:focus:ring-white"
            />
          </div>
        )}
      </div>

      <div className="border-t border-light-border dark:border-dark-border" />

      {/* Headers */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-light-text-primary dark:text-dark-text-primary">Headers</span>
          <button
            onClick={addHeader}
            className="p-1.5 hover:bg-light-hover dark:hover:bg-dark-hover rounded-lg transition-colors"
            title="Add header"
          >
            <Plus className="w-3.5 h-3.5 text-light-text-secondary dark:text-dark-text-secondary" />
          </button>
        </div>
        {config.headers.map((header, i) => (
          <div key={i} className="flex gap-2 items-center">
            <input
              type="text"
              placeholder="Key"
              value={header.key}
              onChange={(e) => updateHeader(i, 'key', e.target.value)}
              className="flex-1 px-2.5 py-1.5 text-[11px] font-mono border border-light-border dark:border-dark-border bg-white dark:bg-dark-surface text-light-text-primary dark:text-dark-text-default rounded-lg focus:ring-1 focus:ring-black dark:focus:ring-white"
            />
            <input
              type="text"
              placeholder="Value"
              value={header.value}
              onChange={(e) => updateHeader(i, 'value', e.target.value)}
              className="flex-1 px-2.5 py-1.5 text-[11px] font-mono border border-light-border dark:border-dark-border bg-white dark:bg-dark-surface text-light-text-primary dark:text-dark-text-default rounded-lg focus:ring-1 focus:ring-black dark:focus:ring-white"
            />
            <button
              onClick={() => removeHeader(i)}
              className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      <div className="border-t border-light-border dark:border-dark-border" />

      {/* Request / Response Mapping */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-light-text-primary dark:text-dark-text-primary uppercase tracking-wide">
          <ArrowRightLeft className="w-3.5 h-3.5" />
          Mappings & Schemas
        </div>

        <div>
          <label className="block text-[11px] font-bold text-light-text-secondary dark:text-dark-text-secondary mb-1">
            Request Mapping (JSON)
          </label>
          <textarea
            value={config.requestMapping}
            onChange={(e) => onChange({ requestMapping: e.target.value })}
            rows={4}
            className="w-full px-3 py-2 text-[11px] font-mono border border-light-border dark:border-dark-border bg-white dark:bg-dark-surface text-light-text-primary dark:text-dark-text-default rounded-lg focus:ring-2 focus:ring-black dark:focus:ring-white resize-none"
            placeholder='{"address": "{input.address}"}'
          />
        </div>

        <div>
          <label className="block text-[11px] font-bold text-light-text-secondary dark:text-dark-text-secondary mb-1">
            Response Mapping (JSON)
          </label>
          <textarea
            value={config.responseMapping}
            onChange={(e) => onChange({ responseMapping: e.target.value })}
            rows={4}
            className="w-full px-3 py-2 text-[11px] font-mono border border-light-border dark:border-dark-border bg-white dark:bg-dark-surface text-light-text-primary dark:text-dark-text-default rounded-lg focus:ring-2 focus:ring-black dark:focus:ring-white resize-none"
            placeholder='{"matchScore": "response.matchScore"}'
          />
        </div>

        <div>
          <label className="block text-[11px] font-bold text-light-text-secondary dark:text-dark-text-secondary mb-1">
            Input Schema (JSON)
          </label>
          <textarea
            value={config.inputSchema}
            onChange={(e) => onChange({ inputSchema: e.target.value })}
            rows={3}
            className="w-full px-3 py-2 text-[11px] font-mono border border-light-border dark:border-dark-border bg-white dark:bg-dark-surface text-light-text-primary dark:text-dark-text-default rounded-lg focus:ring-2 focus:ring-black dark:focus:ring-white resize-none"
            placeholder='{"address": "string"}'
          />
        </div>

        <div>
          <label className="block text-[11px] font-bold text-light-text-secondary dark:text-dark-text-secondary mb-1">
            Output Schema (JSON)
          </label>
          <textarea
            value={config.outputSchema}
            onChange={(e) => onChange({ outputSchema: e.target.value })}
            rows={3}
            className="w-full px-3 py-2 text-[11px] font-mono border border-light-border dark:border-dark-border bg-white dark:bg-dark-surface text-light-text-primary dark:text-dark-text-default rounded-lg focus:ring-2 focus:ring-black dark:focus:ring-white resize-none"
            placeholder='{"matchScore": "number", "status": "string"}'
          />
        </div>
      </div>

      <div className="border-t border-light-border dark:border-dark-border" />

      {/* Timeout & Retry */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-light-text-primary dark:text-dark-text-primary uppercase tracking-wide">
          <Clock className="w-3.5 h-3.5" />
          Timeout & Retry
        </div>

        <div>
          <label className="block text-[11px] font-bold text-light-text-secondary dark:text-dark-text-secondary mb-1">
            Timeout (ms)
          </label>
          <input
            type="number"
            value={config.timeout}
            onChange={(e) => onChange({ timeout: parseInt(e.target.value) || 30000 })}
            className="w-full px-3 py-2 text-xs border border-light-border dark:border-dark-border bg-white dark:bg-dark-surface text-light-text-primary dark:text-dark-text-default rounded-lg focus:ring-2 focus:ring-black dark:focus:ring-white"
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="retryEnabled"
            checked={config.retryEnabled}
            onChange={(e) => onChange({ retryEnabled: e.target.checked })}
            className="w-4 h-4 rounded focus:ring-black dark:focus:ring-white"
          />
          <label htmlFor="retryEnabled" className="text-xs font-medium text-light-text-primary dark:text-dark-text-primary flex items-center gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" />
            Enable Retry
          </label>
        </div>

        {config.retryEnabled && (
          <div className="grid grid-cols-2 gap-3 pl-6">
            <div>
              <label className="block text-[11px] font-bold text-light-text-secondary dark:text-dark-text-secondary mb-1">
                Max Retries
              </label>
              <input
                type="number"
                value={config.maxRetries}
                onChange={(e) => onChange({ maxRetries: parseInt(e.target.value) || 3 })}
                className="w-full px-3 py-2 text-xs border border-light-border dark:border-dark-border bg-white dark:bg-dark-surface text-light-text-primary dark:text-dark-text-default rounded-lg focus:ring-2 focus:ring-black dark:focus:ring-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-light-text-secondary dark:text-dark-text-secondary mb-1">
                Retry Delay (ms)
              </label>
              <input
                type="number"
                value={config.retryDelay}
                onChange={(e) => onChange({ retryDelay: parseInt(e.target.value) || 1000 })}
                className="w-full px-3 py-2 text-xs border border-light-border dark:border-dark-border bg-white dark:bg-dark-surface text-light-text-primary dark:text-dark-text-default rounded-lg focus:ring-2 focus:ring-black dark:focus:ring-white"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
