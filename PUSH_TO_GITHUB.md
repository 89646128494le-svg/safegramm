# Инструкция: Push в новый репозиторий safegramm

## Проблема

Git репозиторий был инициализирован в домашней директории (`C:\Users\Lev`), а не в директории проекта. Поэтому git пытается добавить все системные файлы.

## Решение: Правильная инициализация

### Вариант 1: Через Проводник (РЕКОМЕНДУЕТСЯ)

1. Откройте **Проводник** (File Explorer)
2. Перейдите в `C:\Users\Lev\Desktop\Проекты\SafeGram перезапуск`
3. **Shift + ПКМ** → **"Открыть окно PowerShell здесь"**
4. Выполните команды:

```powershell
# Удаляем старый git (если есть)
if (Test-Path ".git") { Remove-Item -Recurse -Force ".git" }

# Инициализируем новый git
git init
git branch -M main

# Настраиваем remote на новый репозиторий
git remote add origin https://github.com/89646128494le-svg/safegramm.git

# Добавляем файлы проекта
git add -A

# Проверяем, что добавилось
git status

# Создаем коммит
git commit -m "Initial commit: SafeGram - Multi-page website, admin panel, backend (Go), frontend (React), desktop app (Electron)"

# Пушим в GitHub
git push -u origin main
```

При запросе credentials:
- **Username**: `89646128494le-svg`
- **Password**: ваш Personal Access Token (не пароль GitHub!)

### Вариант 2: Через Git Bash

1. Откройте **Git Bash**
2. Выполните:

```bash
cd "/c/Users/Lev/Desktop/Проекты/SafeGram перезапуск"

# Удаляем старый git
rm -rf .git

# Инициализируем новый
git init
git branch -M main

# Настраиваем remote
git remote add origin https://github.com/89646128494le-svg/safegramm.git

# Добавляем файлы
git add -A

# Коммитим
git commit -m "Initial commit: SafeGram project"

# Пушим
git push -u origin main
```

### Вариант 3: GitHub Desktop (САМЫЙ ПРОСТОЙ)

1. Скачайте: https://desktop.github.com/
2. Откройте GitHub Desktop
3. File → Add Local Repository
4. Выберите `C:\Users\Lev\Desktop\Проекты\SafeGram перезапуск`
5. Если появится предупреждение, нажмите "Create a repository"
6. Войдите в GitHub через интерфейс
7. Repository → Repository Settings → Remote
8. Измените URL на: `https://github.com/89646128494le-svg/safegramm.git`
9. Нажмите **"Publish repository"** или **"Push origin"**

## Проверка успешного push

1. Перейдите на https://github.com/89646128494le-svg/safegramm
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
2. Импортируйте репозиторий `89646128494le-svg/safegramm`
3. Следуйте инструкциям из `DEPLOY_AND_API_KEYS.md`
