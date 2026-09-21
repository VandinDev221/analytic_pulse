import React, { useEffect, useState } from 'react';
import { ShieldCheck, Database, Server, RefreshCw } from 'lucide-react';
import { getApiHealth } from '../services/api';

export function ApiStatusPage() {
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchHealth = async () => {
    setLoading(true);
    try {
      const data = await getApiHealth();
      setHealth(data);
    } catch (err) {
      setHealth({ status: 'offline', error: String(err) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !health) {
    return <div className="p-8 text-center text-gray-500">Verificando status da API...</div>;
  }

  const isOk = health?.status === 'ok';

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Status da Infraestrutura</h1>
          <p className="text-sm text-gray-500">Monitoramento em tempo real do Backend, Postgres e Redis</p>
        </div>
        <button 
          onClick={fetchHealth}
          className="p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition"
        >
          <RefreshCw className={\w-5 h-5 text-gray-600 dark:text-gray-300 \\} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* API Server */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
              <Server className="w-5 h-5 text-blue-500" /> API Server
            </h3>
            <span className={\px-2 py-1 text-xs font-medium rounded-full \\}>
              {isOk ? 'Online' : 'Offline/Degraded'}
            </span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {health?.timestamp ? new Date(health.timestamp).toLocaleString() : 'N/A'}
          </p>
        </div>

        {/* PostgreSQL */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
              <Database className="w-5 h-5 text-purple-500" /> PostgreSQL
            </h3>
            <span className={\px-2 py-1 text-xs font-medium rounded-full \\}>
              {health?.postgres?.connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          {health?.postgres?.error && (
            <p className="text-xs text-red-500 mt-2">{health.postgres.error}</p>
          )}
        </div>

        {/* Redis */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-red-500" /> Redis Cloud
            </h3>
            <span className={\px-2 py-1 text-xs font-medium rounded-full \\}>
              {health?.redis?.connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          {health?.redis?.error && (
            <p className="text-xs text-red-500 mt-2">{health.redis.error}</p>
          )}
        </div>
      </div>
    </div>
  );
}
