// Экспорт истории чата

interface Message {
  id: string;
  text: string;
  senderId: string;
  sender?: { username: string };
  createdAt: number;
  attachmentUrl?: string;
}

// Экспорт в JSON
export function exportChatToJSON(messages: Message[], chatName: string): void {
  const data = {
    chatName,
    exportDate: new Date().toISOString(),
    messageCount: messages.length,
    messages: messages.map(msg => ({
      id: msg.id,
      text: msg.text,
      sender: msg.sender?.username || 'Неизвестный',
      timestamp: new Date(msg.createdAt).toISOString(),
      date: new Date(msg.createdAt).toLocaleString('ru-RU'),
      attachmentUrl: msg.attachmentUrl,
    })),
  };
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `safegram_${chatName}_${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// Экспорт в TXT
export function exportChatToTXT(messages: Message[], chatName: string): void {
  let content = `История чата: ${chatName}\n`;
  content += `Дата экспорта: ${new Date().toLocaleString('ru-RU')}\n`;
  content += `Всего сообщений: ${messages.length}\n`;
  content += '='.repeat(50) + '\n\n';
  
  messages.forEach(msg => {
    const date = new Date(msg.createdAt).toLocaleString('ru-RU');
    const sender = msg.sender?.username || 'Неизвестный';
    content += `[${date}] ${sender}:\n`;
    content += `${msg.text || (msg.attachmentUrl ? '📎 Вложение' : 'Сообщение')}\n`;
    if (msg.attachmentUrl) {
      content += `Вложение: ${msg.attachmentUrl}\n`;
    }
    content += '\n';
  });
  
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `safegram_${chatName}_${Date.now()}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}
