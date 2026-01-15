/**
 * API Client
 * 
 * Профессиональный HTTP клиент с обработкой ошибок,
 * повторными попытками и кэшированием
 */

interface RequestOptions {
  method?: string;
  body?: any;
  headers?: Record<string, string>;
  retries?: number;
  timeout?: number;
  cache?: boolean;
}

interface ApiResponse<T = any> {
  data: T;
  status: number;
  headers: Headers;
}

class ApiClient {
  private baseUrl: string;
  private token: string | null = null;
  private defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  constructor(baseUrl: string = 'http://localhost:8080') {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.loadToken();
  }

  /**
   * Загрузка токена из хранилища
   */
  private loadToken() {
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('token');
    }
  }

  /**
   * Установка токена
   */
  setToken(token: string | null) {
    this.token = token;
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem('token', token);
      } else {
        localStorage.removeItem('token');
      }
    }
  }

  /**
   * Получение токена
   */
  getToken(): string | null {
    return this.token;
  }

  /**
   * Выполнение запроса с повторными попытками
   */
  private async request<T>(
    path: string,
    options: RequestOptions = {}
  ): Promise<ApiResponse<T>> {
    const {
      method = 'GET',
      body,
      headers = {},
      retries = 3,
      timeout = 30000
    } = options;

    // Объединение заголовков
    const requestHeaders: Record<string, string> = {
      ...this.defaultHeaders,
      ...headers
    };

    // Добавление токена
    if (this.token) {
      requestHeaders['Authorization'] = `Bearer ${this.token}`;
    }

    // Подготовка тела запроса
    let requestBody: string | undefined;
    if (body) {
      if (body instanceof FormData) {
        requestBody = body as any;
        delete requestHeaders['Content-Type']; // FormData сам установит
      } else {
        requestBody = JSON.stringify(body);
      }
    }

    const url = `${this.baseUrl}${path}`;
    let lastError: Error | null = null;

    // Повторные попытки
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        // Создание контроллера для таймаута
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(url, {
          method,
          headers: requestHeaders,
          body: requestBody,
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        // Обработка ответа
        const data = await this.parseResponse<T>(response);

        return {
          data,
          status: response.status,
          headers: response.headers
        };
      } catch (error: any) {
        lastError = error;

        // Не повторяем при определенных ошибках
        if (error.name === 'AbortError') {
          throw new Error('Request timeout');
        }

        // Если это последняя попытка, выбрасываем ошибку
        if (attempt === retries) {
          throw this.handleError(error, path);
        }

        // Задержка перед повторной попыткой (exponential backoff)
        await this.delay(Math.pow(2, attempt) * 1000);
      }
    }

    throw lastError || new Error('Request failed');
  }

  /**
   * Парсинг ответа
   */
  private async parseResponse<T>(response: Response): Promise<T> {
    const contentType = response.headers.get('content-type');

    if (contentType?.includes('application/json')) {
      const data = await response.json();

      if (!response.ok) {
        throw new ApiError(
          data.error || 'unknown_error',
          data.detail || data.message || 'Request failed',
          response.status,
          data
        );
      }

      return data;
    } else if (contentType?.includes('text/')) {
      const text = await response.text();
      if (!response.ok) {
        throw new ApiError('unknown_error', text, response.status);
      }
      return text as any;
    } else {
      // Бинарные данные
      const blob = await response.blob();
      if (!response.ok) {
        throw new ApiError('unknown_error', 'Request failed', response.status);
      }
      return blob as any;
    }
  }

  /**
   * Обработка ошибок
   */
  private handleError(error: any, path: string): Error {
    if (error instanceof ApiError) {
      return error;
    }

    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      return new ApiError('network_error', 'Network connection failed', 0);
    }

    return new ApiError('unknown_error', error.message || 'Request failed', 0);
  }

  /**
   * Задержка
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * GET запрос
   */
  async get<T = any>(path: string, options?: RequestOptions): Promise<T> {
    const response = await this.request<T>(path, { ...options, method: 'GET' });
    return response.data;
  }

  /**
   * POST запрос
   */
  async post<T = any>(path: string, body?: any, options?: RequestOptions): Promise<T> {
    const response = await this.request<T>(path, { ...options, method: 'POST', body });
    return response.data;
  }

  /**
   * PUT запрос
   */
  async put<T = any>(path: string, body?: any, options?: RequestOptions): Promise<T> {
    const response = await this.request<T>(path, { ...options, method: 'PUT', body });
    return response.data;
  }

  /**
   * PATCH запрос
   */
  async patch<T = any>(path: string, body?: any, options?: RequestOptions): Promise<T> {
    const response = await this.request<T>(path, { ...options, method: 'PATCH', body });
    return response.data;
  }

  /**
   * DELETE запрос
   */
  async delete<T = any>(path: string, options?: RequestOptions): Promise<T> {
    const response = await this.request<T>(path, { ...options, method: 'DELETE' });
    return response.data;
  }

  /**
   * Загрузка файла
   */
  async upload(path: string, file: File | Blob, onProgress?: (progress: number) => void): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);

    // Используем XMLHttpRequest для отслеживания прогресса
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && onProgress) {
          const progress = (e.loaded / e.total) * 100;
          onProgress(progress);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            resolve(data);
          } catch {
            resolve(xhr.responseText);
          }
        } else {
          reject(new ApiError('upload_error', 'Upload failed', xhr.status));
        }
      });

      xhr.addEventListener('error', () => {
        reject(new ApiError('network_error', 'Network error', 0));
      });

      xhr.open('POST', `${this.baseUrl}${path}`);
      
      if (this.token) {
        xhr.setRequestHeader('Authorization', `Bearer ${this.token}`);
      }

      xhr.send(formData);
    });
  }
}

/**
 * Класс ошибки API
 */
export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number = 0,
    public data?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Экспорт синглтона
// Используем import.meta.env для Vite - это стандартный способ работы с переменными окружения
const getApiUrl = () => {
  // В Vite переменные окружения доступны через import.meta.env
  // Переменные должны иметь префикс VITE_ или быть явно определены в vite.config.ts
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    // Проверяем VITE_ префикс (стандарт Vite)
    return import.meta.env.VITE_API_URL || import.meta.env.API_URL || 'http://localhost:8080';
  }
  // Fallback
  return 'http://localhost:8080';
};

export const apiClient = new ApiClient(getApiUrl());

export default apiClient;
