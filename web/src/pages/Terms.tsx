import React from 'react';
import { FileText } from 'lucide-react';
import LegalDocumentPage from '../components/LegalDocumentPage';
import termsRaw from '../content/legal/terms.txt?raw';

export default function Terms() {
  return (
    <LegalDocumentPage
      icon={<FileText size={26} />}
      badge="Terms of Service"
      fallbackTitle="Пользовательское соглашение"
      description="Пользовательское соглашение SafeGram обновлено по новому PDF-документу и перенесено на сайт без потери текущего фирменного оформления."
      raw={termsRaw}
      alertTitle="Важно перед использованием SafeGram"
      alertTone="danger"
      alertText="Этот документ регулирует доступ к платформе, AI-функциям, модерации, ограничениям ответственности и правилам использования. Для beta-продукта это критичный юридический слой, а не формальность."
    />
  );
}
