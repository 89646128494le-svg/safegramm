/**
 * Cache Database (IndexedDB)
 * 
 * Локальная база данных для кэширования данных,
 * офлайн режима и синхронизации
 */

interface CacheOptions {
  dbName?: string;
  version?: number;
}

interface StoreConfig {
  name: string;
  keyPath: string;
  indexes?: Array<{ name: string; keyPath: string; unique?: boolean }>;
}

class CacheDatabase {
  private db: IDBDatabase | null = null;
  private dbName: string;
  private version: number;
  private stores: Map<string, IDBObjectStore> = new Map();

  constructor(options: CacheOptions = {}) {
    this.dbName = options.dbName || 'safegram-cache';
    this.version = options.version || 1;
  }

  /**
   * Инициализация базы данных
   */
  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => {
        reject(new Error('Failed to open database'));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Создание хранилищ
        this.createStores(db);
      };
    });
  }

  /**
   * Создание хранилищ
   */
  private createStores(db: IDBDatabase) {
    // Хранилище для чатов
    if (!db.objectStoreNames.contains('chats')) {
      const chatStore = db.createObjectStore('chats', { keyPath: 'id' });
      chatStore.createIndex('updatedAt', 'updatedAt', { unique: false });
      chatStore.createIndex('type', 'type', { unique: false });
    }

    // Хранилище для сообщений
    if (!db.objectStoreNames.contains('messages')) {
      const messageStore = db.createObjectStore('messages', { keyPath: 'id' });
      messageStore.createIndex('chatId', 'chatId', { unique: false });
      messageStore.createIndex('createdAt', 'createdAt', { unique: false });
      messageStore.createIndex('senderId', 'senderId', { unique: false });
    }

    // Хранилище для пользователей
    if (!db.objectStoreNames.contains('users')) {
      const userStore = db.createObjectStore('users', { keyPath: 'id' });
      userStore.createIndex('username', 'username', { unique: false });
    }

    // Хранилище для медиа
    if (!db.objectStoreNames.contains('media')) {
      const mediaStore = db.createObjectStore('media', { keyPath: 'id' });
      mediaStore.createIndex('messageId', 'messageId', { unique: false });
      mediaStore.createIndex('url', 'url', { unique: false });
    }

    // Хранилище для настроек
    if (!db.objectStoreNames.contains('settings')) {
      db.createObjectStore('settings', { keyPath: 'key' });
    }

    // Хранилище для очереди синхронизации
    if (!db.objectStoreNames.contains('syncQueue')) {
      const syncStore = db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
      syncStore.createIndex('type', 'type', { unique: false });
      syncStore.createIndex('timestamp', 'timestamp', { unique: false });
    }
  }

  /**
   * Получение хранилища
   */
  private getStore(storeName: string, mode: IDBTransactionMode = 'readonly'): IDBObjectStore {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const transaction = this.db.transaction([storeName], mode);
    return transaction.objectStore(storeName);
  }

  /**
   * Добавление записи
   */
  async add<T>(storeName: string, data: T): Promise<void> {
    return new Promise((resolve, reject) => {
      const store = this.getStore(storeName, 'readwrite');
      const request = store.add(data);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Обновление записи
   */
  async put<T>(storeName: string, data: T): Promise<void> {
    return new Promise((resolve, reject) => {
      const store = this.getStore(storeName, 'readwrite');
      const request = store.put(data);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Получение записи
   */
  async get<T>(storeName: string, key: IDBValidKey): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
      const store = this.getStore(storeName);
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Получение всех записей
   */
  async getAll<T>(storeName: string, indexName?: string, query?: IDBValidKey | IDBKeyRange): Promise<T[]> {
    return new Promise((resolve, reject) => {
      const store = this.getStore(storeName);
      const source = indexName ? store.index(indexName) : store;
      const request = query ? source.getAll(query) : source.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Удаление записи
   */
  async delete(storeName: string, key: IDBValidKey): Promise<void> {
    return new Promise((resolve, reject) => {
      const store = this.getStore(storeName, 'readwrite');
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Очистка хранилища
   */
  async clear(storeName: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const store = this.getStore(storeName, 'readwrite');
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Подсчет записей
   */
  async count(storeName: string, indexName?: string, query?: IDBValidKey | IDBKeyRange): Promise<number> {
    return new Promise((resolve, reject) => {
      const store = this.getStore(storeName);
      const source = indexName ? store.index(indexName) : store;
      const request = query ? source.count(query) : source.count();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Закрытие базы данных
   */
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

// Экспорт синглтона
export const cacheDB = new CacheDatabase();
export default cacheDB;
