import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Button } from '../ui/button';
import Form from '@rjsf/core';
import validator from '@rjsf/validator-ajv8';

interface FormPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  formConfig: any;
}

export const FormPreviewModal: React.FC<FormPreviewModalProps> = ({
  isOpen,
  onClose,
  formConfig,
}) => {
  const [formData, setFormData] = useState<any>({});

  if (!isOpen || !formConfig?.schema) return null;

  const handleSubmit = ({ formData }: { formData: any }) => {
    console.log('Form submitted:', formData);
    setFormData(formData);
  };

  const modalContent = (
    <div className="fixed inset-0 bg-black bg-opacity-70 z-[9999]">
      <div className="bg-white w-full h-full flex flex-col">
        <div className="bg-[#D71E28] text-white px-8 py-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold">Form Preview</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-[#BB1A21] rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto bg-gray-50">
          <div className="max-w-4xl mx-auto p-8">
            <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-8">
              <div className="mb-6">
                <h3 className="text-2xl font-bold text-[#D71E28] mb-2">
                  {formConfig.schema.title || 'Form Preview'}
                </h3>
                <p className="text-sm text-gray-600">
                  This is how your form will appear during workflow execution
                </p>
              </div>

              <div className="form-preview-container">
                <Form
                  schema={formConfig.schema}
                  validator={validator}
                  onSubmit={handleSubmit}
                  formData={formData}
                  onChange={({ formData }) => setFormData(formData)}
                >
                  <div className="mt-6 flex justify-end gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={onClose}
                      className="px-6 py-2"
                    >
                      Close Preview
                    </Button>
                    <Button
                      type="submit"
                      className="bg-[#D71E28] hover:bg-[#BB1A21] text-white px-6 py-2"
                    >
                      Submit
                    </Button>
                  </div>
                </Form>
              </div>

              {Object.keys(formData).length > 0 && (
                <div className="mt-8 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <h4 className="text-sm font-bold text-gray-700 mb-2">Form Data Preview</h4>
                  <pre className="text-xs font-mono bg-white p-3 rounded border border-gray-200 overflow-auto">
                    {JSON.stringify(formData, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .form-preview-container .form-group {
          margin-bottom: 1.5rem;
        }

        .form-preview-container label.control-label {
          display: block;
          font-size: 0.875rem;
          font-weight: 600;
          color: #374151;
          margin-bottom: 0.5rem;
        }

        .form-preview-container .form-control {
          width: 100%;
          padding: 0.625rem 0.75rem;
          font-size: 0.875rem;
          line-height: 1.5;
          color: #1f2937;
          background-color: #fff;
          border: 1px solid #d1d5db;
          border-radius: 0.375rem;
          transition: all 0.15s ease-in-out;
        }

        .form-preview-container .form-control:focus {
          outline: none;
          border-color: #D71E28;
          box-shadow: 0 0 0 3px rgba(215, 30, 40, 0.1);
        }

        .form-preview-container select.form-control {
          background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
          background-position: right 0.5rem center;
          background-repeat: no-repeat;
          background-size: 1.5em 1.5em;
          padding-right: 2.5rem;
          appearance: none;
        }

        .form-preview-container .checkbox {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .form-preview-container .checkbox input[type="checkbox"] {
          width: 1.125rem;
          height: 1.125rem;
          border: 1px solid #d1d5db;
          border-radius: 0.25rem;
          cursor: pointer;
          accent-color: #D71E28;
        }

        .form-preview-container .checkbox label {
          margin-bottom: 0;
          cursor: pointer;
        }

        .form-preview-container .radio {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .form-preview-container .radio label {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0;
          cursor: pointer;
        }

        .form-preview-container .radio input[type="radio"] {
          width: 1rem;
          height: 1rem;
          border: 1px solid #d1d5db;
          cursor: pointer;
          accent-color: #D71E28;
        }

        .form-preview-container textarea.form-control {
          min-height: 100px;
          resize: vertical;
        }

        .form-preview-container .field-description {
          font-size: 0.75rem;
          color: #6b7280;
          margin-top: 0.25rem;
        }

        .form-preview-container .error-detail {
          color: #dc2626;
          font-size: 0.75rem;
          margin-top: 0.25rem;
        }

        .form-preview-container .has-error .form-control {
          border-color: #dc2626;
        }

        .form-preview-container .has-error .form-control:focus {
          border-color: #dc2626;
          box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.1);
        }

        .form-preview-container fieldset {
          border: none;
          padding: 0;
          margin: 0;
        }

        .form-preview-container legend {
          font-size: 0.875rem;
          font-weight: 600;
          color: #374151;
          margin-bottom: 0.5rem;
        }

        .form-preview-container .btn-group {
          display: none;
        }
      `}</style>
    </div>
  );

  return createPortal(modalContent, document.body);
};
