import React from 'react';
import { FileText } from 'lucide-react';
import { useLangGraphStore } from '../../stores/langGraphStore';
import { CompactNodeDisplay } from './CompactNodeDisplay';

interface FormNodeProps {
  id: string;
  data: {
    label: string;
    formConfig: any;
  };
}

export const FormNode: React.FC<FormNodeProps> = ({ id, data }) => {
  const { deleteNode, setSelectedNodeId, nodeExecutionStates, setNodeExecutionState } = useLangGraphStore();
  const executionState = nodeExecutionStates[id];

  const handleRun = () => {
    setSelectedNodeId(id);
    setNodeExecutionState(id, { status: 'running', logs: [`Starting form node execution...`] });
  };

  return (
    <CompactNodeDisplay
      id={id}
      label={data.label || id}
      icon={<FileText className="w-5 h-5" />}
      pattern="solid"
      onConfig={() => setSelectedNodeId(id)}
      onDelete={() => deleteNode(id)}
      onRun={handleRun}
      executionStatus={executionState?.status}
      borderColor="#4B5563"
      bgColor="#FFFFFF"
    />
  );
};
