/**
 * Скрипт для ожидания запуска Vite dev server и запуска Electron
 */

const waitOn = require('wait-on');
const { spawn } = require('child_process');
const path = require('path');

const options = {
  resources: ['http://localhost:5173'],
  delay: 1000,
  interval: 500,
  timeout: 30000,
  window: 1000
};

console.log('Ожидание запуска Vite dev server на http://localhost:5173...');

waitOn(options)
  .then(() => {
    console.log('Vite dev server запущен, запускаем Electron...');
    
    // Используем npx для запуска Electron (самый надежный способ)
    const electron = spawn('npx', ['electron', '.'], {
      stdio: 'inherit',
      shell: true, // Важно для Windows
      cwd: path.resolve(__dirname, '..')
    });

    electron.on('error', (err) => {
      console.error('Ошибка запуска Electron:', err);
      console.error('\nПопробуйте:');
      console.error('1. Установить зависимости: npm install');
      console.error('2. Или запустить напрямую: npx electron .');
      process.exit(1);
    });

    electron.on('exit', (code) => {
      if (code !== null) {
        process.exit(code);
      }
    });
  })
  .catch((err) => {
    console.error('Ошибка ожидания Vite dev server:', err);
    process.exit(1);
  });
