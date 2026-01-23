import React, { useState } from 'react';
import { api } from '../services/api';

interface PollOption {
  id: string;
  text: string;
  votes: number;
  voters: string[];
}

interface PollProps {
  pollId: string;
  question: string;
  options: PollOption[];
  messageId: string;
  chatId: string;
  currentUserId: string;
  canVote: boolean;
  totalVotes: number;
  onVote?: () => void;
}

export default function Poll({ 
  pollId, 
  question, 
  options, 
  messageId, 
  chatId, 
  currentUserId, 
  canVote,
  totalVotes,
  onVote 
}: PollProps) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [voting, setVoting] = useState(false);
  const [localOptions, setLocalOptions] = useState(options);

  const hasVoted = localOptions.some(opt => opt.voters.includes(currentUserId));
  const userVote = localOptions.find(opt => opt.voters.includes(currentUserId));

  const handleVote = async (optionId: string) => {
    if (voting || hasVoted || !canVote) return;
    
    setVoting(true);
    try {
      // Используем endpoint для голосования по messageId
      const response = await api(`/api/messages/${messageId}/poll/vote`, 'POST', { optionId });
      
      // Обновляем локальное состояние из ответа
      if (response.poll) {
        const updatedOptions = response.poll.options.map((opt: any) => ({
          id: opt.id,
          text: opt.text,
          votes: opt.votes || 0,
          voters: opt.voters || []
        }));
        setLocalOptions(updatedOptions);
      }
      
      // Обновляем локальное состояние
      setLocalOptions(prev => prev.map(opt => {
        if (opt.id === optionId) {
          return {
            ...opt,
            votes: opt.votes + 1,
            voters: [...opt.voters, currentUserId]
          };
        }
        return opt;
      }));
      
      setSelectedOption(optionId);
      onVote?.();
    } catch (e: any) {
      console.error('Failed to vote:', e);
      alert('Ошибка голосования: ' + e.message);
    } finally {
      setVoting(false);
    }
  };

  return (
    <div style={{
      padding: '12px',
      background: 'var(--bg-secondary)',
      borderRadius: '8px',
      marginTop: '8px',
      border: '1px solid var(--border)'
    }}>
      <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: 'var(--text-primary)' }}>
        📊 {question}
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {localOptions.map((option) => {
          const percentage = totalVotes > 0 ? (option.votes / totalVotes) * 100 : 0;
          const isUserVote = option.voters.includes(currentUserId);
          
          return (
            <div
              key={option.id}
              style={{
                position: 'relative',
                padding: '8px 12px',
                background: isUserVote ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                borderRadius: '6px',
                cursor: canVote && !hasVoted ? 'pointer' : 'default',
                transition: 'all 0.2s',
                border: isUserVote ? '2px solid var(--accent-primary)' : '1px solid var(--border)',
                opacity: voting && selectedOption !== option.id ? 0.6 : 1
              }}
              onClick={() => !hasVoted && canVote && handleVote(option.id)}
              onMouseEnter={(e) => {
                if (canVote && !hasVoted) {
                  e.currentTarget.style.background = 'var(--bg-tertiary)';
                  e.currentTarget.style.borderColor = 'var(--accent-primary)';
                }
              }}
              onMouseLeave={(e) => {
                if (canVote && !hasVoted) {
                  e.currentTarget.style.background = isUserVote ? 'var(--accent-primary)' : 'var(--bg-tertiary)';
                }
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <span style={{ fontSize: '13px', color: isUserVote ? 'white' : 'var(--text-primary)' }}>
                  {option.text}
                </span>
                <span style={{ fontSize: '12px', color: isUserVote ? 'white' : 'var(--text-secondary)' }}>
                  {option.votes} {option.votes === 1 ? 'голос' : 'голосов'} ({percentage.toFixed(1)}%)
                </span>
              </div>
              
              {hasVoted && (
                <div style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  height: '4px',
                  width: `${percentage}%`,
                  background: isUserVote ? 'rgba(255,255,255,0.3)' : 'var(--accent-primary)',
                  borderRadius: '0 0 6px 6px',
                  transition: 'width 0.3s'
                }} />
              )}
            </div>
          );
        })}
      </div>
      
      <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '8px' }}>
        Всего голосов: {totalVotes}
        {hasVoted && userVote && ` • Вы проголосовали за "${userVote.text}"`}
      </div>
    </div>
  );
}
