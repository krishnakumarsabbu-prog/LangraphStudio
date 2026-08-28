import React from 'react';
import { GitBranch } from 'lucide-react';
import { useLangGraphStore } from '../../stores/langGraphStore';
import { CompactNodeDisplay } from './CompactNodeDisplay';

interface DecisionNodeProps {
  id: string;
  data: {
    label: string;
    script: string;
  };
}

export const DecisionNode: React.FC<DecisionNodeProps> = ({ id, data }) => {
  const { deleteNode, setSelectedNodeId, nodeExecutionStates, setNodeExecutionState } = useLangGraphStore();
  const executionState = nodeExecutionStates[id];

  const handleRun = () => {
    setSelectedNodeId(id);
    setNodeExecutionState(id, { status: 'running', logs: [`Starting decision node execution...`] });
  };

  return (
    <CompactNodeDisplay
      id={id}
      label={data.label || id}
      icon={<GitBranch className="w-5 h-5" />}
      pattern="striped"
      onConfig={() => setSelectedNodeId(id)}
      onDelete={() => deleteNode(id)}
      onRun={handleRun}
      executionStatus={executionState?.status}
      borderColor="#6B7280"
      bgColor="#F3F4F6"
    />
  );
};
