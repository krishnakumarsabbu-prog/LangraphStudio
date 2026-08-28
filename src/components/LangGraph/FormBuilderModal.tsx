import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Trash2, GripVertical } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select } from '../ui/select';

interface FormField {
  id: string;
  type: 'string' | 'number' | 'boolean' | 'array';
  title: string;
  fieldName: string;
  widget?: 'text' | 'textarea' | 'select' | 'radio' | 'checkbox';
  enum?: string[];
}

interface FormBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (schema: any) => void;
  initialSchema?: any;
}

export const FormBuilderModal: React.FC<FormBuilderModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialSchema,
}) => {
  const [formTitle, setFormTitle] = useState('');
  const [fields, setFields] = useState<FormField[]>([]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen && initialSchema?.schema) {
      setFormTitle(initialSchema.schema.title || '');
      const properties = initialSchema.schema.properties || {};
      const loadedFields: FormField[] = Object.keys(properties).map((key, index) => ({
        id: `field-${index}`,
        fieldName: key,
        title: properties[key].title || key,
        type: properties[key].type || 'string',
        widget: properties[key].widget,
        enum: properties[key].enum,
      }));
      setFields(loadedFields);
    } else if (isOpen) {
      setFormTitle('');
      setFields([]);
    }
  }, [isOpen, initialSchema]);

  if (!isOpen) return null;

  const addField = (type: 'string' | 'number' | 'boolean' | 'array') => {
    const newField: FormField = {
      id: `field-${Date.now()}`,
      type,
      title: `Field ${fields.length + 1}`,
      fieldName: `field_${fields.length + 1}`,
      widget: type === 'string' ? 'text' : undefined,
    };
    setFields([...fields, newField]);
  };

  const updateField = (id: string, updates: Partial<FormField>) => {
    setFields(fields.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const deleteField = (id: string) => {
    setFields(fields.filter(f => f.id !== id));
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newFields = [...fields];
    const draggedField = newFields[draggedIndex];
    newFields.splice(draggedIndex, 1);
    newFields.splice(index, 0, draggedField);
    setFields(newFields);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleSave = () => {
    const properties: any = {};
    fields.forEach(field => {
      properties[field.fieldName] = {
        type: field.type,
        title: field.title,
      };
      if (field.widget) {
        properties[field.fieldName].widget = field.widget;
      }
      if (field.enum && field.enum.length > 0) {
        properties[field.fieldName].enum = field.enum;
      }
    });

    const schema = {
      schema: {
        title: formTitle,
        type: 'object',
        properties,
      },
    };

    onSave(schema);
    onClose();
  };

  const modalContent = (
    <div className="fixed inset-0 bg-black bg-opacity-70 z-[9999]">
      <div className="bg-white w-full h-full flex flex-col">
        <div className="bg-white border-b border-gray-300 px-8 py-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Form Builder</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          <div className="w-1/3 border-r border-gray-200 p-6 overflow-y-auto bg-gray-50">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Form Elements</h3>
            <p className="text-sm text-gray-600 mb-6">Click to add elements to your form</p>

            <div className="space-y-3">
              <button
                onClick={() => addField('string')}
                className="w-full bg-white border-2 border-gray-300 rounded-lg px-4 py-3 text-left hover:bg-gray-100 hover:border-gray-500 transition-all shadow-sm"
              >
                <div className="font-semibold text-sm">Text Input</div>
                <div className="text-xs text-gray-500">Single line text field</div>
              </button>

              <button
                onClick={() => addField('number')}
                className="w-full bg-white border-2 border-gray-300 rounded-lg px-4 py-3 text-left hover:bg-gray-100 hover:border-gray-500 transition-all shadow-sm"
              >
                <div className="font-semibold text-sm">Number Input</div>
                <div className="text-xs text-gray-500">Numeric field</div>
              </button>

              <button
                onClick={() => addField('boolean')}
                className="w-full bg-white border-2 border-gray-300 rounded-lg px-4 py-3 text-left hover:bg-gray-100 hover:border-gray-500 transition-all shadow-sm"
              >
                <div className="font-semibold text-sm">Checkbox</div>
                <div className="text-xs text-gray-500">True/false selection</div>
              </button>

              <button
                onClick={() => addField('array')}
                className="w-full bg-white border-2 border-gray-300 rounded-lg px-4 py-3 text-left hover:bg-gray-100 hover:border-gray-500 transition-all shadow-sm"
              >
                <div className="font-semibold text-sm">Select/Dropdown</div>
                <div className="text-xs text-gray-500">Multiple choice selection</div>
              </button>
            </div>
          </div>

          <div className="flex-1 p-6 overflow-y-auto">
            <div className="mb-6">
              <Label className="text-sm font-semibold mb-2">Form Title</Label>
              <Input
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="Enter form title"
                className="text-base"
              />
            </div>

            <h3 className="text-lg font-bold text-gray-800 mb-4">Form Fields</h3>

            {fields.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <p>No fields added yet. Click on elements from the left to add them.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {fields.map((field, index) => (
                  <div
                    key={field.id}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                    className="bg-white border-2 border-gray-300 rounded-lg p-4 space-y-3 hover:shadow-md transition-all"
                  >
                    <div className="flex items-start gap-3">
                      <GripVertical className="w-5 h-5 text-gray-400 cursor-move mt-1" />
                      <div className="flex-1 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs mb-1">Field Label</Label>
                            <Input
                              value={field.title}
                              onChange={(e) => updateField(field.id, { title: e.target.value })}
                              placeholder="Label"
                              className="text-sm"
                            />
                          </div>
                          <div>
                            <Label className="text-xs mb-1">Field Name</Label>
                            <Input
                              value={field.fieldName}
                              onChange={(e) => updateField(field.id, { fieldName: e.target.value })}
                              placeholder="field_name"
                              className="text-sm font-mono"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs mb-1">Type</Label>
                            <select
                              value={field.type}
                              onChange={(e) => updateField(field.id, { type: e.target.value as any })}
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400"
                            >
                              <option value="string">String</option>
                              <option value="number">Number</option>
                              <option value="boolean">Boolean</option>
                              <option value="array">Array</option>
                            </select>
                          </div>

                          {field.type === 'string' && (
                            <div>
                              <Label className="text-xs mb-1">Widget</Label>
                              <select
                                value={field.widget || 'text'}
                                onChange={(e) => updateField(field.id, { widget: e.target.value as any })}
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400"
                              >
                                <option value="text">Text</option>
                                <option value="textarea">Textarea</option>
                                <option value="radio">Radio</option>
                              </select>
                            </div>
                          )}
                        </div>

                        {(field.type === 'array' || field.widget === 'radio') && (
                          <div>
                            <Label className="text-xs mb-1">Options (comma-separated)</Label>
                            <Input
                              value={field.enum?.join(', ') || ''}
                              onChange={(e) => updateField(field.id, {
                                enum: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                              })}
                              placeholder="Option 1, Option 2, Option 3"
                              className="text-sm"
                            />
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => deleteField(field.id)}
                        className="p-2 hover:bg-red-50 text-red-600 rounded transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-gray-200 px-8 py-6 flex justify-end gap-4">
          <Button variant="outline" onClick={onClose} className="px-6 py-3 text-base">
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            className="bg-gray-700 hover:bg-gray-800 text-white px-8 py-3 text-base"
          >
            Save Form
          </Button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
