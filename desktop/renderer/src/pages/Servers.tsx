/**
 * Servers Page - Страница серверов
 */

import React, { useEffect, useState } from 'react';
import { apiClient } from '../core/api/client';
import { useNavigate } from 'react-router-dom';
import './Servers.css';

interface ServersProps {
  wsManager: any;
  user: any;
}

interface Server {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  iconUrl?: string;
  createdAt: number;
}

export default function Servers({ wsManager, user }: ServersProps) {
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadServers();
  }, []);

  async function loadServers() {
    try {
      setLoading(true);
      const response = await apiClient.get('/api/servers');
      setServers(response.servers || []);
    } catch (error) {
      console.error('Failed to load servers:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="servers-page-loading">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="servers-page">
      <h2>🖥️ Серверы</h2>
      
      <div className="servers-list">
        {servers.length === 0 ? (
          <div className="servers-empty">
            <p>Нет серверов</p>
          </div>
        ) : (
          servers.map(server => (
            <div
              key={server.id}
              className="server-item"
              onClick={() => navigate(`/servers/${server.id}`)}
            >
              <div className="server-icon">
                {server.iconUrl ? (
                  <img src={server.iconUrl} alt={server.name} />
                ) : (
                  <div className="server-icon-placeholder">
                    {server.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="server-info">
                <div className="server-name">{server.name}</div>
                {server.description && (
                  <div className="server-description">{server.description}</div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
