// Кэширование изображений с использованием Cache API и IndexedDB

interface CachedImage {
  url: string;
  blob: Blob;
  timestamp: number;
  size: number;
}

const CACHE_NAME = 'safegram-images-v1';
const MAX_CACHE_SIZE = 100 * 1024 * 1024; // 100MB
const MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 дней

// Проверка поддержки Cache API
const supportsCacheAPI = 'caches' in window;

// Инициализация IndexedDB для fallback
let db: IDBDatabase | null = null;

const initIndexedDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db);
      return;
    }

    const request = indexedDB.open('safegram-image-cache', 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;
      if (!database.objectStoreNames.contains('images')) {
        const store = database.createObjectStore('images', { keyPath: 'url' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
};

// Получить изображение из кэша
export async function getCachedImage(url: string): Promise<Blob | null> {
  try {
    // Пробуем Cache API
    if (supportsCacheAPI) {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(url);
      if (cached) {
        const blob = await cached.blob();
        return blob;
      }
    }

    // Fallback на IndexedDB
    const database = await initIndexedDB();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(['images'], 'readonly');
      const store = transaction.objectStore('images');
      const request = store.get(url);

      request.onsuccess = () => {
        const result = request.result as CachedImage | undefined;
        if (result && Date.now() - result.timestamp < MAX_AGE) {
          resolve(result.blob);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => resolve(null);
    });
  } catch (e) {
    console.warn('Failed to get cached image:', e);
    return null;
  }
}

// Сохранить изображение в кэш
export async function cacheImage(url: string, blob: Blob): Promise<void> {
  try {
    // Пробуем Cache API
    if (supportsCacheAPI) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(url, new Response(blob));
      
      // Очистка старых записей
      await cleanupCache();
      return;
    }

    // Fallback на IndexedDB
    const database = await initIndexedDB();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(['images'], 'readwrite');
      const store = transaction.objectStore('images');
      
      const imageData: CachedImage = {
        url,
        blob,
        timestamp: Date.now(),
        size: blob.size
      };

      const request = store.put(imageData);

      request.onsuccess = () => {
        cleanupIndexedDB();
        resolve();
      };

      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.warn('Failed to cache image:', e);
  }
}

// Загрузить и закэшировать изображение
export async function loadAndCacheImage(url: string): Promise<Blob> {
  // Проверяем кэш
  const cached = await getCachedImage(url);
  if (cached) {
    return cached;
  }

  // Загружаем изображение
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load image: ${response.statusText}`);
  }

  const blob = await response.blob();
  
  // Кэшируем
  await cacheImage(url, blob);
  
  return blob;
}

// Очистка кэша Cache API
async function cleanupCache(): Promise<void> {
  try {
    const cache = await caches.open(CACHE_NAME);
    const keys = await cache.keys();
    
    // Подсчитываем размер
    let totalSize = 0;
    const entries: Array<{ url: string; size: number; timestamp: number }> = [];
    
    for (const request of keys) {
      const response = await cache.match(request);
      if (response) {
        const blob = await response.blob();
        totalSize += blob.size;
        // В Cache API нет timestamp, используем текущее время
        entries.push({ url: request.url, size: blob.size, timestamp: Date.now() });
      }
    }

    // Удаляем старые записи
    const now = Date.now();
    for (const entry of entries) {
      if (now - entry.timestamp > MAX_AGE) {
        await cache.delete(entry.url);
        totalSize -= entry.size;
      }
    }

    // Если размер все еще превышает лимит, удаляем самые старые
    if (totalSize > MAX_CACHE_SIZE) {
      entries.sort((a, b) => a.timestamp - b.timestamp);
      for (const entry of entries) {
        if (totalSize <= MAX_CACHE_SIZE) break;
        await cache.delete(entry.url);
        totalSize -= entry.size;
      }
    }
  } catch (e) {
    console.warn('Failed to cleanup cache:', e);
  }
}

// Очистка IndexedDB
async function cleanupIndexedDB(): Promise<void> {
  try {
    const database = await initIndexedDB();
    const transaction = database.transaction(['images'], 'readwrite');
    const store = transaction.objectStore('images');
    const index = store.index('timestamp');
    
    const now = Date.now();
    let totalSize = 0;
    
    // Подсчитываем размер и удаляем старые
    index.openCursor().onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        const data = cursor.value as CachedImage;
        if (now - data.timestamp > MAX_AGE) {
          cursor.delete();
        } else {
          totalSize += data.size;
        }
        cursor.continue();
      } else {
        // Если размер превышает лимит, удаляем самые старые
        if (totalSize > MAX_CACHE_SIZE) {
          const deleteTransaction = database.transaction(['images'], 'readwrite');
          const deleteStore = deleteTransaction.objectStore('images');
          const deleteIndex = deleteStore.index('timestamp');
          
          deleteIndex.openCursor().onsuccess = (deleteEvent) => {
            const deleteCursor = (deleteEvent.target as IDBRequest<IDBCursorWithValue>).result;
            if (deleteCursor && totalSize > MAX_CACHE_SIZE) {
              const deleteData = deleteCursor.value as CachedImage;
              totalSize -= deleteData.size;
              deleteCursor.delete();
              deleteCursor.continue();
            }
          };
        }
      }
    };
  } catch (e) {
    console.warn('Failed to cleanup IndexedDB:', e);
  }
}

// Очистить весь кэш
export async function clearImageCache(): Promise<void> {
  try {
    if (supportsCacheAPI) {
      await caches.delete(CACHE_NAME);
    }
    
    const database = await initIndexedDB();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(['images'], 'readwrite');
      const store = transaction.objectStore('images');
      const request = store.clear();
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.warn('Failed to clear cache:', e);
  }
}

// Получить размер кэша
export async function getCacheSize(): Promise<number> {
  try {
    let size = 0;
    
    if (supportsCacheAPI) {
      const cache = await caches.open(CACHE_NAME);
      const keys = await cache.keys();
      for (const request of keys) {
        const response = await cache.match(request);
        if (response) {
          const blob = await response.blob();
          size += blob.size;
        }
      }
    } else {
      const database = await initIndexedDB();
      return new Promise((resolve) => {
        const transaction = database.transaction(['images'], 'readonly');
        const store = transaction.objectStore('images');
        const request = store.openCursor();
        
        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
          if (cursor) {
            const data = cursor.value as CachedImage;
            size += data.size;
            cursor.continue();
          } else {
            resolve(size);
          }
        };
        
        request.onerror = () => resolve(size);
      });
    }
    
    return size;
  } catch (e) {
    console.warn('Failed to get cache size:', e);
    return 0;
  }
}
