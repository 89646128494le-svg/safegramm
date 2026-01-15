
import React, { useEffect, useState } from 'react';
import { api } from '../services/api';

export default function AdminModeration() {
  const [queue, setQueue] = useState<any[]>([]);
  const load = () => api('/api/mod/queue').then(setQueue).catch(()=>setQueue([]));
  useEffect(() => { load(); }, []);

  const approve = async (id: string) => {
    await api('/api/mod/approve/' + id, 'POST');
    load();
  };

  return (
    <div style={{padding: 16}}>
      <h2>Модерация (admin)</h2>
      {queue.length === 0 ? <div className="small">Очередь пуста</div> :
        queue.map(item => (
          <div key={item.id} className="list-item">
            <div>{item.title || '(без названия)'}</div>
            <div className="small">id: {item.id}</div>
            <button onClick={()=>approve(item.id)}>Одобрить</button>
          </div>
        ))
      }
    </div>
  );
}
