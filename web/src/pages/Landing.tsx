import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import Header from '../components/Header';
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
  Star,
  Globe,
  Download
} from 'lucide-react';

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
            className="btn-primary btn-cta"
            onClick={accept}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
          >
            Начать бесплатно
            <ArrowRight size={20} />
          </motion.button>
          <div className="cta-links">
            <Link to="/privacy">Политика конфиденциальности</Link>
            <span>•</span>
            <Link to="/terms">Пользовательское соглашение</Link>
          </div>
        </motion.div>
      </section>

      <style>{`
        .landing-page {
          min-height: 100vh;
          background: linear-gradient(180deg, #0a0e1a 0%, #1a1f35 100%);
          color: #e9ecf5;
          overflow-x: hidden;
        }

        .hero-section {
          position: relative;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 120px 24px 80px;
          overflow: hidden;
        }

        .hero-background {
          position: absolute;
          inset: 0;
          overflow: hidden;
        }

        .gradient-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 0.3;
        }

        .orb-1 {
          width: 600px;
          height: 600px;
          background: radial-gradient(circle, rgba(124,108,255,0.8), transparent);
          top: -200px;
          left: -200px;
        }

        .orb-2 {
          width: 500px;
          height: 500px;
          background: radial-gradient(circle, rgba(61,216,255,0.8), transparent);
          bottom: -150px;
          right: -150px;
        }

        .hero-content {
          position: relative;
          z-index: 2;
          max-width: 1200px;
          width: 100%;
          text-align: center;
        }

        .hero-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          background: rgba(124,108,255,0.15);
          border: 1px solid rgba(124,108,255,0.3);
          border-radius: 999px;
          font-size: 14px;
          margin-bottom: 32px;
          backdrop-filter: blur(10px);
        }

        .hero-title {
          font-size: clamp(48px, 8vw, 96px);
          font-weight: 900;
          line-height: 1.1;
          margin-bottom: 24px;
          letter-spacing: -0.02em;
        }

        .gradient-text {
          background: linear-gradient(135deg, #7c6cff 0%, #3dd8ff 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .hero-description {
          font-size: 20px;
          line-height: 1.6;
          color: rgba(233,236,245,0.7);
          max-width: 700px;
          margin: 0 auto 48px;
        }

        .hero-cta {
          display: flex;
          gap: 16px;
          justify-content: center;
          margin-bottom: 80px;
          flex-wrap: wrap;
        }

        .btn-hero {
          padding: 16px 32px;
          font-size: 16px;
          font-weight: 700;
          border-radius: 12px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          border: none;
          transition: all 0.3s;
        }

        .btn-primary {
          background: linear-gradient(135deg, #7c6cff 0%, #3dd8ff 100%);
          color: #0a0e1a;
          box-shadow: 0 12px 40px rgba(124,108,255,0.4);
        }

        .btn-secondary {
          background: rgba(255,255,255,0.1);
          color: #e9ecf5;
          border: 1px solid rgba(255,255,255,0.2);
          backdrop-filter: blur(10px);
          text-decoration: none;
        }

        .hero-stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 32px;
          max-width: 800px;
          margin: 0 auto;
        }

        .stat-item {
          text-align: center;
        }

        .stat-value {
          font-size: 48px;
          font-weight: 900;
          background: linear-gradient(135deg, #7c6cff 0%, #3dd8ff 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          margin-bottom: 8px;
        }

        .stat-label {
          font-size: 14px;
          color: rgba(233,236,245,0.6);
          text-transform: uppercase;
          letter-spacing: 0.1em;
        }

        .hero-visual {
          position: absolute;
          right: 5%;
          top: 50%;
          transform: translateY(-50%);
          z-index: 1;
          display: none;
        }

        @media (min-width: 1024px) {
          .hero-visual {
            display: block;
          }
          .hero-content {
            text-align: left;
            max-width: 600px;
          }
          .hero-cta {
            justify-content: flex-start;
          }
        }

        .phone-mockup {
          width: 320px;
          height: 640px;
          background: rgba(255,255,255,0.05);
          border: 2px solid rgba(255,255,255,0.1);
          border-radius: 32px;
          padding: 16px;
          backdrop-filter: blur(20px);
          box-shadow: 0 20px 60px rgba(0,0,0,0.5);
        }

        .phone-screen {
          width: 100%;
          height: 100%;
          background: rgba(11,16,32,0.8);
          border-radius: 24px;
          overflow: hidden;
          padding: 16px;
        }

        .mockup-chat {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .mockup-message {
          display: flex;
          gap: 8px;
          align-items: flex-end;
        }

        .mockup-message.sent {
          flex-direction: row-reverse;
        }

        .mockup-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: linear-gradient(135deg, #7c6cff, #3dd8ff);
        }

        .mockup-bubble {
          max-width: 70%;
          padding: 10px 14px;
          border-radius: 14px;
          background: rgba(255,255,255,0.1);
          font-size: 14px;
        }

        .mockup-bubble.primary {
          background: linear-gradient(135deg, rgba(124,108,255,0.3), rgba(61,216,255,0.2));
        }

        .features-section {
          padding: 120px 24px;
          background: rgba(15,22,43,0.5);
        }

        .section-container {
          max-width: 1200px;
          margin: 0 auto;
        }

        .section-header {
          text-align: center;
          margin-bottom: 64px;
        }

        .section-title {
          font-size: clamp(36px, 5vw, 56px);
          font-weight: 900;
          margin-bottom: 16px;
          background: linear-gradient(135deg, #e9ecf5 0%, rgba(233,236,245,0.7) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .section-subtitle {
          font-size: 20px;
          color: rgba(233,236,245,0.6);
          max-width: 600px;
          margin: 0 auto;
        }

        .features-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 24px;
        }

        .feature-card {
          padding: 32px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 20px;
          backdrop-filter: blur(10px);
          transition: all 0.3s;
        }

        .feature-card:hover {
          background: rgba(255,255,255,0.08);
          border-color: rgba(124,108,255,0.5);
          box-shadow: 0 12px 40px rgba(124,108,255,0.2);
        }

        .feature-icon {
          width: 64px;
          height: 64px;
          border-radius: 16px;
          background: linear-gradient(135deg, rgba(124,108,255,0.2), rgba(61,216,255,0.2));
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 20px;
          color: #7c6cff;
        }

        .feature-title {
          font-size: 22px;
          font-weight: 700;
          margin-bottom: 12px;
        }

        .feature-description {
          font-size: 16px;
          line-height: 1.6;
          color: rgba(233,236,245,0.7);
        }

        .security-section {
          padding: 120px 24px;
          background: linear-gradient(180deg, rgba(15,22,43,0.5) 0%, rgba(10,14,26,0.8) 100%);
        }

        .security-content {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 64px;
          align-items: center;
          max-width: 1200px;
          margin: 0 auto;
        }

        @media (max-width: 768px) {
          .security-content {
            grid-template-columns: 1fr;
          }
        }

        .security-features {
          display: grid;
          grid-template-columns: 1fr;
          gap: 16px;
          margin-top: 32px;
        }

        .security-feature-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          background: rgba(124,108,255,0.1);
          border-radius: 12px;
        }

        .check-icon {
          color: #7c6cff;
          flex-shrink: 0;
        }

        .security-visual {
          display: flex;
          justify-content: center;
          align-items: center;
        }

        .crypto-animation {
          position: relative;
          width: 300px;
          height: 300px;
        }

        .crypto-circle {
          position: absolute;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .crypto-circle.outer {
          width: 300px;
          height: 300px;
          border: 2px solid rgba(124,108,255,0.3);
          animation: rotate 20s linear infinite;
        }

        .crypto-circle.middle {
          width: 200px;
          height: 200px;
          border: 2px solid rgba(61,216,255,0.3);
          animation: rotate 15s linear infinite reverse;
        }

        .crypto-circle.inner {
          width: 100px;
          height: 100px;
          background: linear-gradient(135deg, rgba(124,108,255,0.2), rgba(61,216,255,0.2));
          border: 2px solid rgba(124,108,255,0.5);
        }

        @keyframes rotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .cta-section {
          padding: 120px 24px;
          text-align: center;
          background: linear-gradient(135deg, rgba(124,108,255,0.1), rgba(61,216,255,0.1));
        }

        .cta-content {
          max-width: 800px;
          margin: 0 auto;
        }

        .cta-title {
          font-size: clamp(36px, 5vw, 56px);
          font-weight: 900;
          margin-bottom: 16px;
        }

        .cta-subtitle {
          font-size: 20px;
          color: rgba(233,236,245,0.7);
          margin-bottom: 40px;
        }

        .btn-cta {
          padding: 20px 48px;
          font-size: 18px;
        }

        .cta-links {
          display: flex;
          justify-content: center;
          gap: 16px;
          margin-top: 32px;
          font-size: 14px;
          color: rgba(233,236,245,0.6);
        }

        .cta-links a {
          color: rgba(233,236,245,0.8);
          text-decoration: none;
          transition: color 0.3s;
        }

        .cta-links a:hover {
          color: #7c6cff;
        }
      `}</style>
    </div>
  );
}
