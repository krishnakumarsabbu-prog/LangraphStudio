import React from 'react';
import { FileOutput } from 'lucide-react';
import { useLangGraphStore } from '../../stores/langGraphStore';
import { CompactNodeDisplay } from './CompactNodeDisplay';

interface MapperNodeProps {
  id: string;
  data: {
    label: string;
    mapperConfig?: {
      outputFormat?: 'json' | 'xml';
      sampleResponse?: string;
      template?: string;
    };
  };
}

export const MapperNode: React.FC<MapperNodeProps> = ({ id, data }) => {
  const { deleteNode, setSelectedNodeId, nodeExecutionStates, setNodeExecutionState } = useLangGraphStore();
  const executionState = nodeExecutionStates[id];

  const handleRun = () => {
    setSelectedNodeId(id);
    setNodeExecutionState(id, { status: 'running', logs: [`Starting Object Mapper node execution...`] });
  };

  return (
    <CompactNodeDisplay
      id={id}
      label={data.label || id}
      icon={<FileOutput className="w-5 h-5" />}
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
