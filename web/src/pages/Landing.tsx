import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import Header from '../components/Header';
import LandingSidebar from '../components/LandingSidebar';
import LandingFooter from '../components/LandingFooter';
import { useStore } from '../store/useStore';
import { 
  Shield, 
  Lock, 
  Zap, 
  MessageCircle, 
  Video, 
  Users, 
  Sparkles, 
  ArrowRight,
  Check,
  Cloud,
  EyeOff
} from 'lucide-react';
import '../styles/landing.css';

const fadeInUp = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: [0.6, -0.05, 0.01, 0.99] }
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1
    }
  }
};

export default function Landing() {
  const nav = useNavigate();
  const { user } = useStore();
  const { scrollYProgress } = useScroll();
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);
  const scale = useTransform(scrollYProgress, [0, 0.5], [1, 0.95]);

  const accept = () => {
    localStorage.setItem('policiesAccepted', '1');
    nav('/login');
  };

  const features = [
    {
      icon: Shield,
      title: 'End-to-End шифрование',
      description: 'Ваши сообщения защищены военным уровнем криптографии. Только вы и получатель можете их прочитать.'
    },
    {
      icon: Zap,
      title: 'Молниеносная скорость',
      description: 'Оптимизированная архитектура обеспечивает мгновенную доставку сообщений и плавную работу интерфейса.'
    },
    {
      icon: MessageCircle,
      title: 'Умная модерация',
      description: 'AI SafetyNet защищает от мошенничества, deepfake и опасного контента в реальном времени.'
    },
    {
      icon: Video,
      title: 'HD видеозвонки',
      description: 'Кристально четкие видеозвонки с поддержкой групповых конференций и screen sharing.'
    },
    {
      icon: Users,
      title: 'Группы и каналы',
      description: 'Создавайте группы до 10000 участников и публичные каналы для общения с аудиторией.'
    },
    {
      icon: Sparkles,
      title: 'Stories и стикеры',
      description: 'Выражайте себя с помощью историй, стикеров, GIF и реакций на сообщения.'
    }
  ];

  const stats = [
    { value: '100%', label: 'Приватность' },
    { value: '0ms', label: 'Задержка' },
    { value: '∞', label: 'Бесплатно' },
    { value: '7+', label: 'Возраст' }
  ];

  return (
    <div className="landing-page">
      <Header user={user} onLogout={() => {}} />
      <LandingSidebar />
      <main className="landing-main">
      {/* Hero Section */}
      <motion.section 
        className="hero-section"
        style={{ opacity, scale }}
        initial="initial"
        animate="animate"
        variants={staggerContainer}
      >
        <div className="hero-background">
          <motion.div
            className="gradient-orb orb-1"
            animate={{
              x: [0, 100, 0],
              y: [0, -50, 0],
              scale: [1, 1.2, 1],
            }}
            transition={{
              duration: 20,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
          <motion.div
            className="gradient-orb orb-2"
            animate={{
              x: [0, -80, 0],
              y: [0, 60, 0],
              scale: [1, 1.3, 1],
            }}
            transition={{
              duration: 25,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 2
            }}
          />
        </div>

        <motion.div className="hero-content" variants={fadeInUp}>
          <motion.div 
            className="hero-badge"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
          >
            <Lock size={16} />
            <span>Защищенный мессенджер нового поколения</span>
          </motion.div>

          <h1 className="hero-title">
            <motion.span 
              variants={fadeInUp}
              className="gradient-text"
            >
              SafeGram
            </motion.span>
            <motion.span 
              variants={fadeInUp}
              style={{ display: 'block', marginTop: '0.5rem' }}
            >
              Общайтесь свободно и безопасно
            </motion.span>
          </h1>

          <motion.p 
            className="hero-description"
            variants={fadeInUp}
          >
            Мессенджер с end-to-end шифрованием, AI-модерацией и всеми необходимыми функциями 
            для современного общения. Приватность, скорость и удобство в одном приложении.
          </motion.p>

          <motion.div 
            className="hero-cta"
            variants={fadeInUp}
          >
            <motion.button
              className="btn-primary btn-hero"
              onClick={accept}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
            >
              Начать использовать
              <ArrowRight size={20} />
            </motion.button>
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Link
                to="/features"
                className="btn-secondary btn-hero"
                style={{
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                Узнать больше
              </Link>
            </motion.div>
          </motion.div>

          <motion.div 
            className="hero-stats"
            variants={fadeInUp}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            {stats.map((stat, idx) => (
              <motion.div
                key={idx}
                className="stat-item"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 + idx * 0.1 }}
                whileHover={{ scale: 1.1 }}
              >
                <div className="stat-value">{stat.value}</div>
                <div className="stat-label">{stat.label}</div>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>

        <motion.div
          className="hero-visual"
          initial={{ opacity: 0, scale: 0.8, rotate: -10 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={{ delay: 0.4, type: "spring", stiffness: 100 }}
        >
          <div className="phone-mockup">
            <div className="phone-screen">
              <div className="mockup-chat">
                <div className="mockup-message received">
                  <div className="mockup-avatar"></div>
                  <div className="mockup-bubble">Привет! Как дела?</div>
                </div>
                <div className="mockup-message sent">
                  <div className="mockup-bubble primary">Отлично! Только что установил SafeGram</div>
                </div>
                <div className="mockup-message received">
                  <div className="mockup-avatar"></div>
                  <div className="mockup-bubble">
                    Круто! 🔒 Шифрование на уровне
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.section>

      {/* Dashboard: ключевые фишки + Live Preview */}
      <section id="dashboard" className="landing-dashboard">
        <div className="landing-dashboard-inner">
          <h2 className="landing-dashboard-title">Почему SafeGram</h2>
          <div className="landing-dashboard-cards">
            <motion.div className="landing-dashboard-card" whileHover={{ y: -4 }} transition={{ type: 'spring', stiffness: 300 }}>
              <Lock className="landing-dashboard-card-icon" size={28} />
              <h3>Сквозное шифрование</h3>
              <p>Сообщения шифруются на устройстве. Сервер не хранит их в открытом виде.</p>
            </motion.div>
            <motion.div className="landing-dashboard-card" whileHover={{ y: -4 }} transition={{ type: 'spring', stiffness: 300 }}>
              <Cloud className="landing-dashboard-card-icon" size={28} />
              <h3>Облачное хранилище</h3>
              <p>Медиа и файлы надёжно хранятся с шифрованием. Доступ только у вас.</p>
            </motion.div>
            <motion.div className="landing-dashboard-card" whileHover={{ y: -4 }} transition={{ type: 'spring', stiffness: 300 }}>
              <EyeOff className="landing-dashboard-card-icon" size={28} />
              <h3>Анонимность</h3>
              <p>Минимум данных для работы. Никакой продажи персональной информации.</p>
            </motion.div>
          </div>
          <div className="landing-live-preview">
            <h3 className="landing-live-preview-title">Live Preview</h3>
            <p className="landing-live-preview-desc">Так выглядит чат внутри SafeGram</p>
            <div className="landing-live-preview-window">
              <div className="landing-live-preview-header">
                <span className="landing-live-preview-dot" />
                <span>Чат с поддержкой</span>
              </div>
              <div className="landing-live-preview-chat">
                <div className="landing-live-preview-msg received">
                  <div className="landing-live-preview-avatar" />
                  <div className="landing-live-preview-bubble">Привет! Как дела?</div>
                </div>
                <div className="landing-live-preview-msg sent">
                  <div className="landing-live-preview-bubble">Отлично! Уже пользуюсь SafeGram 🔒</div>
                </div>
                <div className="landing-live-preview-msg received">
                  <div className="landing-live-preview-avatar" />
                  <div className="landing-live-preview-bubble">Круто. Шифрование на уровне.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="features-section">
        <motion.div
          className="section-container"
          initial="initial"
          whileInView="animate"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
        >
          <motion.div className="section-header" variants={fadeInUp}>
            <h2 className="section-title">Всё, что нужно для общения</h2>
            <p className="section-subtitle">
              Безопасность, функциональность и удобство в одном приложении
            </p>
          </motion.div>

          <div className="features-grid">
            {features.map((feature, idx) => (
              <motion.div
                key={idx}
                className="feature-card"
                variants={fadeInUp}
                whileHover={{ 
                  y: -10,
                  transition: { type: "spring", stiffness: 300, damping: 20 }
                }}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
              >
                <div className="feature-icon">
                  <feature.icon size={32} />
                </div>
                <h3 className="feature-title">{feature.title}</h3>
                <p className="feature-description">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* Security Section */}
      <section className="security-section">
        <motion.div
          className="section-container"
          initial="initial"
          whileInView="animate"
          viewport={{ once: true }}
          variants={staggerContainer}
        >
          <div className="security-content">
            <motion.div className="security-text" variants={fadeInUp}>
              <h2 className="section-title">Защита на уровне государства</h2>
              <p className="section-subtitle">
                Ваши данные и сообщения защищены криптографией военного уровня. 
                Сервер не может прочитать ваши сообщения — даже мы.
              </p>
              
              <div className="security-features">
                {[
                  'ECDH P-256 для обмена ключами',
                  'AES-GCM для шифрования',
                  'Zero-Knowledge архитектура',
                  'Локальное хранение ключей',
                  'AI SafetyNet для защиты',
                  'Аудит безопасности'
                ].map((feature, idx) => (
                  <motion.div
                    key={idx}
                    className="security-feature-item"
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: idx * 0.1 }}
                  >
                    <Check size={20} className="check-icon" />
                    <span>{feature}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            <motion.div 
              className="security-visual"
              variants={fadeInUp}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
            >
              <div className="crypto-animation">
                <div className="crypto-circle outer">
                  <div className="crypto-circle middle">
                    <div className="crypto-circle inner">
                      <Lock size={48} />
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <motion.div
          className="cta-content"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ type: "spring", stiffness: 100 }}
        >
          <h2 className="cta-title">Готовы начать?</h2>
          <p className="cta-subtitle">
            Присоединяйтесь к тысячам пользователей, которые уже выбрали безопасность
          </p>
          <motion.button
            className="btn-primary btn-hero btn-cta"
            onClick={accept}
            whileHover={{ scale: 1.02, boxShadow: '0 16px 48px rgba(124,108,255,0.45)' }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
          >
            Начать бесплатно
            <ArrowRight size={20} />
          </motion.button>
        </motion.div>
      </section>

      <LandingFooter />
      </main>
    </div>
  );
}
