import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Shield, Heart, Target, Users, Award, ArrowRight } from 'lucide-react';
import Header from '../components/Header';
import { useStore } from '../store/useStore';

const values = [
  {
    icon: Shield,
    title: 'Безопасность прежде всего',
    description: 'Мы верим, что приватность - это фундаментальное право. Каждое сообщение защищено криптографией военного уровня.'
  },
  {
    icon: Heart,
    title: 'Открытость',
    description: 'SafeGram построен на принципах прозрачности и открытого исходного кода. Мы не скрываем, как работаем.'
  },
  {
    icon: Target,
    title: 'Инновации',
    description: 'Мы постоянно развиваемся, внедряя новейшие технологии для обеспечения лучшего опыта пользователей.'
  },
  {
    icon: Users,
    title: 'Сообщество',
    description: 'SafeGram создан для людей. Ваш голос имеет значение, и мы слушаем отзывы наших пользователей.'
  }
];

const team = [
  {
    name: 'Команда SafeGram',
    role: 'Разработка и поддержка',
    description: 'Мы - группа энтузиастов, которые верят в безопасное и приватное общение.'
  }
];

export default function About() {
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
            О SafeGram
          </h1>
          <p style={{
            fontSize: '20px',
            color: 'rgba(233, 236, 245, 0.7)',
            maxWidth: '700px',
            margin: '0 auto',
            lineHeight: '1.6'
          }}>
            Безопасный мессенджер нового поколения, созданный для тех, кто ценит приватность
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          style={{
            marginBottom: '100px',
            padding: '60px',
            background: 'rgba(124, 108, 255, 0.1)',
            borderRadius: '24px',
            border: '1px solid rgba(124, 108, 255, 0.3)'
          }}
        >
          <h2 style={{
            fontSize: '32px',
            fontWeight: 800,
            marginBottom: '24px',
            color: '#e9ecf5',
            textAlign: 'center'
          }}>
            Наша миссия
          </h2>
          <p style={{
            fontSize: '18px',
            lineHeight: '1.8',
            color: 'rgba(233, 236, 245, 0.8)',
            textAlign: 'center',
            maxWidth: '800px',
            margin: '0 auto'
          }}>
            SafeGram создан с одной простой целью - дать людям возможность общаться свободно и безопасно. 
            Мы верим, что приватность - это не роскошь, а базовое право каждого человека. 
            В эпоху, когда личные данные стали товаром, мы предлагаем альтернативу - мессенджер, 
            который действительно защищает вашу конфиденциальность.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          style={{ marginBottom: '100px' }}
        >
          <h2 style={{
            fontSize: '36px',
            fontWeight: 800,
            marginBottom: '50px',
            textAlign: 'center',
            color: '#e9ecf5'
          }}>
            Наши ценности
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '32px'
          }}>
            {values.map((value, idx) => {
              const Icon = value.icon;
              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.1 }}
                  whileHover={{ y: -10, scale: 1.02 }}
                  style={{
                    padding: '40px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '20px',
                    textAlign: 'center',
                    transition: 'all 0.3s'
                  }}
                >
                  <div style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '16px',
                    background: 'linear-gradient(135deg, rgba(124,108,255,0.2), rgba(61,216,255,0.2))',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 24px',
                    color: '#7c6cff'
                  }}>
                    <Icon size={32} />
                  </div>
                  <h3 style={{
                    fontSize: '22px',
                    fontWeight: 700,
                    marginBottom: '16px',
                    color: '#e9ecf5'
                  }}>
                    {value.title}
                  </h3>
                  <p style={{
                    fontSize: '15px',
                    lineHeight: '1.6',
                    color: 'rgba(233, 236, 245, 0.7)'
                  }}>
                    {value.description}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          style={{
            textAlign: 'center',
            padding: '60px',
            background: 'rgba(124, 108, 255, 0.1)',
            borderRadius: '24px',
            border: '1px solid rgba(124, 108, 255, 0.3)'
          }}
        >
          <Award size={64} color="#7c6cff" style={{ marginBottom: '24px' }} />
          <h2 style={{
            fontSize: '32px',
            fontWeight: 800,
            marginBottom: '20px',
            color: '#e9ecf5'
          }}>
            Присоединяйтесь к SafeGram
          </h2>
          <p style={{
            fontSize: '18px',
            color: 'rgba(233, 236, 245, 0.7)',
            marginBottom: '32px',
            maxWidth: '600px',
            marginLeft: 'auto',
            marginRight: 'auto'
          }}>
            Станьте частью сообщества, которое ценит приватность и безопасность
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
