# Исправление Git репозитория

## Проблема

Git репозиторий находится в домашней директории (`C:\Users\Lev`), а проект в другой директории (`C:\Users\Lev\Desktop\Проекты\SafeGram перезапуск`). Поэтому git не видит файлы проекта.

## Решение

### Вариант 1: Использовать Git Bash (РЕКОМЕНДУЕТСЯ)

1. Откройте **Git Bash** (не PowerShell!)
2. Выполните:

```bash
cd "/c/Users/Lev/Desktop/Проекты/SafeGram перезапуск"

# Инициализируйте git в правильной директории
git init
git branch -M main

# Настройте remote
git remote add origin https://github.com/89646128494le-svg/safegram2.git

# Получите существующие файлы
git fetch origin main
git pull origin main --allow-unrelated-histories --no-edit

# Добавьте все файлы проекта
git add -A

# Создайте коммит
git commit -m "Add SafeGram complete project: multi-page website, admin panel, backend, frontend"

# Запушьте (при запросе используйте токен вместо пароля)
git push -u origin main
```

### Вариант 2: Использовать Проводник + PowerShell

1. Откройте **Проводник** (File Explorer)
2. Перейдите в `C:\Users\Lev\Desktop\Проекты\SafeGram перезапуск`
3. **Shift + ПКМ** → **"Открыть окно PowerShell здесь"**
4. Выполните:

```powershell
# Инициализируйте git
git init
git branch -M main

# Настройте remote
git remote add origin https://github.com/89646128494le-svg/safegram2.git

# Получите существующие файлы
git fetch origin main
git pull origin main --allow-unrelated-histories --no-edit

# Добавьте все файлы проекта
git add -A

# Создайте коммит
git commit -m "Add SafeGram complete project"

# Запушьте (при запросе используйте токен вместо пароля)
# Username: 89646128494le-svg
# Password: ваш_токен_из_GITHUB_AUTHENTICATION.md
git push -u origin main
```

### Вариант 3: GitHub Desktop (САМЫЙ ПРОСТОЙ)

1. Скачайте и установите: https://desktop.github.com/
2. Откройте GitHub Desktop
3. File → Add Local Repository
4. Выберите `C:\Users\Lev\Desktop\Проекты\SafeGram перезапуск`
5. Если появится предупреждение, нажмите "Create a repository"
6. Войдите в GitHub через интерфейс
7. Нажмите **"Publish repository"** или **"Push origin"**

## Важно: Аутентификация

При push вам понадобится **Personal Access Token** (не пароль GitHub!).

1. Создайте токен: https://github.com/settings/tokens
2. Права: ✅ `repo` (полный доступ)
3. Используйте токен как пароль при push

Подробнее: см. `GITHUB_AUTHENTICATION.md`

## Проверка успешного push

1. Перейдите на https://github.com/89646128494le-svg/safegram2
2. Убедитесь, что видны все директории:
   - ✅ `web/`
   - ✅ `server-go/`
   - ✅ `server/`
   - ✅ `desktop/`
   - ✅ `docker-compose.yml`
   - ✅ `README.md`
   - ✅ И другие файлы проекта

## После успешного push

1. Перейдите на https://vercel.com
2. Импортируйте репозиторий `89646128494le-svg/safegram2`
3. Следуйте инструкциям из `DEPLOY_AND_API_KEYS.md`
