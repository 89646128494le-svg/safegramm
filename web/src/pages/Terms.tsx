import React from 'react';
import { motion } from 'framer-motion';
import { FileText, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Terms() {
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
        <FileText size={32} color="#7c6cff" />
        <h1 style={{
          fontSize: '32px',
          fontWeight: 900,
          margin: 0,
          background: 'linear-gradient(135deg, #7c6cff 0%, #3dd8ff 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text'
        }}>
          Пользовательское соглашение
        </h1>
      </div>

      <div style={{
        padding: '16px',
        background: 'rgba(239, 68, 68, 0.1)',
        border: '1px solid rgba(239, 68, 68, 0.3)',
        borderRadius: '12px',
        marginBottom: '32px',
        display: 'flex',
        gap: '12px',
        alignItems: 'flex-start'
      }}>
        <AlertTriangle size={20} color="#ef4444" style={{ flexShrink: 0, marginTop: '2px' }} />
        <div>
          <strong style={{ color: '#ef4444', display: 'block', marginBottom: '8px' }}>
            ВАЖНОЕ УВЕДОМЛЕНИЕ
          </strong>
          <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.6 }}>
            Настоящее Соглашение является юридически обязательным договором между Вами («Пользователь») и Разработчиком программного обеспечения SafeGram («Разработчик», «Мы»). Загружая, устанавливая, копируя или используя приложение SafeGram (включая интегрированный ИИ-ассистент «Safety»), Вы подтверждаете, что прочитали, поняли и приняли условия настоящего Соглашения.
          </p>
          <p style={{ margin: '8px 0 0 0', fontSize: '14px', lineHeight: 1.6 }}>
            <strong>Если Вы не согласны с условиями, немедленно удалите Приложение и прекратите его использование.</strong>
          </p>
        </div>
      </div>

      <div style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '32px' }}>
        <strong>Версия документа:</strong> 1.0 (Public Beta)<br />
        <strong>Дата последнего обновления:</strong> 22 января 2026 г.
      </div>

      <div style={{ lineHeight: 1.8, fontSize: '15px' }}>
        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '16px', color: '#f0f4f8' }}>
            РАЗДЕЛ I. ОБЩИЕ ПОЛОЖЕНИЯ
          </h2>
          
          <h3 style={{ fontSize: '18px', fontWeight: 600, marginTop: '24px', marginBottom: '12px', color: '#e2e8f0' }}>
            1. Термины и определения
          </h3>
          <ul style={{ paddingLeft: '24px', marginBottom: '16px' }}>
            <li style={{ marginBottom: '8px' }}>
              <strong>Приложение (Сервис)</strong> — программный комплекс SafeGram, предназначенный для обмена мгновенными сообщениями, медиафайлами и взаимодействия с искусственным интеллектом.
            </li>
            <li style={{ marginBottom: '8px' }}>
              <strong>Safety</strong> — интегрированный в Приложение виртуальный ассистент на базе технологий искусственного интеллекта (LLM), предназначенный для анализа текста, генерации ответов и помощи Пользователю.
            </li>
            <li style={{ marginBottom: '8px' }}>
              <strong>Аккаунт</strong> — уникальная учетная запись Пользователя в Сервисе.
            </li>
            <li style={{ marginBottom: '8px' }}>
              <strong>Контент</strong> — любая информация (текст, аудио, видео, файлы), передаваемая Пользователем через Сервис.
            </li>
          </ul>

          <h3 style={{ fontSize: '18px', fontWeight: 600, marginTop: '24px', marginBottom: '12px', color: '#e2e8f0' }}>
            2. Статус BETA-версии
          </h3>
          <ul style={{ paddingLeft: '24px' }}>
            <li style={{ marginBottom: '8px' }}>Пользователь уведомлен и соглашается с тем, что Приложение находится в стадии публичного бета-тестирования.</li>
            <li style={{ marginBottom: '8px' }}>Приложение может содержать программные ошибки, сбои, уязвимости безопасности и неточности.</li>
            <li style={{ marginBottom: '8px' }}>Разработчик не гарантирует бесперебойную работу Сервиса и сохранность данных Пользователя в случае технических сбоев или хакерских атак. Использование Приложения осуществляется Пользователем на свой страх и риск.</li>
          </ul>
        </section>

        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '16px', color: '#f0f4f8' }}>
            РАЗДЕЛ II. ПОЛИТИКА КОНФИДЕНЦИАЛЬНОСТИ
          </h2>
          
          <h3 style={{ fontSize: '18px', fontWeight: 600, marginTop: '24px', marginBottom: '12px', color: '#e2e8f0' }}>
            3. Сбор и обработка данных
          </h3>
          <p style={{ marginBottom: '12px' }}>
            <strong>3.1. Минимизация данных:</strong> Мы придерживаемся принципа минимизации сбора данных. Для функционирования Сервиса могут обрабатываться:
          </p>
          <ul style={{ paddingLeft: '24px', marginBottom: '16px' }}>
            <li style={{ marginBottom: '8px' }}>Технические идентификаторы устройства (Device ID).</li>
            <li style={{ marginBottom: '8px' }}>IP-адреса (для установления соединения).</li>
            <li style={{ marginBottom: '8px' }}>Публичные ключи шифрования.</li>
            <li style={{ marginBottom: '8px' }}>История взаимодействия с ботом Safety (хранится в анонимизированном виде для улучшения качества ответов).</li>
          </ul>

          <p style={{ marginBottom: '12px' }}>
            <strong>3.2. Личная переписка:</strong>
          </p>
          <p style={{ marginBottom: '12px', paddingLeft: '16px', borderLeft: '3px solid rgba(124, 108, 255, 0.5)' }}>
            Личные сообщения между Пользователями защищены технологиями шифрования. Разработчик предпринимает все разумные меры для обеспечения конфиденциальности переписки.
          </p>
          <p style={{ marginBottom: '12px', paddingLeft: '16px', borderLeft: '3px solid rgba(239, 68, 68, 0.5)' }}>
            <strong>Внимание:</strong> В стадии Beta полная защита End-to-End (E2EE) может быть не реализована или работать с ограничениями. Пользователь не должен использовать Сервис для передачи государственной тайны, банковских данных или критически важной конфиденциальной информации.
          </p>

          <p style={{ marginBottom: '12px' }}>
            <strong>3.3. Взаимодействие с ИИ (Safety):</strong>
          </p>
          <ul style={{ paddingLeft: '24px', marginBottom: '16px' }}>
            <li style={{ marginBottom: '8px' }}>Отправляя запрос боту Safety, Пользователь дает согласие на автоматизированную обработку текста запроса алгоритмами машинного обучения.</li>
            <li style={{ marginBottom: '8px' }}>Данные, передаваемые боту Safety, могут быть обработаны сторонними провайдерами LLM-моделей (если применимо). Мы требуем от провайдеров соблюдения конфиденциальности, но не несем ответственности за их действия.</li>
          </ul>

          <h3 style={{ fontSize: '18px', fontWeight: 600, marginTop: '24px', marginBottom: '12px', color: '#e2e8f0' }}>
            4. Передача данных третьим лицам
          </h3>
          <ul style={{ paddingLeft: '24px' }}>
            <li style={{ marginBottom: '8px' }}>Разработчик не продает и не сдает в аренду персональные данные Пользователей.</li>
            <li style={{ marginBottom: '8px' }}>Раскрытие данных возможно только в случаях, прямо предусмотренных законодательством (по официальному запросу правоохранительных органов), или для защиты прав Разработчика в суде.</li>
          </ul>
        </section>

        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '16px', color: '#f0f4f8' }}>
            РАЗДЕЛ III. ИСПОЛЬЗОВАНИЕ ИИ-АССИСТЕНТА «SAFETY»
          </h2>
          
          <h3 style={{ fontSize: '18px', fontWeight: 600, marginTop: '24px', marginBottom: '12px', color: '#e2e8f0' }}>
            5. Ограничение ответственности за ИИ
          </h3>
          <p style={{ marginBottom: '12px' }}>
            <strong>5.1. Галлюцинации ИИ:</strong> Пользователь понимает, что ответы бота Safety генерируются нейросетью. ИИ может предоставлять ложную, неточную, устаревшую или выдуманную информацию («галлюцинации»).
          </p>
          <p style={{ marginBottom: '12px' }}>
            <strong>5.2. Запрет на профессиональные советы:</strong> Safety не является врачом, юристом, финансовым консультантом или иным лицензированным специалистом.
          </p>
          <div style={{
            padding: '16px',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '12px',
            marginBottom: '16px'
          }}>
            <strong style={{ color: '#ef4444' }}>Категорически запрещено</strong> использовать советы Safety для диагностики заболеваний, лечения, принятия инвестиционных решений или совершения юридически значимых действий.
          </div>
          <p style={{ marginBottom: '12px' }}>
            Разработчик не несет ответственности за любой ущерб здоровью, финансам или имуществу, возникший в результате следования советам ИИ.
          </p>
          <p style={{ marginBottom: '12px' }}>
            <strong>5.3. Нейтральность:</strong> Мнения, выраженные ботом Safety, являются результатом работы алгоритма и могут не совпадать с мнением Разработчика.
          </p>
        </section>

        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '16px', color: '#f0f4f8' }}>
            РАЗДЕЛ IV. ПРАВИЛА ПОВЕДЕНИЯ
          </h2>
          
          <h3 style={{ fontSize: '18px', fontWeight: 600, marginTop: '24px', marginBottom: '12px', color: '#e2e8f0' }}>
            6. Запрещенное использование
          </h3>
          <p style={{ marginBottom: '12px' }}>Пользователю запрещается использовать SafeGram для:</p>
          <ul style={{ paddingLeft: '24px', marginBottom: '16px' }}>
            <li style={{ marginBottom: '8px' }}>Распространения вредоносного ПО, вирусов, троянов.</li>
            <li style={{ marginBottom: '8px' }}>Пропаганды терроризма, экстремизма, насилия, разжигания межнациональной розни.</li>
            <li style={{ marginBottom: '8px' }}>Продажи наркотиков, оружия или иных изъятых из оборота товаров.</li>
            <li style={{ marginBottom: '8px' }}>Спама, фишинга и мошенничества.</li>
            <li style={{ marginBottom: '8px' }}>Попыток взлома (реверс-инжиниринга) кода Приложения или серверов SafeGram.</li>
          </ul>

          <h3 style={{ fontSize: '18px', fontWeight: 600, marginTop: '24px', marginBottom: '12px', color: '#e2e8f0' }}>
            7. Блокировка и модерация
          </h3>
          <ul style={{ paddingLeft: '24px' }}>
            <li style={{ marginBottom: '8px' }}>Разработчик оставляет за собой право заблокировать Аккаунт Пользователя без предупреждения и объяснения причин при нарушении условий настоящего Соглашения.</li>
            <li style={{ marginBottom: '8px' }}>В случае использования Сервиса для противоправных действий, данные Пользователя могут быть переданы компетентным органам.</li>
          </ul>
        </section>

        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '16px', color: '#f0f4f8' }}>
            РАЗДЕЛ V. ОТКАЗ ОТ ГАРАНТИЙ И ОТВЕТСТВЕННОСТИ
          </h2>
          
          <h3 style={{ fontSize: '18px', fontWeight: 600, marginTop: '24px', marginBottom: '12px', color: '#e2e8f0' }}>
            8. Отказ от гарантий (AS IS)
          </h3>
          <p style={{ marginBottom: '12px' }}>
            <strong>8.1.</strong> СЕРВИС ПРЕДОСТАВЛЯЕТСЯ НА УСЛОВИЯХ «КАК ЕСТЬ» (AS IS).
          </p>
          <p style={{ marginBottom: '12px' }}>
            <strong>8.2.</strong> РАЗРАБОТЧИК НЕ ДАЕТ НИКАКИХ ГАРАНТИЙ, ЯВНЫХ ИЛИ ПОДРАЗУМЕВАЕМЫХ, ВКЛЮЧАЯ:
          </p>
          <ul style={{ paddingLeft: '24px', marginBottom: '16px' }}>
            <li style={{ marginBottom: '8px' }}>ГАРАНТИЮ ПРИГОДНОСТИ ДЛЯ КОНКРЕТНОЙ ЦЕЛИ.</li>
            <li style={{ marginBottom: '8px' }}>ГАРАНТИЮ БЕСПЕРЕБОЙНОЙ И БЕЗОШИБОЧНОЙ РАБОТЫ.</li>
            <li style={{ marginBottom: '8px' }}>ГАРАНТИЮ ПОЛНОЙ КОНФИДЕНЦИАЛЬНОСТИ (С УЧЕТОМ BETA-СТАТУСА).</li>
          </ul>

          <h3 style={{ fontSize: '18px', fontWeight: 600, marginTop: '24px', marginBottom: '12px', color: '#e2e8f0' }}>
            9. Ограничение ответственности (Limitation of Liability)
          </h3>
          <p style={{ marginBottom: '12px' }}>
            <strong>9.1.</strong> НИ ПРИ КАКИХ ОБСТОЯТЕЛЬСТВАХ РАЗРАБОТЧИК НЕ НЕСЕТ ОТВЕТСТВЕННОСТИ ЗА ЛЮБОЙ ПРЯМОЙ, КОСВЕННЫЙ, СЛУЧАЙНЫЙ ИЛИ ШТРАФНОЙ УЩЕРБ, ВКЛЮЧАЯ УПУЩЕННУЮ ВЫГОДУ, ПОТЕРЮ ДАННЫХ ИЛИ МОРАЛЬНЫЙ ВРЕД.
          </p>
          <p style={{ marginBottom: '12px' }}>
            <strong>9.2.</strong> МАКСИМАЛЬНАЯ СОВОКУПНАЯ ОТВЕТСТВЕННОСТЬ РАЗРАБОТЧИКА ПО ЛЮБЫМ ИСКАМ ОГРАНИЧИВАЕТСЯ СУММОЙ В 100 (СТО) РУБЛЕЙ ИЛИ СУММОЙ, ФАКТИЧЕСКИ УПЛАЧЕННОЙ ПОЛЬЗОВАТЕЛЕМ ЗА ИСПОЛЬЗОВАНИЕ СЕРВИСА (ЕСЛИ ПРИМЕНИМО).
          </p>

          <h3 style={{ fontSize: '18px', fontWeight: 600, marginTop: '24px', marginBottom: '12px', color: '#e2e8f0' }}>
            10. Форс-мажор
          </h3>
          <p style={{ marginBottom: '12px' }}>
            Разработчик освобождается от ответственности за неисполнение обязательств в случае обстоятельств непреодолимой силы (пожары, наводнения, войны, блокировки интернета государственными органами, DDoS-атаки).
          </p>
        </section>

        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '16px', color: '#f0f4f8' }}>
            РАЗДЕЛ VI. ЗАКЛЮЧИТЕЛЬНЫЕ ПОЛОЖЕНИЯ
          </h2>
          
          <h3 style={{ fontSize: '18px', fontWeight: 600, marginTop: '24px', marginBottom: '12px', color: '#e2e8f0' }}>
            11. Интеллектуальная собственность
          </h3>
          <ul style={{ paddingLeft: '24px', marginBottom: '16px' }}>
            <li style={{ marginBottom: '8px' }}>Весь код, дизайн, логотипы и алгоритмы SafeGram (за исключением сторонних библиотек с открытым кодом) являются исключительной собственностью Разработчика.</li>
            <li style={{ marginBottom: '8px' }}>Копирование или создание клонов Сервиса без письменного разрешения запрещено.</li>
          </ul>

          <h3 style={{ fontSize: '18px', fontWeight: 600, marginTop: '24px', marginBottom: '12px', color: '#e2e8f0' }}>
            12. Изменения условий
          </h3>
          <ul style={{ paddingLeft: '24px', marginBottom: '16px' }}>
            <li style={{ marginBottom: '8px' }}>Разработчик имеет право в любой момент изменить текст настоящего Соглашения.</li>
            <li style={{ marginBottom: '8px' }}>Продолжение использования Сервиса после публикации новой версии Соглашения означает принятие Пользователем новых условий.</li>
          </ul>

          <h3 style={{ fontSize: '18px', fontWeight: 600, marginTop: '24px', marginBottom: '12px', color: '#e2e8f0' }}>
            13. Применимое право
          </h3>
          <ul style={{ paddingLeft: '24px' }}>
            <li style={{ marginBottom: '8px' }}>Настоящее Соглашение регулируется законодательством страны резидентства Разработчика.</li>
            <li style={{ marginBottom: '8px' }}>Все споры решаются путем переговоров. В случае невозможности достижения согласия — в судебном порядке по месту нахождения Разработчика.</li>
      </ul>
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
            По вопросам безопасности, ошибок или юридическим запросам обращайтесь через{' '}
            <Link to="/feedback" style={{ color: '#7c6cff', textDecoration: 'underline' }}>форму обратной связи</Link>
          </p>
        </div>
    </div>
    </motion.div>
  );
}
