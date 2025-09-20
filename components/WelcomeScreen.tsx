import React, { useState } from 'react';
import { UserProfile } from '../types';
import { INDIA_BOARDS } from './constants';

interface WelcomeScreenProps {
  onProfileCreate: (profile: Omit<UserProfile, 'badges'> & { badges: string[] }) => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onProfileCreate }) => {
  const [name, setName] = useState('');
  const [grade, setGrade] = useState<number | ''>('');
  const [dob, setDob] = useState('');
  const [board, setBoard] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !grade || !dob || !board) {
      setError('Please fill out all fields.');
      return;
    }
    if (grade < 1 || grade > 12) {
      setError('Please enter a valid grade (1-12).');
      return;
    }
    onProfileCreate({ name, grade: Number(grade), dob, board, badges: [] });
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 flex items-center justify-center p-4 animate-fade-in">
      <div className="w-full max-w-lg bg-white dark:bg-slate-800/50 dark:backdrop-blur-sm dark:border dark:border-slate-700 rounded-2xl shadow-2xl p-8 space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-purple-500">
            Welcome to Teststar
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2">Your AI-powered learning companion</p>
        </div>
        
        {error && <p className="text-red-500 text-center bg-red-100 dark:bg-red-500/10 dark:text-red-400 p-3 rounded-lg animate-scale-in">{error}</p>}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="name" className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-2">Full Name</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
              placeholder="e.g., Rohan Kumar"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="grade" className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-2">Class/Grade</label>
              <input
                id="grade"
                type="number"
                value={grade}
                onChange={(e) => setGrade(e.target.value === '' ? '' : parseInt(e.target.value))}
                min="1"
                max="12"
                className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                placeholder="e.g., 8"
                required
              />
            </div>
            <div>
              <label htmlFor="dob" className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-2">Date of Birth</label>
              <input
                id="dob"
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                required
              />
            </div>
          </div>
          <div>
            <label htmlFor="board" className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-2">Board</label>
            <select
              id="board"
              value={board}
              onChange={(e) => setBoard(e.target.value)}
              className={`w-full px-4 py-2.5 border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition ${!board ? 'text-slate-400' : 'text-slate-900 dark:text-slate-100'}`}
              required
            >
              <option value="" disabled>Select your board</option>
              {INDIA_BOARDS.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <button
            type="submit"
            className="w-full bg-indigo-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-500 focus:ring-opacity-50 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
          >
            Start Learning
          </button>
        </form>
      </div>
    </div>
  );
};
