import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Settings, Send, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { api } from '../services/api';

export default function WebhookManager() {
  const [webhookURL, setWebhookURL] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await api('/api/admin/webhook');
      setWebhookURL(data.webhookURL || '');
      setEnabled(data.enabled || false);
    } catch (e: any) {
      setMessage({ type: 'error', text: 'Ошибка загрузки настроек: ' + e.message });
    }
  };

  const saveSettings = async () => {
    if (!webhookURL.trim() && enabled) {
      setMessage({ type: 'error', text: 'Введите URL webhook' });
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      await api('/api/admin/webhook', 'POST', { webhookURL: webhookURL.trim() });
      setMessage({ type: 'success', text: 'Настройки сохранены' });
      await loadSettings();
    } catch (e: any) {
      setMessage({ type: 'error', text: 'Ошибка сохранения: ' + e.message });
    } finally {
      setLoading(false);
    }
  };

  const testWebhook = async () => {
    setTesting(true);
    setMessage(null);
    try {
      await api('/api/admin/webhook/test', 'POST');
      setMessage({ type: 'success', text: 'Тестовое сообщение отправлено. Проверьте ваш webhook receiver.' });
    } catch (e: any) {
      setMessage({ type: 'error', text: 'Ошибка отправки: ' + e.message });
    } finally {
      setTesting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10"
    >
      <div className="flex items-center gap-3 mb-6">
        <Settings className="w-6 h-6 text-blue-400" />
        <h2 className="text-2xl font-bold text-white">Webhook Уведомления</h2>
      </div>

      <div className="space-y-6">
        {/* Статус */}
        <div className="flex items-center gap-3">
          {enabled ? (
            <>
              <CheckCircle className="w-5 h-5 text-green-400" />
              <span className="text-green-400 font-medium">Webhook активен</span>
            </>
          ) : (
            <>
              <XCircle className="w-5 h-5 text-gray-400" />
              <span className="text-gray-400">Webhook не настроен</span>
            </>
          )}
        </div>

        {/* URL Input */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Webhook URL
          </label>
          <input
            type="url"
            value={webhookURL}
            onChange={(e) => setWebhookURL(e.target.value)}
            placeholder="http://localhost:3000/webhook"
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="mt-2 text-sm text-gray-400">
            Укажите URL вашего локального webhook receiver. Например: <code className="text-blue-400">http://localhost:3000/webhook</code>
          </p>
        </div>

        {/* Сообщения */}
        {message && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-4 rounded-xl flex items-center gap-3 ${
              message.type === 'success'
                ? 'bg-green-500/20 border border-green-500/30'
                : message.type === 'error'
                ? 'bg-red-500/20 border border-red-500/30'
                : 'bg-blue-500/20 border border-blue-500/30'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle className="w-5 h-5 text-green-400" />
            ) : message.type === 'error' ? (
              <XCircle className="w-5 h-5 text-red-400" />
            ) : (
              <AlertCircle className="w-5 h-5 text-blue-400" />
            )}
            <span className={message.type === 'success' ? 'text-green-400' : message.type === 'error' ? 'text-red-400' : 'text-blue-400'}>
              {message.text}
            </span>
          </motion.div>
        )}

        {/* Кнопки */}
        <div className="flex gap-3">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={saveSettings}
            disabled={loading}
            className="flex-1 px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Сохранение...
              </>
            ) : (
              <>
                <CheckCircle className="w-5 h-5" />
                Сохранить
              </>
            )}
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={testWebhook}
            disabled={testing || !enabled}
            className="px-6 py-3 bg-purple-500 hover:bg-purple-600 text-white font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {testing ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Отправка...
              </>
            ) : (
              <>
                <Send className="w-5 h-5" />
                Тест
              </>
            )}
          </motion.button>
        </div>

        {/* Инструкции */}
        <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
          <h3 className="text-sm font-medium text-blue-400 mb-2">Как настроить:</h3>
          <ol className="list-decimal list-inside space-y-1 text-sm text-gray-400">
            <li>Запустите webhook receiver: <code className="text-blue-400">cd webhook-receiver && npm start</code></li>
            <li>Укажите URL в поле выше (например: <code className="text-blue-400">http://localhost:3000/webhook</code>)</li>
            <li>Нажмите "Сохранить"</li>
            <li>Нажмите "Тест" для проверки соединения</li>
          </ol>
        </div>
      </div>
    </motion.div>
  );
}
