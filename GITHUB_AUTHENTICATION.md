# Решение проблемы аутентификации GitHub

## Ошибка: `permission denied` при push

Это означает, что GitHub не может проверить вашу личность. Есть несколько способов решить эту проблему:

## Способ 1: Personal Access Token (PAT) - РЕКОМЕНДУЕТСЯ

### Шаг 1: Создайте Personal Access Token

1. Перейдите на https://github.com/settings/tokens
2. Нажмите **"Generate new token"** → **"Generate new token (classic)"**
3. Назовите токен (например: `SafeGram-Push`)
4. Выберите срок действия (например: `90 days` или `No expiration`)
5. Отметьте права доступа:
   - ✅ `repo` (полный доступ к репозиториям)
6. Нажмите **"Generate token"**
7. **СКОПИРУЙТЕ ТОКЕН** (он показывается только один раз!)

### Шаг 2: Используйте токен при push

**Вариант A: Использовать токен в URL (одноразово)**
```powershell
git remote set-url origin https://ВАШ_ТОКЕН@github.com/89646128494le-svg/safegram2.git
git push origin main
```

**Вариант B: Использовать Git Credential Manager (постоянно)**
```powershell
# При запросе логина введите:
# Username: 89646128494le-svg
# Password: ВАШ_ТОКЕН (не пароль GitHub!)

git push origin main
```

**Вариант C: Сохранить токен в Windows Credential Manager**
1. Откройте **Панель управления** → **Диспетчер учетных данных**
2. Выберите **Учетные данные Windows**
3. Найдите `git:https://github.com`
4. Нажмите **Изменить**
5. Пароль = ваш токен (не пароль GitHub!)

## Способ 2: GitHub Desktop (САМЫЙ ПРОСТОЙ)

1. Скачайте и установите: https://desktop.github.com/
2. Откройте GitHub Desktop
3. File → Add Local Repository
4. Выберите директорию проекта: `C:\Users\Lev\Desktop\Проекты\SafeGram перезапуск`
5. Войдите в GitHub через интерфейс
6. Все готово! Просто нажмите **"Push origin"**

## Способ 3: SSH ключи

### Шаг 1: Создайте SSH ключ
```powershell
ssh-keygen -t ed25519 -C "your_email@example.com"
# Нажмите Enter для всех вопросов (или задайте пароль)
```

### Шаг 2: Скопируйте публичный ключ
```powershell
cat ~/.ssh/id_ed25519.pub
# Скопируйте весь вывод
```

### Шаг 3: Добавьте ключ в GitHub
1. Перейдите на https://github.com/settings/keys
2. Нажмите **"New SSH key"**
3. Название: `SafeGram Push`
4. Вставьте скопированный ключ
5. Нажмите **"Add SSH key"**

### Шаг 4: Измените remote на SSH
```powershell
git remote set-url origin git@github.com:89646128494le-svg/safegram2.git
git push origin main
```

## Важно: Проверьте репозиторий

Убедитесь, что remote указывает на правильный репозиторий:
```powershell
git remote -v
```

Должно быть:
```
origin  https://github.com/89646128494le-svg/safegram2 (fetch)
origin  https://github.com/89646128494le-svg/safegram2 (push)
```

Если нет, исправьте:
```powershell
git remote set-url origin https://github.com/89646128494le-svg/safegram2.git
```

## После успешной аутентификации

Попробуйте push снова:
```powershell
git push origin main
```

## Проверка успешного push

1. Перейдите на https://github.com/89646128494le-svg/safegram2
2. Убедитесь, что все файлы видны (web/, server-go/, и т.д.)
3. Проверьте последний коммит

## Если проблема сохраняется

- Проверьте, что у вас есть права на запись в репозиторий (вы должны быть владельцем или collaborator)
- Убедитесь, что репозиторий существует: https://github.com/89646128494le-svg/safegram2
- Попробуйте создать новый токен с правами `repo`
