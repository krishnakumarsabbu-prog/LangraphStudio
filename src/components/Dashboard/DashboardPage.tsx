import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select } from '../ui/select';
import { TestGroupCard } from './TestGroupCard';
import { MockEndpointsHelper } from './MockEndpointsHelper';
import { testGroupService } from '../../services/testGroupService';
import { TestGroupWithStats, TestGroupStatus, ConnectionStatus } from '../../types/championChallenger';
import toast from 'react-hot-toast';
import { Loader2, Plus, Search, Filter, Circle } from 'lucide-react';

export function DashboardPage() {
  const navigate = useNavigate();
  const [testGroups, setTestGroups] = useState<TestGroupWithStats[]>([]);
  const [filteredGroups, setFilteredGroups] = useState<TestGroupWithStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<TestGroupStatus | 'all'>('all');
  const [healthFilter, setHealthFilter] = useState<ConnectionStatus | 'all'>('all');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadTestGroups();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [testGroups, searchQuery, statusFilter, healthFilter]);

  const loadTestGroups = async () => {
    setIsLoading(true);
    try {
      const groups = await testGroupService.getTestGroups();
      setTestGroups(groups);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load test groups');
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...testGroups];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (group) =>
          group.name.toLowerCase().includes(query) ||
          group.description.toLowerCase().includes(query) ||
          group.champion_url?.toLowerCase().includes(query)
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((group) => group.status === statusFilter);
    }

    if (healthFilter !== 'all') {
      filtered = filtered.filter((group) => group.overall_health === healthFilter);
    }

    setFilteredGroups(filtered);
  };

  const handleDelete = async (id: string) => {
    try {
      await testGroupService.deleteTestGroup(id);
      toast.success('Test group deleted successfully');
      loadTestGroups();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete test group');
    }
  };

  const handleEdit = (id: string) => {
    navigate(`/configure/${id}`);
  };

  const handleViewDetails = (id: string) => {
    navigate(`/monitor/${id}`);
  };

  const handleCreateNew = () => {
    navigate('/configure');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6 bg-light-bg dark:bg-dark-bg">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-light-text-primary dark:text-dark-text-primary mb-2">Test Groups</h1>
              <p className="text-light-text-secondary dark:text-dark-text-secondary">
                Manage and monitor your Champion-Challenger test configurations
              </p>
            </div>
            <Button onClick={handleCreateNew}>
              <Plus className="w-4 h-4 mr-2" />
              Create New Test Group
            </Button>
          </div>

          <div className="bg-white rounded-lg p-4 shadow-sm space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name, description, or URL..."
                  className="pl-10"
                />
              </div>
              <Button
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="w-4 h-4 mr-2" />
                Filters
              </Button>
            </div>

            {showFilters && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-200">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status
                  </label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as TestGroupStatus | 'all')}
                    className="w-full px-3 py-2 text-sm rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Statuses</option>
                    <option value="active">Active</option>
                    <option value="paused">Paused</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Health Status
                  </label>
                  <select
                    value={healthFilter}
                    onChange={(e) => setHealthFilter(e.target.value as ConnectionStatus | 'all')}
                    className="w-full px-3 py-2 text-sm rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Health Statuses</option>
                    <option value="healthy">Healthy</option>
                    <option value="unhealthy">Unhealthy</option>
                    <option value="untested">Untested</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>

        {testGroups.length === 0 && (
          <div className="mb-6">
            <MockEndpointsHelper />
          </div>
        )}

        {filteredGroups.length === 0 ? (
          <div className="text-center py-12">
            <div className="mb-4">
              <Circle className="w-16 h-16 text-gray-300 mx-auto" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No test groups found</h3>
            <p className="text-gray-600 mb-6">
              {testGroups.length === 0
                ? 'Get started by creating your first champion-challenger test'
                : 'Try adjusting your filters'}
            </p>
            {testGroups.length === 0 && (
              <Button onClick={handleCreateNew}>
                <Plus className="w-4 h-4 mr-2" />
                Create New Test
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredGroups.map((group) => (
              <TestGroupCard
                key={group.id}
                testGroup={group}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onViewDetails={handleViewDetails}
              />
            ))}
          </div>
        )}

        {filteredGroups.length > 0 && (
          <div className="mt-6 text-center text-sm text-gray-600">
            Showing {filteredGroups.length} of {testGroups.length} test groups
          </div>
        )}
      </div>
    </div>
  );
}
