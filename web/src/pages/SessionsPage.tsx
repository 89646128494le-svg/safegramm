import React from 'react';
import { useNavigate } from 'react-router-dom';
import SessionsManager from '../components/SessionsManager';

export default function SessionsPage() {
  const navigate = useNavigate();
  return (
    <SessionsManager onClose={() => navigate('/app/settings')} />
  );
}
