import axios from 'axios';

const BACKEND_API_URL = 'http://localhost:8001';

export interface LangGraphWorkflow {
  name: string;
  context?: string;
  latest_version: number;
  created_at: string;
  data: any;
}

export const langGraphService = {
  async getAllWorkflows(tenantId?: string): Promise<LangGraphWorkflow[]> {
    try {
      const params = tenantId && tenantId !== 'all' ? { tenant_id: tenantId } : {};
      const response = await axios.get(`${BACKEND_API_URL}/api/flows`, { params });
      return response.data.map((flow: any) => ({
        name: flow.name,
        context: flow.context?.description || '',
        latest_version: flow.latest_version || flow.version || 1,
        created_at: flow.created_at,
        data: flow.data,
      }));
    } catch (error) {
      console.error('Error fetching workflows from backend:', error);
      return [];
    }
  },

  async getWorkflowByName(name: string): Promise<LangGraphWorkflow | null> {
    try {
      const response = await axios.get(`${BACKEND_API_URL}/api/flows/${encodeURIComponent(name)}`);
      return {
        name: response.data.name,
        context: response.data.context?.description || '',
        latest_version: response.data.version || response.data.latest_version || 1,
        created_at: response.data.created_at,
        data: response.data.data,
      };
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      console.error('Error fetching workflow from backend:', error);
      return null;
    }
  },

  async createWorkflow(name: string, context: string, workflowData: any, tenantId?: string): Promise<LangGraphWorkflow> {
    try {
      const response = await axios.post(`${BACKEND_API_URL}/api/flows`, {
        name,
        data: workflowData,
        context: { description: context },
        tenant_id: tenantId || 'tenant-gsa',
      });
      return {
        name: response.data.name,
        context,
        latest_version: response.data.version || response.data.latest_version || 1,
        created_at: response.data.created_at || new Date().toISOString(),
        data: workflowData,
      };
    } catch (error) {
      console.error('Error creating workflow in backend:', error);
      throw error;
    }
  },

  async updateWorkflow(name: string, context: string, workflowData: any, tenantId?: string): Promise<LangGraphWorkflow> {
    try {
      const response = await axios.post(`${BACKEND_API_URL}/api/flows`, {
        name,
        data: workflowData,
        context: { description: context },
        tenant_id: tenantId || 'tenant-gsa',
      });
      return {
        name: response.data.name,
        context,
        latest_version: response.data.version || response.data.latest_version || 1,
        created_at: response.data.created_at || new Date().toISOString(),
        data: workflowData,
      };
    } catch (error) {
      console.error('Error updating workflow in backend:', error);
      throw error;
    }
  },

  async deleteWorkflow(name: string): Promise<void> {
    try {
      await axios.delete(`${BACKEND_API_URL}/api/flows/${encodeURIComponent(name)}`);
    } catch (error) {
      console.error('Error deleting workflow in backend:', error);
      throw error;
    }
  },
};
