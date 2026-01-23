import React from 'react';
import { render, screen } from '@testing-library/react';
import VirtualizedMessages from '../components/VirtualizedMessages';

// Мокаем react-window
jest.mock('react-window', () => ({
  VariableSizeList: ({ children, itemData }: any) => (
    <div data-testid="virtualized-list">
      {itemData.messages.map((msg: any, index: number) => 
        children({ index, style: {}, data: itemData })
      )}
    </div>
  )
}));

// Мокаем imageCache
jest.mock('../utils/imageCache', () => ({
  loadAndCacheImage: jest.fn(() => Promise.resolve(new Blob())),
  getCachedImage: jest.fn(() => Promise.resolve(null))
}));

// Мокаем lazyMediaLoader
jest.mock('../utils/lazyMediaLoader', () => ({
  setupLazyImage: jest.fn(() => () => {}),
  setupLazyVideo: jest.fn(() => () => {})
}));

describe('VirtualizedMessages', () => {
  const mockMessages = [
    {
      id: '1',
      text: 'Test message 1',
      senderId: 'user1',
      createdAt: Date.now(),
      chatId: 'chat1'
    },
    {
      id: '2',
      text: 'Test message 2',
      senderId: 'user2',
      createdAt: Date.now() + 1000,
      chatId: 'chat1'
    }
  ];

  const mockUsers = {
    user1: { id: 'user1', username: 'User 1' },
    user2: { id: 'user2', username: 'User 2' }
  };

  test('renders messages', () => {
    render(
      <VirtualizedMessages
        messages={mockMessages}
        currentUserId="user1"
        users={mockUsers}
        onReply={() => {}}
        onReact={() => {}}
        onEdit={() => {}}
        onDelete={() => {}}
        onPin={() => {}}
        onForward={() => {}}
      />
    );

    expect(screen.getByTestId('virtualized-list')).toBeInTheDocument();
  });

  test('handles empty messages', () => {
    render(
      <VirtualizedMessages
        messages={[]}
        currentUserId="user1"
        users={{}}
        onReply={() => {}}
        onReact={() => {}}
        onEdit={() => {}}
        onDelete={() => {}}
        onPin={() => {}}
        onForward={() => {}}
      />
    );

    expect(screen.getByTestId('virtualized-list')).toBeInTheDocument();
  });
});
