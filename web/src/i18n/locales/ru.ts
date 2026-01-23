// Русский язык (по умолчанию)
export const ru = {
  // Общие
  common: {
    loading: 'Загрузка...',
    save: 'Сохранить',
    cancel: 'Отмена',
    delete: 'Удалить',
    edit: 'Редактировать',
    close: 'Закрыть',
    confirm: 'Подтвердить',
    search: 'Поиск',
    send: 'Отправить',
    back: 'Назад',
    next: 'Далее',
    yes: 'Да',
    no: 'Нет',
    ok: 'OK',
    error: 'Ошибка',
    success: 'Успешно',
    warning: 'Предупреждение',
    info: 'Информация'
  },

  // Чаты
  chat: {
    title: 'Чаты',
    newChat: 'Новый чат',
    noChats: 'Нет чатов',
    typeMessage: 'Введите сообщение...',
    sending: 'Отправка...',
    sent: 'Отправлено',
    delivered: 'Доставлено',
    read: 'Прочитано',
    online: 'В сети',
    offline: 'Не в сети',
    typing: 'печатает...',
    reply: 'Ответить',
    forward: 'Переслать',
    edit: 'Редактировать',
    delete: 'Удалить',
    pin: 'Закрепить',
    unpin: 'Открепить',
    copy: 'Копировать',
    select: 'Выбрать',
    selectAll: 'Выбрать все',
    deselectAll: 'Снять выделение',
    deleteSelected: 'Удалить выбранные',
    noMessages: 'Нет сообщений',
    messageDeleted: 'Сообщение удалено',
    messageEdited: 'Сообщение отредактировано',
    unsend: 'Отменить отправку',
    unsendConfirm: 'Отменить отправку этого сообщения?',
    deleteForEveryone: 'Удалить для всех',
    deleteForMe: 'Удалить для меня',
    deleteConfirm: 'Удалить это сообщение?',
    editMessage: 'Редактировать сообщение',
    replyTo: 'Ответить на',
    forwardedFrom: 'Переслано от',
    attachment: 'Вложение',
    file: 'Файл',
    image: 'Изображение',
    video: 'Видео',
    audio: 'Аудио',
    voiceMessage: 'Голосовое сообщение',
    location: 'Местоположение',
    contact: 'Контакт',
    poll: 'Опрос',
    sticker: 'Стикер',
    gif: 'GIF',
    emoji: 'Эмодзи'
  },

  // Группы и каналы
  group: {
    title: 'Группы',
    createGroup: 'Создать группу',
    createChannel: 'Создать канал',
    groupName: 'Название группы',
    channelName: 'Название канала',
    description: 'Описание',
    members: 'Участники',
    addMember: 'Добавить участника',
    removeMember: 'Удалить участника',
    leaveGroup: 'Покинуть группу',
    deleteGroup: 'Удалить группу',
    settings: 'Настройки группы',
    permissions: 'Права доступа',
    roles: 'Роли',
    owner: 'Владелец',
    admin: 'Администратор',
    moderator: 'Модератор',
    member: 'Участник',
    inviteLink: 'Пригласительная ссылка',
    generateLink: 'Создать ссылку',
    revokeLink: 'Отозвать ссылку',
    qrCode: 'QR-код',
    exportMembers: 'Экспорт участников'
  },

  // Звонки
  call: {
    incoming: 'Входящий звонок',
    outgoing: 'Исходящий звонок',
    missed: 'Пропущенный звонок',
    answered: 'Принят',
    declined: 'Отклонён',
    ended: 'Завершён',
    duration: 'Длительность',
    videoCall: 'Видеозвонок',
    voiceCall: 'Голосовой звонок',
    answer: 'Ответить',
    decline: 'Отклонить',
    endCall: 'Завершить звонок',
    mute: 'Отключить звук',
    unmute: 'Включить звук',
    videoOn: 'Включить видео',
    videoOff: 'Выключить видео',
    screenShare: 'Поделиться экраном',
    stopScreenShare: 'Остановить трансляцию',
    recording: 'Идёт запись',
    effects: 'Эффекты',
    virtualBackground: 'Виртуальный фон'
  },

  // Настройки
  settings: {
    title: 'Настройки',
    profile: 'Профиль',
    appearance: 'Внешний вид',
    notifications: 'Уведомления',
    privacy: 'Приватность',
    security: 'Безопасность',
    language: 'Язык',
    theme: 'Тема',
    fontSize: 'Размер шрифта',
    compactMode: 'Компактный режим',
    soundEnabled: 'Звуки включены',
    soundVolume: 'Громкость звуков',
    notificationSound: 'Звук уведомлений',
    messageSound: 'Звук сообщений',
    callSound: 'Звук звонков',
    mentionSound: 'Звук упоминаний',
    showLastSeen: 'Показывать последний раз в сети',
    showReadReceipts: 'Показывать прочитано',
    blockScreenshots: 'Блокировать скриншоты',
    twoFactorAuth: 'Двухфакторная аутентификация',
    activeSessions: 'Активные сессии',
    logout: 'Выйти',
    logoutAll: 'Выйти из всех устройств',
    deleteAccount: 'Удалить аккаунт',
    exportData: 'Экспорт данных',
    backup: 'Резервное копирование',
    restore: 'Восстановление'
  },

  // Уведомления
  notification: {
    newMessage: 'Новое сообщение',
    newMessageFrom: 'Новое сообщение от {name}',
    mentioned: 'Вас упомянули',
    mentionedIn: 'Вас упомянули в {chat}',
    newCall: 'Входящий звонок',
    callFrom: 'Звонок от {name}',
    groupInvite: 'Приглашение в группу',
    invitedTo: 'Вас пригласили в {group}',
    permissionDenied: 'Разрешение отклонено',
    enableNotifications: 'Включите уведомления в настройках браузера'
  },

  // Безопасность
  security: {
    e2ee: 'End-to-End шифрование',
    e2eeEnabled: 'E2EE включено',
    e2eeDisabled: 'E2EE выключено',
    verifyKey: 'Проверить ключ',
    keyFingerprint: 'Отпечаток ключа',
    updateKey: 'Обновить ключ',
    secretChat: 'Секретный чат',
    selfDestruct: 'Самоуничтожающиеся сообщения',
    expiresIn: 'Истекает через',
    minutes: 'минут',
    hours: 'часов',
    days: 'дней'
  },

  // Офлайн
  offline: {
    offline: 'Офлайн',
    online: 'Онлайн',
    connecting: 'Подключение...',
    reconnecting: 'Переподключение...',
    syncPending: 'Синхронизация ожидает',
    pendingMessages: 'Ожидающих сообщений: {count}',
    syncNow: 'Синхронизировать сейчас',
    syncing: 'Синхронизация...',
    syncComplete: 'Синхронизация завершена',
    syncFailed: 'Ошибка синхронизации',
    messageQueued: 'Сообщение будет отправлено при восстановлении связи'
  },

  // Экспорт и резервное копирование
  export: {
    title: 'Экспорт чата',
    format: 'Формат',
    json: 'JSON',
    txt: 'ТXT',
    pdf: 'PDF',
    includeMedia: 'Включить медиа',
    export: 'Экспортировать',
    exporting: 'Экспорт...',
    exported: 'Экспортировано',
    backup: 'Резервное копирование',
    restore: 'Восстановление',
    backupCreated: 'Резервная копия создана',
    backupRestored: 'Резервная копия восстановлена'
  },

  // Статистика
  statistics: {
    title: 'Статистика',
    messages: 'Сообщения',
    media: 'Медиа',
    reactions: 'Реакции',
    activity: 'Активность',
    topMembers: 'Топ участников',
    messagesByHour: 'Сообщения по часам',
    messagesByDay: 'Сообщения по дням',
    totalMessages: 'Всего сообщений',
    totalMedia: 'Всего медиа',
    totalReactions: 'Всего реакций'
  },

  // Боты
  bot: {
    title: 'Боты',
    createBot: 'Создать бота',
    botName: 'Имя бота',
    botToken: 'Токен бота',
    commands: 'Команды',
    addCommand: 'Добавить команду',
    webhooks: 'Вебхуки',
    addWebhook: 'Добавить вебхук'
  },

  // Календарь и задачи
  calendar: {
    title: 'Календарь',
    events: 'События',
    createEvent: 'Создать событие',
    eventTitle: 'Название события',
    eventDate: 'Дата',
    eventTime: 'Время',
    reminder: 'Напоминание',
    noReminder: 'Без напоминания',
    minutesBefore: 'За {minutes} минут',
    hoursBefore: 'За {hours} часов',
    daysBefore: 'За {days} дней'
  },
  todo: {
    title: 'Задачи',
    createTodo: 'Создать задачу',
    todoTitle: 'Название задачи',
    priority: 'Приоритет',
    high: 'Высокий',
    medium: 'Средний',
    low: 'Низкий',
    completed: 'Выполнено',
    pending: 'В ожидании'
  },

  // Ошибки
  errors: {
    networkError: 'Ошибка сети',
    serverError: 'Ошибка сервера',
    unauthorized: 'Не авторизован',
    forbidden: 'Доступ запрещён',
    notFound: 'Не найдено',
    validationError: 'Ошибка валидации',
    unknownError: 'Неизвестная ошибка',
    tryAgain: 'Попробовать снова',
    connectionLost: 'Соединение потеряно',
    reconnecting: 'Переподключение...'
  },

  // Аутентификация
  auth: {
    login: 'Войти',
    register: 'Регистрация',
    logout: 'Выйти',
    username: 'Имя пользователя',
    email: 'Email',
    password: 'Пароль',
    confirmPassword: 'Подтвердите пароль',
    forgotPassword: 'Забыли пароль?',
    rememberMe: 'Запомнить меня',
    loginSuccess: 'Вход выполнен',
    loginFailed: 'Ошибка входа',
    registerSuccess: 'Регистрация успешна',
    registerFailed: 'Ошибка регистрации',
    passwordMismatch: 'Пароли не совпадают',
    invalidCredentials: 'Неверные учётные данные'
  }
};
