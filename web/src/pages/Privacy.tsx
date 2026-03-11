import React from 'react';
import { Shield } from 'lucide-react';
import LegalDocumentPage from '../components/LegalDocumentPage';
import privacyRaw from '../content/legal/privacy.txt?raw';

export default function Privacy() {
  return (
    <LegalDocumentPage
      icon={<Shield size={26} />}
      badge="Privacy Policy"
      fallbackTitle="Политика конфиденциальности"
      description="Новая редакция политики конфиденциальности SafeGram встроена из глобального юридического документа и оформлена в текущем визуальном стиле сайта."
      raw={privacyRaw}
      alertTitle="Приватность и Public Beta"
      alertText="SafeGram строится вокруг минимизации данных, но документ прямо фиксирует ограничения Public Beta. Этот текст должен читаться как юридическое обязательство, а не как рекламное обещание."
    />
  );
}
