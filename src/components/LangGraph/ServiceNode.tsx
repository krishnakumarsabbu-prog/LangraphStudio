import React from 'react';
import { Globe } from 'lucide-react';
import { useLangGraphStore } from '../../stores/langGraphStore';
import { CompactNodeDisplay } from './CompactNodeDisplay';

interface ServiceNodeProps {
  id: string;
  data: {
    label: string;
    url: string;
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    config?: any;
  };
}

export const ServiceNode: React.FC<ServiceNodeProps> = ({ id, data }) => {
  const { deleteNode, setSelectedNodeId, nodeExecutionStates, setNodeExecutionState } = useLangGraphStore();
  const executionState = nodeExecutionStates[id];

  const handleRun = () => {
    setSelectedNodeId(id);
    setNodeExecutionState(id, { status: 'running', logs: [`Starting service node execution...`] });
  };

  return (
    <CompactNodeDisplay
      id={id}
      label={data.label || id}
      icon={<Globe className="w-5 h-5" />}
      pattern="solid"
      onConfig={() => setSelectedNodeId(id)}
      onDelete={() => deleteNode(id)}
      onRun={handleRun}
      executionStatus={executionState?.status}
      borderColor="#374151"
      bgColor="#FFFFFF"
    />
  );
};
