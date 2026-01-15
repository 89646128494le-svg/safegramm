# Инструкция по настройке Git для SafeGram

## Проблема
PowerShell не может правильно обработать кириллицу в пути. Выполните команды вручную.

## Решение

### Вариант 1: Использовать скрипт (рекомендуется)

1. Откройте **Проводник Windows**
2. Перейдите в папку проекта: `C:\Users\Lev\Desktop\Проекты\SafeGram перезапуск`
3. Дважды кликните на файл **`init-git.bat`**
4. Скрипт автоматически:
   - Инициализирует Git репозиторий
   - Добавит все файлы
   - Создаст первый коммит
   - Настроит ветку main

5. После этого выполните вручную:
```bash
git remote add origin https://github.com/89646128494le-svg/SafeGram3.git
git push -u origin main
```

### Вариант 2: Выполнить команды вручную

Откройте **Git Bash** (не PowerShell!) и выполните:

```bash
# Перейдите в директорию проекта
cd "/c/Users/Lev/Desktop/Проекты/SafeGram перезапуск"

# Инициализируйте Git
git init

# Добавьте все файлы
git add .

# Создайте первый коммит
git commit -m "Initial commit: SafeGram messenger"

# Переименуйте ветку в main
git branch -M main

# Добавьте remote
git remote add origin https://github.com/89646128494le-svg/SafeGram3.git

# Отправьте код на GitHub
git push -u origin main
```

### Вариант 3: Использовать короткий путь (8.3 формат)

В PowerShell выполните:

```powershell
# Получите короткий путь
$path = (Get-Item "C:\Users\Lev\Desktop\Проекты\SafeGram перезапуск").FullName
$shortPath = (New-Object -ComObject Scripting.FileSystemObject).GetFolder($path).ShortPath
Write-Host "Короткий путь: $shortPath"

# Используйте короткий путь для команд
cd $shortPath
git init
git add .
git commit -m "Initial commit: SafeGram messenger"
git branch -M main
git remote add origin https://github.com/89646128494le-svg/SafeGram3.git
git push -u origin main
```

## Если возникли проблемы

1. **Убедитесь, что вы в правильной директории:**
   ```bash
   pwd  # или в PowerShell: Get-Location
   ```
   Должно быть: `C:\Users\Lev\Desktop\Проекты\SafeGram перезапуск`

2. **Проверьте, что Git установлен:**
   ```bash
   git --version
   ```

3. **Если репозиторий уже существует, удалите его:**
   ```bash
   Remove-Item -Path ".git" -Recurse -Force
   ```

4. **Если remote уже добавлен, удалите его:**
   ```bash
   git remote remove origin
   ```

## После успешной отправки

Ваш код будет доступен по адресу:
https://github.com/89646128494le-svg/SafeGram3
