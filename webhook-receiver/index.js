const express = require('express');
const chalk = require('chalk');
const moment = require('moment');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

// Создаем директорию для логов если её нет
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Цвета для разных уровней логов
const levelColors = {
  info: chalk.blue,
  warning: chalk.yellow,
  error: chalk.red,
  debug: chalk.gray,
};

// Форматирование логов в консоль
function formatLog(entry) {
  const color = levelColors[entry.level] || chalk.white;
  const timestamp = moment(entry.timestamp).format('YYYY-MM-DD HH:mm:ss');
  const level = color(`[${entry.level.toUpperCase()}]`);
  
  let output = `${chalk.gray(timestamp)} ${level} ${entry.message}`;
  
  if (entry.service) {
    output += chalk.cyan(` [${entry.service}]`);
  }
  
  if (entry.userId) {
    output += chalk.magenta(` [User: ${entry.userId}]`);
  }
  
  if (entry.action) {
    output += chalk.green(` [Action: ${entry.action}]`);
  }
  
  if (entry.error) {
    output += chalk.red(`\n  Error: ${entry.error}`);
  }
  
  if (entry.metadata && Object.keys(entry.metadata).length > 0) {
    output += chalk.gray(`\n  ${JSON.stringify(entry.metadata, null, 2)}`);
  }
  
  return output;
}

// Сохранение логов в файл
function saveLog(entry) {
  const date = moment().format('YYYY-MM-DD');
  const logFile = path.join(logsDir, `safegram-${date}.log`);
  const logLine = `${moment(entry.timestamp).format('YYYY-MM-DD HH:mm:ss')} [${entry.level.toUpperCase()}] ${entry.message} ${JSON.stringify(entry)}\n`;
  
  fs.appendFileSync(logFile, logLine, 'utf8');
}

// Middleware для парсинга JSON
app.use(express.json());

// Главная страница
app.get('/', (req, res) => {
  res.json({
    service: 'SafeGram Webhook Receiver',
    version: '1.0.0',
    status: 'running',
    port: PORT,
    endpoints: {
      webhook: '/webhook',
      status: '/status',
      logs: '/logs',
    },
  });
});

// Статус
app.get('/status', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Webhook endpoint
app.post('/webhook', (req, res) => {
  const { logs, server } = req.body;
  
  if (!logs || !Array.isArray(logs)) {
    return res.status(400).json({ error: 'Invalid payload: logs array required' });
  }
  
  console.log(chalk.cyan(`\n📨 Received ${logs.length} log entries from ${server || 'SafeGram Server'}`));
  console.log(chalk.gray('─'.repeat(80)));
  
  logs.forEach((entry) => {
    console.log(formatLog(entry));
    saveLog(entry);
    
    // Специальная обработка ошибок
    if (entry.level === 'error') {
      console.log(chalk.red('⚠️  ERROR DETECTED!'));
    }
  });
  
  console.log(chalk.gray('─'.repeat(80)));
  
  res.json({ 
    success: true, 
    received: logs.length,
    timestamp: new Date().toISOString(),
  });
});

// Получение логов за сегодня
app.get('/logs', (req, res) => {
  const date = moment().format('YYYY-MM-DD');
  const logFile = path.join(logsDir, `safegram-${date}.log`);
  
  if (!fs.existsSync(logFile)) {
    return res.json({ logs: [], message: 'No logs for today' });
  }
  
  const content = fs.readFileSync(logFile, 'utf8');
  const lines = content.split('\n').filter(line => line.trim());
  
  res.json({
    date,
    count: lines.length,
    logs: lines,
  });
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(chalk.green('╔════════════════════════════════════════════════════════════════╗'));
  console.log(chalk.green('║') + chalk.white('  SafeGram Webhook Receiver v1.0.0') + chalk.green('                                    ║'));
  console.log(chalk.green('╠════════════════════════════════════════════════════════════════╣'));
  console.log(chalk.green('║') + chalk.white(`  📡 Server running on http://localhost:${PORT}`) + chalk.green('                        ║'));
  console.log(chalk.green('║') + chalk.white(`  📁 Logs directory: ${logsDir}`) + chalk.green('                  ║'));
  console.log(chalk.green('║') + chalk.white('  🔗 Webhook URL: http://localhost:3000/webhook') + chalk.green('            ║'));
  console.log(chalk.green('╠════════════════════════════════════════════════════════════════╣'));
  console.log(chalk.green('║') + chalk.yellow('  ⚠️  Для получения webhook от внешнего сервера используйте:') + chalk.green('  ║'));
  console.log(chalk.green('║') + chalk.cyan('     ngrok/http://your-ip:3000/webhook') + chalk.green('                    ║'));
  console.log(chalk.green('╚════════════════════════════════════════════════════════════════╝'));
  console.log('');
  console.log(chalk.gray('Waiting for webhook requests...'));
  console.log('');
});

// Обработка ошибок
process.on('uncaughtException', (err) => {
  console.error(chalk.red('Uncaught Exception:'), err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error(chalk.red('Unhandled Rejection at:'), promise, 'reason:', reason);
});
