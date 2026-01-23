import React from 'react';
import { render, screen } from '@testing-library/react';
import ConnectionStatus from '../components/ConnectionStatus';

// Мокаем offlineQueue
jest.mock('../services/offlineQueue', () => ({
  isOnline: jest.fn(() => true),
  getOfflineQueue: jest.fn(() => []),
  processOfflineQueue: jest.fn(() => Promise.resolve()),
  onOnlineStatusChange: jest.fn((callback) => {
    // Возвращаем функцию очистки
    return () => {};
  })
}));

describe('ConnectionStatus', () => {
  test('renders online status', () => {
    render(<ConnectionStatus />);
    expect(screen.getByText(/онлайн/i)).toBeInTheDocument();
  });

  test('renders offline status when offline', () => {
    const { isOnline } = require('../services/offlineQueue');
    isOnline.mockReturnValue(false);
    
    render(<ConnectionStatus />);
    expect(screen.getByText(/офлайн/i)).toBeInTheDocument();
  });

  test('shows pending messages count', () => {
    const { getOfflineQueue } = require('../services/offlineQueue');
    getOfflineQueue.mockReturnValue([
      { id: '1', chatId: '1', text: 'Test' },
      { id: '2', chatId: '1', text: 'Test 2' }
    ]);
    
    render(<ConnectionStatus />);
    expect(screen.getByText(/2/)).toBeInTheDocument();
  });
});
