import axios from 'axios';

const BACKEND_API_URL = 'http://localhost:8000';

export interface LangGraphWorkflow {
  name: string;
  context?: string;
  latest_version: number;
  created_at: string;
  data: any;
}

export const langGraphService = {
  async getAllWorkflows(): Promise<LangGraphWorkflow[]> {
    try {
      console.log('Fetching all workflows from Python backend');
      const response = await axios.get(`${BACKEND_API_URL}/api/flows`);
      return response.data.map((flow: any) => ({
        name: flow.name,
        context: flow.context?.description || '',
        latest_version: flow.latest_version,
        created_at: flow.created_at,
        data: flow.data
      }));
    } catch (error) {
      console.error('Error fetching workflows from backend:', error);
      return [];
    }
  },

  async getWorkflowByName(name: string): Promise<LangGraphWorkflow | null> {
    try {
      console.log('Fetching workflow from Python backend:', name);
      const response = await axios.get(`${BACKEND_API_URL}/api/flows/${name}`);
      return {
        name: response.data.name,
        context: response.data.context?.description || '',
        latest_version: response.data.version,
        created_at: response.data.created_at,
        data: response.data.data
      };
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      console.error('Error fetching workflow from backend:', error);
      return null;
    }
  },

  async createWorkflow(name: string, context: string, workflowData: any): Promise<LangGraphWorkflow> {
    try {
      console.log('Creating workflow in Python backend:', name);
      const response = await axios.post(`${BACKEND_API_URL}/api/flows`, {
        name,
        data: workflowData,
        context: { description: context }
      });
      return {
        name: response.data.name,
        context,
        latest_version: response.data.version,
        created_at: new Date().toISOString(),
        data: workflowData
      };
    } catch (error) {
      console.error('Error creating workflow in backend:', error);
      throw error;
    }
  },

  async updateWorkflow(name: string, context: string, workflowData: any): Promise<LangGraphWorkflow> {
    try {
      console.log('Updating workflow in Python backend:', name);
      const response = await axios.post(`${BACKEND_API_URL}/api/flows`, {
        name,
        data: workflowData,
        context: { description: context }
      });
      return {
        name: response.data.name,
        context,
        latest_version: response.data.version,
        created_at: new Date().toISOString(),
        data: workflowData
      };
    } catch (error) {
      console.error('Error updating workflow in backend:', error);
      throw error;
    }
  },

  async deleteWorkflow(name: string): Promise<void> {
    console.log('Delete not implemented in Python backend API');
    throw new Error('Delete operation not supported');
  },
};
