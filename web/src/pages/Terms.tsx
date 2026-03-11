import React from 'react';
import { FileText } from 'lucide-react';
import LegalDocumentPage from '../components/LegalDocumentPage';
import termsRaw from '../content/legal/terms.txt?raw';

export default function Terms() {
  return (
    <LegalDocumentPage
      icon={<FileText size={26} />}
      badge="Условия использования"
      fallbackTitle="Пользовательское соглашение"
      description="Документ регулирует правила использования SafeGram, ограничения сервиса, порядок модерации, бета-статус продукта и способы разрешения спорных ситуаций."
      raw={termsRaw}
      alertTitle="Важно перед использованием SafeGram"
      alertTone="danger"
      alertText="SafeGram остаётся развивающимся продуктом. Перед использованием сервиса стоит ознакомиться с правилами доступа, ограничениями, правилами модерации и порядком обращения в Техподдержку при спорных ситуациях."
      highlights={[
        { label: 'Статус сервиса', value: 'Public Beta' },
        { label: 'Применимое право', value: 'Законодательство РФ' },
        { label: 'Споры', value: 'Претензия → суд по закону' },
      ]}
    />
  );
}
