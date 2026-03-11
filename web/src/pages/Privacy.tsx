import React from 'react';
import { Shield } from 'lucide-react';
import LegalDocumentPage from '../components/LegalDocumentPage';
import privacyRaw from '../content/legal/privacy.txt?raw';

export default function Privacy() {
  return (
    <LegalDocumentPage
      icon={<Shield size={26} />}
      badge="Политика конфиденциальности"
      fallbackTitle="Политика конфиденциальности"
      description="Документ описывает, какие данные нужны SafeGram для работы сервиса, как они защищаются и каким образом пользователь может управлять своими данными."
      raw={privacyRaw}
      alertTitle="Приватность и бета-режим"
      alertText="SafeGram строится вокруг минимизации данных и защищённого обмена сообщениями. При этом сервис находится в стадии тестирования, поэтому отдельные процессы и формулировки могут уточняться по мере развития продукта."
      highlights={[
        { label: 'Подход', value: 'Минимизация данных' },
        { label: 'Юрисдикция', value: 'С учётом законодательства РФ' },
        { label: 'Связь', value: 'Через Техподдержку SafeGram' },
      ]}
    />
  );
}
