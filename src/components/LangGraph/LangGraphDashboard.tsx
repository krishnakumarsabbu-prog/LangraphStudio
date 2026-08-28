import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Edit, Trash2, LayoutGrid, Table as TableIcon, Search, Calendar, Eye } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { langGraphService, LangGraphWorkflow } from '../../services/langGraphService';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

export const LangGraphDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [workflows, setWorkflows] = useState<LangGraphWorkflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadWorkflows();
  }, []);

  const loadWorkflows = async () => {
    try {
      setLoading(true);
      const data = await langGraphService.getAllWorkflows();
      setWorkflows(data);
    } catch (error) {
      console.error('Failed to load workflows:', error);
      toast.error('Failed to load workflows');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    navigate('/langgraph/builder/new');
  };

  const handleEdit = (workflowName: string) => {
    navigate(`/langgraph/builder/${encodeURIComponent(workflowName)}`);
  };

  const handleView = (workflowName: string) => {
    navigate(`/langgraph/builder/${encodeURIComponent(workflowName)}?mode=view`);
  };


  const handleDelete = async (workflowName: string) => {
    if (window.confirm(`Are you sure you want to delete "${workflowName}"?`)) {
      try {
        await langGraphService.deleteWorkflow(workflowName);
        toast.success('Workflow deleted successfully');
        loadWorkflows();
      } catch (error) {
        console.error('Failed to delete workflow:', error);
        toast.error('Failed to delete workflow');
      }
    }
  };

  const filteredWorkflows = workflows.filter(
    (workflow) =>
      workflow.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getNodeCount = (data: any) => {
    return data?.graph?.nodes?.length || 0;
  };

  const getEdgeCount = (data: any) => {
    return data?.graph?.edges?.length || 0;
  };

  return (
    <div className="p-8 bg-gray-100 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                LangGraph Workflows
              </h1>
              <p className="text-gray-600">
                Build and manage your workflow graphs
              </p>
            </div>
            <Button
              onClick={handleCreateNew}
              className="bg-gray-700 hover:bg-gray-800 text-white px-6 py-3"
            >
              <Plus className="w-5 h-5 mr-2" />
              Create Workflow
            </Button>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                placeholder="Search workflows..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex bg-white border border-gray-300 rounded-lg">
              <button
                onClick={() => setViewMode('cards')}
                className={`p-2 ${
                  viewMode === 'cards'
                    ? 'bg-gray-700 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                } rounded-l-lg transition-colors`}
              >
                <LayoutGrid className="w-5 h-5" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-2 ${
                  viewMode === 'table'
                    ? 'bg-gray-700 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                } rounded-r-lg transition-colors`}
              >
                <TableIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-700 mx-auto"></div>
            <p className="text-gray-600 mt-4">Loading workflows...</p>
          </div>
        ) : filteredWorkflows.length === 0 ? (
          <Card className="p-12 text-center">
            <div className="text-gray-400 mb-4">
              <LayoutGrid className="w-16 h-16 mx-auto mb-4" />
              {searchQuery ? (
                <>
                  <h3 className="text-lg font-semibold mb-2">No workflows found</h3>
                  <p>Try adjusting your search query</p>
                </>
              ) : (
                <>
                  <h3 className="text-lg font-semibold mb-2">No workflows yet</h3>
                  <p>Create your first workflow to get started</p>
                  <Button
                    onClick={handleCreateNew}
                    className="bg-gray-700 hover:bg-gray-800 text-white mt-6"
                  >
                    <Plus className="w-5 h-5 mr-2" />
                    Create Your First Workflow
                  </Button>
                </>
              )}
            </div>
          </Card>
        ) : viewMode === 'cards' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredWorkflows.map((workflow) => (
              <Card
                key={workflow.name}
                className="p-6 hover:shadow-xl transition-all cursor-pointer bg-white border border-gray-300"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900 mb-1">
                      {workflow.name}
                    </h3>
                    <div className="mt-2">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-800">
                        v{workflow.latest_version}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 mb-4 text-sm text-gray-600">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
                    <span>{getNodeCount(workflow.data)} nodes</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                    <span>{getEdgeCount(workflow.data)} edges</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-gray-500 mb-4">
                  <Calendar className="w-3 h-3" />
                  <span>Created {format(new Date(workflow.created_at), 'MMM dd, yyyy')}</span>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={() => handleView(workflow.name)}
                    variant="outline"
                    className="flex-1 border-gray-300 text-gray-700 hover:bg-gray-100"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    View
                  </Button>
                  <Button
                    onClick={() => handleEdit(workflow.name)}
                    className="flex-1 bg-gray-700 hover:bg-gray-800 text-white"
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                  <Button
                    onClick={() => handleDelete(workflow.name)}
                    variant="outline"
                    className="px-4 text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="overflow-hidden bg-white">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-300">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Version
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Nodes
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Edges
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-300">
                  {filteredWorkflows.map((workflow) => (
                    <tr
                      key={workflow.name}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="font-semibold text-gray-900">
                          {workflow.name}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-800">
                          v{workflow.latest_version}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-800">
                          {getNodeCount(workflow.data)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-800">
                          {getEdgeCount(workflow.data)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {format(new Date(workflow.created_at), 'MMM dd, yyyy')}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            onClick={() => handleView(workflow.name)}
                            size="sm"
                            variant="outline"
                            className="border-gray-300 text-gray-700 hover:bg-gray-100"
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            View
                          </Button>
                          <Button
                            onClick={() => handleEdit(workflow.name)}
                            size="sm"
                            className="bg-gray-700 hover:bg-gray-800 text-white"
                          >
                            <Edit className="w-4 h-4 mr-1" />
                            Edit
                          </Button>
                          <Button
                            onClick={() => handleDelete(workflow.name)}
                            size="sm"
                            variant="outline"
                            className="text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

    </div>
  );
};
