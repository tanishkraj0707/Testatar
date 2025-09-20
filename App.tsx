import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { UserProfile, AppView, Test, Answer, Report, ChatMessage, Question, FeedbackPreference, Difficulty, Goal } from './types';
import { WelcomeScreen } from './components/WelcomeScreen';
import { OnboardingTour } from './components/OnboardingTour';
import * as Icons from './components/Icons';
import { INDIA_BOARDS, BADGES } from './components/constants';
import * as GeminiService from './services/geminiService';
import * as BadgeService from './services/badgeService';
import * as GoalService from './services/goalService';
import { Chat } from '@google/genai';

type Theme = 'light' | 'dark';

// --- Custom Hooks ---

function useLocalStorage<T>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    // Prevent SSR issues and ensure key is valid before accessing localStorage
    if (typeof window === 'undefined' || !key) {
        return initialValue;
    }
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(error);
      return initialValue;
    }
  });

  const setValue = (value: T | ((val: T) => T)) => {
    if (!key) return; // Don't save if key is not provided (e.g., user is logged out)
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error(error);
    }
  };

  return [storedValue, setValue];
}


// --- Helper & UI Components ---

const Spinner: React.FC<{ fullscreen?: boolean }> = ({ fullscreen = false }) => (
    <div className={`flex justify-center items-center h-full p-8 ${fullscreen ? 'fixed inset-0 bg-slate-100/80 dark:bg-slate-900/80 backdrop-blur-sm z-50' : ''}`}>
        <Icons.LoaderIcon className="w-12 h-12 text-indigo-500 animate-spin" />
    </div>
);

const ErrorDisplay: React.FC<{ message: string }> = ({ message }) => (
    <div className="m-4 md:m-8 bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md" role="alert">
        <p className="font-bold">An Error Occurred</p>
        <p>{message}</p>
    </div>
);

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  confirmButtonClass?: string;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = "Confirm",
  cancelText = "Cancel",
  confirmButtonClass = "bg-red-600 hover:bg-red-700",
}) => {
  if (!isOpen) return null;
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      confirmButtonRef.current?.focus();
    }
  }, [isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <div 
        className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4" 
        role="dialog" 
        aria-modal="true" 
        aria-labelledby="dialog-title"
        onKeyDown={handleKeyDown}
    >
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg w-full max-w-md p-6 transform transition-all animate-scale-in" role="document">
        <h2 id="dialog-title" className="text-xl font-bold text-slate-800 dark:text-slate-100">{title}</h2>
        <p className="mt-2 text-slate-600 dark:text-slate-300">{message}</p>
        <div className="mt-6 flex justify-end space-x-4">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg bg-slate-200 text-slate-800 font-semibold hover:bg-slate-300 transition focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
          >
            {cancelText}
          </button>
          <button
            ref={confirmButtonRef}
            onClick={onConfirm}
            className={`px-4 py-2 rounded-lg text-white font-semibold transition focus:outline-none focus:ring-2 focus:ring-offset-2 ${confirmButtonClass}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

const BadgeNotificationModal: React.FC<{ badges: { name: string; icon: string; description: string }[], onClose: () => void }> = ({ badges, onClose }) => {
  if (badges.length === 0) return null;
  const modalContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const focusableElement = modalContentRef.current?.querySelector('button');
    focusableElement?.focus();
  }, []);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="badge-dialog-title">
      <div ref={modalContentRef} className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg w-full max-w-sm p-6 text-center transform transition-all animate-scale-in" role="document">
        <h2 id="badge-dialog-title" className="text-2xl font-bold text-slate-800 dark:text-slate-100">Achievement Unlocked!</h2>
        <div className="my-6 space-y-4">
          {badges.map(badge => (
            <div key={badge.name} className="flex flex-col items-center">
              <span className="text-6xl">{badge.icon}</span>
              <p className="mt-2 font-semibold text-slate-700 dark:text-slate-200">{badge.name}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">{badge.description}</p>
            </div>
          ))}
        </div>
        <button
          onClick={onClose}
          className="w-full bg-indigo-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-500/50"
        >
          Awesome!
        </button>
      </div>
    </div>
  );
};


const ScoreCircle: React.FC<{ score: number }> = ({ score }) => {
    const clampedScore = Math.max(0, Math.min(100, score));
    const circumference = 2 * Math.PI * 45;
    const strokeDashoffset = circumference - (clampedScore / 100) * circumference;
    const scoreColor = clampedScore >= 75 ? 'text-emerald-500' : clampedScore >= 40 ? 'text-amber-500' : 'text-red-500';

    return (
        <div className="relative w-32 h-32">
            <svg className="w-full h-full" viewBox="0 0 100 100">
                <circle className="text-slate-200 dark:text-slate-700" strokeWidth="12" stroke="currentColor" fill="transparent" r="45" cx="50" cy="50" />
                <circle
                    className={scoreColor}
                    strokeWidth="12"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="transparent"
                    r="45"
                    cx="50"
                    cy="50"
                    transform="rotate(-90 50 50)"
                    style={{transition: 'stroke-dashoffset 0.8s ease-out'}}
                />
            </svg>
            <span className={`absolute inset-0 flex items-center justify-center text-3xl font-bold ${scoreColor}`}>
                {clampedScore.toFixed(0)}%
            </span>
        </div>
    );
};

const getPerformanceFeedback = (score: number) => {
    if (score >= 90) return { text: "Excellent!", color: "text-emerald-500" };
    if (score >= 75) return { text: "Great Job!", color: "text-green-500" };
    if (score >= 60) return { text: "Good Effort!", color: "text-sky-500" };
    if (score >= 40) return { text: "Keep Practicing!", color: "text-amber-500" };
    return { text: "Needs Improvement", color: "text-red-500" };
};

const ReportCard: React.FC<{ report: Report }> = ({ report }) => {
    const hasWrittenQuestions = report.questions.some(q => q.questionType !== 'MCQ');
    const accuracy = report.totalQuestions > 0 ? (report.correctAnswers / report.totalQuestions * 100) : 0;
    const avgTimePerQ = report.totalQuestions > 0 ? (report.timeTaken / report.totalQuestions) : 0;
    const performance = getPerformanceFeedback(report.score);

    const Stat: React.FC<{label: string; value: string}> = ({ label, value}) => (
        <div className="text-center md:text-left">
            <p className="text-3xl font-bold text-slate-800 dark:text-slate-100">{value}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
        </div>
    );

    return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-6">
            <div className="flex flex-col md:flex-row items-center gap-8">
                <div className="flex-shrink-0">
                    <ScoreCircle score={report.score} />
                    {hasWrittenQuestions && <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 text-center">(Score based on MCQs)</p>}
                </div>
                <div className="w-full space-y-6">
                    <div className="text-center md:text-left">
                        <p className={`text-2xl font-bold ${performance.color}`}>{performance.text}</p>
                        <p className="text-slate-500 dark:text-slate-400">Here's a summary of your performance.</p>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 border-t dark:border-slate-700 pt-4">
                       <Stat label="Marks Scored" value={`${report.marksScored}/${report.totalMarks}`} />
                       <Stat label="Accuracy" value={`${accuracy.toFixed(0)}%`} />
                       <Stat label="Time Taken" value={`${Math.floor(report.timeTaken / 60)}m ${report.timeTaken % 60}s`} />
                       <Stat label="Avg. Time / Q" value={`${avgTimePerQ.toFixed(1)}s`} />
                    </div>
                </div>
            </div>
        </div>
    );
};

interface QuestionNavigatorProps {
    totalQuestions: number;
    currentQuestionIndex: number;
    testAnswers: Answer[];
    onJumpToQuestion: (index: number) => void;
}

const QuestionNavigator: React.FC<QuestionNavigatorProps> = ({ totalQuestions, currentQuestionIndex, testAnswers, onJumpToQuestion }) => {
    const isAnswered = (index: number): boolean => {
        const answer = testAnswers[index];
        if (!answer) return false;
        return (answer.selectedOptionIndex !== undefined && answer.selectedOptionIndex !== null) || (!!answer.writtenAnswer && answer.writtenAnswer.trim() !== '');
    };

    return (
        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-lg">
            <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-3 px-1">Question Map</h3>
            <div className="grid grid-cols-5 gap-2">
                {Array.from({ length: totalQuestions }).map((_, index) => {
                    const status =
                        index === currentQuestionIndex
                            ? 'current'
                            : isAnswered(index)
                            ? 'answered'
                            : 'unanswered';

                    const baseClasses = "w-full aspect-square flex items-center justify-center rounded-lg font-bold text-sm transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-slate-800";
                    let statusClasses = '';

                    switch (status) {
                        case 'current':
                            statusClasses = 'bg-indigo-600 text-white ring-indigo-500 shadow-md';
                            break;
                        case 'answered':
                            statusClasses = 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 ring-emerald-400 dark:bg-emerald-500/20 dark:text-emerald-300 dark:hover:bg-emerald-500/30';
                            break;
                        default:
                            statusClasses = 'bg-slate-200 text-slate-700 hover:bg-slate-300 ring-slate-400 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600';
                            break;
                    }

                    return (
                        <button
                            key={index}
                            onClick={() => onJumpToQuestion(index)}
                            className={`${baseClasses} ${statusClasses}`}
                            aria-label={`Go to question ${index + 1}`}
                        >
                            {index + 1}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

// --- Charting Components ---

const ScoreTrendChart: React.FC<{ reports: Report[] }> = ({ reports }) => {
    const sortedReports = useMemo(() => [...reports].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()), [reports]);
    const [activePoint, setActivePoint] = useState<number | null>(null);

    if (sortedReports.length < 2) {
        return (
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-lg text-center">
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">Score Trend</h3>
                <p className="text-slate-500 dark:text-slate-400">Complete at least two tests to see your progress chart.</p>
            </div>
        );
    }
    
    const svgWidth = 500;
    const svgHeight = 200;
    const padding = { top: 20, right: 20, bottom: 30, left: 30 };
    const chartWidth = svgWidth - padding.left - padding.right;
    const chartHeight = svgHeight - padding.top - padding.bottom;

    const points = sortedReports.map((r, i) => ({
        x: (i / (sortedReports.length - 1)) * chartWidth,
        y: chartHeight - (r.score / 100) * chartHeight
    }));

    const pathD = points.map((p, i) => i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`).join(' ');

    return (
        <div className="bg-white dark:bg-slate-800 p-4 md:p-6 rounded-2xl shadow-lg">
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4">Score Trend</h3>
            <div className="relative">
                <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-auto">
                    <g transform={`translate(${padding.left}, ${padding.top})`}>
                        {/* Y-axis labels and grid lines */}
                        {[0, 25, 50, 75, 100].map(val => (
                            <g key={val}>
                                <line x1="0" x2={chartWidth} y1={chartHeight - (val/100)*chartHeight} className="stroke-slate-200 dark:stroke-slate-700" strokeDasharray="2,3"/>
                                <text x="-8" y={chartHeight - (val/100)*chartHeight + 4} textAnchor="end" fontSize="10" className="fill-slate-500 dark:fill-slate-400">{val}%</text>
                            </g>
                        ))}
                         {/* X-axis labels */}
                        <text x="0" y={chartHeight + 20} textAnchor="start" fontSize="10" className="fill-slate-500 dark:fill-slate-400">{new Date(sortedReports[0].date).toLocaleDateString()}</text>
                        <text x={chartWidth} y={chartHeight + 20} textAnchor="end" fontSize="10" className="fill-slate-500 dark:fill-slate-400">{new Date(sortedReports[sortedReports.length - 1].date).toLocaleDateString()}</text>

                        {/* Line Graph */}
                        <path d={pathD} fill="none" stroke="#4f46e5" strokeWidth="2.5" />
                        
                        {/* Data Points */}
                        {points.map((p, i) => (
                            <circle key={i} cx={p.x} cy={p.y} r="5" fill="#4f46e5" stroke="white" strokeWidth="2" 
                                onMouseEnter={() => setActivePoint(i)}
                                onMouseLeave={() => setActivePoint(null)}
                                className="cursor-pointer transition-transform duration-200 hover:scale-125"
                            />
                        ))}
                    </g>
                </svg>
                {activePoint !== null && (
                    <div className="absolute bg-slate-800 text-white text-xs rounded py-1 px-2 pointer-events-none animate-scale-in" style={{
                        left: `${(padding.left + points[activePoint].x) / svgWidth * 100}%`,
                        top: `${(padding.top + points[activePoint].y) / svgHeight * 100}%`,
                        transform: 'translate(-50%, -120%)'
                    }}>
                        {sortedReports[activePoint].score.toFixed(0)}%
                    </div>
                )}
            </div>
        </div>
    );
};

const AnswerBreakdownPieChart: React.FC<{ report: Report }> = ({ report }) => {
    const data = useMemo(() => {
        const correct = report.answers.filter(a => a.isCorrect === true).length;
        const incorrect = report.answers.filter(a => a.isCorrect === false).length;
        const mcqAnswers = report.answers.filter(a => a.selectedOptionIndex !== undefined).length;
        const written = report.questions.length - mcqAnswers;
        
        return { correct, incorrect, written };
    }, [report]);
    
    const total = data.correct + data.incorrect + data.written;
    if (total === 0) return null;

    const getCircumference = (radius: number) => 2 * Math.PI * radius;
    const radius = 45;
    const circumference = getCircumference(radius);

    const correctPct = (data.correct / total) * circumference;
    const incorrectPct = (data.incorrect / total) * circumference;
    const writtenPct = (data.written / total) * circumference;

    const correctOffset = 0;
    const incorrectOffset = correctPct;

    return (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-lg h-full">
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4">Answer Breakdown</h3>
            <div className="flex flex-col sm:flex-row items-center gap-6">
                <div className="relative w-40 h-40 flex-shrink-0">
                    <svg className="w-full h-full" viewBox="0 0 100 100">
                        <circle className="text-slate-200 dark:text-slate-700" strokeWidth="12" stroke="currentColor" fill="transparent" r={radius} cx="50" cy="50" />
                        <circle className="text-emerald-500" strokeWidth="12" stroke="currentColor" fill="transparent" r={radius} cx="50" cy="50" 
                            strokeDasharray={`${correctPct} ${circumference}`}
                            transform="rotate(-90 50 50)"
                        />
                         <circle className="text-red-500" strokeWidth="12" stroke="currentColor" fill="transparent" r={radius} cx="50" cy="50" 
                            strokeDasharray={`${incorrectPct} ${circumference}`}
                            strokeDashoffset={-incorrectOffset}
                            transform="rotate(-90 50 50)"
                        />
                         {data.written > 0 && <circle className="text-slate-400" strokeWidth="12" stroke="currentColor" fill="transparent" r={radius} cx="50" cy="50" 
                            strokeDasharray={`${writtenPct} ${circumference}`}
                            strokeDashoffset={-(incorrectOffset + correctPct)}
                            transform="rotate(-90 50 50)"
                        />}
                    </svg>
                     <span className="absolute inset-0 flex items-center justify-center text-xl font-bold text-slate-700 dark:text-slate-200">{total} Qs</span>
                </div>
                <div className="space-y-3">
                    <div className="flex items-center">
                        <span className="w-3 h-3 rounded-full bg-emerald-500 mr-3"></span>
                        <span className="font-semibold text-slate-700 dark:text-slate-200">{data.correct} Correct</span>
                    </div>
                    <div className="flex items-center">
                        <span className="w-3 h-3 rounded-full bg-red-500 mr-3"></span>
                        <span className="font-semibold text-slate-700 dark:text-slate-200">{data.incorrect} Incorrect</span>
                    </div>
                    {data.written > 0 && <div className="flex items-center">
                        <span className="w-3 h-3 rounded-full bg-slate-400 mr-3"></span>
                        <span className="font-semibold text-slate-700 dark:text-slate-200">{data.written} Written (Not Graded)</span>
                    </div>}
                </div>
            </div>
        </div>
    );
}

const TopicPerformanceChart: React.FC<{ report: Report }> = ({ report }) => {
    const topicData = useMemo(() => {
        const data: { [topic: string]: { total: number; correct: number } } = {};
        report.questions.forEach((q, index) => {
            const topic = q.topic || 'General';
            if (!data[topic]) {
                data[topic] = { total: 0, correct: 0 };
            }
            // Only consider MCQs for automatic grading
            if (q.questionType === 'MCQ') {
                data[topic].total++;
                if (report.answers[index]?.isCorrect) {
                    data[topic].correct++;
                }
            }
        });

        return Object.entries(data)
            .filter(([, { total }]) => total > 0) // Only show topics with graded questions
            .map(([topic, { total, correct }]) => ({
                topic,
                percentage: (correct / total) * 100,
            }));
    }, [report]);

    if (topicData.length === 0) {
         return (
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-lg text-center h-full flex flex-col justify-center">
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">Topic Performance</h3>
                <p className="text-slate-500 dark:text-slate-400">No multiple-choice questions found to analyze performance.</p>
            </div>
        );
    }
    
    return (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-lg h-full">
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4">Topic Performance</h3>
            <div className="space-y-4">
                {topicData.map(({ topic, percentage }) => (
                    <div key={topic}>
                        <div className="flex justify-between mb-1">
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-200 capitalize">{topic}</span>
                            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{percentage.toFixed(0)}%</span>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5">
                            <div className="bg-gradient-to-r from-indigo-500 to-purple-500 h-2.5 rounded-full" style={{ width: `${percentage}%` }}></div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// --- Main Application Views ---

const MainLayout: React.FC<{
    children: React.ReactNode;
    currentView: AppView;
    setView: (view: AppView) => void;
    userProfile: UserProfile;
    theme: Theme;
    toggleTheme: () => void;
}> = ({ children, currentView, setView, userProfile, theme, toggleTheme }) => {
    const [isSidebarOpen, setSidebarOpen] = useState(false);

    const navItems = [
        { view: 'dashboard', label: 'Dashboard', icon: Icons.HomeIcon },
        { view: 'createTest', label: 'New Test', icon: Icons.FilePlusIcon },
        { view: 'reports', label: 'Reports', icon: Icons.BarChartIcon },
        { view: 'tutor', label: 'AI Tutor', icon: Icons.MessageSquareIcon },
        { view: 'studyNotes', label: 'Study Notes', icon: Icons.FileTextIcon },
        { view: 'goals', label: 'Goals', icon: Icons.TargetIcon },
        { view: 'studyPlanner', label: 'Study Planner', icon: Icons.CalendarIcon },
        { view: 'poemsAndStories', label: 'Fun Zone', icon: Icons.PlayCircleIcon },
        { view: 'settings', label: 'Settings', icon: Icons.CogIcon },
    ] as const;

    const NavLink: React.FC<{
      view: AppView;
      label: string;
      icon: React.FC<{ className?: string }>;
    }> = ({ view, label, icon: Icon }) => {
      const isActive = currentView === view;
      return (
        <li key={view}>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              setView(view);
              setSidebarOpen(false);
            }}
            className={`flex items-center p-3 rounded-lg transition-colors duration-200 relative ${
              isActive
                ? 'bg-indigo-50 text-indigo-700 dark:bg-slate-700 dark:text-white'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'
            }`}
          >
            <Icon className="w-6 h-6 mr-3" />
            <span className="font-semibold">{label}</span>
          </a>
        </li>
      );
    };

    const Header: React.FC = () => (
        <header className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm sticky top-0 z-30 flex items-center justify-between h-20 px-4 md:px-8 border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-4">
                <button
                    onClick={() => setSidebarOpen(true)}
                    className="md:hidden text-slate-500 dark:text-slate-400"
                    aria-label="Open navigation menu"
                >
                    <Icons.MenuIcon className="w-6 h-6" />
                </button>
                <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 capitalize">
                    {currentView.replace(/([A-Z])/g, ' $1').trim()}
                </h1>
            </div>
            <div className="flex items-center space-x-4">
                 <button onClick={toggleTheme} className="text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 p-2 rounded-full transition" aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}>
                    {theme === 'light' ? <Icons.MoonIcon className="w-5 h-5" /> : <Icons.SunIcon className="w-5 h-5" />}
                </button>
                <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-lg">
                        {userProfile.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="hidden sm:block">
                        <p className="font-semibold text-slate-800 dark:text-slate-100">{userProfile.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Grade {userProfile.grade}</p>
                    </div>
                </div>
            </div>
        </header>
    );

    return (
        <div className="flex min-h-screen bg-slate-100 dark:bg-slate-900">
            <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-white/80 backdrop-blur-lg dark:bg-slate-800/80 border-r border-slate-200 dark:border-slate-700 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 transition-transform duration-300 ease-in-out`}>
                <div className="flex items-center justify-center h-20 border-b border-slate-200 dark:border-slate-700">
                    <h1 className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-purple-500">Teststar AI</h1>
                </div>
                <nav className="p-4">
                    <ul className="space-y-2">
                        {navItems.map(item => <NavLink {...item} />)}
                    </ul>
                </nav>
            </aside>
             {isSidebarOpen && <div className="fixed inset-0 bg-black/30 z-30 md:hidden" onClick={() => setSidebarOpen(false)}></div>}
            <main className="flex-1 flex flex-col">
                <Header />
                <div className="flex-1 p-4 md:p-8 overflow-y-auto">
                    {children}
                </div>
            </main>
        </div>
    );
};

// ... ALL THE VIEW COMPONENTS WILL GO HERE ...

const ActionCard: React.FC<{
    tourId: string;
    gradient: string;
    icon: React.FC<{className?: string}>;
    title: string;
    description: string;
    buttonText: string;
    buttonColor: string;
    onClick: () => void;
}> = ({ tourId, gradient, icon: Icon, title, description, buttonText, buttonColor, onClick }) => (
    <div data-tour-id={tourId} className={`text-white p-6 rounded-2xl shadow-lg flex flex-col justify-between relative overflow-hidden ${gradient}`}>
        <div className="relative z-10">
            <h3 className="text-xl font-bold">{title}</h3>
            <p className="opacity-80 mt-1 text-sm">{description}</p>
            <button onClick={onClick} className={`mt-6 bg-white ${buttonColor} font-bold py-2 px-4 rounded-lg self-start hover:bg-opacity-90 transition-all transform hover:scale-105`}>
                {buttonText}
            </button>
        </div>
        <Icon className="absolute -right-4 -bottom-4 w-24 h-24 text-white opacity-20 transform rotate-[-15deg] pointer-events-none" />
    </div>
);

const StatCard: React.FC<{ icon: React.FC<{ className?: string }>, label: string, value: string | number }> = ({ icon: Icon, label, value }) => (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-lg flex items-center gap-5">
        <div className="flex-shrink-0 w-14 h-14 rounded-full bg-indigo-100 dark:bg-slate-700 flex items-center justify-center">
            <Icon className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div>
            <h3 className="font-semibold text-slate-600 dark:text-slate-300">{label}</h3>
            <p className="text-3xl font-bold text-slate-900 dark:text-white">{value}</p>
        </div>
    </div>
);

const DashboardView: React.FC<{ 
    userProfile: UserProfile;
    reports: Report[];
    goals: Goal[];
    onStartTest: () => void;
    onStartRandomQuiz: () => void;
    onViewReport: (reportId: string) => void;
    onViewGoals: () => void;
}> = ({ userProfile, reports, goals, onStartTest, onStartRandomQuiz, onViewReport, onViewGoals }) => {
    const totalTests = reports.length;
    const avgScore = totalTests > 0 ? reports.reduce((sum, r) => sum + r.score, 0) / totalTests : 0;
    const activeGoals = goals.filter(g => g.status === 'active');
    const recentReports = [...reports].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 3);

    const subjectIcons: { [key: string]: React.FC<{ className?: string }> } = {
        math: Icons.SigmaIcon,
        science: Icons.AtomIcon,
        english: Icons.BookIcon,
        history: Icons.BookOpenIcon,
        geography: Icons.GlobeIcon,
    };
    
    const getSubjectIcon = (subject: string) => {
        const lowerSub = subject.toLowerCase();
        for (const key in subjectIcons) {
            if (lowerSub.includes(key)) {
                return subjectIcons[key];
            }
        }
        return Icons.FileTextIcon;
    };

    return (
        <div className="space-y-8 animate-fade-in-up dashboard-background">
            <div>
                <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-100">Welcome back, {userProfile.name.split(' ')[0]}!</h2>
                <p className="text-slate-500 dark:text-slate-400">Ready to ace your next test? Let's get started.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <ActionCard 
                    tourId="create-test"
                    gradient="bg-gradient-to-br from-indigo-500 to-purple-500"
                    icon={Icons.FilePlusIcon}
                    title="Start a New Test"
                    description="Challenge yourself and track your progress."
                    buttonText="Create Test"
                    buttonColor="text-indigo-600"
                    onClick={onStartTest}
                />
                <ActionCard 
                    tourId="quick-quiz"
                    gradient="bg-gradient-to-br from-teal-500 to-cyan-500"
                    icon={Icons.LightningBoltIcon}
                    title="Quick Quiz"
                    description="A fun 5-question random challenge."
                    buttonText="Start Quiz"
                    buttonColor="text-teal-600"
                    onClick={onStartRandomQuiz}
                />
                <StatCard icon={Icons.FileTextIcon} label="Total Tests Taken" value={totalTests} />
                <StatCard icon={Icons.TargetIcon} label="Average Score" value={`${avgScore.toFixed(0)}%`} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div data-tour-id="recent-reports">
                    <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4">Recent Reports</h3>
                    <div className="space-y-4">
                        {recentReports.length > 0 ? recentReports.map(report => {
                            const Icon = getSubjectIcon(report.subject);
                            return (
                                <div key={report.id} onClick={() => onViewReport(report.id)} className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-lg flex items-center justify-between cursor-pointer hover:shadow-xl hover:scale-[1.02] transition-all">
                                    <div className="flex items-center">
                                        <div className="w-12 h-12 rounded-lg bg-indigo-100 dark:bg-slate-700 flex items-center justify-center mr-4">
                                            <Icon className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-800 dark:text-slate-100">{report.subject} - {report.chapter}</p>
                                            <p className="text-sm text-slate-500 dark:text-slate-400">{new Date(report.date).toLocaleDateString()}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-lg text-slate-800 dark:text-slate-100">{report.score.toFixed(0)}%</p>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">{report.marksScored}/{report.totalMarks}</p>
                                    </div>
                                </div>
                            );
                        }) : (
                             <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-lg text-center">
                                <p className="text-slate-500 dark:text-slate-400">You haven't completed any tests yet.</p>
                            </div>
                        )}
                    </div>
                </div>
                <div data-tour-id="active-goals">
                    <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4">Active Goals</h3>
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-lg">
                        {activeGoals.length > 0 ? (
                             <div className="space-y-4">
                                {activeGoals.slice(0, 3).map(goal => (
                                    <div key={goal.id}>
                                        <p className="font-semibold text-slate-700 dark:text-slate-200">{goal.description}</p>
                                        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5 my-1">
                                            <div className="bg-emerald-500 h-2.5 rounded-full" style={{ width: `${Math.min(100, (goal.currentValue / goal.targetValue) * 100)}%` }}></div>
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">{GoalService.getMotivationalMessage(goal)}</p>
                                    </div>
                                ))}
                                <button onClick={onViewGoals} className="text-indigo-600 dark:text-indigo-400 font-semibold mt-4 hover:underline">View All Goals</button>
                            </div>
                        ) : (
                             <div className="text-center">
                                <p className="text-slate-500 dark:text-slate-400">You have no active goals. Set one to stay motivated!</p>
                                 <button onClick={onViewGoals} className="mt-4 bg-indigo-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-indigo-700 transition">
                                    Set a Goal
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// ... And so on for every other view
const CreateTestView: React.FC<{
    userProfile: UserProfile;
    onTestCreated: (test: Test) => void;
    setLoading: (loading: boolean) => void;
    setError: (error: string) => void;
}> = ({ userProfile, onTestCreated, setLoading, setError }) => {
    const [subject, setSubject] = useState('');
    const [topic, setTopic] = useState('');
    const [totalMarks, setTotalMarks] = useState<number | ''>(10);
    const [questionCounts, setQuestionCounts] = useState({ MCQ: 2, SHORT: 2, LONG: 1 });
    const [difficulty, setDifficulty] = useState<Difficulty>('Medium');

    const handleCreateTest = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!subject || !topic || !totalMarks || Object.values(questionCounts).reduce((a,b) => a+b, 0) === 0) {
            setError("Please fill all fields and specify at least one question.");
            return;
        }
        setLoading(true);
        setError('');
        try {
            const questions = await GeminiService.generateTestQuestions(subject, topic, userProfile.grade, userProfile.board, totalMarks, questionCounts, difficulty);
            onTestCreated({
                id: `test_${Date.now()}`,
                subject,
                chapter: topic,
                questions
            });
        } catch (err: any) {
            setError(err.message || "Failed to create test.");
        } finally {
            setLoading(false);
        }
    };
    
    return (
        <div className="max-w-2xl mx-auto animate-fade-in-up">
            <form onSubmit={handleCreateTest} className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-lg space-y-6">
                 <div>
                    <label htmlFor="subject" className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-2">Subject</label>
                    <input id="subject" type="text" value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g., Physics" className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 rounded-lg focus:ring-2 focus:ring-indigo-500" required />
                </div>
                 <div>
                    <label htmlFor="topic" className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-2">Topic / Chapter</label>
                    <input id="topic" type="text" value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g., Laws of Motion" className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 rounded-lg focus:ring-2 focus:ring-indigo-500" required />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label htmlFor="totalMarks" className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-2">Total Marks</label>
                        <input id="totalMarks" type="number" min="1" value={totalMarks} onChange={e => setTotalMarks(e.target.value === '' ? '' : parseInt(e.target.value))} className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 rounded-lg focus:ring-2 focus:ring-indigo-500" required />
                    </div>
                     <div>
                        <label htmlFor="difficulty" className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-2">Difficulty</label>
                        <select id="difficulty" value={difficulty} onChange={e => setDifficulty(e.target.value as Difficulty)} className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 rounded-lg focus:ring-2 focus:ring-indigo-500">
                            <option>Easy</option>
                            <option>Medium</option>
                            <option>Hard</option>
                        </select>
                    </div>
                </div>

                 <div>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-2">Question Distribution</label>
                    <div className="grid grid-cols-3 gap-4 bg-slate-50 dark:bg-slate-700/50 p-4 rounded-lg">
                        {(['MCQ', 'SHORT', 'LONG'] as const).map(type => (
                             <div key={type}>
                                <label htmlFor={`count-${type}`} className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">{type}s</label>
                                <input id={`count-${type}`} type="number" min="0" value={questionCounts[type]} onChange={e => setQuestionCounts(prev => ({...prev, [type]: parseInt(e.target.value)}))} className="w-full text-center px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-md focus:ring-2 focus:ring-indigo-500" />
                            </div>
                        ))}
                    </div>
                </div>

                <button type="submit" className="w-full bg-indigo-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-500/50 transition-all transform hover:scale-[1.02] shadow-md hover:shadow-lg">
                    Generate Test
                </button>
            </form>
        </div>
    );
};

const TestTakerView: React.FC<{
    test: Test;
    onSubmit: (answers: Answer[], timeTaken: number) => void;
}> = ({ test, onSubmit }) => {
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [answers, setAnswers] = useState<Answer[]>(() =>
        Array.from({ length: test.questions.length }, (_, i) => ({ questionIndex: i }))
    );
    const [startTime] = useState(Date.now());
    const [isConfirming, setConfirming] = useState(false);

    const timerInterval = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [timeElapsed, setTimeElapsed] = useState(0);

    useEffect(() => {
        timerInterval.current = setInterval(() => {
            setTimeElapsed(Math.floor((Date.now() - startTime) / 1000));
        }, 1000);
        return () => {
            if (timerInterval.current) {
                clearInterval(timerInterval.current);
            }
        };
    }, [startTime]);

    const handleAnswerChange = (answer: Partial<Answer>) => {
        setAnswers(prev => {
            const newAnswers = [...prev];
            newAnswers[currentQuestionIndex] = {
                ...newAnswers[currentQuestionIndex],
                questionIndex: currentQuestionIndex,
                ...answer
            };
            return newAnswers;
        });
    };
    
    const currentQuestion = test.questions[currentQuestionIndex];
    const currentAnswer = answers[currentQuestionIndex];

    const handleSubmit = () => {
        setConfirming(false);
        const timeTaken = Math.floor((Date.now() - startTime) / 1000);
        onSubmit(answers, timeTaken);
    };

    const handleNext = () => {
        if (currentQuestionIndex < test.questions.length - 1) {
            setCurrentQuestionIndex(i => i + 1);
        }
    };
    
    const handlePrev = () => {
        if (currentQuestionIndex > 0) {
            setCurrentQuestionIndex(i => i + 1);
        }
    };

    return (
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fade-in-up">
            <ConfirmationModal 
                isOpen={isConfirming}
                title="Submit Test"
                message="Are you sure you want to finish and submit your answers?"
                onConfirm={handleSubmit}
                onCancel={() => setConfirming(false)}
                confirmText="Submit Now"
                confirmButtonClass="bg-indigo-600 hover:bg-indigo-700"
            />
            <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-lg">
                <div className="flex justify-between items-start mb-6">
                    <div>
                         <p className="text-sm text-indigo-600 dark:text-indigo-400 font-semibold">{test.subject} - {test.chapter}</p>
                        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mt-1">Question {currentQuestionIndex + 1} of {test.questions.length}</h2>
                    </div>
                    <div className="text-right flex-shrink-0 bg-slate-100 dark:bg-slate-700 px-3 py-1 rounded-full">
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{currentQuestion.marks} Marks</p>
                    </div>
                </div>
                <div className="prose dark:prose-invert max-w-none mb-8 text-lg">
                    <p>{currentQuestion.questionText}</p>
                </div>
                
                <div className="space-y-4">
                    {currentQuestion.questionType === 'MCQ' && currentQuestion.options?.map((option, index) => (
                        <label key={index} className={`flex items-center p-4 rounded-lg border-2 cursor-pointer transition-all duration-200 ${currentAnswer.selectedOptionIndex === index ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 shadow-inner' : 'border-slate-300 dark:border-slate-600 hover:border-indigo-400 dark:hover:border-indigo-500'}`}>
                            <input type="radio" name={`q_${currentQuestionIndex}`} className="w-5 h-5 text-indigo-600 focus:ring-indigo-500" checked={currentAnswer.selectedOptionIndex === index} onChange={() => handleAnswerChange({ selectedOptionIndex: index })}/>
                            <span className="ml-4 text-slate-700 dark:text-slate-200">{option}</span>
                        </label>
                    ))}
                    {(currentQuestion.questionType === 'SHORT' || currentQuestion.questionType === 'LONG') && (
                        <textarea 
                            value={currentAnswer.writtenAnswer || ''}
                            onChange={(e) => handleAnswerChange({ writtenAnswer: e.target.value })}
                            rows={currentQuestion.questionType === 'SHORT' ? 4 : 8}
                            className="w-full p-4 border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 rounded-lg focus:ring-2 focus:ring-indigo-500"
                            placeholder="Type your answer here..."
                        />
                    )}
                </div>

                <div className="mt-8 flex justify-between items-center">
                    <button onClick={handlePrev} disabled={currentQuestionIndex === 0} className="px-6 py-2 rounded-lg bg-slate-200 text-slate-800 font-semibold hover:bg-slate-300 transition disabled:opacity-50 disabled:cursor-not-allowed dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600">Previous</button>
                    {currentQuestionIndex === test.questions.length - 1 ? (
                        <button onClick={() => setConfirming(true)} className="px-6 py-2 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition shadow-md hover:shadow-lg">Submit Test</button>
                    ) : (
                        <button onClick={handleNext} className="px-6 py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition shadow-md hover:shadow-lg">Next</button>
                    )}
                </div>
            </div>

            <div className="space-y-6">
                <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-lg text-center">
                    <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Time Elapsed</p>
                    <p className="text-3xl font-bold text-slate-800 dark:text-slate-100 tabular-nums">{String(Math.floor(timeElapsed / 60)).padStart(2, '0')}:{String(timeElapsed % 60).padStart(2, '0')}</p>
                </div>
                <QuestionNavigator 
                    totalQuestions={test.questions.length}
                    currentQuestionIndex={currentQuestionIndex}
                    testAnswers={answers}
                    onJumpToQuestion={(index) => setCurrentQuestionIndex(index)}
                />
            </div>
        </div>
    );
};

const ResultsView: React.FC<{
    report: Report;
    onViewDetails: () => void;
    onGoToDashboard: () => void;
}> = ({ report, onViewDetails, onGoToDashboard }) => {
     return (
        <div className="max-w-4xl mx-auto space-y-8 animate-fade-in-up">
            <div className="text-center">
                <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-100 mb-2">Test Completed!</h2>
                <p className="text-slate-500 dark:text-slate-400">Well done for completing the test. Here are your results.</p>
            </div>
            <ReportCard report={report} />
            
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-6">
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4">Weak Areas Identified</h3>
                 {report.weakAreas.length > 0 ? (
                    <ul className="list-disc list-inside space-y-2 text-slate-600 dark:text-slate-300">
                        {report.weakAreas.map(area => <li key={area}>{area}</li>)}
                    </ul>
                ) : (
                    <p className="text-slate-500 dark:text-slate-400">Great job! No specific weak areas were identified in this test.</p>
                )}
            </div>

             <div className="flex justify-center gap-4">
                <button onClick={onGoToDashboard} className="px-6 py-3 rounded-lg bg-slate-200 text-slate-800 font-semibold hover:bg-slate-300 transition dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600">
                    Go to Dashboard
                </button>
                <button onClick={onViewDetails} className="px-6 py-3 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition shadow-md hover:shadow-lg">
                    View Detailed Report
                </button>
            </div>
        </div>
    );
};


const ReportsView: React.FC<{
    reports: Report[];
    onViewReport: (reportId: string) => void;
    onDeleteReport: (reportId: string) => void;
}> = ({ reports, onViewReport, onDeleteReport }) => {
     const sortedReports = [...reports].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return (
        <div className="max-w-4xl mx-auto animate-fade-in-up">
            <div className="space-y-4">
                {sortedReports.length > 0 ? (
                    sortedReports.map(report => (
                        <div key={report.id} onClick={() => onViewReport(report.id)} className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-lg flex items-center justify-between cursor-pointer group hover:shadow-xl transition-all hover:scale-[1.02]">
                            <div>
                                <p className="font-bold text-lg text-slate-800 dark:text-slate-100">{report.subject} - {report.chapter}</p>
                                <p className="text-sm text-slate-500 dark:text-slate-400">{new Date(report.date).toLocaleString()}</p>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="text-right">
                                    <p className="font-bold text-xl text-indigo-600 dark:text-indigo-400">{report.score.toFixed(0)}%</p>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">{report.marksScored}/{report.totalMarks} Marks</p>
                                </div>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onDeleteReport(report.id);
                                    }}
                                    className="p-2 rounded-full text-slate-400 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-500/20 dark:hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                                    aria-label={`Delete report for ${report.subject} - ${report.chapter}`}
                                >
                                    <Icons.TrashIcon className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    ))
                ) : (
                     <div className="text-center bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-lg">
                         <p className="text-slate-500 dark:text-slate-400">You haven't completed any tests yet. Create a new test to get started!</p>
                     </div>
                )}
            </div>
        </div>
    );
};

const ReportDetailView: React.FC<{
    report: Report;
}> = ({ report }) => {
    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-fade-in-up">
            <div>
                 <p className="text-slate-500 dark:text-slate-400">Test taken on {new Date(report.date).toLocaleString()}</p>
            </div>
            
            <ReportCard report={report} />

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                <div className="lg:col-span-3">
                    <AnswerBreakdownPieChart report={report} />
                </div>
                <div className="lg:col-span-2">
                     <TopicPerformanceChart report={report} />
                </div>
            </div>

            <div>
                <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-6">Question Review</h3>
                 <div className="space-y-6">
                    {report.questions.map((q, index) => {
                        const answer = report.answers[index];
                        const isCorrect = answer?.isCorrect;
                        const isMCQ = q.questionType === 'MCQ';

                        let statusColor = 'border-slate-300 dark:border-slate-700';
                        if (isMCQ) {
                            statusColor = isCorrect ? 'border-emerald-500' : 'border-red-500';
                        }
                        
                        return (
                            <div key={index} className={`bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-lg border-l-4 ${statusColor}`}>
                                <p className="font-semibold text-slate-800 dark:text-slate-100 mb-2">Q{index + 1}: {q.questionText}</p>
                                {isMCQ && q.options?.map((opt, optIndex) => {
                                    const isSelected = answer.selectedOptionIndex === optIndex;
                                    const isCorrectOption = q.correctOptionIndex === optIndex;
                                    
                                    let optionStyle = 'text-slate-600 dark:text-slate-300';
                                    if (isCorrectOption) optionStyle = 'text-emerald-600 dark:text-emerald-400 font-semibold';
                                    if (isSelected && !isCorrectOption) optionStyle = 'text-red-600 dark:text-red-400 line-through';
                                    
                                    return <p key={optIndex} className={`pl-4 ${optionStyle}`}>
                                        {isSelected && '➔ '} {opt} {isCorrectOption && ' (Correct)'}
                                    </p>;
                                })}
                                 {!isMCQ && (
                                     <>
                                        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mt-4 mb-1">Your Answer:</p>
                                        <p className="p-3 bg-slate-100 dark:bg-slate-700/50 rounded-md text-slate-700 dark:text-slate-200">{answer.writtenAnswer || 'No answer provided.'}</p>
                                         <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mt-4 mb-1">Model Answer:</p>
                                        <p className="p-3 bg-emerald-50 dark:bg-emerald-500/10 rounded-md text-emerald-800 dark:text-emerald-300">{q.modelAnswer}</p>
                                     </>
                                 )}
                            </div>
                        )
                    })}
                 </div>
            </div>
        </div>
    );
};

const AiTutorView: React.FC<{ userProfile: UserProfile }> = ({ userProfile }) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [useWebSearch, setUseWebSearch] = useState(false);
    const [isConfirmingReset, setIsConfirmingReset] = useState(false);
    
    const chatRef = useRef<Chat | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;
        
        const userMessage: ChatMessage = { role: 'user', text: input };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);
        setError('');

        try {
            if (!chatRef.current) {
                chatRef.current = GeminiService.createTutorChat(userProfile, useWebSearch);
            }
            
            const stream = await chatRef.current.sendMessageStream({ message: input });

            let modelResponse: ChatMessage = { role: 'model', text: '', sources: [] };
            setMessages(prev => [...prev, modelResponse]);

            for await (const chunk of stream) {
                modelResponse.text += chunk.text;
                if (chunk.candidates?.[0]?.groundingMetadata?.groundingChunks) {
                    const sources = chunk.candidates[0].groundingMetadata.groundingChunks
                        .map((c: any) => c.web)
                        .filter(Boolean); // Filter out any non-web chunks
                     modelResponse.sources = [...(modelResponse.sources || []), ...sources];
                }

                setMessages(prev => {
                    const newMessages = [...prev];
                    newMessages[newMessages.length - 1] = { ...modelResponse };
                    return newMessages;
                });
            }

        } catch (err) {
            setError("Sorry, I couldn't get a response. Please try again.");
            setMessages(prev => prev.slice(0, -1)); // Remove the empty model message
        } finally {
            setIsLoading(false);
        }
    };

    const handleResetChat = () => {
        chatRef.current = null;
        setMessages([]);
    };

    const handleConfirmReset = () => {
        handleResetChat();
        setIsConfirmingReset(false);
    };

    return (
        <div className="h-[calc(100vh-10rem)] max-w-4xl mx-auto flex flex-col bg-white dark:bg-slate-800 rounded-2xl shadow-lg animate-fade-in-up">
            <ConfirmationModal
                isOpen={isConfirmingReset}
                title="Reset Chat History"
                message="Are you sure you want to permanently delete the current conversation? This action cannot be undone."
                onConfirm={handleConfirmReset}
                onCancel={() => setIsConfirmingReset(false)}
                confirmText="Reset Chat"
                confirmButtonClass="bg-red-600 hover:bg-red-700"
            />
            <div className="p-4 border-b dark:border-slate-700 flex justify-between items-center flex-wrap gap-2">
                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">AI Tutor - Nova</h2>
                <div className="flex items-center gap-4">
                     <label className="flex items-center cursor-pointer">
                        <Icons.GlobeIcon className={`w-5 h-5 mr-2 ${useWebSearch ? 'text-indigo-600' : 'text-slate-400'}`} />
                        <span className="text-sm font-medium text-slate-600 dark:text-slate-300 mr-2">Search the web</span>
                        <div className="relative">
                            <input type="checkbox" checked={useWebSearch} onChange={(e) => {
                                setUseWebSearch(e.target.checked);
                                handleResetChat(); // Reset chat when toggling search
                            }} className="sr-only" />
                            <div className={`block w-12 h-6 rounded-full ${useWebSearch ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-600'}`}></div>
                            <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${useWebSearch ? 'translate-x-6' : ''}`}></div>
                        </div>
                    </label>
                    <button onClick={() => setIsConfirmingReset(true)} className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-200" title="Reset Chat">
                        <Icons.TrashIcon className="w-5 h-5"/>
                    </button>
                </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
                 {messages.length === 0 && (
                    <div className="text-center text-slate-500 dark:text-slate-400 h-full flex flex-col justify-center">
                        <p>Ask me anything about your subjects!</p>
                        <p className="text-sm">For example: "Explain Newton's third law of motion."</p>
                    </div>
                 )}
                {messages.map((msg, index) => (
                    <div key={index} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                        {msg.role === 'model' && <div className="w-8 h-8 rounded-full bg-indigo-500 flex-shrink-0 self-end"></div>}
                        <div className={`p-4 rounded-2xl max-w-lg ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-bl-none'}`}>
                            <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">{msg.text}</div>
                            {msg.sources && msg.sources.length > 0 && (
                                <div className="mt-3 border-t dark:border-slate-600 pt-2">
                                    <p className="text-xs font-semibold mb-1">Sources:</p>
                                    <ul className="text-xs space-y-1">
                                        {[...new Map(msg.sources.map(item => [item["uri"], item])).values()].map((source, i) => (
                                            <li key={i}>
                                                <a href={source.uri} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline truncate block">
                                                   {i+1}. {source.title}
                                                </a>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                 {isLoading && messages[messages.length-1]?.role !== 'model' && (
                     <div className="flex gap-3">
                         <div className="w-8 h-8 rounded-full bg-indigo-500 flex-shrink-0"></div>
                         <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-700 rounded-bl-none">
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-75"></span>
                                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-200"></span>
                                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-300"></span>
                            </div>
                         </div>
                    </div>
                 )}
                <div ref={messagesEndRef} />
            </div>
            {error && <p className="text-red-500 text-sm px-6 pb-2">{error}</p>}
            <form onSubmit={handleSendMessage} className="p-4 border-t dark:border-slate-700">
                <div className="relative">
                     <input type="text" value={input} onChange={e => setInput(e.target.value)} placeholder="Ask Nova a question..." className="w-full px-4 py-3 pr-12 border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 rounded-xl focus:ring-2 focus:ring-indigo-500" />
                     <button type="submit" disabled={isLoading || !input.trim()} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-indigo-300 dark:disabled:bg-indigo-800 transition">
                         <Icons.ArrowRightIcon className="w-5 h-5" />
                     </button>
                </div>
            </form>
        </div>
    );
};

const StudyNotesView: React.FC<{ userProfile: UserProfile }> = ({ userProfile }) => {
    const [topic, setTopic] = useState('');
    const [notes, setNotes] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleGenerate = async () => {
        if (!topic.trim()) {
            setError("Please enter a topic.");
            return;
        }
        setIsLoading(true);
        setError('');
        setNotes('');
        try {
            const result = await GeminiService.generateStudyNotes(topic, userProfile.grade, userProfile.board);
            setNotes(result);
        } catch (err: any) {
            setError(err.message || "Failed to generate notes.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6 animate-fade-in-up">
            <div>
                <p className="text-slate-500 dark:text-slate-400">Enter a topic and get structured, easy-to-understand notes generated for you.</p>
            </div>
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-lg">
                <div className="flex flex-col sm:flex-row gap-4">
                    <input
                        id="topic-notes"
                        type="text"
                        value={topic}
                        onChange={e => setTopic(e.target.value)}
                        placeholder="e.g., The Indian Rebellion of 1857"
                        className="flex-1 w-full px-4 py-2.5 border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                     <button onClick={handleGenerate} disabled={isLoading} className="w-full sm:w-auto bg-indigo-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-500/50 transition disabled:opacity-50">
                        {isLoading ? 'Generating...' : 'Generate Notes'}
                    </button>
                </div>
            </div>

            {error && <ErrorDisplay message={error} />}

            {(notes || isLoading) && (
                <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-lg min-h-[20rem]">
                    {isLoading && <Spinner />}
                    {notes && <div className="prose dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: notes }} />}
                </div>
            )}
        </div>
    );
};

const PoemsAndStoriesView: React.FC<{ userProfile: UserProfile }> = ({ userProfile }) => {
    const [type, setType] = useState<'poem' | 'story'>('story');
    const [topic, setTopic] = useState('');
    const [content, setContent] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleGenerate = async () => {
        if (!topic.trim()) {
            setError("Please enter a topic.");
            return;
        }
        setIsLoading(true);
        setError('');
        setContent('');
        try {
            const result = await GeminiService.generateFunContent(type, topic, userProfile.grade);
            setContent(result);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <div className="max-w-4xl mx-auto space-y-6 animate-fade-in-up">
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-lg">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <input id="topic" type="text" value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g., A talking squirrel" className="md:col-span-2 w-full px-4 py-2.5 border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                     <div className="flex rounded-lg bg-slate-200 dark:bg-slate-700 p-1">
                        <button onClick={() => setType('story')} className={`px-4 py-1.5 text-sm font-semibold rounded-md flex-1 transition ${type === 'story' ? 'bg-white dark:bg-slate-600 text-indigo-700 dark:text-white shadow' : 'text-slate-600 dark:text-slate-300'}`}>Story</button>
                        <button onClick={() => setType('poem')} className={`px-4 py-1.5 text-sm font-semibold rounded-md flex-1 transition ${type === 'poem' ? 'bg-white dark:bg-slate-600 text-indigo-700 dark:text-white shadow' : 'text-slate-600 dark:text-slate-300'}`}>Poem</button>
                     </div>
                </div>
                <button onClick={handleGenerate} disabled={isLoading} className="mt-4 w-full bg-indigo-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-500/50 transition disabled:opacity-50">
                    {isLoading ? 'Generating...' : 'Generate'}
                </button>
            </div>
            
            {error && <ErrorDisplay message={error} />}

            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-lg min-h-[20rem]">
                {isLoading && <Spinner />}
                {content && <div className="prose dark:prose-invert max-w-none whitespace-pre-wrap">{content}</div>}
            </div>
        </div>
    );
};

const SettingsView: React.FC<{
    userProfile: UserProfile;
    onUpdateProfile: (updatedProfile: UserProfile) => void;
}> = ({ userProfile, onUpdateProfile }) => {
    const [profile, setProfile] = useState(userProfile);
    const [isSaved, setIsSaved] = useState(false);

    const handleSave = () => {
        onUpdateProfile(profile);
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 2000);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setProfile(prev => ({ ...prev, [name]: name === 'grade' ? parseInt(value) : value }));
    }

    return (
        <div className="max-w-2xl mx-auto space-y-8 animate-fade-in-up">
            <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-lg space-y-6">
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 border-b dark:border-slate-700 pb-3">Profile Information</h3>
                <div>
                    <label htmlFor="name" className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-2">Name</label>
                    <input id="name" name="name" type="text" value={profile.name} onChange={handleChange} className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                </div>
                 <div className="grid grid-cols-2 gap-6">
                    <div>
                        <label htmlFor="grade" className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-2">Grade</label>
                        <input id="grade" name="grade" type="number" value={profile.grade} onChange={handleChange} className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                    </div>
                     <div>
                        <label htmlFor="board" className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-2">Board</label>
                        <select id="board" name="board" value={profile.board} onChange={handleChange} className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 rounded-lg focus:ring-2 focus:ring-indigo-500">
                            {INDIA_BOARDS.map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                    </div>
                 </div>
                
                 <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 border-b dark:border-slate-700 pb-3 pt-4">Feedback Preferences</h3>
                 <div>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-2">Test Result Feedback</label>
                    <div className="flex rounded-lg bg-slate-200 dark:bg-slate-700 p-1">
                        <button onClick={() => setProfile(p => ({...p, feedbackPreference: 'summary'}))} className={`px-4 py-1.5 text-sm font-semibold rounded-md flex-1 transition ${profile.feedbackPreference !== 'full' ? 'bg-white dark:bg-slate-600 text-indigo-700 dark:text-white shadow' : 'text-slate-600 dark:text-slate-300'}`}>Summary</button>
                        <button onClick={() => setProfile(p => ({...p, feedbackPreference: 'full'}))} className={`px-4 py-1.5 text-sm font-semibold rounded-md flex-1 transition ${profile.feedbackPreference === 'full' ? 'bg-white dark:bg-slate-600 text-indigo-700 dark:text-white shadow' : 'text-slate-600 dark:text-slate-300'}`}>Full Detailed</button>
                    </div>
                 </div>
                 <div className="flex justify-end items-center gap-4 pt-4">
                     {isSaved && <p className="text-emerald-600 dark:text-emerald-400 text-sm animate-fade-in">Changes saved!</p>}
                     <button onClick={handleSave} className="bg-indigo-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-500/50 transition">Save Changes</button>
                 </div>
            </div>
            
            <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-lg">
                 <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4">Your Badges</h3>
                 <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                     {BADGES.map(badge => {
                         const hasBadge = userProfile.badges.includes(badge.id);
                         return (
                            <div key={badge.id} className={`p-4 rounded-lg text-center transition-all ${hasBadge ? 'bg-amber-100 dark:bg-amber-500/20' : 'bg-slate-100 dark:bg-slate-700 opacity-60'}`}>
                                <span className="text-4xl">{badge.icon}</span>
                                <p className={`mt-2 font-semibold text-sm ${hasBadge ? 'text-amber-800 dark:text-amber-200' : 'text-slate-600 dark:text-slate-300'}`}>{badge.name}</p>
                            </div>
                         )
                     })}
                 </div>
            </div>
        </div>
    );
};

const GoalsView: React.FC<{
    goals: Goal[];
    setGoals: React.Dispatch<React.SetStateAction<Goal[]>>;
}> = ({ goals, setGoals }) => {
    const [isCreating, setCreating] = useState(false);
    const [newGoal, setNewGoal] = useState<Partial<Goal>>({ type: 'completion', subject: 'Any', timeframe: 'week'});

    const handleCreateGoal = () => {
        if (!newGoal.description || !newGoal.targetValue) return;
        const goal: Goal = {
            id: `goal_${Date.now()}`,
            description: newGoal.description,
            type: newGoal.type!,
            subject: newGoal.subject!,
            targetValue: newGoal.targetValue!,
            currentValue: 0,
            timeframe: newGoal.timeframe!,
            startDate: new Date().toISOString(),
            status: 'active'
        };
        setGoals(prev => [goal, ...prev]);
        setCreating(false);
        setNewGoal({ type: 'completion', subject: 'Any', timeframe: 'week'});
    };

    const handleDeleteGoal = (id: string) => {
        setGoals(prev => prev.filter(g => g.id !== id));
    };

    const activeGoals = goals.filter(g => g.status === 'active');
    const completedGoals = goals.filter(g => g.status === 'completed');

    const GoalCard: React.FC<{ goal: Goal; onDelete: (id: string) => void }> = ({ goal, onDelete }) => (
         <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-lg">
            <div className="flex justify-between items-start">
                 <p className="font-bold text-slate-800 dark:text-slate-100 pr-4">{goal.description}</p>
                 <button onClick={() => onDelete(goal.id)} className="text-slate-400 hover:text-red-500 transition"><Icons.TrashIcon className="w-4 h-4" /></button>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5 my-2">
                <div className={`${goal.status === 'completed' ? 'bg-emerald-500' : 'bg-indigo-600'} h-2.5 rounded-full`} style={{ width: `${Math.min(100, (goal.currentValue / goal.targetValue) * 100)}%` }}></div>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">{GoalService.getMotivationalMessage(goal)}</p>
         </div>
    );
    
    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-fade-in-up">
            <div className="flex justify-end items-center">
                <button onClick={() => setCreating(!isCreating)} className="bg-indigo-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-indigo-700 transition">
                    {isCreating ? 'Cancel' : 'New Goal'}
                </button>
            </div>

            {isCreating && (
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-lg space-y-4 animate-scale-in">
                    <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">Create New Goal</h3>
                    <textarea value={newGoal.description || ''} onChange={e => setNewGoal(p => ({...p, description: e.target.value}))} placeholder="e.g., Score above 80% in 3 Math tests" className="w-full p-2.5 border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 rounded-lg" rows={2}/>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {/* More fields could be added here for subject, target, timeframe etc. */}
                        <input type="number" value={newGoal.targetValue || ''} onChange={e => setNewGoal(p => ({...p, targetValue: parseInt(e.target.value)}))} placeholder="Target" className="p-2.5 border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 rounded-lg"/>
                    </div>
                    <div className="flex justify-end gap-4">
                        <button onClick={handleCreateGoal} className="bg-indigo-600 text-white font-semibold px-4 py-2 rounded-lg">Add Goal</button>
                    </div>
                </div>
            )}
            
            <div>
                 <h3 className="text-xl font-semibold text-slate-700 dark:text-slate-200 mb-4">Active</h3>
                 <div className="space-y-4">
                    {activeGoals.length > 0 ? activeGoals.map(g => <GoalCard key={g.id} goal={g} onDelete={handleDeleteGoal} />) : <p className="text-slate-500 dark:text-slate-400">No active goals.</p>}
                 </div>
            </div>
            <div>
                 <h3 className="text-xl font-semibold text-slate-700 dark:text-slate-200 mb-4">Completed</h3>
                 <div className="space-y-4">
                     {completedGoals.length > 0 ? completedGoals.map(g => <GoalCard key={g.id} goal={g} onDelete={handleDeleteGoal} />) : <p className="text-slate-500 dark:text-slate-400">No completed goals yet.</p>}
                 </div>
            </div>
        </div>
    );
};

// FIX: Correctly implemented the StudyPlannerView component to manage its own state and logic.
const StudyPlannerView: React.FC<{
    reports: Report[];
    goals: Goal[];
    userProfile: UserProfile;
}> = ({ reports, goals, userProfile }) => {
    const [plan, setPlan] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const generatePlan = useCallback(async () => {
        setIsLoading(true);
        setError('');
        try {
            const weakAreas = [...new Set(reports.flatMap(r => r.weakAreas))];
            const activeGoals = goals.filter(g => g.status === 'active');
            const generatedPlan = await GeminiService.generateStudyPlan(weakAreas, activeGoals, userProfile);
            setPlan(generatedPlan.weeklyPlan);
        } catch (err: any) {
            setError(err.message || "Failed to generate a plan.");
        } finally {
            setIsLoading(false);
        }
    }, [reports, goals, userProfile]);

    useEffect(() => {
        generatePlan();
    }, [generatePlan]);
    
    const handleTaskToggle = (dayIndex: number, taskIndex: number) => {
        setPlan((prevPlan: any) => {
            const newPlan = [...prevPlan];
            newPlan[dayIndex].tasks[taskIndex].completed = !newPlan[dayIndex].tasks[taskIndex].completed;
            return newPlan;
        });
    };

    if (isLoading) return <Spinner />;
    if (error) return <ErrorDisplay message={error} />;

    return (
        <div className="max-w-7xl mx-auto animate-fade-in-up">
            <div className="flex justify-end items-center mb-6">
                <button onClick={generatePlan} className="bg-indigo-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-indigo-700 transition flex items-center gap-2">
                    <Icons.CogIcon className="w-5 h-5"/> Regenerate Plan
                </button>
            </div>
            {!plan ? (
                <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-lg text-center">
                    <p>Generating your personalized plan...</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-4">
                    {plan.map((day: any, dayIndex: number) => (
                        <div key={day.day} className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-lg">
                            <h3 className="font-bold text-lg text-indigo-700 dark:text-indigo-400">{day.day}</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mb-3 border-b dark:border-slate-700 pb-2">{day.focus}</p>
                            <div className="space-y-2">
                                {day.tasks.map((task: any, taskIndex: number) => (
                                    <label key={taskIndex} className="flex items-start p-2 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer">
                                        <input type="checkbox" checked={task.completed} onChange={() => handleTaskToggle(dayIndex, taskIndex)} className="mt-1 w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 border-slate-300 dark:border-slate-600 dark:bg-slate-700" />
                                        <span className={`ml-2 text-sm text-slate-700 dark:text-slate-200 ${task.completed ? 'line-through text-slate-400 dark:text-slate-500' : ''}`}>{task.description}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
};


// --- The Main App Component ---
const App: React.FC = () => {
    const [userProfile, setUserProfile] = useLocalStorage<UserProfile | null>('userProfile', null);
    const [reports, setReports] = useLocalStorage<Report[]>('reports', []);
    const [goals, setGoals] = useLocalStorage<Goal[]>('goals', []);
    const [theme, setTheme] = useLocalStorage<Theme>('theme', 'light');
    const [hasSeenTour, setHasSeenTour] = useLocalStorage<boolean>('hasSeenTour', false);

    const [currentView, setCurrentView] = useState<AppView>('dashboard');
    const [currentTest, setCurrentTest] = useState<Test | null>(null);
    const [currentReport, setCurrentReport] = useState<Report | null>(null);
    
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [newlyEarnedBadges, setNewlyEarnedBadges] = useState<{name: string, icon: string, description: string}[]>([]);
    const [reportToDelete, setReportToDelete] = useState<string | null>(null);
    const [isTourActive, setIsTourActive] = useState(false);

    useEffect(() => {
        document.documentElement.classList.toggle('dark', theme === 'dark');
    }, [theme]);

    useEffect(() => {
      if(userProfile) {
         // GoalService.updateGoalProgress returns a new array, which could cause an infinite loop
         // if we don't check for actual changes before setting state.
         const updatedGoals = GoalService.updateGoalProgress(goals, reports);
         if (JSON.stringify(updatedGoals) !== JSON.stringify(goals)) {
            setGoals(updatedGoals);
         }
      }
    }, [reports, userProfile, goals, setGoals]);

    useEffect(() => {
        // Use a small delay to ensure the dashboard has rendered for the tour
        const timer = setTimeout(() => {
            if (!hasSeenTour && currentView === 'dashboard') {
                setIsTourActive(true);
            } else {
                setIsTourActive(false);
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [hasSeenTour, currentView]);

    const handleTourComplete = () => {
        setHasSeenTour(true);
        setIsTourActive(false);
    };

    const handleProfileCreate = (profileData: Omit<UserProfile, 'badges'>) => {
        const newUserProfile: UserProfile = { ...profileData, badges: [], feedbackPreference: 'summary' };
        setUserProfile(newUserProfile);
        setCurrentView('dashboard');
    };
    
    const handleTestCreated = (test: Test) => {
        setCurrentTest(test);
        setCurrentView('test');
    };

    const handleStartRandomQuiz = async () => {
        if (!userProfile) return;
        setLoading(true);
        setError('');
        try {
            const questions = await GeminiService.generateRandomQuiz(userProfile.grade, userProfile.board);
            const randomTest: Test = {
                id: `test_random_${Date.now()}`,
                subject: 'General Knowledge',
                chapter: 'Quick Quiz',
                questions: questions
            };
            handleTestCreated(randomTest);
        } catch (err: any) {
            setError(err.message || "Failed to create the quiz. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleTestSubmit = (answers: Answer[], timeTaken: number) => {
        if (!currentTest || !userProfile) return;

        let correctCount = 0;
        let marksScored = 0;
        const mcqQuestions = currentTest.questions.filter(q => q.questionType === 'MCQ');
        const totalMcqMarks = mcqQuestions.reduce((sum, q) => sum + q.marks, 0);
        const processedAnswers: Answer[] = [];
        const weakAreas = new Set<string>();
        
        currentTest.questions.forEach((q, index) => {
            const answer = answers[index] || { questionIndex: index };
            let isCorrect: boolean | undefined = undefined;

            if (q.questionType === 'MCQ') {
                isCorrect = answer.selectedOptionIndex === q.correctOptionIndex;
                if (isCorrect) {
                    correctCount++;
                    marksScored += q.marks;
                } else {
                    weakAreas.add(q.topic);
                }
            }
            processedAnswers.push({ ...answer, isCorrect });
        });
        
        const score = totalMcqMarks > 0 ? (marksScored / totalMcqMarks) * 100 : 100;

        const newReport: Report = {
            id: `report_${Date.now()}`,
            subject: currentTest.subject,
            chapter: currentTest.chapter,
            score: score,
            totalMarks: currentTest.questions.reduce((sum, q) => sum + q.marks, 0),
            marksScored: marksScored,
            totalQuestions: currentTest.questions.length,
            correctAnswers: correctCount,
            timeTaken: timeTaken,
            date: new Date().toISOString(),
            weakAreas: Array.from(weakAreas),
            answers: processedAnswers,
            questions: currentTest.questions,
            feedbackPreference: userProfile?.feedbackPreference || 'summary',
        };
        
        const updatedReports = [...reports, newReport];
        setReports(updatedReports);
        setCurrentReport(newReport);
        setCurrentTest(null);
        setCurrentView('results');

        // Check for new badges
        const oldBadges = userProfile.badges || [];
        const newBadgeIds = BadgeService.checkAllBadges(updatedReports);
        const newlyEarnedIds = newBadgeIds.filter(id => !oldBadges.includes(id));
        if (newlyEarnedIds.length > 0) {
            setUserProfile(p => p ? ({ ...p, badges: [...p.badges, ...newlyEarnedIds] }) : null);
            const badgeDetails = newlyEarnedIds.map(id => BADGES.find(b => b.id === id)).filter(Boolean) as {name: string, icon: string, description: string}[];
            setNewlyEarnedBadges(badgeDetails);
        }
    };
    
    const viewReportDetail = (reportId: string) => {
        const report = reports.find(r => r.id === reportId);
        if (report) {
            setCurrentReport(report);
            setCurrentView('reportDetail');
        }
    };

    const handleDeleteReport = (reportId: string) => {
        setReportToDelete(reportId);
    };

    const handleConfirmDelete = () => {
        if (reportToDelete) {
            setReports(reports => reports.filter(r => r.id !== reportToDelete));
            setReportToDelete(null);
        }
    };

    const handleCancelDelete = () => {
        setReportToDelete(null);
    };
    
    const handleUpdateProfile = (updatedProfile: UserProfile) => {
        setUserProfile(updatedProfile);
    };

    const toggleTheme = () => {
        setTheme(prev => prev === 'light' ? 'dark' : 'light');
    }
    
    if (!userProfile) {
        return <WelcomeScreen onProfileCreate={handleProfileCreate} />;
    }

    const renderView = () => {
        if (loading) return <Spinner fullscreen />;
        if (error) return <ErrorDisplay message={error} />;

        switch (currentView) {
            case 'dashboard':
                return <DashboardView userProfile={userProfile} reports={reports} goals={goals} onStartTest={() => setCurrentView('createTest')} onStartRandomQuiz={handleStartRandomQuiz} onViewReport={viewReportDetail} onViewGoals={() => setCurrentView('goals')} />;
            case 'createTest':
                return <CreateTestView userProfile={userProfile} onTestCreated={handleTestCreated} setLoading={setLoading} setError={setError} />;
            case 'test':
                return currentTest ? <TestTakerView test={currentTest} onSubmit={handleTestSubmit} /> : <ErrorDisplay message="No active test found."/>;
            case 'results':
                return currentReport ? <ResultsView report={currentReport} onViewDetails={() => setCurrentView('reportDetail')} onGoToDashboard={() => setCurrentView('dashboard')} /> : <ErrorDisplay message="No report found."/>;
            case 'reports':
                return <ReportsView reports={reports} onViewReport={viewReportDetail} onDeleteReport={handleDeleteReport} />;
            case 'reportDetail':
                 return currentReport ? <ReportDetailView report={currentReport} /> : <ErrorDisplay message="Report not found."/>;
            case 'tutor':
                return <AiTutorView userProfile={userProfile} />;
            case 'studyNotes':
                return <StudyNotesView userProfile={userProfile} />;
            case 'poemsAndStories':
                return <PoemsAndStoriesView userProfile={userProfile} />;
            case 'settings':
                return <SettingsView userProfile={userProfile} onUpdateProfile={handleUpdateProfile} />;
            case 'goals':
                return <GoalsView goals={goals} setGoals={setGoals} />;
            case 'studyPlanner':
                return <StudyPlannerView reports={reports} goals={goals} userProfile={userProfile} />;
            default:
                return <DashboardView userProfile={userProfile} reports={reports} goals={goals} onStartTest={() => setCurrentView('createTest')} onStartRandomQuiz={handleStartRandomQuiz} onViewReport={viewReportDetail} onViewGoals={() => setCurrentView('goals')} />;
        }
    };

    return (
        <>
            <ConfirmationModal
                isOpen={!!reportToDelete}
                title="Delete Report"
                message="Are you sure you want to permanently delete this report? This action cannot be undone."
                onConfirm={handleConfirmDelete}
                onCancel={handleCancelDelete}
                confirmText="Delete"
                confirmButtonClass="bg-red-600 hover:bg-red-700"
            />
            <BadgeNotificationModal badges={newlyEarnedBadges} onClose={() => setNewlyEarnedBadges([])} />
            {isTourActive && <OnboardingTour onComplete={handleTourComplete} />}
            <MainLayout
                currentView={currentView}
                setView={setCurrentView}
                userProfile={userProfile}
                theme={theme}
                toggleTheme={toggleTheme}
            >
                {renderView()}
            </MainLayout>
        </>
    );
};

export default App;