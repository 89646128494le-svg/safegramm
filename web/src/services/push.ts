
import { api } from './api';

function urlB64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

// Проверка поддержки Push API
export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window;
}

// Регистрация Service Worker и подписка на Push-уведомления
export async function setupPush(): Promise<boolean> {
  if (!isPushSupported()) {
    console.warn('Push notifications not supported');
    return false;
  }
  
  try {
    // Регистрируем Service Worker
    const registration = await navigator.serviceWorker.register('/sw.js');
    console.log('Service Worker registered:', registration);
    
    // Получаем публичный ключ VAPID
    const { key } = await api('/api/push/vapid_public');
    if (!key) {
      console.warn('VAPID public key not available');
      return false;
    }
    
    // Подписываемся на Push-уведомления
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlB64ToUint8Array(key)
    });
    
    // Отправляем подписку на сервер
    await api('/api/push/subscribe', 'POST', {
      subscription: subscription.toJSON(),
      endpoint: subscription.endpoint,
      keys: {
        p256dh: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('p256dh')!))),
        auth: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('auth')!)))
      }
    });
    
    console.log('Push subscription successful');
    return true;
  } catch (error) {
    console.error('Failed to setup push notifications:', error);
    return false;
  }
}

// Отписка от Push-уведомлений
export async function unsubscribePush(): Promise<boolean> {
  if (!isPushSupported()) return false;
  
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    
    if (subscription) {
      await subscription.unsubscribe();
      await api('/api/push/unsubscribe', 'POST', { endpoint: subscription.endpoint });
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Failed to unsubscribe from push:', error);
    return false;
  }
}

// Проверка статуса подписки
export async function getPushSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  
  try {
    const registration = await navigator.serviceWorker.ready;
    return await registration.pushManager.getSubscription();
  } catch (error) {
    console.error('Failed to get push subscription:', error);
    return null;
  }
}
