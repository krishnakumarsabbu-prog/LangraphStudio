/**
 * LangGraphSDK.ts
 * 
 * Programmatic Graph Generator & Auto-Layout Engine for LangGraph.
 * Enables 95% automated creation of nodes, endpoint configurations, dynamic variable 
 * bindings, decision rules, edge conditions, and topological DAG auto-layout positioning.
 */

export interface SDKServiceNodeConfig {
  id?: string;
  label?: string;
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  requestBody?: string;
  headers?: Array<{ key: string; value: string }>;
  authType?: 'none' | 'bearer' | 'basic' | 'oauth2' | 'api-key';
  timeout?: number;
}

export interface SDKDecisionNodeConfig {
  id?: string;
  label?: string;
  script: string;
}

export interface SDKLLMNodeConfig {
  id?: string;
  label?: string;
  model: string;
  prompt: string;
}

export interface SDKFormNodeConfig {
  id?: string;
  label?: string;
  formConfig?: any;
}

export interface SDKWorkflowNodeConfig {
  id?: string;
  label?: string;
  selectedWorkflowName?: string;
  dynamicSelection?: boolean;
  workflowFieldPath?: string;
}

export interface SDKNode {
  id: string;
  type: 'service' | 'decision' | 'llm' | 'form' | 'workflow' | 'parallel' | 'merge';
  data: Record<string, any>;
  position?: { x: number; y: number };
}

export interface SDKEdge {
  id?: string;
  source: string;
  target: string;
  condition?: string;
}

export class LangGraphSDK {
  private name: string;
  private nodes: SDKNode[] = [];
  private edges: SDKEdge[] = [];
  private inputs: Record<string, any> = { message: {} };
  private nodeCounter: Record<string, number> = {
    service: 1,
    decision: 1,
    llm: 1,
    form: 1,
    workflow: 1,
    parallel: 1,
    merge: 1,
  };

  constructor(workflowName: string = 'Automated Workflow') {
    this.name = workflowName;
  }

  public setWorkflowName(name: string): this {
    this.name = name;
    return this;
  }

  public setInputs(inputs: Record<string, any>): this {
    this.inputs = inputs;
    return this;
  }

  public addServiceNode(config: SDKServiceNodeConfig): string {
    const id = config.id || `service-${this.nodeCounter.service++}`;
    const node: SDKNode = {
      id,
      type: 'service',
      data: {
        label: config.label || id,
        url: config.url,
        method: config.method || 'GET',
        config: {
          requestBody: config.requestBody || '',
          headers: config.headers || [],
          authType: config.authType || 'none',
          authConfig: {},
          tlsConfig: { enabled: false, verifyCertificate: true },
          timeout: config.timeout || 30000,
          retryConfig: { enabled: false, maxRetries: 3, retryDelay: 1000 },
        },
      },
    };
    this.nodes.push(node);
    return id;
  }

  public addDecisionNode(config: SDKDecisionNodeConfig): string {
    const id = config.id || `decision-${this.nodeCounter.decision++}`;
    const node: SDKNode = {
      id,
      type: 'decision',
      data: {
        label: config.label || id,
        script: config.script,
      },
    };
    this.nodes.push(node);
    return id;
  }

  public addLLMNode(config: SDKLLMNodeConfig): string {
    const id = config.id || `llm-${this.nodeCounter.llm++}`;
    const node: SDKNode = {
      id,
      type: 'llm',
      data: {
        label: config.label || id,
        model: config.model || 'gpt-4',
        prompt: config.prompt,
      },
    };
    this.nodes.push(node);
    return id;
  }

  public addFormNode(config: SDKFormNodeConfig): string {
    const id = config.id || `form-${this.nodeCounter.form++}`;
    const node: SDKNode = {
      id,
      type: 'form',
      data: {
        label: config.label || id,
        formConfig: config.formConfig || null,
      },
    };
    this.nodes.push(node);
    return id;
  }

  public addWorkflowNode(config: SDKWorkflowNodeConfig): string {
    const id = config.id || `workflow-${this.nodeCounter.workflow++}`;
    const node: SDKNode = {
      id,
      type: 'workflow',
      data: {
        label: config.label || id,
        selectedWorkflowName: config.selectedWorkflowName,
        dynamicSelection: config.dynamicSelection || false,
        workflowFieldPath: config.workflowFieldPath,
      },
    };
    this.nodes.push(node);
    return id;
  }

  public addParallelNode(label?: string, id?: string): string {
    const nodeId = id || `parallel-${this.nodeCounter.parallel++}`;
    const node: SDKNode = {
      id: nodeId,
      type: 'parallel',
      data: { label: label || nodeId },
    };
    this.nodes.push(node);
    return nodeId;
  }

  public addMergeNode(label?: string, id?: string): string {
    const nodeId = id || `merge-${this.nodeCounter.merge++}`;
    const node: SDKNode = {
      id: nodeId,
      type: 'merge',
      data: { label: label || nodeId },
    };
    this.nodes.push(node);
    return nodeId;
  }

  public connect(sourceId: string, targetId: string, condition: string = ''): this {
    const edge: SDKEdge = {
      id: `edge-${sourceId}-${targetId}-${Date.now()}`,
      source: sourceId,
      target: targetId,
      condition,
    };
    this.edges.push(edge);
    return this;
  }

  /**
   * DAG Auto-Layout Engine
   * Calculates topological ranks level-by-level to auto-position nodes smoothly.
   */
  public applyAutoLayout(direction: 'LR' | 'TB' = 'LR'): this {
    if (this.nodes.length === 0) return this;

    const inDegree: Record<string, number> = {};
    const adjList: Record<string, string[]> = {};
    
    this.nodes.forEach((n) => {
      inDegree[n.id] = 0;
      adjList[n.id] = [];
    });

    this.edges.forEach((e) => {
      if (adjList[e.source]) adjList[e.source].push(e.target);
      if (inDegree[e.target] !== undefined) inDegree[e.target] += 1;
    });

    const levelMap: Record<string, number> = {};
    const queue: string[] = [];

    this.nodes.forEach((n) => {
      if (inDegree[n.id] === 0) {
        queue.push(n.id);
        levelMap[n.id] = 0;
      }
    });

    const visited = new Set<string>();
    while (queue.length > 0) {
      const current = queue.shift()!;
      visited.add(current);
      const currLevel = levelMap[current] || 0;

      adjList[current].forEach((neighbor) => {
        levelMap[neighbor] = Math.max(levelMap[neighbor] || 0, currLevel + 1);
        inDegree[neighbor] -= 1;
        if (inDegree[neighbor] === 0 && !visited.has(neighbor)) {
          queue.push(neighbor);
        }
      });
    }

    // Assign unvisited nodes to max level
    const maxAssignedLevel = Math.max(...Object.values(levelMap), 0);
    this.nodes.forEach((n) => {
      if (levelMap[n.id] === undefined) {
        levelMap[n.id] = maxAssignedLevel + 1;
      }
    });

    // Group nodes by level
    const nodesByLevel: Record<number, SDKNode[]> = {};
    this.nodes.forEach((n) => {
      const lvl = levelMap[n.id];
      if (!nodesByLevel[lvl]) nodesByLevel[lvl] = [];
      nodesByLevel[lvl].push(n);
    });

    // Calculate coordinates
    const levelDistance = direction === 'LR' ? 320 : 200;
    const nodeDistance = direction === 'LR' ? 160 : 280;

    Object.keys(nodesByLevel).forEach((lvlStr) => {
      const lvl = parseInt(lvlStr, 10);
      const levelNodes = nodesByLevel[lvl];
      const count = levelNodes.length;

      levelNodes.forEach((node, index) => {
        const primaryPos = lvl * levelDistance + 100;
        const secondaryPos = (index - (count - 1) / 2) * nodeDistance + 250;

        if (direction === 'LR') {
          node.position = { x: primaryPos, y: secondaryPos };
        } else {
          node.position = { x: secondaryPos, y: primaryPos };
        }
      });
    });

    return this;
  }

  /**
   * OpenAPI / Swagger Auto-Importer
   * Converts REST paths into pre-configured Service Nodes with payload templates.
   */
  public fromOpenAPI(openApiSpec: any): this {
    if (!openApiSpec || (!openApiSpec.paths && !openApiSpec.swagger && !openApiSpec.openapi)) {
      throw new Error('Invalid OpenAPI/Swagger specification');
    }

    const baseUrl = openApiSpec.servers?.[0]?.url || openApiSpec.host ? `https://${openApiSpec.host}${openApiSpec.basePath || ''}` : 'https://api.example.com';
    const paths = openApiSpec.paths || {};

    let previousNodeId: string | null = null;

    Object.keys(paths).forEach((pathKey) => {
      const methods = paths[pathKey];
      Object.keys(methods).forEach((methodKey) => {
        if (!['get', 'post', 'put', 'delete', 'patch'].includes(methodKey.toLowerCase())) return;

        const operation = methods[methodKey];
        const method = methodKey.toUpperCase() as 'GET' | 'POST' | 'PUT' | 'DELETE';
        const summary = operation.summary || operation.operationId || `${method} ${pathKey}`;
        const url = `${baseUrl}${pathKey}`;

        // Construct request body template from schema if available
        let requestBody = '';
        if (method !== 'GET' && operation.requestBody) {
          const content = operation.requestBody.content?.['application/json'];
          if (content?.schema?.properties) {
            const props = content.schema.properties;
            const sampleObj: Record<string, string> = {};
            Object.keys(props).forEach((prop) => {
              sampleObj[prop] = previousNodeId 
                ? `{${previousNodeId}.response.${prop}}` 
                : `{input.${prop}}`;
            });
            requestBody = JSON.stringify(sampleObj, null, 2);
          }
        }

        const nodeId = this.addServiceNode({
          label: summary,
          url,
          method,
          requestBody,
        });

        if (previousNodeId) {
          this.connect(previousNodeId, nodeId);
        }
        previousNodeId = nodeId;
      });
    });

    this.applyAutoLayout('LR');
    return this;
  }

  public exportGraph(): { graph: { nodes: SDKNode[]; edges: SDKEdge[]; inputs: Record<string, any> }; name: string } {
    this.applyAutoLayout('LR');
    return {
      name: this.name,
      graph: {
        nodes: this.nodes,
        edges: this.edges,
        inputs: this.inputs,
      },
    };
  }

  public exportJSON(): string {
    return JSON.stringify(this.exportGraph(), null, 2);
  }
}

/**
 * Pre-built Enterprise Workflow Recipes (95% Automated)
 */

export const createCreditApprovalWorkflowSDK = (): string => {
  const sdk = new LangGraphSDK('Credit Approval Engine (Automated)');

  const fetchUser = sdk.addServiceNode({
    label: '1. Fetch User Profile',
    url: 'https://api.bank.com/v1/customers/{input.userId}',
    method: 'GET',
    headers: [{ key: 'Authorization', value: 'Bearer {input.token}' }],
  });

  const fetchCreditScore = sdk.addServiceNode({
    label: '2. Query Bureau Score',
    url: 'https://api.bureau.com/v1/credit-check',
    method: 'POST',
    requestBody: JSON.stringify(
      {
        ssn: `{${fetchUser}.response.ssn}`,
        email: `{${fetchUser}.response.email}`,
      },
      null,
      2
    ),
  });

  const checkRisk = sdk.addDecisionNode({
    label: '3. Risk Decision Rule',
    script: `score = state.get("${fetchCreditScore}", {}).get("credit_score", 0)\nreturn score >= 720`,
  });

  const generateLoanOffer = sdk.addLLMNode({
    label: '4. AI Loan Offer Generator',
    model: 'gpt-4',
    prompt: `Generate personalized pre-approval letter for customer {${fetchUser}.response.name} with score {${fetchCreditScore}.response.credit_score}.`,
  });

  const postApproval = sdk.addServiceNode({
    label: '5. Issue Pre-Approval Token',
    url: 'https://api.bank.com/v1/loan/approve',
    method: 'POST',
    requestBody: JSON.stringify(
      {
        userId: `{${fetchUser}.response.id}`,
        offerText: `{${generateLoanOffer}.response.text}`,
        status: 'APPROVED',
      },
      null,
      2
    ),
  });

  const sendRejectionNotice = sdk.addServiceNode({
    label: '4. Send Rejection Email',
    url: 'https://api.bank.com/v1/notifications/send',
    method: 'POST',
    requestBody: JSON.stringify(
      {
        userId: `{${fetchUser}.response.id}`,
        template: 'REJECT_CREDIT_SCORE',
        reason: 'Score below threshold',
      },
      null,
      2
    ),
  });

  sdk.connect(fetchUser, fetchCreditScore);
  sdk.connect(fetchCreditScore, checkRisk);
  sdk.connect(checkRisk, generateLoanOffer, 'True');
  sdk.connect(generateLoanOffer, postApproval);
  sdk.connect(checkRisk, sendRejectionNotice, 'False');

  sdk.setInputs({
    userId: 'USR-89402',
    token: 'eyJhbGciOiJIUzI1NiIsIn...',
  });

  return sdk.exportJSON();
};

export const createECommerceOrderWorkflowSDK = (): string => {
  const sdk = new LangGraphSDK('Order Processing & Inventory Engine');

  const checkInventory = sdk.addServiceNode({
    label: '1. Check Stock Level',
    url: 'https://api.store.com/v1/inventory/{input.itemId}',
    method: 'GET',
  });

  const stockCheck = sdk.addDecisionNode({
    label: '2. In Stock?',
    script: `stock = state.get("${checkInventory}", {}).get("available_quantity", 0)\nreturn stock >= state.get("input", {}).get("quantity", 1)`,
  });

  const processPayment = sdk.addServiceNode({
    label: '3. Charge Card Service',
    url: 'https://api.payments.com/v1/charges',
    method: 'POST',
    requestBody: JSON.stringify(
      {
        amount: '{input.amount}',
        currency: 'USD',
        cardToken: '{input.cardToken}',
      },
      null,
      2
    ),
  });

  const triggerFulfillment = sdk.addServiceNode({
    label: '4. Dispatch Warehouse Order',
    url: 'https://api.warehouse.com/v1/shipments',
    method: 'POST',
    requestBody: JSON.stringify(
      {
        paymentId: `{${processPayment}.response.chargeId}`,
        itemId: '{input.itemId}',
        quantity: '{input.quantity}',
      },
      null,
      2
    ),
  });

  const notifyBackorder = sdk.addServiceNode({
    label: '3. Trigger Backorder Alert',
    url: 'https://api.store.com/v1/backorders',
    method: 'POST',
    requestBody: JSON.stringify({ itemId: '{input.itemId}' }, null, 2),
  });

  sdk.connect(checkInventory, stockCheck);
  sdk.connect(stockCheck, processPayment, 'True');
  sdk.connect(processPayment, triggerFulfillment);
  sdk.connect(stockCheck, notifyBackorder, 'False');

  sdk.setInputs({
    itemId: 'ITEM-9921',
    quantity: 2,
    amount: 149.99,
    cardToken: 'tok_visa_4444',
  });

  return sdk.exportJSON();
};
