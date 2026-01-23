// Улучшенный парсер Markdown для сообщений с подсветкой синтаксиса

// Простая подсветка синтаксиса для популярных языков
function highlightCode(code: string, language?: string): string {
  if (!language) return escapeHtml(code);
  
  const lang = language.toLowerCase();
  const escaped = escapeHtml(code);
  
  // Базовые паттерны для разных языков
  const patterns: Record<string, Array<[RegExp, string]>> = {
    javascript: [
      [/\b(const|let|var|function|if|else|for|while|return|class|import|export|async|await|try|catch|finally)\b/g, '<span class="keyword">$1</span>'],
      [/\b(true|false|null|undefined)\b/g, '<span class="literal">$1</span>'],
      [/("([^"\\]|\\.)*"|'([^'\\]|\\.)*')/g, '<span class="string">$1</span>'],
      [/\/\/.*$/gm, '<span class="comment">$&</span>'],
      [/\/\*[\s\S]*?\*\//g, '<span class="comment">$&</span>'],
      [/\b\d+\.?\d*\b/g, '<span class="number">$&</span>'],
    ],
    typescript: [
      [/\b(const|let|var|function|if|else|for|while|return|class|interface|type|enum|import|export|async|await|try|catch|finally|public|private|protected|readonly)\b/g, '<span class="keyword">$1</span>'],
      [/\b(true|false|null|undefined)\b/g, '<span class="literal">$1</span>'],
      [/("([^"\\]|\\.)*"|'([^'\\]|\\.)*')/g, '<span class="string">$1</span>'],
      [/\/\/.*$/gm, '<span class="comment">$&</span>'],
      [/\/\*[\s\S]*?\*\//g, '<span class="comment">$&</span>'],
      [/\b\d+\.?\d*\b/g, '<span class="number">$&</span>'],
    ],
    python: [
      [/\b(def|class|if|elif|else|for|while|return|import|from|try|except|finally|with|as|lambda|yield|async|await)\b/g, '<span class="keyword">$1</span>'],
      [/\b(True|False|None)\b/g, '<span class="literal">$1</span>'],
      [/("([^"\\]|\\.)*"|'([^'\\]|\\.)*')/g, '<span class="string">$1</span>'],
      [/#.*$/gm, '<span class="comment">$&</span>'],
      [/\b\d+\.?\d*\b/g, '<span class="number">$&</span>'],
    ],
    go: [
      [/\b(func|package|import|var|const|type|struct|interface|if|else|for|range|return|defer|go|chan|select|switch|case|default)\b/g, '<span class="keyword">$1</span>'],
      [/\b(true|false|nil)\b/g, '<span class="literal">$1</span>'],
      [/("([^"\\]|\\.)*"|`[^`]*`)/g, '<span class="string">$1</span>'],
      [/\/\/.*$/gm, '<span class="comment">$&</span>'],
      [/\/\*[\s\S]*?\*\//g, '<span class="comment">$&</span>'],
      [/\b\d+\.?\d*\b/g, '<span class="number">$&</span>'],
    ],
    html: [
      [/&lt;\/?[\w\s="'-]+&gt;/g, '<span class="tag">$&</span>'],
      [/&lt;!--[\s\S]*?--&gt;/g, '<span class="comment">$&</span>'],
    ],
    css: [
      [/([^{}]+)\{/g, '<span class="selector">$1</span>{'],
      [/:\s*([^;]+);/g, ': <span class="value">$1</span>;'],
      [/\/\*[\s\S]*?\*\//g, '<span class="comment">$&</span>'],
    ],
  };
  
  const langPatterns = patterns[lang] || patterns.javascript;
  let highlighted = escaped;
  
  for (const [pattern, replacement] of langPatterns) {
    highlighted = highlighted.replace(pattern, replacement);
  }
  
  return highlighted;
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function parseMarkdown(text: string): string {
  if (!text) return '';
  
  let html = text;
  
  // Экранируем HTML
  html = escapeHtml(html);
  
  // Блок кода с языком: ```language\nкод```
  html = html.replace(/```(\w+)?\n([\s\S]+?)```/g, (match, lang, code) => {
    const highlighted = highlightCode(code.trim(), lang);
    return `<pre class="code-block"><code class="language-${lang || 'text'}">${highlighted}</code></pre>`;
  });
  
  // Блок кода без языка: ```код```
  html = html.replace(/```([\s\S]+?)```/g, (match, code) => {
    const highlighted = highlightCode(code.trim());
    return `<pre class="code-block"><code>${highlighted}</code></pre>`;
  });
  
  // Инлайн код: `код` (должен быть после блоков кода)
  html = html.replace(/`([^`\n]+)`/g, '<code class="inline-code">$1</code>');
  
  // Жирный текст: **текст** или __текст__
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
  
  // Курсив: *текст* или _текст_ (но не внутри жирного)
  html = html.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');
  html = html.replace(/(?<!_)_(?!_)(.+?)(?<!_)_(?!_)/g, '<em>$1</em>');
  
  // Зачёркнутый: ~~текст~~
  html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');
  
  // Ссылки: [текст](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="message-link">$1</a>');
  
  // Автоматические ссылки (http/https)
  html = html.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer" class="message-link">$1</a>');
  
  // Переносы строк
  html = html.replace(/\n/g, '<br>');
  
  return html;
}

// Извлечение языка из блока кода
export function extractCodeLanguage(codeBlock: string): string | null {
  const match = codeBlock.match(/^```(\w+)/);
  return match ? match[1] : null;
}

// Проверка является ли URL видео (YouTube, Vimeo и т.д.)
export function isVideoUrl(url: string): boolean {
  const videoPatterns = [
    /youtube\.com\/watch\?v=/,
    /youtu\.be\//,
    /vimeo\.com\//,
    /dailymotion\.com\/video/,
    /twitch\.tv\//,
  ];
  return videoPatterns.some(pattern => pattern.test(url));
}

// Извлечение ID видео из URL
export function extractVideoId(url: string): { platform: string; id: string } | null {
  // YouTube
  const youtubeMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
  if (youtubeMatch) {
    return { platform: 'youtube', id: youtubeMatch[1] };
  }
  
  // Vimeo
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) {
    return { platform: 'vimeo', id: vimeoMatch[1] };
  }
  
  return null;
}
