import React, { useEffect, useState } from 'react';
import { Link, useParams, useLocation } from 'react-router-dom';
import { api } from '../services/api';

interface Server {
  id: string;
  name: string;
  iconUrl?: string;
}

export default function ServerStrip() {
  const location = useLocation();
  const params = useParams();
  const serverId = params.id;
  const [servers, setServers] = useState<Server[]>([]);

  useEffect(() => {
    api('/api/servers')
      .then((data: any) => setServers(data.servers || []))
      .catch(() => setServers([]));
  }, []);

  const isChats = location.pathname === '/app/chats' || location.pathname === '/app';
  const isServerView = location.pathname.startsWith('/app/servers/') && serverId;

  return (
    <div className="server-strip">
      <Link
        to="/app/chats"
        className={`server-strip-icon server-strip-dm ${isChats ? 'active' : ''}`}
        title="Чаты (Личные сообщения)"
      >
        <span className="server-strip-emoji">💬</span>
      </Link>
      <div className="server-strip-divider" />
      {servers.map((s) => (
        <Link
          key={s.id}
          to={`/app/servers/${s.id}`}
          className={`server-strip-icon ${isServerView && serverId === s.id ? 'active' : ''}`}
          title={s.name}
        >
          {s.iconUrl ? (
            <img src={s.iconUrl} alt={s.name} />
          ) : (
            <span className="server-strip-letter">{s.name.charAt(0).toUpperCase()}</span>
          )}
        </Link>
      ))}
      <Link
        to="/app/servers"
        className="server-strip-icon server-strip-add"
        title="Добавить сервер"
      >
        +
      </Link>
    </div>
  );
}
