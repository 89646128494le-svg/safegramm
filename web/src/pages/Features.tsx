import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { 
  Shield, Lock, Zap, MessageCircle, Video, Users, Sparkles, 
  Globe, Bell, Image, FileText, Settings, ArrowRight, Check 
} from 'lucide-react';
import Header from '../components/Header';
import { useStore } from '../store/useStore';

const features = [
  {
    category: 'Безопасность',
    icon: Shield,
    color: '#7c6cff',
    items: [
      {
        icon: Lock,
        title: 'End-to-End шифрование',
        description: 'Ваши сообщения защищены криптографией военного уровня. Только вы и получатель можете их прочитать.'
      },
      {
        icon: Shield,
        title: 'Zero-Knowledge архитектура',
        description: 'Сервер не может прочитать ваши сообщения. Все ключи хранятся только на вашем устройстве.'
      },
      {
        icon: Check,
        title: 'AI SafetyNet',
        description: 'Защита от мошенничества, deepfake и опасного контента в реальном времени.'
      }
    ]
  },
  {
    category: 'Функции общения',
    icon: MessageCircle,
    color: '#3dd8ff',
    items: [
      {
        icon: MessageCircle,
        title: 'Личные чаты',
        description: 'Приватное общение один-на-один с полным шифрованием.'
      },
      {
        icon: Users,
        title: 'Группы до 10000',
        description: 'Создавайте группы и каналы для общения с друзьями и коллегами.'
      },
      {
        icon: Video,
        title: 'HD видеозвонки',
        description: 'Кристально четкие видеозвонки с поддержкой групповых конференций.'
      },
      {
        icon: Sparkles,
        title: 'Stories и стикеры',
        description: 'Выражайте себя с помощью историй, стикеров, GIF и реакций.'
      }
    ]
  },
  {
    category: 'Производительность',
    icon: Zap,
    color: '#fbbf24',
    items: [
      {
        icon: Zap,
        title: 'Молниеносная скорость',
        description: 'Оптимизированная архитектура обеспечивает мгновенную доставку сообщений.'
      },
      {
        icon: Globe,
        title: 'Работает везде',
        description: 'Web, Desktop, Mobile - ваши данные синхронизируются на всех устройствах.'
      },
      {
        icon: FileText,
        title: 'Файлы до 5GB',
        description: 'Передавайте большие файлы без ограничений и потери качества.'
      }
    ]
  }
];

export default function Features() {
  const { user } = useStore();

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #0a0e1a 0%, #1a1f35 100%)',
      color: '#e9ecf5'
    }}>
      <Header user={user} onLogout={() => {}} />
      
      <motion.section
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        style={{
          padding: '120px 24px 80px',
          maxWidth: '1200px',
          margin: '0 auto'
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          style={{ textAlign: 'center', marginBottom: '80px' }}
        >
          <h1 style={{
            fontSize: 'clamp(36px, 6vw, 64px)',
            fontWeight: 900,
            marginBottom: '16px',
            background: 'linear-gradient(135deg, #7c6cff 0%, #3dd8ff 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            Функции SafeGram
          </h1>
          <p style={{
            fontSize: '20px',
            color: 'rgba(233, 236, 245, 0.7)',
            maxWidth: '700px',
            margin: '0 auto'
          }}>
            Всё, что нужно для безопасного и удобного общения
          </p>
        </motion.div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '80px' }}>
          {features.map((category, categoryIdx) => {
            const Icon = category.icon;
            return (
              <motion.div
                key={categoryIdx}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: categoryIdx * 0.2 }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  marginBottom: '40px'
                }}>
                  <div style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '16px',
                    background: `${category.color}20`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: category.color
                  }}>
                    <Icon size={28} />
                  </div>
                  <h2 style={{
                    fontSize: '36px',
                    fontWeight: 800,
                    margin: 0,
                    color: '#e9ecf5'
                  }}>
                    {category.category}
                  </h2>
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                  gap: '24px'
                }}>
                  {category.items.map((feature, idx) => {
                    const FeatureIcon = feature.icon;
                    return (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: idx * 0.1 }}
                        whileHover={{ y: -10, scale: 1.02 }}
                        style={{
                          padding: '32px',
                          background: 'rgba(255, 255, 255, 0.05)',
                          backdropFilter: 'blur(10px)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '20px',
                          transition: 'all 0.3s',
                          cursor: 'pointer'
                        }}
                      >
                        <div style={{
                          width: '48px',
                          height: '48px',
                          borderRadius: '12px',
                          background: `${category.color}20`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginBottom: '20px',
                          color: category.color
                        }}>
                          <FeatureIcon size={24} />
                        </div>
                        <h3 style={{
                          fontSize: '20px',
                          fontWeight: 700,
                          marginBottom: '12px',
                          color: '#e9ecf5'
                        }}>
                          {feature.title}
                        </h3>
                        <p style={{
                          fontSize: '15px',
                          lineHeight: '1.6',
                          color: 'rgba(233, 236, 245, 0.7)'
                        }}>
                          {feature.description}
                        </p>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            );
          })}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          style={{
            marginTop: '100px',
            textAlign: 'center',
            padding: '60px',
            background: 'rgba(124, 108, 255, 0.1)',
            borderRadius: '24px',
            border: '1px solid rgba(124, 108, 255, 0.3)'
          }}
        >
          <h2 style={{
            fontSize: '32px',
            fontWeight: 800,
            marginBottom: '20px',
            color: '#e9ecf5'
          }}>
            Готовы начать?
          </h2>
          <p style={{
            fontSize: '18px',
            color: 'rgba(233, 236, 245, 0.7)',
            marginBottom: '32px'
          }}>
            Присоединяйтесь к тысячам пользователей SafeGram
          </p>
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Link
              to="/register"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '16px 32px',
                background: 'linear-gradient(135deg, #7c6cff 0%, #3dd8ff 100%)',
                borderRadius: '12px',
                color: '#0a0e1a',
                textDecoration: 'none',
                fontSize: '16px',
                fontWeight: 700,
                boxShadow: '0 12px 40px rgba(124,108,255,0.4)'
              }}
            >
              Начать бесплатно
              <ArrowRight size={20} />
            </Link>
          </motion.div>
        </motion.div>
      </motion.section>
    </div>
  );
}
