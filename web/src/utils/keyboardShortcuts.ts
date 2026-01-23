// Утилиты для горячих клавиш

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean; // Cmd на Mac
  callback: () => void;
  description?: string;
}

class KeyboardShortcutsManager {
  private shortcuts: Map<string, KeyboardShortcut> = new Map();
  private isEnabled: boolean = true;

  register(shortcut: KeyboardShortcut) {
    const id = this.getShortcutId(shortcut);
    this.shortcuts.set(id, shortcut);
  }

  unregister(shortcut: KeyboardShortcut) {
    const id = this.getShortcutId(shortcut);
    this.shortcuts.delete(id);
  }

  private getShortcutId(shortcut: KeyboardShortcut): string {
    const modifiers = [
      shortcut.ctrl ? 'ctrl' : '',
      shortcut.shift ? 'shift' : '',
      shortcut.alt ? 'alt' : '',
      shortcut.meta ? 'meta' : '',
    ].filter(Boolean).join('+');
    return `${modifiers ? modifiers + '+' : ''}${shortcut.key.toLowerCase()}`;
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    if (!this.isEnabled) return;

    // Игнорируем если пользователь вводит текст
    const target = e.target as HTMLElement;
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable
    ) {
      // Разрешаем некоторые глобальные горячие клавиши даже при вводе
      const allowedKeys = ['Escape', 'F1', 'F2', 'F3', 'F4', 'F5'];
      if (!allowedKeys.includes(e.key)) {
        return;
      }
    }

    const key = e.key.toLowerCase();
    const modifiers = [
      e.ctrlKey ? 'ctrl' : '',
      e.shiftKey ? 'shift' : '',
      e.altKey ? 'alt' : '',
      e.metaKey ? 'meta' : '',
    ].filter(Boolean).join('+');

    const shortcutId = `${modifiers ? modifiers + '+' : ''}${key}`;
    const shortcut = this.shortcuts.get(shortcutId);

    if (shortcut) {
      e.preventDefault();
      e.stopPropagation();
      shortcut.callback();
    }
  };

  enable() {
    this.isEnabled = true;
  }

  disable() {
    this.isEnabled = false;
  }

  init() {
    document.addEventListener('keydown', this.handleKeyDown);
  }

  destroy() {
    document.removeEventListener('keydown', this.handleKeyDown);
    this.shortcuts.clear();
  }

  // Получить все зарегистрированные горячие клавиши
  getAllShortcuts(): Array<KeyboardShortcut & { id: string }> {
    return Array.from(this.shortcuts.entries()).map(([id, shortcut]) => ({
      ...shortcut,
      id,
    }));
  }
}

// Глобальный экземпляр менеджера
export const keyboardShortcuts = new KeyboardShortcutsManager();

// Инициализация при загрузке модуля
if (typeof window !== 'undefined') {
  keyboardShortcuts.init();
}

// Стандартные горячие клавиши для чата
export const defaultChatShortcuts: KeyboardShortcut[] = [
  {
    key: 'k',
    ctrl: true,
    callback: () => {
      // Открыть поиск чатов
      const searchInput = document.querySelector('[data-chat-search]') as HTMLInputElement;
      if (searchInput) {
        searchInput.focus();
      }
    },
    description: 'Поиск чатов',
  },
  {
    key: 'n',
    ctrl: true,
    callback: () => {
      // Создать новый чат
      const newChatButton = document.querySelector('[data-new-chat]') as HTMLElement;
      if (newChatButton) {
        newChatButton.click();
      }
    },
    description: 'Новый чат',
  },
  {
    key: 'Escape',
    callback: () => {
      // Закрыть модальные окна
      const modals = document.querySelectorAll('[data-modal]');
      modals.forEach((modal) => {
        const closeButton = modal.querySelector('[data-modal-close]') as HTMLElement;
        if (closeButton) {
          closeButton.click();
        }
      });
    },
    description: 'Закрыть модальное окно',
  },
  {
    key: 'ArrowUp',
    ctrl: true,
    callback: () => {
      // Перейти к предыдущему чату
      const chatItems = Array.from(document.querySelectorAll('[data-chat-item]'));
      const currentIndex = chatItems.findIndex((item) =>
        item.classList.contains('active')
      );
      if (currentIndex > 0) {
        (chatItems[currentIndex - 1] as HTMLElement).click();
      }
    },
    description: 'Предыдущий чат',
  },
  {
    key: 'ArrowDown',
    ctrl: true,
    callback: () => {
      // Перейти к следующему чату
      const chatItems = Array.from(document.querySelectorAll('[data-chat-item]'));
      const currentIndex = chatItems.findIndex((item) =>
        item.classList.contains('active')
      );
      if (currentIndex < chatItems.length - 1) {
        (chatItems[currentIndex + 1] as HTMLElement).click();
      }
    },
    description: 'Следующий чат',
  },
  {
    key: 'Enter',
    callback: () => {
      // Отправить сообщение (если фокус в поле ввода)
      const input = document.activeElement as HTMLInputElement | HTMLTextAreaElement;
      if (input && (input.tagName === 'TEXTAREA' || input.tagName === 'INPUT')) {
        const sendButton = input.closest('form')?.querySelector('[data-send-button]') as HTMLElement;
        if (sendButton) {
          sendButton.click();
        }
      }
    },
    description: 'Отправить сообщение',
  },
];
