// Расширенный экспорт истории чата

interface Message {
  id: string;
  text: string;
  senderId: string;
  sender?: { username: string; avatarUrl?: string };
  createdAt: number;
  attachmentUrl?: string;
  attachments?: Array<{ url: string; kind: string; mime?: string }>;
  replyTo?: { id: string; text: string };
  reactions?: Array<{ emoji: string; userId: string }>;
}

interface ChatInfo {
  id: string;
  name: string;
  type: 'dm' | 'group' | 'channel';
  members?: Array<{ id: string; username: string }>;
}

// Экспорт в PDF
export async function exportChatToPDF(messages: Message[], chatInfo: ChatInfo): Promise<void> {
  try {
    // Пытаемся использовать jsPDF, если доступен
    let jsPDF: any;
    try {
      const module = await import('jspdf');
      jsPDF = module.jsPDF || module.default;
    } catch {
      // Если jsPDF не установлен, используем простой текстовый экспорт
      alert('Для экспорта в PDF необходимо установить библиотеку jsPDF. Используйте экспорт в JSON или TXT.');
      return;
    }
    const doc = new jsPDF();
    
    let y = 20;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 20;
    const lineHeight = 7;
    
    // Заголовок
    doc.setFontSize(16);
    doc.text(`История чата: ${chatInfo.name}`, margin, y);
    y += 10;
    
    doc.setFontSize(10);
    doc.text(`Дата экспорта: ${new Date().toLocaleString('ru-RU')}`, margin, y);
    y += 5;
    doc.text(`Всего сообщений: ${messages.length}`, margin, y);
    y += 10;
    
    // Разделитель
    doc.line(margin, y, doc.internal.pageSize.width - margin, y);
    y += 10;
    
    // Сообщения
    doc.setFontSize(9);
    messages.forEach((msg, index) => {
      // Проверка на новую страницу
      if (y > pageHeight - 30) {
        doc.addPage();
        y = 20;
      }
      
      const date = new Date(msg.createdAt).toLocaleString('ru-RU');
      const sender = msg.sender?.username || 'Неизвестный';
      
      // Дата и отправитель
      doc.setFont(undefined, 'bold');
      doc.text(`[${date}] ${sender}:`, margin, y);
      y += lineHeight;
      
      // Текст сообщения
      doc.setFont(undefined, 'normal');
      const textLines = doc.splitTextToSize(msg.text || (msg.attachmentUrl ? '📎 Вложение' : 'Сообщение'), doc.internal.pageSize.width - 2 * margin);
      textLines.forEach((line: string) => {
        if (y > pageHeight - 20) {
          doc.addPage();
          y = 20;
        }
        doc.text(line, margin + 5, y);
        y += lineHeight;
      });
      
      // Вложения
      if (msg.attachmentUrl || (msg.attachments && msg.attachments.length > 0)) {
        const attachments = msg.attachments || [{ url: msg.attachmentUrl!, kind: 'file' }];
        attachments.forEach(att => {
          if (y > pageHeight - 20) {
            doc.addPage();
            y = 20;
          }
          doc.setFont(undefined, 'italic');
          doc.text(`📎 ${att.kind}: ${att.url}`, margin + 5, y);
          y += lineHeight;
        });
      }
      
      // Реакции
      if (msg.reactions && msg.reactions.length > 0) {
        const reactionsText = msg.reactions.map(r => r.emoji).join(' ');
        if (y > pageHeight - 20) {
          doc.addPage();
          y = 20;
        }
        doc.setFont(undefined, 'normal');
        doc.text(`Реакции: ${reactionsText}`, margin + 5, y);
        y += lineHeight;
      }
      
      y += 3; // Отступ между сообщениями
    });
    
    // Сохранение
    doc.save(`safegram_${chatInfo.name}_${Date.now()}.pdf`);
  } catch (e) {
    console.error('Failed to export PDF:', e);
    // Fallback: если jsPDF не установлен, показываем предупреждение
    alert('Для экспорта в PDF необходимо установить библиотеку jsPDF. Используйте экспорт в JSON или TXT.');
  }
}

// Экспорт медиа из чата
export async function exportChatMedia(messages: Message[], chatInfo: ChatInfo): Promise<void> {
  const mediaFiles: Array<{ url: string; name: string; type: string }> = [];
  
  messages.forEach(msg => {
    if (msg.attachmentUrl) {
      mediaFiles.push({
        url: msg.attachmentUrl,
        name: `media_${msg.id}_${Date.now()}`,
        type: 'file'
      });
    }
    if (msg.attachments) {
      msg.attachments.forEach(att => {
        mediaFiles.push({
          url: att.url,
          name: `media_${msg.id}_${att.kind}`,
          type: att.kind
        });
      });
    }
  });
  
  if (mediaFiles.length === 0) {
    alert('В этом чате нет медиафайлов для экспорта');
    return;
  }
  
  // Создаем ZIP архив с медиафайлами
  try {
    let JSZip: any;
    try {
      const module = await import('jszip');
      JSZip = module.default || module;
    } catch {
      // Если JSZip не установлен, просто показываем список URL
      const urlsText = mediaFiles.map(f => f.url).join('\n');
      const blob = new Blob([urlsText], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `safegram_${chatInfo.name}_media_urls_${Date.now()}.txt`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }
    const zip = new JSZip();
    
    // Скачиваем и добавляем файлы в ZIP
    for (const file of mediaFiles) {
      try {
        const response = await fetch(file.url);
        const blob = await response.blob();
        const fileName = `${file.type}/${file.name}.${blob.type.split('/')[1] || 'bin'}`;
        zip.file(fileName, blob);
      } catch (e) {
        console.warn(`Failed to download ${file.url}:`, e);
      }
    }
    
    // Генерируем и скачиваем ZIP
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `safegram_${chatInfo.name}_media_${Date.now()}.zip`;
    a.click();
    URL.revokeObjectURL(url);
    
    alert(`Экспортировано ${mediaFiles.length} медиафайлов`);
  } catch (e) {
    console.error('Failed to create ZIP:', e);
    // Fallback: просто показываем список URL
    const urlsText = mediaFiles.map(f => f.url).join('\n');
    const blob = new Blob([urlsText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `safegram_${chatInfo.name}_media_urls_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

// Создание резервной копии
export function createBackup(chats: ChatInfo[], allMessages: Record<string, Message[]>): string {
  const backup = {
    version: '1.0',
    exportDate: new Date().toISOString(),
    chats: chats.map(chat => ({
      ...chat,
      messages: allMessages[chat.id] || []
    }))
  };
  
  return JSON.stringify(backup, null, 2);
}

// Сохранение резервной копии в localStorage
export function saveBackupToLocal(backup: string): void {
  const timestamp = Date.now();
  const backups = JSON.parse(localStorage.getItem('safegram_backups') || '[]');
  backups.push({ timestamp, data: backup });
  
  // Храним только последние 10 резервных копий
  if (backups.length > 10) {
    backups.shift();
  }
  
  localStorage.setItem('safegram_backups', JSON.stringify(backups));
}

// Загрузка резервной копии из localStorage
export function loadBackupsFromLocal(): Array<{ timestamp: number; data: string }> {
  return JSON.parse(localStorage.getItem('safegram_backups') || '[]');
}

// Экспорт резервной копии в файл
export function exportBackupToFile(backup: string, filename?: string): void {
  const blob = new Blob([backup], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `safegram_backup_${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// Импорт резервной копии из файла
export function importBackupFromFile(file: File): Promise<any> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const backup = JSON.parse(e.target?.result as string);
        resolve(backup);
      } catch (err) {
        reject(new Error('Неверный формат файла резервной копии'));
      }
    };
    reader.onerror = () => reject(new Error('Ошибка чтения файла'));
    reader.readAsText(file);
  });
}
