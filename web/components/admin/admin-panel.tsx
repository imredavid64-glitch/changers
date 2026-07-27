"use client";

export default function AdminPanel() {
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [conferences, setConferences] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // Check if user is admin
    const checkAdminStatus = async () => {
      const response = await fetch('/api/auth/admin-check');
      const data = await response.json();
      setIsAdmin(data.isAdmin);
    };
    
    checkAdminStatus();
    fetchConferences();
    fetchAnalytics();
    
    // Real-time updates
    const interval = setInterval(() => {
      fetchConferences();
      fetchAnalytics();
    }, 30000); // Update every 30 seconds
    
    return () => clearInterval(interval);
  }, []);

  const fetchConferences = async () => {
    try {
      const response = await fetch('/api/conferences');
      const data = await response.json();
      setConferences(data.conferences);
    } catch (error) {
      console.error('Failed to fetch conferences:', error);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const response = await fetch('/api/analytics');
      const data = await response.json();
      setAnalytics(data);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    }
  };

  const pushConferenceUpdate = async (update) => {
    try {
      const response = await fetch('/api/conferences/admin', {
        method: 'POST',
        body: JSON.stringify({
          action: 'push_updates',
          data: update
        })
      });
      alert('Update pushed successfully!');
    } catch (error) {
      console.error('Failed to push update:', error);
    }
  };

  if (!isAdmin) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-red-800 mb-2">Access Denied</h3>
        <p className="text-red-600">You do not have admin privileges to access this panel.</p>
      </div>
    );
  }

  return (
    <div className="admin-panel">
      <div className="admin-header mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Admin Control Panel</h2>
        <div className="flex items-center space-x-4">
          <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-semibold">
            Admin Access Active
          </span>
          <button
            onClick={() => setShowAdminPanel(!showAdminPanel)}
            className="text-green-600 hover:text-green-700 underline"
          >Toggle Admin View</button>
        </div>
      </div>

      {showAdminPanel && (
        <div className="admin-features grid grid-cols-1 md:grid-cols-2 gap-6">
          <ConferenceAdmin conferences={conferences} />
          <AnalyticsDashboard analytics={analytics} />
          <FeatureToggles />
          <UserManagement />
        </div>
      )}

      <div className="admin-actions mt-8">
        <h3 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => pushConferenceUpdate({
              title: 'New Conference Announced!',
              content: 'Join us for an exclusive sustainability summit featuring keynotes from global leaders.',
              impact: 'high_sustainability',
              visibility: 'all_users'
            })}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Push Event Update
          </button>
          <button
            onClick={() => pushConferenceUpdate({
              title: 'System Maintenance',
              content: 'Scheduled maintenance this weekend. Features will be temporarily unavailable.',
              impact: 'neutral',
              visibility: 'all_users'
            })}
            className="bg-yellow-600 text-white px-6 py-3 rounded-lg hover:bg-yellow-700 transition-colors"
          >
            Maintenance Notice
          </button>
          <button
            onClick={() => setShowAdminPanel(!showAdminPanel)}
            className="bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition-colors"
          >{
            showAdminPanel ? 'Hide Admin View' : 'Show Admin View'
          }</button>
        </div>
      </div>
    </div>
  );
}

const ConferenceAdmin = ({ conferences }) => {
  const [newConference, setNewConference] = useState({
    title: '',
    description: '',
    date: '',
    location: '',
    isActive: true
  });

  const createConference = async () => {
    try {
      const response = await fetch('/api/conferences/admin', {
        method: 'POST',
        body: JSON.stringify({
          action: 'create_event',
          data: newConference
        })
      });
      alert('Conference created successfully!');
      setNewConference({
        title: '',
        description: '',
        date: '',
        location: '',
        isActive: true
      });
    } catch (error) {
      console.error('Failed to create conference:', error);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Conference Management</h3>
      
      <div className="conference-form mb-6">
        <h4 className="font-semibold mb-2">Create New Conference</h4>
        <div className="space-y-3">
          <input
            type="text"
            placeholder="Title"
            value={newConference.title}
            onChange={(e) => setNewConference({...newConference, title: e.target.value})}
            className="w-full px-3 py-2 border rounded-lg"
          />
          <textarea
            placeholder="Description"
            value={newConference.description}
            onChange={(e) => setNewConference({...newConference, description: e.target.value})}
            className="w-full px-3 py-2 border rounded-lg h-20"
          />
          <input
            type="datetime-local"
            value={newConference.date}
            onChange={(e) => setNewConference({...newConference, date: e.target.value})}
            className="w-full px-3 py-2 border rounded-lg"
          />
          <input
            type="text"
            placeholder="Location"
            value={newConference.location}
            onChange={(e) => setNewConference({...newConference, location: e.target.value})}
            className="w-full px-3 py-2 border rounded-lg"
          />
          <button
            onClick={createConference}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700"
          >Create Conference</button>
        </div>
      </div>

      <div className="conference-list">
        <h4 className="font-semibold mb-2">Active Conferences</h4>
        <div className="space-y-2">
          {conferences.map(conf => (
            <div key={conf.id} className="flex justify-between items-center p-3 bg-gray-50 rounded">
              <span className="font-medium">{conf.title}</span>
              <span className={`px-2 py-1 rounded text-sm ${conf.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                {conf.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const AnalyticsDashboard = ({ analytics }) => {
  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Analytics Dashboard</h3>
      
      {analytics ? (
        <div className="analytics-grid grid grid-cols-2 gap-4">
          <div className="bg-green-50 p-4 rounded-lg">
            <h5 className="font-semibold text-green-800 mb-2">User Statistics</h5>
            <p className="text-sm text-gray-600">Total Users: {analytics.stats?.totalUsers || 0}</p>
            <p className="text-sm text-gray-600">Active Sessions: {analytics.stats?.activeSessions || 0}</p>
          </div>
          <div className="bg-blue-50 p-4 rounded-lg">
            <h5 className="font-semibold text-blue-800 mb-2">Sustainability Metrics</h5>
            <p className="text-sm text-gray-600">CO₂ Saved: {analytics.stats?.co2Saved || 0} g</p>
            <p className="text-sm text-gray-600">Energy Optimized: {analytics.stats?.energyOptimized || 0} kWh</p>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <h5 className="font-semibold text-purple-800 mb-2">Conference Activity</h5>
            <p className="text-sm text-gray-600">Active Events: {analytics.conferences?.length || 0}</p>
            <p className="text-sm text-gray-600">Recent Registrations: {analytics.stats?.recentRegistrations || 0}</p>
          </div>
          <div className="bg-orange-50 p-4 rounded-lg">
            <h5 className="font-semibold text-orange-800 mb-2">System Health</h5>
            <p className="text-sm text-gray-600">Server Uptime: {analytics.stats?.uptime || '99.9%'}</p>
            <p className="text-sm text-gray-600">Response Time: {analytics.stats?.responseTime || '150ms'}</p>
          </div>
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          <p>Loading analytics data...</p>
        </div>
      )}
    </div>
  );
};

const FeatureToggles = () => {
  const [features, setFeatures] = useState({
    conferenceScheduler: true,
    realTimeAnalytics: true,
    userAnalytics: true,
    sustainabilityReports: true,
    aiModelTuning: true,
    featureFlags: true,
    environmentMonitoring: true,
    performanceOptimization: true
  });

  const toggleFeature = (feature) => {
    setFeatures(prev => ({
      ...prev,
      [feature]: !prev[feature]
    }));
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Feature Toggles</h3>
      <div className="grid grid-cols-1 gap-3">
        {Object.entries(features).map(([feature, enabled]) => (
          <div key={feature} className="flex items-center justify-between p-3 bg-gray-50 rounded">
            <span className="text-sm font-medium">{feature.replace(/([A-Z])/g, ' $1').trim()}</span>
            <button
              onClick={() => toggleFeature(feature)}
              className={`w-12 h-6 rounded-full transition-colors ${enabled ? 'bg-green-600' : 'bg-gray-300'}`}
            >
              <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform ${enabled ? 'translate-x-6' : 'translate-x-0'}`} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  
  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">User Management</h3>
      <div className="text-center py-8 text-gray-500">
        <p>User management features would be available here.</p>
        <p className="text-sm mt-2">Admin can manage user roles, permissions, and activity.</p>
      </div>
    </div>
  );
};