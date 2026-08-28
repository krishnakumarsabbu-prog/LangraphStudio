import { v4 as uuidv4 } from 'uuid';

export const generateMockExecutions = (count: number = 50) => {
  const workflows = [
    'Customer Onboarding Flow',
    'Invoice Processing',
    'Lead Qualification',
    'Data Migration Pipeline',
    'Email Campaign Automation',
    'Report Generation',
    'User Registration Flow',
    'Payment Processing',
  ];

  const statuses = ['completed', 'failed', 'running', 'cancelled'];
  const statusWeights = [70, 15, 10, 5];

  const executions = [];
  const now = Date.now();

  for (let i = 0; i < count; i++) {
    const workflowName = workflows[Math.floor(Math.random() * workflows.length)];
    const createdAt = new Date(now - (count - i) * 3600000 - Math.random() * 3600000);

    const statusRandom = Math.random() * 100;
    let status = statuses[0];
    let cumulative = 0;
    for (let j = 0; j < statusWeights.length; j++) {
      cumulative += statusWeights[j];
      if (statusRandom < cumulative) {
        status = statuses[j];
        break;
      }
    }

    const duration = Math.random() * 300000;
    const completedAt = status === 'completed' || status === 'failed'
      ? new Date(createdAt.getTime() + duration)
      : null;

    executions.push({
      id: uuidv4(),
      workflow_id: uuidv4(),
      workflow_name: workflowName,
      status,
      current_node_id: status === 'running' ? `node-${Math.floor(Math.random() * 5) + 1}` : undefined,
      input_data: {
        userId: `user-${Math.floor(Math.random() * 1000)}`,
        timestamp: createdAt.toISOString(),
        parameters: {
          region: ['US', 'EU', 'APAC'][Math.floor(Math.random() * 3)],
          priority: ['high', 'medium', 'low'][Math.floor(Math.random() * 3)],
        },
      },
      output_data: status === 'completed' ? {
        result: 'success',
        processedRecords: Math.floor(Math.random() * 1000),
        executionTime: duration,
      } : {},
      error: status === 'failed' ? [
        'Connection timeout',
        'Invalid input format',
        'Database constraint violation',
        'Rate limit exceeded',
        'External API error',
      ][Math.floor(Math.random() * 5)] : undefined,
      created_at: createdAt.toISOString(),
      updated_at: new Date().toISOString(),
      completed_at: completedAt?.toISOString(),
    });
  }

  return executions;
};

export const generateMockNodeExecutions = (executionId: string, nodeCount: number = 8) => {
  const nodeTypes = ['service', 'decision', 'parallel', 'llm', 'form', 'merge', 'workflow'];
  const statuses = ['completed', 'failed', 'running'];

  const nodes = [];
  let currentTime = Date.now() - 300000;

  for (let i = 0; i < nodeCount; i++) {
    const nodeType = nodeTypes[Math.floor(Math.random() * nodeTypes.length)];
    const startedAt = new Date(currentTime);
    const duration = Math.random() * 5000 + 500;
    const status = i === nodeCount - 1 && Math.random() > 0.5 ? 'running' :
                   (Math.random() > 0.9 ? 'failed' : 'completed');
    const completedAt = status !== 'running' ? new Date(currentTime + duration) : null;

    nodes.push({
      id: uuidv4(),
      workflow_execution_id: executionId,
      node_id: `node-${i + 1}`,
      node_type: nodeType,
      status,
      input_data: {
        previousOutput: i > 0 ? `Output from node-${i}` : 'Initial input',
        nodeConfig: {
          timeout: 30000,
          retries: 3,
        },
      },
      output_data: status === 'completed' ? {
        result: 'processed',
        records: Math.floor(Math.random() * 100),
        duration: duration,
      } : {},
      error: status === 'failed' ? 'Node execution failed: Timeout exceeded' : undefined,
      started_at: startedAt.toISOString(),
      completed_at: completedAt?.toISOString(),
      duration_ms: status !== 'running' ? Math.floor(duration) : undefined,
    });

    if (status !== 'running') {
      currentTime += duration;
    }
  }

  return nodes;
};

export const generateMockServiceMetrics = () => {
  const services = [
    { name: 'Email Service', node_id: 'node-email-1' },
    { name: 'Payment Gateway', node_id: 'node-payment-1' },
    { name: 'Data Validator', node_id: 'node-validator-1' },
    { name: 'CRM Integration', node_id: 'node-crm-1' },
    { name: 'Authentication Service', node_id: 'node-auth-1' },
    { name: 'Notification Service', node_id: 'node-notify-1' },
    { name: 'Analytics Engine', node_id: 'node-analytics-1' },
    { name: 'Storage Service', node_id: 'node-storage-1' },
  ];

  return services.map(service => {
    const totalCalls = Math.floor(Math.random() * 500) + 50;
    const failureCount = Math.floor(totalCalls * (Math.random() * 0.1));
    const successCount = totalCalls - failureCount;
    const avgDuration = Math.floor(Math.random() * 2000) + 100;
    const minDuration = Math.floor(avgDuration * 0.5);
    const maxDuration = Math.floor(avgDuration * 2);

    return {
      id: uuidv4(),
      node_id: service.node_id,
      service_name: service.name,
      total_calls: totalCalls,
      success_count: successCount,
      failure_count: failureCount,
      total_duration_ms: totalCalls * avgDuration,
      avg_duration_ms: avgDuration,
      min_duration_ms: minDuration,
      max_duration_ms: maxDuration,
      last_called_at: new Date(Date.now() - Math.random() * 86400000).toISOString(),
      updated_at: new Date().toISOString(),
    };
  });
};

export const generateMockWorkflows = () => {
  const workflows = [
    { name: 'Customer Onboarding Flow', description: 'Automated customer onboarding workflow' },
    { name: 'Invoice Processing', description: 'Automated invoice processing and approval' },
    { name: 'Lead Qualification', description: 'Qualify and score incoming leads' },
    { name: 'Data Migration Pipeline', description: 'Migrate data between systems' },
    { name: 'Email Campaign Automation', description: 'Automated email marketing campaigns' },
  ];

  return workflows.map((workflow, index) => ({
    id: uuidv4(),
    name: workflow.name,
    description: workflow.description,
    version: Math.floor(Math.random() * 5) + 1,
    data: {
      nodes: [],
      edges: [],
    },
    context: {},
    created_at: new Date(Date.now() - (workflows.length - index) * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
    is_latest: true,
  }));
};

export const generateMockData = () => {
  return {
    executions: generateMockExecutions(50),
    serviceMetrics: generateMockServiceMetrics(),
    workflows: generateMockWorkflows(),
  };
};
