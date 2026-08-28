import React from 'react';
import { Workflow } from 'lucide-react';
import { useLangGraphStore } from '../../stores/langGraphStore';
import { CompactNodeDisplay } from './CompactNodeDisplay';

interface WorkflowNodeProps {
  id: string;
  data: {
    label: string;
    selectedWorkflowName?: string;
    dynamicSelection?: boolean;
    workflowFieldPath?: string;
    workflowConfig?: any;
  };
}

export const WorkflowNode: React.FC<WorkflowNodeProps> = ({ id, data }) => {
  const { deleteNode, setSelectedNodeId, nodeExecutionStates, setNodeExecutionState } = useLangGraphStore();
  const executionState = nodeExecutionStates[id];

  const handleRun = () => {
    setSelectedNodeId(id);
    setNodeExecutionState(id, { status: 'running', logs: [`Starting workflow node execution...`] });
  };

  return (
    <CompactNodeDisplay
      id={id}
      label={data.label || id}
      icon={<Workflow className="w-5 h-5" />}
      pattern="striped"
      onConfig={() => setSelectedNodeId(id)}
      onDelete={() => deleteNode(id)}
      onRun={handleRun}
      executionStatus={executionState?.status}
      borderColor="#6B7280"
      bgColor="#F9FAFB"
    />
  );
};
