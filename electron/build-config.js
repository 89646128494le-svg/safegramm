// Конфигурация для electron-builder
// Используется для динамической настройки путей к иконкам

const path = require('path');
const fs = require('fs');

// Проверяем наличие иконок
const iconPaths = {
  win: path.join(__dirname, 'icon.ico'),
  mac: path.join(__dirname, 'icon.icns'),
  linux: path.join(__dirname, 'icon.png')
};

// Если иконки нет, используем пустую строку (electron-builder создаст дефолтную)
const getIconPath = (platform) => {
  const iconPath = iconPaths[platform];
  if (fs.existsSync(iconPath)) {
    return iconPath;
  }
  return undefined; // electron-builder создаст дефолтную иконку
};

module.exports = {
  getIconPath
};
