import React from 'react';
import { motion } from 'framer-motion';
import { Shield, Lock, Eye, Database } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Privacy() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      style={{
        maxWidth: '900px',
        margin: '40px auto',
        padding: '40px',
        background: 'rgba(11, 16, 32, 0.95)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '24px',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
        color: '#e2e8f0'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
        <Shield size={32} color="#7c6cff" />
        <h1 style={{
          fontSize: '32px',
          fontWeight: 900,
          margin: 0,
          background: 'linear-gradient(135deg, #7c6cff 0%, #3dd8ff 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text'
        }}>
          Политика конфиденциальности
        </h1>
      </div>

      <div style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '32px' }}>
        <strong>Версия документа:</strong> 1.0 (Public Beta)<br />
        <strong>Дата последнего обновления:</strong> 22 января 2026 г.
      </div>

      <div style={{ lineHeight: 1.8, fontSize: '15px' }}>
        <section style={{ marginBottom: '32px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '16px',
            padding: '20px',
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '12px',
            marginBottom: '24px'
          }}>
            <Lock size={24} color="#10b981" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px', color: '#10b981' }}>
                Принцип минимизации данных
              </h3>
              <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.6 }}>
                Мы придерживаемся принципа минимизации сбора данных. Мы собираем только те данные, которые необходимы для функционирования сервиса. Личные сообщения в личных чатах шифруются на устройстве (E2EE) и недоступны серверу.
              </p>
            </div>
          </div>
        </section>

        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '16px', color: '#f0f4f8', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Database size={24} color="#7c6cff" />
            Сбор и обработка данных
          </h2>

          <h3 style={{ fontSize: '18px', fontWeight: 600, marginTop: '24px', marginBottom: '12px', color: '#e2e8f0' }}>
            Технические данные
          </h3>
          <p style={{ marginBottom: '12px' }}>
            Для функционирования Сервиса могут обрабатываться следующие данные:
          </p>
          <ul style={{ paddingLeft: '24px', marginBottom: '16px' }}>
            <li style={{ marginBottom: '8px' }}>
              <strong>Технические идентификаторы устройства (Device ID)</strong> — для обеспечения безопасности и предотвращения злоупотреблений.
            </li>
            <li style={{ marginBottom: '8px' }}>
              <strong>IP-адреса</strong> — для установления соединения и защиты от атак.
            </li>
            <li style={{ marginBottom: '8px' }}>
              <strong>Публичные ключи шифрования</strong> — для обеспечения End-to-End шифрования сообщений.
            </li>
            <li style={{ marginBottom: '8px' }}>
              <strong>История взаимодействия с ботом Safety</strong> — хранится в анонимизированном виде для улучшения качества ответов ИИ.
            </li>
          </ul>

          <h3 style={{ fontSize: '18px', fontWeight: 600, marginTop: '24px', marginBottom: '12px', color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Lock size={20} color="#7c6cff" />
            Личная переписка
          </h3>
          <div style={{
            padding: '16px',
            background: 'rgba(124, 108, 255, 0.1)',
            border: '1px solid rgba(124, 108, 255, 0.3)',
            borderRadius: '12px',
            marginBottom: '16px'
          }}>
            <p style={{ margin: 0, marginBottom: '12px' }}>
              Личные сообщения между Пользователями защищены технологиями шифрования. Разработчик предпринимает все разумные меры для обеспечения конфиденциальности переписки.
            </p>
            <p style={{ margin: 0, padding: '12px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
              <strong style={{ color: '#ef4444' }}>Внимание:</strong> В стадии Beta полная защита End-to-End (E2EE) может быть не реализована или работать с ограничениями. Пользователь не должен использовать Сервис для передачи государственной тайны, банковских данных или критически важной конфиденциальной информации.
            </p>
          </div>

          <h3 style={{ fontSize: '18px', fontWeight: 600, marginTop: '24px', marginBottom: '12px', color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Eye size={20} color="#7c6cff" />
            Взаимодействие с ИИ (Safety)
          </h3>
          <ul style={{ paddingLeft: '24px', marginBottom: '16px' }}>
            <li style={{ marginBottom: '8px' }}>
              Отправляя запрос боту Safety, Пользователь дает согласие на автоматизированную обработку текста запроса алгоритмами машинного обучения.
            </li>
            <li style={{ marginBottom: '8px' }}>
              Данные, передаваемые боту Safety, могут быть обработаны сторонними провайдерами LLM-моделей (если применимо). Мы требуем от провайдеров соблюдения конфиденциальности, но не несем ответственности за их действия.
            </li>
            <li style={{ marginBottom: '8px' }}>
              История взаимодействий хранится в анонимизированном виде и используется исключительно для улучшения качества сервиса.
            </li>
          </ul>
        </section>

        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '16px', color: '#f0f4f8' }}>
            Передача данных третьим лицам
          </h2>
          <ul style={{ paddingLeft: '24px', marginBottom: '16px' }}>
            <li style={{ marginBottom: '8px' }}>
              <strong>Мы не продаем данные:</strong> Разработчик не продает и не сдает в аренду персональные данные Пользователей.
            </li>
            <li style={{ marginBottom: '8px' }}>
              <strong>Раскрытие данных:</strong> Раскрытие данных возможно только в случаях, прямо предусмотренных законодательством (по официальному запросу правоохранительных органов), или для защиты прав Разработчика в суде.
            </li>
            <li style={{ marginBottom: '8px' }}>
              <strong>Провайдеры услуг:</strong> Мы можем использовать сторонние сервисы (хостинг, аналитика) для обеспечения работы Сервиса. Все такие провайдеры обязаны соблюдать конфиденциальность данных.
            </li>
          </ul>
        </section>

        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '16px', color: '#f0f4f8' }}>
            Ваши права
          </h2>
          <p style={{ marginBottom: '12px' }}>Вы имеете право:</p>
          <ul style={{ paddingLeft: '24px', marginBottom: '16px' }}>
            <li style={{ marginBottom: '8px' }}>Запросить информацию о данных, которые мы храним о вас.</li>
            <li style={{ marginBottom: '8px' }}>Запросить удаление ваших данных (с учетом ограничений, связанных с безопасностью и законодательством).</li>
            <li style={{ marginBottom: '8px' }}>Отозвать согласие на обработку данных (это может привести к невозможности использования Сервиса).</li>
            <li style={{ marginBottom: '8px' }}>Удалить свой аккаунт в любое время через настройки профиля.</li>
          </ul>
        </section>

        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '16px', color: '#f0f4f8' }}>
            Безопасность данных
          </h2>
          <p style={{ marginBottom: '12px' }}>
            Мы применяем современные методы защиты данных:
          </p>
          <ul style={{ paddingLeft: '24px', marginBottom: '16px' }}>
            <li style={{ marginBottom: '8px' }}>End-to-End шифрование для личных сообщений (в стадии Beta может работать с ограничениями).</li>
            <li style={{ marginBottom: '8px' }}>Хеширование паролей с использованием bcrypt.</li>
            <li style={{ marginBottom: '8px' }}>Защита от SQL-инъекций и XSS-атак.</li>
            <li style={{ marginBottom: '8px' }}>Регулярные обновления безопасности.</li>
          </ul>
          <p style={{ marginBottom: '12px', padding: '16px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '12px' }}>
            <strong>Важно:</strong> Несмотря на все меры безопасности, в стадии Beta мы не можем гарантировать абсолютную защиту данных. Используйте Сервис на свой страх и риск.
          </p>
        </section>

        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '16px', color: '#f0f4f8' }}>
            Изменения в политике конфиденциальности
          </h2>
          <p style={{ marginBottom: '12px' }}>
            Мы оставляем за собой право изменять настоящую Политику конфиденциальности. О существенных изменениях мы уведомим Пользователей через интерфейс Сервиса или по электронной почте.
          </p>
          <p style={{ marginBottom: '12px' }}>
            Продолжение использования Сервиса после публикации новой версии Политики означает принятие Пользователем новых условий.
          </p>
        </section>

        <div style={{
          marginTop: '40px',
          padding: '20px',
          background: 'rgba(124, 108, 255, 0.1)',
          border: '1px solid rgba(124, 108, 255, 0.3)',
          borderRadius: '12px',
          textAlign: 'center'
        }}>
          <p style={{ margin: 0, fontSize: '14px', color: '#94a3b8' }}>
            По вопросам конфиденциальности обращайтесь через{' '}
            <Link to="/feedback" style={{ color: '#7c6cff', textDecoration: 'underline' }}>форму обратной связи</Link>
          </p>
        </div>
      </div>
    </motion.div>
  );
}
