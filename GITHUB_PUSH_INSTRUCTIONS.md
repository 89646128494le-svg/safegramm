# Инструкция: Добавление всех файлов в GitHub

## Проблема
Git репозиторий находится в домашней директории (`C:\Users\Lev`), а проект в другой директории (`C:\Users\Lev\Desktop\Проекты\SafeGram перезапуск`).

## Решение

### Вариант 1: Использовать скрипт через Проводник (РЕКОМЕНДУЕТСЯ)

1. Откройте **Проводник** (File Explorer)
2. Перейдите в `C:\Users\Lev\Desktop\Проекты\SafeGram перезапуск`
3. Нажмите **Shift + ПКМ** (правая кнопка мыши) в пустом месте
4. Выберите **"Открыть окно PowerShell здесь"** (или "Open PowerShell window here")
5. Выполните команды:

```powershell
# Убедитесь что remote настроен правильно
git remote -v
git remote set-url origin https://github.com/89646128494le-svg/safegram2

# Добавьте все файлы (кроме .git, который уже в .gitignore)
git add -A
git reset -- .git/

# Создайте коммит
git commit -m "Add SafeGram complete project: multi-page website, admin panel, backend, frontend"

# Переименуйте ветку если нужно
git branch -M main

# Запуште
git push -u origin main
```

### Вариант 2: Использовать GitHub Desktop

1. Скачайте и установите [GitHub Desktop](https://desktop.github.com/)
2. Откройте GitHub Desktop
3. File → Add Local Repository
4. Выберите `C:\Users\Lev\Desktop\Проекты\SafeGram перезапуск`
5. Все файлы автоматически появятся
6. Нажмите "Publish repository" или "Push origin"

### Вариант 3: Использовать Git Bash

1. Откройте **Git Bash**
2. Выполните:

```bash
cd "/c/Users/Lev/Desktop/Проекты/SafeGram перезапуск"
git add -A
git reset -- .git/
git commit -m "Add SafeGram complete project"
git branch -M main
git push -u origin main
```

## Что будет добавлено

- ✅ Все файлы из `web/` (фронтенд)
- ✅ Все файлы из `server-go/` (Go бэкенд)
- ✅ Все файлы из `server/` (Node.js бэкенд)
- ✅ Все файлы из `desktop/` (Electron приложение)
- ✅ `docker-compose.yml`
- ✅ `vercel.json`
- ✅ Все `.md` файлы с документацией
- ✅ Все `.bat` скрипты
- ✅ `.gitignore`
- ✅ `LICENSE`

## Что НЕ будет добавлено (благодаря .gitignore)

- ❌ `.git/` директория
- ❌ `node_modules/`
- ❌ `.env` файлы
- ❌ `*.log` файлы
- ❌ `*.pkl` файлы (ML модели)
- ❌ `uploads/` директории
- ❌ Кэш и временные файлы

## После успешного push

1. Перейдите на https://github.com/89646128494le-svg/safegram2
2. Убедитесь что все файлы видны
3. Перейдите на https://vercel.com
4. Импортируйте репозиторий
5. Следуйте инструкциям из `DEPLOY_AND_API_KEYS.md`
