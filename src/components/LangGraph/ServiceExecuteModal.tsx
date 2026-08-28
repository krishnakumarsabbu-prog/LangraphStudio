import React, { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import axios from 'axios';
import toast from 'react-hot-toast';

interface ServiceExecuteModalProps {
  isOpen: boolean;
  onClose: () => void;
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  requestTemplate: string;
}

export const ServiceExecuteModal: React.FC<ServiceExecuteModalProps> = ({
  isOpen,
  onClose,
  url,
  method,
  requestTemplate,
}) => {
  const [inputJson, setInputJson] = useState('{}');
  const [response, setResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const replaceTemplateVariables = (template: string, inputs: any): string => {
    let result = template;
    const regex = /\{\{([^}]+)\}\}/g;
    const matches = template.matchAll(regex);

    for (const match of matches) {
      const path = match[1];
      const value = getNestedValue(inputs, path);
      result = result.replace(match[0], JSON.stringify(value));
    }

    return result;
  };

  const getNestedValue = (obj: any, path: string): any => {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  };

  const handleExecute = async () => {
    setIsLoading(true);
    try {
      const inputs = JSON.parse(inputJson);
      const processedBody = replaceTemplateVariables(requestTemplate, inputs);

      let requestBody;
      try {
        requestBody = JSON.parse(processedBody);
      } catch {
        requestBody = processedBody;
      }

      const config: any = {
        method,
        url,
      };

      if (method !== 'GET') {
        config.data = requestBody;
      }

      const result = await axios(config);
      setResponse(JSON.stringify(result.data, null, 2));
      toast.success('Request executed successfully');
    } catch (error: any) {
      const errorMessage = error.response?.data || error.message || 'Request failed';
      setResponse(JSON.stringify({ error: errorMessage }, null, 2));
      toast.error('Request failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-2xl w-[90%] h-[80%] flex flex-col">
        <div className="bg-[#D71E28] text-white px-6 py-4 rounded-t-lg flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Execute Service</h2>
            <p className="text-sm opacity-90">{method} {url}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-[#BB1A21] rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          <div className="w-1/2 border-r border-gray-200 p-4 flex flex-col">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Input JSON</h3>
            <p className="text-xs text-gray-500 mb-2">
              Provide the input data for template variables
            </p>
            <textarea
              value={inputJson}
              onChange={(e) => setInputJson(e.target.value)}
              className="flex-1 w-full px-4 py-3 text-sm font-mono border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D71E28] focus:border-[#D71E28] bg-white resize-none"
              placeholder='{\n  "field": {\n    "name": "value"\n  }\n}'
            />
          </div>

          <div className="flex-1 p-4 flex flex-col bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">API Response</h3>
            <div className="flex-1 w-full px-4 py-3 text-sm font-mono border border-gray-300 rounded-lg bg-white overflow-auto whitespace-pre-wrap">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-8 h-8 animate-spin text-[#D71E28]" />
                </div>
              ) : response ? (
                response
              ) : (
                <span className="text-gray-400">Response will appear here...</span>
              )}
            </div>
          </div>
        </div>

        <div className="border-t border-gray-200 px-6 py-4 flex justify-between items-center">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button
            onClick={handleExecute}
            disabled={isLoading}
            className="bg-[#10b981] hover:bg-[#059669] text-white"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Executing...
              </>
            ) : (
              'Execute Request'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
