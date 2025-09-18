import React, { useState, useEffect, useMemo, useRef } from 'react';
import { UserProfile, AppView, Test, Answer, Report, ChatMessage, Question, FeedbackPreference, Difficulty, Goal } from './types';
import { WelcomeScreen } from './components/WelcomeScreen';
import * as Icons from './components/Icons';
import { INDIA_BOARDS, BADGES } from './components/constants';
import * as GeminiService from './services/geminiService';
import * as BadgeService from './services/badgeService';
import * as GoalService from './services/goalService';

type Theme = 'light' | 'dark';

// --- Helper & UI Components ---

const Spinner: React.FC = () => (
    <div className="flex justify-center items-center h-full p-8">
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
        className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" 
        role="dialog" 
        aria-modal="true" 
        aria-labelledby="dialog-title"
        onKeyDown={handleKeyDown}
    >
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg w-full max-w-md p-6 transform transition-all" role="document">
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
    const scoreColor = clampedScore >= 75 ? 'text-emerald-500 dark:text-emerald-400' : clampedScore >= 40 ? 'text-amber-500 dark:text-amber-400' : 'text-red-500 dark:text-red-400';

    return (
        <div className="relative w-32 h-32">
            <svg className="w-full h-full" viewBox="0 0 100 100">
                <circle className="text-slate-200 dark:text-slate-700" strokeWidth="10" stroke="currentColor" fill="transparent" r="45" cx="50" cy="50" />
                <circle
                    className={scoreColor}
                    strokeWidth="10"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="transparent"
                    r="45"
                    cx="50"
                    cy="50"
                    transform="rotate(-90 50 50)"
                />
            </svg>
            <span className={`absolute inset-0 flex items-center justify-center text-3xl font-bold ${scoreColor}`}>
                {clampedScore.toFixed(0)}%
            </span>
        </div>
    );
};

const getPerformanceFeedback = (score: number) => {
    if (score >= 90) return { text: "Excellent!", color: "text-emerald-600 dark:text-emerald-400" };
    if (score >= 75) return { text: "Great Job!", color: "text-green-600 dark:text-green-400" };
    if (score >= 60) return { text: "Good Effort!", color: "text-sky-600 dark:text-sky-400" };
    if (score >= 40) return { text: "Keep Practicing!", color: "text-amber-600 dark:text-amber-400" };
    return { text: "Needs Improvement", color: "text-red-600 dark:text-red-400" };
};

const ReportCard: React.FC<{ report: Report }> = ({ report }) => {
    const hasWrittenQuestions = report.questions.some(q => q.questionType !== 'MCQ');
    const accuracy = report.totalQuestions > 0 ? (report.correctAnswers / report.totalQuestions * 100) : 0;
    const avgTimePerQ = report.totalQuestions > 0 ? (report.timeTaken / report.totalQuestions) : 0;
    const performance = getPerformanceFeedback(report.score);

    return (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6 mb-8">
            <div className="flex flex-col md:flex-row items-center gap-8">
                <div className="flex-shrink-0">
                    <ScoreCircle score={report.score} />
                    {hasWrittenQuestions && <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 text-center">(Score based on MCQs)</p>}
                </div>
                <div className="w-full space-y-4">
                    <div className="text-center md:text-left">
                        <p className={`text-2xl font-bold ${performance.color}`}>{performance.text}</p>
                        <p className="text-slate-500 dark:text-slate-400">Here's a summary of your performance.</p>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center border-t dark:border-slate-700 pt-4">
                        <div>
                            <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{report.marksScored}/{report.totalMarks}</p>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Marks Scored</p>
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{accuracy.toFixed(0)}%</p>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Accuracy</p>
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{Math.floor(report.timeTaken / 60)}m {report.timeTaken % 60}s</p>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Time Taken</p>
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{avgTimePerQ.toFixed(1)}s</p>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Avg. Time / Q</p>
                        </div>
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
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-md">
            <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-3">Question Map</h3>
            <div className="flex flex-wrap gap-2">
                {Array.from({ length: totalQuestions }).map((_, index) => {
                    const status =
                        index === currentQuestionIndex
                            ? 'current'
                            : isAnswered(index)
                            ? 'answered'
                            : 'unanswered';

                    const baseClasses = "w-9 h-9 flex items-center justify-center rounded-md font-bold text-sm transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2";
                    let statusClasses = '';

                    switch (status) {
                        case 'current':
                            statusClasses = 'bg-indigo-600 text-white ring-indigo-500';
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
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md text-center">
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
        <div className="bg-white dark:bg-slate-800 p-4 md:p-6 rounded-xl shadow-md">
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
                        <path d={pathD} fill="none" stroke="#4f46e5" strokeWidth="2" />
                        
                        {/* Data Points */}
                        {points.map((p, i) => (
                            <circle key={i} cx={p.x} cy={p.y} r="4" fill="#4f46e5" stroke="white" strokeWidth="2" 
                                onMouseEnter={() => setActivePoint(i)}
                                onMouseLeave={() => setActivePoint(null)}
                                className="cursor-pointer"
                            />
                        ))}
                    </g>
                </svg>
                {activePoint !== null && (
                    <div className="absolute bg-slate-800 text-white text-xs rounded py-1 px-2 pointer-events-none" style={{
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
        const written = report.questions.filter(q => q.questionType !== 'MCQ').length;
        return { correct, incorrect, written };
    }, [report]);
    
    const total = data.correct + data.incorrect + data.written;
    if (total === 0) return null;

    const getCircumference = (radius: number) => 2 * Math.PI * radius;
    const radius = 45;
    const circumference = getCircumference(radius);

    const correctPct = (data.correct / total);
    const incorrectPct = (data.incorrect / total);

    const correctOffset = 0;
    const incorrectOffset = circumference * correctPct;
    const writtenOffset = circumference * (correctPct + incorrectPct);

    return (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md h-full">
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4">Answer Breakdown</h3>
            <div className="flex flex-col sm:flex-row items-center gap-6">
                <div className="relative w-40 h-40 flex-shrink-0">
                    <svg className="w-full h-full" viewBox="0 0 100 100" transform="rotate(-90)">
                        <circle className="text-slate-200 dark:text-slate-700" strokeWidth="10" stroke="currentColor" fill="transparent" r={radius} cx="50" cy="50" />
                        <circle className="text-emerald-500" strokeWidth="10" stroke="currentColor" fill="transparent" r={radius} cx="50" cy="50" 
                            strokeDasharray={circumference}
                            strokeDashoffset={-correctOffset}
                            strokeLinecap="round"
                        />
                         <circle className="text-red-500" strokeWidth="10" stroke="currentColor" fill="transparent" r={radius} cx="50" cy="50" 
                            strokeDasharray={circumference}
                            strokeDashoffset={-incorrectOffset}
                             strokeLinecap="round"
                        />
                         <circle className="text-slate-400" strokeWidth="10" stroke="currentColor" fill="transparent" r={radius} cx="50" cy="50" 
                            strokeDasharray={circumference}
                            strokeDashoffset={-writtenOffset}
                             strokeLinecap="round"
                        />
                    </svg>
                </div>
                <div className="space-y-3">
                    <div className="flex items-center">
                        <span className="w-3 h-3 rounded-full bg-emerald-500 mr-2"></span>
                        <span className="font-semibold text-slate-700 dark:text-slate-200">{data.correct} Correct</span>
                    </div>
                    <div className="flex items-center">
                        <span className="w-3 h-3 rounded-full bg-red-500 mr-2"></span>
                        <span className="font-semibold text-slate-700 dark:text-slate-200">{data.incorrect} Incorrect</span>
                    </div>
                    {data.written > 0 && <div className="flex items-center">
                        <span className="w-3 h-3 rounded-full bg-slate-400 mr-2"></span>
                        <span className="font-semibold text-slate-700 dark:text-slate-200">{data.written} Written (Not Graded)</span>
                    </div>}
                </div>
            </div>
        </div>
    );
}

const TopicPerformanceChart: React.FC<{ report: Report }> = ({ report }) => {
    const topicData = useMemo(() => {
        const data: { [topic: string]: { scored: number; total: number } } = {};
        report.questions.forEach((q, i) => {
            const ans = report.answers[i];
            if (!data[q.topic]) {
                data[q.topic] = { scored: 0, total: 0 };
            }
            data[q.topic].total += q.marks;
            if (ans.isCorrect) {
                data[q.topic].scored += q.marks;
            }
        });
        return Object.entries(data).map(([topic, scores]) => ({
            topic,
            ...scores,
            percentage: scores.total > 0 ? (scores.scored / scores.total) * 100 : 0,
        }));
    }, [report]);

    return (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md">
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4">Performance by Topic</h3>
            <div className="space-y-4">
                {topicData.map(({ topic, scored, total, percentage }) => (
                    <div key={topic}>
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{topic}</span>
                            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{scored}/{total} Marks</span>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5">
                            <div className="bg-indigo-600 h-2.5 rounded-full" style={{ width: `${percentage}%` }}></div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// --- Standalone View Components ---

interface ThemeToggleProps {
  theme: Theme;
  toggleTheme: () => void;
}
const ThemeToggle: React.FC<ThemeToggleProps> = ({ theme, toggleTheme }) => (
    <button
        onClick={toggleTheme}
        className="w-full flex items-center justify-between px-4 py-3 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-slate-700 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors duration-200"
        aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
    >
        <span>{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>
        {theme === 'light' ? <Icons.MoonIcon className="w-5 h-5" /> : <Icons.SunIcon className="w-5 h-5" />}
    </button>
);


interface SidebarProps {
    userProfile: UserProfile;
    currentView: AppView;
    onNavClick: (view: AppView) => void;
    onLogout: () => void;
    theme: Theme;
    toggleTheme: () => void;
}
const Sidebar: React.FC<SidebarProps> = ({ userProfile, currentView, onNavClick, onLogout, theme, toggleTheme }) => {
    const navItems = [
        { view: 'dashboard', icon: Icons.HomeIcon, label: 'Dashboard' },
        { view: 'createTest', icon: Icons.FilePlusIcon, label: 'Create Test' },
        { view: 'reports', icon: Icons.FileTextIcon, label: 'Reports' },
        { view: 'goals', icon: Icons.TargetIcon, label: 'My Goals' },
        { view: 'tutor', icon: Icons.MessageSquareIcon, label: 'AI Tutor' },
        { view: 'poemsAndStories', icon: Icons.BookIcon, label: 'Fun Learning' },
        { view: 'settings', icon: Icons.CogIcon, label: 'Settings' },
    ];

    return (
        <div className="w-64 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex flex-col p-4 space-y-4 h-full">
            <div className="px-4 py-2">
                <h1 className="text-2xl font-bold text-indigo-600">Teststar</h1>
            </div>
            <nav className="flex-grow">
                {navItems.map(item => (
                    <button key={item.view} onClick={() => onNavClick(item.view as AppView)} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-slate-700 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors duration-200 ${currentView === item.view ? 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 font-semibold' : ''}`}>
                        <item.icon className="w-6 h-6" />
                        <span>{item.label}</span>
                    </button>
                ))}
            </nav>
            <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                 <div className="mb-2">
                    <ThemeToggle theme={theme} toggleTheme={toggleTheme} />
                </div>
                <div className="flex items-center space-x-3 p-2">
                    <div className="w-10 h-10 rounded-full bg-indigo-500 text-white flex items-center justify-center font-bold text-lg flex-shrink-0">
                        {userProfile?.name.charAt(0)}
                    </div>
                    <div className="truncate">
                        <p className="font-semibold text-slate-800 dark:text-slate-100 truncate">{userProfile?.name}</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Grade {userProfile?.grade} | {userProfile?.board}</p>
                    </div>
                </div>
                <button onClick={onLogout} className="w-full mt-4 text-sm text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-500">Logout</button>
            </div>
        </div>
    );
};

interface HeaderProps {
    currentView: AppView;
    viewingReport: Report | null;
    onMenuClick: () => void;
}
const Header: React.FC<HeaderProps> = ({ currentView, viewingReport, onMenuClick }) => {
    let title = "Dashboard";
    if (currentView === 'createTest') title = "Create a Test";
    if (currentView === 'reports') title = "My Reports";
    if (currentView === 'reportDetail' && viewingReport) title = "Report Details";
    if (currentView === 'goals') title = "My Study Goals";
    if (currentView === 'tutor') title = "AI Tutor";
    if (currentView === 'test') title = "Test in Progress";
    if (currentView === 'results') title = "Test Results";
    if (currentView === 'poemsAndStories') title = "Fun Learning";
    if (currentView === 'settings') title = "Settings";
  
    return (
        <header className="md:hidden fixed top-0 left-0 right-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm shadow-sm z-20 h-16 flex items-center px-4">
            <button onClick={onMenuClick} className="p-2 text-slate-600 dark:text-slate-300">
                <Icons.MenuIcon className="w-6 h-6" />
            </button>
            <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-100 ml-4 truncate">{title}</h1>
        </header>
    );
};

interface DashboardViewProps {
    userProfile: UserProfile;
    reports: Report[];
    goals: Goal[];
    setCurrentView: (view: AppView) => void;
}
const DashboardView: React.FC<DashboardViewProps> = ({ userProfile, reports, goals, setCurrentView }) => {
    const avgScore = reports.length > 0 ? reports.reduce((acc, r) => acc + r.score, 0) / reports.length : 0;
    const testsTaken = reports.length;
    
    const userBadges = useMemo(() => {
        return BADGES.filter(b => userProfile.badges?.includes(b.id));
    }, [userProfile.badges]);

    const weakAreasData = useMemo(() => {
        const topicCounts: { [key: string]: number } = {};
        reports.forEach(report => {
            if (Array.isArray(report.weakAreas)) {
                report.weakAreas.forEach(topic => {
                    topicCounts[topic] = (topicCounts[topic] || 0) + 1;
                });
            }
        });
        
        const sortedTopics = Object.entries(topicCounts)
            .map(([topic, count]) => ({ topic, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        if (sortedTopics.length === 0) {
            return { topics: [], maxCount: 0 };
        }
        
        const maxCount = sortedTopics[0].count;

        return { topics: sortedTopics, maxCount };
    }, [reports]);

    const activeGoals = useMemo(() => goals.filter(g => g.status === 'active').slice(0, 2), [goals]);

    return (
        <div className="p-4 md:p-8 space-y-8">
            <div>
                <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-100">Hello, {userProfile?.name}!</h2>
                <p className="text-slate-500 dark:text-slate-400 mt-1">Let's make today a productive day.</p>
            </div>

            <div className="space-y-6">
                 <div className="bg-indigo-600 text-white p-6 rounded-xl shadow-lg flex flex-col md:flex-row justify-between items-center gap-4">
                    <div>
                        <h3 className="text-xl font-bold">Ready for a challenge?</h3>
                        <p className="text-indigo-200 mt-1">Create a custom test on any topic you want to master.</p>
                    </div>
                    <button onClick={() => setCurrentView('createTest')} className="bg-white text-indigo-600 font-bold py-2 px-6 rounded-lg hover:bg-indigo-100 transition w-full md:w-auto flex-shrink-0">
                        Create a Test
                    </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md">
                        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4">Your Progress</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                            <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-lg">
                                <p className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">{testsTaken}</p>
                                <p className="text-sm text-slate-500 dark:text-slate-400">Tests Taken</p>
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-lg">
                                <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{avgScore.toFixed(0)}%</p>
                                <p className="text-sm text-slate-500 dark:text-slate-400">Average Score</p>
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-lg flex flex-col items-center justify-center">
                                <Icons.BarChartIcon className="w-8 h-8 text-amber-500 dark:text-amber-400 mb-1"/>
                                <p className="text-sm text-slate-500 dark:text-slate-400">Keep it up!</p>
                            </div>
                        </div>
                    </div>
                    
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md">
                        <div className="flex justify-between items-center mb-4">
                             <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">My Goals</h3>
                             <button onClick={() => setCurrentView('goals')} className="text-sm font-semibold text-indigo-600 hover:underline">View All</button>
                        </div>
                        {activeGoals.length > 0 ? (
                            <div className="space-y-4">
                                {activeGoals.map(goal => {
                                    const progress = goal.targetValue > 0 ? (goal.currentValue / goal.targetValue) * 100 : 0;
                                    return (
                                        <div key={goal.id}>
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate pr-2">{goal.description}</span>
                                                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{goal.type === 'completion' ? `${Math.round(goal.currentValue)}/${goal.targetValue}` : `${goal.currentValue.toFixed(0)}% / ${goal.targetValue}%`}</span>
                                            </div>
                                            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5">
                                                <div className="bg-indigo-600 h-2.5 rounded-full" style={{ width: `${progress}%` }}></div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        ) : (
                             <div className="text-center py-4 flex flex-col items-center justify-center">
                                 <Icons.TargetIcon className="w-12 h-12 text-slate-300 dark:text-slate-600"/>
                                 <p className="mt-2 text-slate-500 dark:text-slate-400 text-sm">You have no active goals. Set a goal to track your progress!</p>
                            </div>
                        )}
                    </div>

                    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md">
                        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4">Focus Areas</h3>
                        {weakAreasData.topics.length > 0 ? (
                             <div className="h-48 pt-4 border-t dark:border-slate-700">
                                <div className="flex justify-around items-end h-full">
                                    {weakAreasData.topics.map(item => (
                                        <div key={item.topic} className="flex flex-col items-center w-1/5 text-center group" title={`${item.topic}: ${item.count} ${item.count > 1 ? 'mistakes' : 'mistake'}`}>
                                            <span className="text-sm font-bold text-slate-600 dark:text-slate-300 mb-1">{item.count}</span>
                                            <div className="w-8 bg-slate-200 dark:bg-slate-700 rounded-t-md flex-grow flex items-end">
                                                <div 
                                                    className="w-full bg-amber-400 group-hover:bg-amber-500 rounded-t-md transition-all duration-300" 
                                                    style={{ height: `${(item.count / weakAreasData.maxCount) * 100}%` }}
                                                ></div>
                                            </div>
                                            <span 
                                                className="text-xs text-slate-500 dark:text-slate-400 mt-2 h-8 w-full break-words"
                                            >
                                                {item.topic}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-4 flex flex-col items-center justify-center min-h-[150px]">
                                 <Icons.TargetIcon className="w-12 h-12 text-slate-300 dark:text-slate-600"/>
                                 <p className="mt-2 text-slate-500 dark:text-slate-400 text-sm">No specific weak areas identified. Keep up the great work!</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md">
                    <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4">Achievements</h3>
                    {userBadges.length > 0 ? (
                        <div className="flex flex-wrap gap-x-6 gap-y-4">
                            {userBadges.map(badge => (
                                <div key={badge.id} className="text-center group w-20" title={badge.description}>
                                    <div className="relative">
                                        <span className={`text-6xl ${badge.color} group-hover:scale-110 transition-transform duration-200 block`}>{badge.icon}</span>
                                    </div>
                                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mt-1 truncate">{badge.name}</p>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-8 flex flex-col items-center justify-center">
                            <Icons.AwardIcon className="w-12 h-12 text-slate-300 dark:text-slate-600"/>
                            <p className="mt-2 text-slate-500 dark:text-slate-400 text-sm">Your badges will appear here as you complete challenges!</p>
                        </div>
                    )}
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                   <div onClick={() => setCurrentView('createTest')} className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-md hover:shadow-lg dark:hover:bg-slate-700 hover:-translate-y-1 transition-transform duration-300 cursor-pointer text-center">
                       <Icons.FilePlusIcon className="w-10 h-10 mx-auto text-sky-500 dark:text-sky-400"/>
                       <h4 className="font-semibold mt-2 text-slate-700 dark:text-slate-200">New Test</h4>
                   </div>
                   <div onClick={() => setCurrentView('tutor')} className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-md hover:shadow-lg dark:hover:bg-slate-700 hover:-translate-y-1 transition-transform duration-300 cursor-pointer text-center">
                       <Icons.MessageSquareIcon className="w-10 h-10 mx-auto text-emerald-500 dark:text-emerald-400"/>
                       <h4 className="font-semibold mt-2 text-slate-700 dark:text-slate-200">AI Tutor</h4>
                   </div>
                   <div onClick={() => setCurrentView('reports')} className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-md hover:shadow-lg dark:hover:bg-slate-700 hover:-translate-y-1 transition-transform duration-300 cursor-pointer text-center">
                       <Icons.FileTextIcon className="w-10 h-10 mx-auto text-amber-500 dark:text-amber-400"/>
                       <h4 className="font-semibold mt-2 text-slate-700 dark:text-slate-200">Reports</h4>
                   </div>
                   <div onClick={() => setCurrentView('poemsAndStories')} className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-md hover:shadow-lg dark:hover:bg-slate-700 hover:-translate-y-1 transition-transform duration-300 cursor-pointer text-center">
                       <Icons.BookIcon className="w-10 h-10 mx-auto text-rose-500 dark:text-rose-400"/>
                       <h4 className="font-semibold mt-2 text-slate-700 dark:text-slate-200">Fun Learning</h4>
                   </div>
                </div>
            </div>
        </div>
    );
};

interface CreateTestViewProps {
    userProfile: UserProfile;
    isLoading: boolean;
    setIsLoading: (loading: boolean) => void;
    setError: (error: string | null) => void;
    setCurrentTest: (test: Test | null) => void;
    setTestAnswers: (answers: Answer[]) => void;
    setCurrentView: (view: AppView) => void;
    setCurrentQuestionIndex: (index: number) => void;
}
const CreateTestView: React.FC<CreateTestViewProps> = ({ userProfile, isLoading, setIsLoading, setError, setCurrentTest, setTestAnswers, setCurrentView, setCurrentQuestionIndex }) => {
    const [subject, setSubject] = useState('');
    const [topic, setTopic] = useState('');
    const [grade, setGrade] = useState<number | ''>(userProfile.grade);
    const [board, setBoard] = useState(userProfile.board || '');
    const [totalMarks, setTotalMarks] = useState<number | ''>(25);
    const [difficulty, setDifficulty] = useState<Difficulty>('Medium');
    const [questionCounts, setQuestionCounts] = useState({ MCQ: 5, SHORT: 2, LONG: 1 });
    const [formError, setFormError] = useState('');

    const handleCountChange = (type: keyof typeof questionCounts, value: string) => {
        const count = parseInt(value, 10);
        setQuestionCounts(prev => ({
            ...prev,
            [type]: isNaN(count) || count < 0 ? 0 : count,
        }));
    };

    const handleGenerateTest = async (e: React.FormEvent) => {
        e.preventDefault();
        const totalQuestions = Object.values(questionCounts).reduce((sum, count) => sum + count, 0);

        if (!subject || !topic || !totalMarks || totalQuestions === 0 || !grade || !board) {
            setFormError('Please fill out all fields and specify at least one question.');
            return;
        }
        if (totalMarks < 5 || totalMarks > 100) {
            setFormError('Total marks must be between 5 and 100.');
            return;
        }
        if (grade < 1 || grade > 12) {
            setFormError('Please enter a valid grade (1-12).');
            return;
        }
        setFormError('');
        
        if (!userProfile) return;

        setIsLoading(true);
        setError(null);
        try {
            const questions = await GeminiService.generateTestQuestions(subject, topic, Number(grade), board, Number(totalMarks), questionCounts, difficulty);
            const newTest: Test = { 
                id: Date.now().toString(), 
                subject: subject, 
                chapter: topic,
                questions 
            };
            setCurrentTest(newTest);
            setTestAnswers(new Array(questions.length).fill(null).map((_, i) => ({ questionIndex: i })));
            setCurrentQuestionIndex(0);
            setCurrentView('test');
        } catch (err: any) {
            setError(err.message || 'An unknown error occurred.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="p-4 md:p-8 max-w-2xl mx-auto">
            <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-100 mb-6">Create a New Test</h2>
            <form onSubmit={handleGenerateTest} className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md space-y-6">
                {formError && <p className="text-red-500 text-center bg-red-100 p-3 rounded-lg">{formError}</p>}
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label htmlFor="subject" className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-2">Subject</label>
                        <input id="subject" type="text" value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g., Physics" className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                    </div>
                    <div>
                        <label htmlFor="topic" className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-2">Topic</label>
                        <input id="topic" type="text" value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g., Laws of Motion" className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                    </div>
                    <div>
                        <label htmlFor="grade" className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-2">Class/Grade</label>
                        <input id="grade" type="number" value={grade} onChange={e => setGrade(e.target.value === '' ? '' : parseInt(e.target.value))} min="1" max="12" className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                    </div>
                    <div>
                        <label htmlFor="board" className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-2">Board</label>
                         <select
                            id="board"
                            value={board}
                            onChange={(e) => setBoard(e.target.value)}
                            className={`w-full px-4 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white ${!board ? 'text-slate-400' : 'text-slate-900 dark:text-slate-100'}`}
                            required
                        >
                            <option value="" disabled>Select your board</option>
                            {INDIA_BOARDS.map((b) => <option key={b} value={b}>{b}</option>)}
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label htmlFor="totalMarks" className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-2">Total Marks</label>
                        <input id="totalMarks" type="number" value={totalMarks} onChange={e => setTotalMarks(e.target.value === '' ? '' : parseInt(e.target.value))} min="5" max="100" className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                    </div>
                    <div>
                        <label htmlFor="difficulty" className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-2">Difficulty</label>
                        <select
                            id="difficulty"
                            value={difficulty}
                            onChange={(e) => setDifficulty(e.target.value as Difficulty)}
                            className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white text-slate-900 dark:text-slate-100"
                            required
                        >
                            <option value="Easy">Easy</option>
                            <option value="Medium">Medium</option>
                            <option value="Hard">Hard</option>
                        </select>
                    </div>
                </div>

                <div>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-2">Question Distribution</label>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Specify the number of questions for each type. Use 0 to exclude a type.</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {(Object.keys(questionCounts) as Array<keyof typeof questionCounts>).map(type => (
                            <div key={type}>
                                <label htmlFor={`count-${type}`} className="text-sm font-medium text-slate-600 dark:text-slate-400 block mb-1">{type}</label>
                                <input 
                                    id={`count-${type}`}
                                    type="number" 
                                    value={questionCounts[type]} 
                                    onChange={e => handleCountChange(type, e.target.value)} 
                                    min="0"
                                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-indigo-500" 
                                />
                            </div>
                        ))}
                    </div>
                </div>

                <button type="submit" className="w-full bg-indigo-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-500/50 transition-transform transform hover:scale-105" disabled={isLoading}>
                    {isLoading ? 'Generating...' : 'Generate Test'}
                </button>
            </form>
        </div>
    );
};

interface TestTakerViewProps {
    currentTest: Test;
    testAnswers: Answer[];
    setTestAnswers: (answers: Answer[]) => void;
    confirmAndSubmitTest: (timeTaken: number) => void;
    currentQuestionIndex: number;
    setCurrentQuestionIndex: React.Dispatch<React.SetStateAction<number>>;
    isLoading: boolean;
}
const TestTakerView: React.FC<TestTakerViewProps> = ({ currentTest, testAnswers, setTestAnswers, confirmAndSubmitTest, currentQuestionIndex, setCurrentQuestionIndex, isLoading }) => {
    const [startTime] = useState(Date.now());

    if (!currentTest) return null;
    const question = currentTest.questions[currentQuestionIndex];
    const answer = testAnswers[currentQuestionIndex];
    
    const handleAnswerChange = (optionIndex?: number, writtenAnswer?: string) => {
        const newAnswers = [...testAnswers];
        newAnswers[currentQuestionIndex] = { 
            ...newAnswers[currentQuestionIndex], 
            selectedOptionIndex: optionIndex,
            writtenAnswer: writtenAnswer,
        };
        setTestAnswers(newAnswers);
    };
    
    const handleNext = () => {
        if (currentQuestionIndex < currentTest.questions.length - 1) {
            setCurrentQuestionIndex(prev => prev + 1);
        } else {
            const timeTaken = Math.round((Date.now() - startTime) / 1000);
            confirmAndSubmitTest(timeTaken);
        }
    };

    const handlePrevious = () => {
        if (currentQuestionIndex > 0) {
            setCurrentQuestionIndex(prev => prev - 1);
        }
    };

    return (
        <div className="p-4 md:p-8 flex flex-col h-full max-w-4xl mx-auto">
             <div className="flex justify-between items-baseline">
                <div>
                    <h2 className="text-xl md:text-2xl font-bold text-slate-800 dark:text-slate-100">{currentTest.subject}: {currentTest.chapter}</h2>
                    <p className="text-slate-500 dark:text-slate-400">Question {currentQuestionIndex + 1} of {currentTest.questions.length}</p>
                </div>
                <div className="bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300 font-bold text-sm px-3 py-1 rounded-full flex-shrink-0">
                    {question.marks} {question.marks === 1 ? 'Mark' : 'Marks'}
                </div>
            </div>

            <div className="my-6">
                <QuestionNavigator
                    totalQuestions={currentTest.questions.length}
                    currentQuestionIndex={currentQuestionIndex}
                    testAnswers={testAnswers}
                    onJumpToQuestion={setCurrentQuestionIndex}
                />
            </div>

            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-lg flex-grow">
                <p className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-6 whitespace-pre-wrap">{question.questionText}</p>
                
                {question.questionType === 'MCQ' && question.options && (
                    <div className="space-y-4">
                        {question.options.map((option, index) => (
                            <button key={index} onClick={() => handleAnswerChange(index, undefined)} className={`w-full text-left p-4 rounded-lg border-2 transition ${answer?.selectedOptionIndex === index ? 'bg-indigo-100 border-indigo-500 text-indigo-800 dark:bg-indigo-500/20 dark:border-indigo-500 dark:text-indigo-300 font-semibold' : 'bg-slate-50 border-slate-200 hover:border-indigo-400 text-slate-800 dark:bg-slate-700/50 dark:border-slate-700 dark:hover:border-indigo-500 dark:text-slate-200'}`}>
                                {option}
                            </button>
                        ))}
                    </div>
                )}

                {(question.questionType === 'SHORT' || question.questionType === 'LONG') && (
                    <textarea
                        value={answer?.writtenAnswer || ''}
                        onChange={(e) => handleAnswerChange(undefined, e.target.value)}
                        placeholder="Type your answer here..."
                        rows={question.questionType === 'SHORT' ? 4 : 8}
                        className="w-full p-3 border border-slate-300 dark:border-slate-600 dark:bg-slate-700/50 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-indigo-500 transition"
                    />
                )}
            </div>
            <div className="mt-6 flex justify-between items-center">
                <button
                    onClick={handlePrevious}
                    disabled={currentQuestionIndex === 0 || isLoading}
                    className="bg-slate-200 text-slate-700 font-bold py-3 px-6 rounded-lg hover:bg-slate-300 transition disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 dark:disabled:bg-slate-800 dark:disabled:text-slate-500"
                >
                    Previous
                </button>
                <button 
                    onClick={handleNext} 
                    disabled={isLoading}
                    className="bg-indigo-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-indigo-700 transition flex items-center justify-center min-w-[160px] disabled:bg-indigo-400 disabled:cursor-wait"
                >
                    {currentQuestionIndex < currentTest.questions.length - 1 ? (
                        'Next Question'
                    ) : isLoading ? (
                        <>
                            <Icons.LoaderIcon className="w-5 h-5 mr-2 animate-spin" />
                            Submitting...
                        </>
                    ) : (
                        'Submit Test'
                    )}
                </button>
            </div>
        </div>
    );
};

interface TestResultsViewProps {
    testResult: Report;
    reports: Report[];
    saveReport: () => void;
    setCurrentView: (view: AppView) => void;
}
const TestResultsView: React.FC<TestResultsViewProps> = ({ testResult, reports, saveReport, setCurrentView }) => {
    const isAlreadySaved = reports.some(r => r.id === testResult.id);
    
    if (!testResult) return null;

    return (
        <div className="p-4 md:p-8">
            <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-100 mb-2">Test Complete!</h2>
            <p className="text-slate-500 dark:text-slate-400 mb-6">{testResult.subject}: {testResult.chapter}</p>
            
            <ReportCard report={testResult} />

            <div className="mb-8">
                <h3 className="text-xl font-semibold mb-4 text-slate-800 dark:text-slate-100">Review Your Answers</h3>
                <div className="space-y-4">
                    {testResult.questions.map((q, i) => {
                        const ans = testResult.answers[i];
                        const isMcq = q.questionType === 'MCQ';
                        return (
                            <div key={i} className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border-l-4" 
                                style={{borderColor: ans.isCorrect === true ? '#10B981' : ans.isCorrect === false ? '#EF4444' : '#64748B'}}>
                                <div className="mb-3">
                                    <div className="flex justify-between items-start">
                                        <p className="font-semibold text-slate-800 dark:text-slate-100 whitespace-pre-wrap flex-1">{i + 1}. {q.questionText}</p>
                                        <span className="text-xs font-bold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-1 rounded-full ml-4 flex-shrink-0">{q.marks} marks</span>
                                    </div>
                                </div>
                                
                                {isMcq ? (
                                    <div className="mt-2 pt-2 border-t dark:border-slate-700">
                                        <p className={`text-sm mt-2 ${ans.isCorrect ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                            Your answer: {q.options?.[ans.selectedOptionIndex ?? -1] ?? 'Not answered'} {ans.isCorrect ? <Icons.CheckCircleIcon className="inline w-4 h-4 ml-1" /> : <Icons.XCircleIcon className="inline w-4 h-4 ml-1" />}
                                        </p>
                                        {!ans.isCorrect && (
                                            <div className="mt-3 pt-3 border-t dark:border-slate-700">
                                                <p className="text-sm text-emerald-700 dark:text-emerald-500 font-medium">Correct answer: {q.options?.[q.correctOptionIndex!]}</p>
                                                {testResult.feedbackPreference === 'full' && ans.solution && (
                                                    <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 whitespace-pre-wrap">{ans.solution}</p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="mt-3 pt-3 border-t dark:border-slate-700 grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-1">Your Answer</h4>
                                            <p className="text-sm text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-700/50 p-2 rounded whitespace-pre-wrap">{ans.writtenAnswer || "No answer provided."}</p>
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-bold text-emerald-700 dark:text-emerald-500 mb-1">Model Answer</h4>
                                            <p className="text-sm text-slate-600 dark:text-slate-300 bg-emerald-50 dark:bg-emerald-900/50 p-2 rounded whitespace-pre-wrap">{q.modelAnswer}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
                <button 
                    onClick={saveReport} 
                    disabled={isAlreadySaved}
                    className="w-full sm:w-auto bg-emerald-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-emerald-700 disabled:bg-emerald-300 disabled:cursor-not-allowed"
                >
                    {isAlreadySaved ? 'Report Saved' : 'Save Report'}
                </button>
                <button onClick={() => setCurrentView('createTest')} className="w-full sm:w-auto bg-slate-200 text-slate-700 font-bold py-2 px-4 rounded-lg hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600">Take Another Test</button>
            </div>
        </div>
    );
};

interface ReportsListViewProps {
    reports: Report[];
    setViewingReport: (report: Report) => void;
    setCurrentView: (view: AppView) => void;
    deleteReport: (reportId: string) => void;
}
const ReportsListView: React.FC<ReportsListViewProps> = ({ reports, setViewingReport, setCurrentView, deleteReport }) => {
    const sortedReports = [...reports].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return (
        <div className="p-4 md:p-8">
            <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-100 mb-6">My Reports</h2>
            {sortedReports.length === 0 ? (
                <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-xl shadow-md">
                    <Icons.FileTextIcon className="w-16 h-16 mx-auto text-slate-300 dark:text-slate-600"/>
                    <h3 className="mt-2 text-xl font-semibold text-slate-800 dark:text-slate-100">No Reports Yet</h3>
                    <p className="mt-1 text-slate-500 dark:text-slate-400">Take a test to see your first report here.</p>
                </div>
            ) : (
                <div className="space-y-6">
                    <ScoreTrendChart reports={sortedReports} />
                    {sortedReports.map(report => (
                         <div key={report.id} className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-md hover:shadow-lg transition-shadow">
                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-4 items-center">
                                <div 
                                    onClick={() => { setViewingReport(report); setCurrentView('reportDetail'); }} 
                                    className="col-span-2 sm:col-span-3 cursor-pointer group"
                                    aria-label={`View report for ${report.subject} - ${report.chapter}`}
                                >
                                    <h3 className="font-semibold text-indigo-700 dark:text-indigo-400 group-hover:underline">{report.subject} - {report.chapter}</h3>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">{new Date(report.date).toLocaleDateString()}</p>
                                </div>
                                <div className="flex items-center justify-end space-x-2">
                                     <div className="text-right">
                                        <p className="font-bold text-xl text-slate-800 dark:text-slate-100">{report.score.toFixed(0)}%</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">{report.marksScored}/{report.totalMarks}</p>
                                    </div>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); deleteReport(report.id); }}
                                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-full transition-colors flex-shrink-0"
                                        aria-label="Delete report"
                                    >
                                        <Icons.TrashIcon className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

interface ReportDetailViewProps {
    viewingReport: Report;
    setCurrentView: (view: AppView) => void;
}
const ReportDetailView: React.FC<ReportDetailViewProps> = ({ viewingReport, setCurrentView }) => {
    if (!viewingReport) return <p>Report not found.</p>;
    
    return (
         <div className="p-4 md:p-8">
            <button onClick={() => setCurrentView('reports')} className="flex items-center text-sm text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 mb-4 font-semibold">
                <Icons.ChevronLeftIcon className="w-4 h-4 mr-1" /> Back to Reports
            </button>
            <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-100 mb-2">Report Details</h2>
            <p className="text-slate-500 dark:text-slate-400 mb-6">{viewingReport.subject}: {viewingReport.chapter}</p>
            
            <ReportCard report={viewingReport} />
            
            {viewingReport.feedbackPreference === 'full' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                    <AnswerBreakdownPieChart report={viewingReport} />
                    <TopicPerformanceChart report={viewingReport} />
                </div>
            )}

            <div>
                <h3 className="text-xl font-semibold mb-4 text-slate-800 dark:text-slate-100">Review Your Answers</h3>
                <div className="space-y-4">
                    {viewingReport.questions.map((q, i) => {
                        const ans = viewingReport.answers[i];
                        if (!ans) return null;
                         const isMcq = q.questionType === 'MCQ';
                        return (
                            <div key={i} className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border-l-4"
                                style={{borderColor: ans.isCorrect === true ? '#10B981' : ans.isCorrect === false ? '#EF4444' : '#64748B'}}>
                                <div className="mb-3">
                                    <div className="flex justify-between items-start">
                                        <p className="font-semibold text-slate-800 dark:text-slate-100 whitespace-pre-wrap flex-1">{i + 1}. {q.questionText}</p>
                                        <span className="text-xs font-bold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-1 rounded-full ml-4 flex-shrink-0">{q.marks} marks</span>
                                    </div>
                                </div>
                                
                                {isMcq ? (
                                    <div className="mt-2 pt-2 border-t dark:border-slate-700">
                                        <p className={`text-sm mt-2 ${ans.isCorrect ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                            Your answer: {q.options?.[ans.selectedOptionIndex ?? -1] ?? 'Not answered'} {ans.isCorrect ? <Icons.CheckCircleIcon className="inline w-4 h-4 ml-1" /> : <Icons.XCircleIcon className="inline w-4 h-4 ml-1" />}
                                        </p>
                                        {!ans.isCorrect && (
                                            <div className="mt-3 pt-3 border-t dark:border-slate-700">
                                                <p className="text-sm text-emerald-700 dark:text-emerald-500 font-medium">Correct answer: {q.options?.[q.correctOptionIndex!]}</p>
                                                {viewingReport.feedbackPreference === 'full' && ans.solution && (
                                                    <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 whitespace-pre-wrap">{ans.solution}</p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="mt-3 pt-3 border-t dark:border-slate-700 grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-1">Your Answer</h4>
                                            <p className="text-sm text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-700/50 p-2 rounded whitespace-pre-wrap">{ans.writtenAnswer || "No answer provided."}</p>
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-bold text-emerald-700 dark:text-emerald-500 mb-1">Model Answer</h4>
                                            <p className="text-sm text-slate-600 dark:text-slate-300 bg-emerald-50 dark:bg-emerald-900/50 p-2 rounded whitespace-pre-wrap">{q.modelAnswer}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    );
};

interface AiTutorViewProps {
    chatHistory: ChatMessage[];
    tutorInput: string;
    setTutorInput: (input: string) => void;
    isLoading: boolean;
    handleTutorSubmit: (e: React.FormEvent) => void;
}
const AiTutorView: React.FC<AiTutorViewProps> = ({ chatHistory, tutorInput, setTutorInput, isLoading, handleTutorSubmit }) => (
    <div className="p-4 md:p-8 h-full flex flex-col">
        <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-100 mb-4">AI Tutor - Nova</h2>
        <div className="flex-grow bg-white dark:bg-slate-800/50 rounded-lg shadow-inner p-4 overflow-y-auto mb-4 space-y-4">
            {chatHistory.length === 0 && <div className="text-center text-slate-500 dark:text-slate-400 py-8">Ask Nova anything about your subjects!</div>}
            {chatHistory.map((msg, index) => {
                // Simple parser for **bold** text
                const parts = msg.text.split(/(\*\*.*?\*\*)/g).filter(Boolean);
                return (
                    <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-md sm:max-w-xl p-3 rounded-2xl ${msg.role === 'user' ? 'bg-indigo-500 text-white' : 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100'}`}>
                            <p className="whitespace-pre-wrap">
                                {parts.map((part, i) =>
                                    part.startsWith('**') && part.endsWith('**') ?
                                    <strong key={i}>{part.slice(2, -2)}</strong> :
                                    part
                                )}
                            </p>
                        </div>
                    </div>
                );
            })}
            {isLoading && <div className="flex justify-start"><div className="bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-100 p-3 rounded-2xl animate-pulse">Nova is typing...</div></div>}
        </div>
        <form onSubmit={handleTutorSubmit} className="flex space-x-2">
            <input
                type="text"
                value={tutorInput}
                onChange={(e) => setTutorInput(e.target.value)}
                placeholder="Ask me anything..."
                className="flex-grow px-4 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-700/50 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-indigo-500"
                disabled={isLoading}
            />
            <button type="submit" className="bg-indigo-600 text-white font-semibold px-6 py-2 rounded-lg hover:bg-indigo-700 disabled:bg-indigo-300" disabled={isLoading}>Send</button>
        </form>
    </div>
);

interface FunLearningViewProps {
    isLoading: boolean;
    funContent: string | null;
    funContentError: string | null;
    handleGenerateFunContent: (type: 'poem' | 'story', topic: string) => void;
    handleGenerateRandomQuiz: () => void;
    studyNotes: string | null;
    studyNotesError: string | null;
    handleGenerateStudyNotes: (topic: string) => void;
}
const FunLearningView: React.FC<FunLearningViewProps> = ({ 
    isLoading, 
    funContent, 
    funContentError, 
    handleGenerateFunContent, 
    handleGenerateRandomQuiz,
    studyNotes,
    studyNotesError,
    handleGenerateStudyNotes
}) => {
    const [creativeTopic, setCreativeTopic] = useState('');
    const [notesTopic, setNotesTopic] = useState('');

    const handleCreativeSubmit = (type: 'poem' | 'story') => {
        if (!creativeTopic.trim()) return;
        handleGenerateFunContent(type, creativeTopic);
    };

    const handleNotesSubmit = () => {
        if (!notesTopic.trim()) return;
        handleGenerateStudyNotes(notesTopic);
    };

    return (
        <div className="p-4 md:p-8 max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-100 mb-6">Fun Learning</h2>

            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md mb-8">
                <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-100 mb-2">Study Notes Generator</h3>
                <p className="text-slate-500 dark:text-slate-400 mb-4">Need help with a topic? Enter it below to get AI-generated study notes tailored to your curriculum.</p>
                <div className="flex flex-col sm:flex-row gap-2">
                    <input
                        type="text"
                        value={notesTopic}
                        onChange={(e) => setNotesTopic(e.target.value)}
                        placeholder="e.g., Photosynthesis"
                        className="flex-grow px-4 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-700/50 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        disabled={isLoading}
                    />
                    <button onClick={handleNotesSubmit} className="bg-indigo-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:bg-indigo-300 w-full sm:w-auto" disabled={isLoading || !notesTopic}>
                        Generate Notes
                    </button>
                </div>
                 {(studyNotes || studyNotesError) && (
                    <div className="mt-6 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg border dark:border-slate-700">
                        {studyNotesError ? (
                            <p className="text-red-600">{studyNotesError}</p>
                        ) : (
                            <p className="text-slate-700 dark:text-slate-200 whitespace-pre-wrap">{studyNotes}</p>
                        )}
                    </div>
                )}
            </div>

            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md mb-8">
                <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-100 mb-2">Creative Corner</h3>
                <p className="text-slate-500 dark:text-slate-400 mb-4">Enter a topic and let our AI write a poem or a story for you!</p>
                <div className="flex flex-col sm:flex-row gap-2">
                    <input
                        type="text"
                        value={creativeTopic}
                        onChange={(e) => setCreativeTopic(e.target.value)}
                        placeholder="e.g., The Solar System"
                        className="flex-grow px-4 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-700/50 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        disabled={isLoading}
                    />
                    <div className="flex gap-2">
                        <button onClick={() => handleCreativeSubmit('poem')} className="flex-1 bg-sky-500 text-white font-semibold px-4 py-2 rounded-lg hover:bg-sky-600 disabled:bg-sky-300" disabled={isLoading || !creativeTopic}>Generate Poem</button>
                        <button onClick={() => handleCreativeSubmit('story')} className="flex-1 bg-emerald-500 text-white font-semibold px-4 py-2 rounded-lg hover:bg-emerald-600 disabled:bg-emerald-300" disabled={isLoading || !creativeTopic}>Generate Story</button>
                    </div>
                </div>
                 {(funContent || funContentError) && (
                    <div className="mt-6 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg border dark:border-slate-700">
                        {funContentError ? (
                            <p className="text-red-600">{funContentError}</p>
                        ) : (
                            <p className="text-slate-700 dark:text-slate-200 whitespace-pre-wrap">{funContent}</p>
                        )}
                    </div>
                )}
            </div>

            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md">
                <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-100 mb-2">Quick Challenge</h3>
                <p className="text-slate-500 dark:text-slate-400 mb-4">Test your knowledge with a quick, random quiz on various subjects.</p>
                <button onClick={handleGenerateRandomQuiz} className="w-full bg-indigo-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-indigo-700 disabled:bg-indigo-300" disabled={isLoading}>
                    Start Random Quiz
                </button>
            </div>
        </div>
    );
};

interface SettingsViewProps {
    userProfile: UserProfile;
    updateUserProfile: (profile: UserProfile) => void;
}
const SettingsView: React.FC<SettingsViewProps> = ({ userProfile, updateUserProfile }) => {
    const currentPreference = userProfile.feedbackPreference || 'full';

    const handlePreferenceChange = (preference: FeedbackPreference) => {
        updateUserProfile({ ...userProfile, feedbackPreference: preference });
    };

    return (
        <div className="p-4 md:p-8 max-w-2xl mx-auto">
            <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-100 mb-6">Settings</h2>
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md space-y-6">
                <div>
                    <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Feedback Preferences</h3>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">Choose the level of detail for your test reports.</p>
                </div>
                <fieldset className="space-y-4">
                    <legend className="sr-only">Feedback preference</legend>
                    <div 
                        className={`relative flex items-start p-4 rounded-lg border-2 transition-all duration-200 cursor-pointer ${currentPreference === 'full' ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-500/10' : 'border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500'}`}
                        onClick={() => handlePreferenceChange('full')}
                    >
                        <div className="flex items-center h-5">
                            <input
                                id="feedback-full"
                                name="feedback-preference"
                                type="radio"
                                checked={currentPreference === 'full'}
                                onChange={() => handlePreferenceChange('full')}
                                className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300"
                            />
                        </div>
                        <div className="ml-3 text-sm">
                            <label htmlFor="feedback-full" className="font-medium text-slate-800 dark:text-slate-100 cursor-pointer">Full Feedback</label>
                            <p className="text-slate-500 dark:text-slate-400 mt-1">Receive detailed explanations for incorrect answers and in-depth performance analysis.</p>
                        </div>
                    </div>
                    <div 
                         className={`relative flex items-start p-4 rounded-lg border-2 transition-all duration-200 cursor-pointer ${currentPreference === 'summary' ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-500/10' : 'border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500'}`}
                        onClick={() => handlePreferenceChange('summary')}
                    >
                        <div className="flex items-center h-5">
                            <input
                                id="feedback-summary"
                                name="feedback-preference"
                                type="radio"
                                checked={currentPreference === 'summary'}
                                onChange={() => handlePreferenceChange('summary')}
                                className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300"
                            />
                        </div>
                        <div className="ml-3 text-sm">
                            <label htmlFor="feedback-summary" className="font-medium text-slate-800 dark:text-slate-100 cursor-pointer">Summary Only</label>
                            <p className="text-slate-500 dark:text-slate-400 mt-1">See your score and which answers were correct or incorrect, without detailed explanations or charts.</p>
                        </div>
                    </div>
                </fieldset>
            </div>
        </div>
    );
};

interface AddGoalModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAddGoal: (goal: Omit<Goal, 'id' | 'currentValue' | 'startDate' | 'status'>) => void;
    reports: Report[];
}

const AddGoalModal: React.FC<AddGoalModalProps> = ({ isOpen, onClose, onAddGoal, reports }) => {
    const [type, setType] = useState<'completion' | 'improvement'>('completion');
    const [subject, setSubject] = useState('Any');
    const [targetValue, setTargetValue] = useState<number | ''>(5);
    const [timeframe, setTimeframe] = useState<'week' | 'month'>('week');
    const [description, setDescription] = useState('');
    const [error, setError] = useState('');
    
    const subjects = useMemo(() => ['Any', ...[...new Set(reports.map(r => r.subject))]], [reports]);

    useEffect(() => {
        if (type === 'completion') {
            setDescription(`Complete ${targetValue} ${subject === 'Any' ? '' : subject} test${targetValue !== 1 ? 's' : ''} this ${timeframe}`);
        } else {
            setDescription(`Improve my ${subject === 'Any' ? '' : subject} score by ${targetValue}% this ${timeframe}`);
        }
    }, [type, subject, targetValue, timeframe]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!description || !targetValue || targetValue <= 0) {
            setError('Please fill out all fields with valid values.');
            return;
        }
        setError('');
        onAddGoal({ description, type, subject, targetValue: Number(targetValue), timeframe });
        onClose();
    };
    
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg w-full max-w-md p-6 transform transition-all animate-scale-in" onClick={e => e.stopPropagation()}>
                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Set a New Goal</h2>
                {error && <p className="text-red-500 bg-red-100 p-2 rounded mt-2">{error}</p>}
                <form onSubmit={handleSubmit} className="mt-4 space-y-4">
                    <div>
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-2">Goal Type</label>
                        <select value={type} onChange={e => setType(e.target.value as any)} className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-lg bg-white text-slate-900 dark:text-slate-100">
                            <option value="completion">Complete Tests</option>
                            <option value="improvement">Improve Score</option>
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                             <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-2">Subject</label>
                            <select value={subject} onChange={e => setSubject(e.target.value)} className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-lg bg-white text-slate-900 dark:text-slate-100">
                                {subjects.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-2">{type === 'completion' ? '# of Tests' : 'Improve by %'}</label>
                            <input type="number" value={targetValue} onChange={e => setTargetValue(e.target.value === '' ? '' : parseInt(e.target.value))} min="1" className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg" />
                        </div>
                    </div>
                     <div>
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-2">Timeframe</label>
                        <select value={timeframe} onChange={e => setTimeframe(e.target.value as any)} className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-lg bg-white text-slate-900 dark:text-slate-100">
                            <option value="week">This Week</option>
                            <option value="month">This Month</option>
                        </select>
                    </div>
                     <div>
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-2">Description</label>
                        <input type="text" value={description} onChange={e => setDescription(e.target.value)} className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg" />
                    </div>
                    <div className="mt-6 flex justify-end space-x-4">
                        <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg bg-slate-200 text-slate-800 font-semibold hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600">Cancel</button>
                        <button type="submit" className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700">Set Goal</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

interface GoalsViewProps {
    goals: Goal[];
    deleteGoal: (goalId: string) => void;
    addGoal: (goal: Omit<Goal, 'id' | 'currentValue' | 'startDate' | 'status'>) => void;
    reports: Report[];
}

const GoalsView: React.FC<GoalsViewProps> = ({ goals, deleteGoal, addGoal, reports }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const activeGoals = useMemo(() => goals.filter(g => g.status === 'active'), [goals]);
    const completedGoals = useMemo(() => goals.filter(g => g.status === 'completed'), [goals]);

    const GoalCard: React.FC<{ goal: Goal }> = ({ goal }) => {
        const progress = goal.targetValue > 0 ? (goal.currentValue / goal.targetValue) * 100 : 0;
        const progressClamped = Math.min(100, progress);

        return (
             <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-md">
                <div className="flex justify-between items-start">
                    <div className="flex-1 pr-4">
                        <p className="font-semibold text-slate-800 dark:text-slate-100">{goal.description}</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{GoalService.getMotivationalMessage(goal)}</p>
                    </div>
                    <button onClick={() => deleteGoal(goal.id)} className="p-2 text-slate-400 hover:text-red-500 rounded-full hover:bg-red-50 dark:hover:bg-slate-700">
                        <Icons.TrashIcon className="w-5 h-5" />
                    </button>
                </div>
                <div className="mt-4">
                     <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Progress</span>
                        <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                           {goal.type === 'completion' ? `${Math.round(goal.currentValue)} / ${goal.targetValue} tests` : `${goal.currentValue.toFixed(0)}% / ${goal.targetValue}% gain`}
                        </span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3">
                        <div className={`h-3 rounded-full transition-all duration-500 ${goal.status === 'completed' ? 'bg-emerald-500' : 'bg-indigo-600'}`} style={{ width: `${progressClamped}%` }}></div>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="p-4 md:p-8">
             <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-100">My Study Goals</h2>
                <button onClick={() => setIsModalOpen(true)} className="bg-indigo-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-indigo-700 flex items-center space-x-2">
                    <Icons.FilePlusIcon className="w-5 h-5" />
                    <span>New Goal</span>
                </button>
            </div>
            
            <div className="space-y-6">
                <div>
                    <h3 className="text-xl font-semibold text-slate-700 dark:text-slate-200 mb-4">Active Goals</h3>
                    {activeGoals.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {activeGoals.map(goal => <GoalCard key={goal.id} goal={goal} />)}
                        </div>
                    ) : (
                         <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-xl shadow-md">
                            <Icons.TargetIcon className="w-16 h-16 mx-auto text-slate-300 dark:text-slate-600"/>
                            <h3 className="mt-2 text-xl font-semibold text-slate-800 dark:text-slate-100">No Active Goals</h3>
                            <p className="mt-1 text-slate-500 dark:text-slate-400">Click 'New Goal' to set a new target for yourself!</p>
                        </div>
                    )}
                </div>

                {completedGoals.length > 0 && (
                    <div>
                        <h3 className="text-xl font-semibold text-slate-700 dark:text-slate-200 mb-4">Completed Goals</h3>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {completedGoals.map(goal => <GoalCard key={goal.id} goal={goal} />)}
                        </div>
                    </div>
                )}
            </div>
            
            <AddGoalModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onAddGoal={addGoal} reports={reports} />
        </div>
    )
}


// --- Main App Component ---

const App: React.FC = () => {
    // State Management
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [currentView, setCurrentView] = useState<AppView>('welcome');
    const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('teststar_theme') as Theme) || 'light');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [currentTest, setCurrentTest] = useState<Test | null>(null);
    const [testAnswers, setTestAnswers] = useState<Answer[]>([]);
    const [testResult, setTestResult] = useState<Report | null>(null);
    const [reports, setReports] = useState<Report[]>([]);
    const [goals, setGoals] = useState<Goal[]>([]);
    const [viewingReport, setViewingReport] = useState<Report | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
    const [tutorInput, setTutorInput] = useState('');
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [funContent, setFunContent] = useState<string | null>(null);
    const [funContentError, setFunContentError] = useState<string | null>(null);
    const [studyNotes, setStudyNotes] = useState<string | null>(null);
    const [studyNotesError, setStudyNotesError] = useState<string | null>(null);
    const [newlyAwardedBadges, setNewlyAwardedBadges] = useState<string[]>([]);
    const [confirmation, setConfirmation] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
        // FIX: Added onCancel to the state type to match the object passed to setConfirmation.
        onCancel: () => void;
        confirmText?: string;
        cancelText?: string;
        confirmButtonClass?: string;
    } | null>(null);


    // --- Effects ---

    useEffect(() => {
        const root = window.document.documentElement;
        if (theme === 'dark') {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
        }
        localStorage.setItem('teststar_theme', theme);
    }, [theme]);


    useEffect(() => {
        const savedProfile = localStorage.getItem('teststar_userProfile');
        if (savedProfile) {
            const profile = JSON.parse(savedProfile);
            // Ensure profile has a badges array for backwards compatibility
            if (!profile.badges) {
                profile.badges = [];
            }
            if (!profile.feedbackPreference) {
                profile.feedbackPreference = 'full';
            }
            setUserProfile(profile);
            setCurrentView('dashboard');
        }
        const savedReports = localStorage.getItem('teststar_reports');
        if (savedReports) {
            setReports(JSON.parse(savedReports));
        }
        const savedGoals = localStorage.getItem('teststar_goals');
        if (savedGoals) {
            setGoals(JSON.parse(savedGoals));
        }
    }, []);

    useEffect(() => {
        // Proactively offer help from the AI tutor based on weak areas
        if (currentView === 'tutor' && userProfile && chatHistory.length === 0 && reports.length > 0) {
            const topicCounts: { [key: string]: number } = {};
            reports.forEach(report => {
                // Ensure weakAreas is an array before iterating
                if (Array.isArray(report.weakAreas)) {
                    report.weakAreas.forEach(topic => {
                        topicCounts[topic] = (topicCounts[topic] || 0) + 1;
                    });
                }
            });

            // Find topics that have appeared as weak areas more than once
            const recurringWeakTopics = Object.entries(topicCounts)
                .filter(([, count]) => count > 1)
                .sort((a, b) => b[1] - a[1]) // Sort by frequency, descending
                .map(([topic]) => topic)
                .slice(0, 2); // Get the top 2 most frequent weak topics

            if (recurringWeakTopics.length > 0) {
                // Format the topic list for the message
                const topicList = recurringWeakTopics.length > 1 
                    ? `${recurringWeakTopics[0]} and ${recurringWeakTopics[1]}` 
                    : recurringWeakTopics[0];

                const initialTutorMessage: ChatMessage = {
                    role: 'model',
                    text: `Hello, ${userProfile.name}! I've noticed you've had some challenges with **${topicList}** in your recent tests. Would you like me to explain one of these concepts for you, or is there something else I can help with today?`
                };
                setChatHistory([initialTutorMessage]);
            }
        }
    }, [currentView, userProfile, reports]);

    // --- Handlers ---
    const toggleTheme = () => {
        setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
    };

    const showConfirmation = (props: Omit<NonNullable<typeof confirmation>, 'isOpen' | 'onCancel'>) => {
        setConfirmation({ ...props, isOpen: true, onCancel: hideConfirmation });
    };

    const hideConfirmation = () => {
        setConfirmation(null);
    };

    const handleProfileCreate = (profile: UserProfile) => {
        const profileWithDefaults: UserProfile = { 
            ...profile, 
            badges: profile.badges || [], 
            feedbackPreference: 'full'
        };
        localStorage.setItem('teststar_userProfile', JSON.stringify(profileWithDefaults));
        setUserProfile(profileWithDefaults);
        setCurrentView('dashboard');
    };
    
    const handleLogout = () => {
        localStorage.removeItem('teststar_userProfile');
        localStorage.removeItem('teststar_reports');
        localStorage.removeItem('teststar_goals');
        setUserProfile(null);
        setReports([]);
        setGoals([]);
        setCurrentView('welcome');
        setChatHistory([]);
    };
    
    const updateUserProfile = (updatedProfile: UserProfile) => {
        setUserProfile(updatedProfile);
        localStorage.setItem('teststar_userProfile', JSON.stringify(updatedProfile));
    };

    const updateGoals = (updatedGoals: Goal[]) => {
        setGoals(updatedGoals);
        localStorage.setItem('teststar_goals', JSON.stringify(updatedGoals));
    };

    const addGoal = (newGoalData: Omit<Goal, 'id' | 'currentValue' | 'startDate' | 'status'>) => {
        const newGoal: Goal = {
            ...newGoalData,
            id: `goal_${Date.now()}`,
            currentValue: 0,
            startDate: new Date().toISOString(),
            status: 'active',
        };
        const allGoals = [newGoal, ...goals];
        const updatedGoals = GoalService.updateGoalProgress(allGoals, reports);
        updateGoals(updatedGoals);
    };

    const deleteGoal = (goalId: string) => {
        showConfirmation({
            title: "Delete Goal?",
            message: "Are you sure you want to delete this goal? This cannot be undone.",
            onConfirm: () => {
                const updatedGoals = goals.filter(g => g.id !== goalId);
                updateGoals(updatedGoals);
                hideConfirmation();
            },
            confirmText: "Delete",
            confirmButtonClass: "bg-red-600 hover:bg-red-700 focus:ring-red-500",
        });
    };
    
    const submitTest = async (timeTaken: number) => {
        if (!currentTest || !userProfile) return;
        setIsLoading(true);
        
        const feedbackPref = userProfile.feedbackPreference || 'full';
        
        let correctCount = 0;
        let totalMcqMarks = 0;
        let marksScored = 0;
        const totalMarks = currentTest.questions.reduce((sum, q) => sum + q.marks, 0);

        const processedAnswers = await Promise.all(testAnswers.map(async (ans, index) => {
            const question = currentTest.questions[index];
            let isCorrect: boolean | undefined = undefined;
            let solution = question.modelAnswer;

            if (question.questionType === 'MCQ') {
                totalMcqMarks += question.marks;
                isCorrect = ans.selectedOptionIndex === question.correctOptionIndex;
                if (isCorrect) {
                    correctCount++;
                    marksScored += question.marks;
                } else if (question.options && ans.selectedOptionIndex !== undefined) {
                    if (feedbackPref === 'full') {
                        try {
                            solution = await GeminiService.generateSolution(question, question.options[ans.selectedOptionIndex] ?? "No answer", userProfile.grade);
                        } catch (e) {
                            solution = "Could not generate a solution at this time.";
                        }
                    } else {
                        solution = undefined; // Don't generate solution for summary
                    }
                }
            }
            return { ...ans, isCorrect, solution };
        }));

        const score = totalMcqMarks > 0 ? (marksScored / totalMcqMarks) * 100 : 0;
        const weakAreas = [...new Set(processedAnswers.filter(a => a.isCorrect === false).map(a => currentTest.questions[a.questionIndex].topic))];
        
        const newReport: Report = {
            id: `rep_${Date.now()}`,
            testId: currentTest.id,
            subject: currentTest.subject,
            chapter: currentTest.chapter,
            score: score,
            totalMarks: totalMarks,
            marksScored: marksScored,
            totalQuestions: currentTest.questions.length,
            correctAnswers: correctCount,
            timeTaken,
            date: new Date().toISOString(),
            weakAreas,
            answers: processedAnswers,
            questions: currentTest.questions,
            feedbackPreference: feedbackPref,
        };

        setTestResult(newReport);
        setCurrentView('results');
        setIsLoading(false);
    };

    const handleConfirmAndSubmitTest = (timeTaken: number) => {
        const unansweredQuestions = testAnswers.filter(a =>
            (a.selectedOptionIndex === undefined || a.selectedOptionIndex === null) &&
            (!a.writtenAnswer || a.writtenAnswer.trim() === '')
        ).length;

        let message = "You are about to submit your test. Are you sure you want to proceed?";
        if (unansweredQuestions > 0) {
            message = `You have ${unansweredQuestions} unanswered question${unansweredQuestions > 1 ? 's' : ''}. Are you sure you want to submit?`;
        }

        showConfirmation({
            title: "Submit Test?",
            message: message,
            confirmText: "Submit",
            confirmButtonClass: "bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500",
            onConfirm: () => {
                submitTest(timeTaken);
                hideConfirmation();
            }
        });
    };
    
    const saveReport = () => {
        if (!testResult || !userProfile) return;
        if (reports.some(r => r.id === testResult.id)) {
            return;
        }
        const updatedReports = [testResult, ...reports];
        setReports(updatedReports);
        localStorage.setItem('teststar_reports', JSON.stringify(updatedReports));

        // Update goal progress
        const updatedGoals = GoalService.updateGoalProgress(goals, updatedReports);
        updateGoals(updatedGoals);
        
        // Check for new badges
        const currentBadges = userProfile.badges || [];
        const allEarnedBadges = BadgeService.checkAllBadges(updatedReports);
        const newBadges = allEarnedBadges.filter(b => !currentBadges.includes(b));
        
        if (newBadges.length > 0) {
            setNewlyAwardedBadges(newBadges);
            const updatedProfile = { ...userProfile, badges: allEarnedBadges };
            setUserProfile(updatedProfile);
            localStorage.setItem('teststar_userProfile', JSON.stringify(updatedProfile));
        }
    };

    const handleDeleteReport = (reportId: string) => {
        showConfirmation({
            title: "Delete Report?",
            message: "Are you sure you want to delete this report? This action is permanent and cannot be undone.",
            confirmText: "Delete",
            confirmButtonClass: "bg-red-600 hover:bg-red-700 focus:ring-red-500",
            onConfirm: () => {
                setReports(currentReports => {
                    const updatedReports = currentReports.filter(r => r.id !== reportId);
                    localStorage.setItem('teststar_reports', JSON.stringify(updatedReports));
                    return updatedReports;
                });

                if (viewingReport?.id === reportId) {
                    setViewingReport(null);
                    setCurrentView('reports');
                }
                hideConfirmation();
            }
        });
    };
    
    const handleTutorSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!tutorInput.trim() || !userProfile) return;

        const newHistory: ChatMessage[] = [...chatHistory, { role: 'user', text: tutorInput }];
        setChatHistory(newHistory);
        const currentInput = tutorInput;
        setTutorInput('');
        setIsLoading(true);

        try {
            const response = await GeminiService.getTutorResponse(currentInput, userProfile);
            setChatHistory(prev => [...prev, { role: 'model', text: response }]);
        } catch (err: any) {
            setChatHistory(prev => [...prev, { role: 'model', text: `Error: ${err.message}` }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleGenerateFunContent = async (type: 'poem' | 'story', topic: string) => {
        if (!userProfile) return;
        setIsLoading(true);
        setFunContent(null);
        setFunContentError(null);
        setStudyNotes(null);
        setStudyNotesError(null);
        try {
            const content = await GeminiService.generateFunContent(type, topic, userProfile.grade);
            setFunContent(content);
        } catch (err: any) {
            setFunContentError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleGenerateStudyNotes = async (topic: string) => {
        if (!userProfile) return;
        setIsLoading(true);
        setStudyNotes(null);
        setStudyNotesError(null);
        setFunContent(null);
        setFunContentError(null);
        try {
            const notes = await GeminiService.generateStudyNotes(topic, userProfile.grade, userProfile.board);
            setStudyNotes(notes);
        } catch (err: any) {
            setStudyNotesError(err.message);
        } finally {
            setIsLoading(false);
        }
    };


    const handleGenerateRandomQuiz = async () => {
        if (!userProfile) return;
        setIsLoading(true);
        setError(null);
        try {
            const questions = await GeminiService.generateRandomQuiz(userProfile.grade, userProfile.board);
            const newTest: Test = { 
                id: `quiz_${Date.now()}`, 
                subject: 'General Knowledge', 
                chapter: 'Random Quiz',
                questions 
            };
            setCurrentTest(newTest);
            setTestAnswers(new Array(questions.length).fill(null).map((_, i) => ({ questionIndex: i })));
            setCurrentQuestionIndex(0);
            setCurrentView('test');
        } catch (err: any) {
            setError(err.message || 'An unknown error occurred while creating the quiz.');
        } finally {
            setIsLoading(false);
        }
    };
    
    // --- Render Logic ---
    const handleNavClick = (view: AppView) => {
        setCurrentView(view);
        setIsSidebarOpen(false);
    };

    const renderView = () => {
        if (!userProfile) return null;

        switch (currentView) {
            case 'welcome': return <WelcomeScreen onProfileCreate={handleProfileCreate} />;
            case 'dashboard': return <DashboardView userProfile={userProfile} reports={reports} goals={goals} setCurrentView={setCurrentView}/>;
            case 'createTest': return <CreateTestView userProfile={userProfile} isLoading={isLoading} setIsLoading={setIsLoading} setError={setError} setCurrentTest={setCurrentTest} setTestAnswers={setTestAnswers} setCurrentView={setCurrentView} setCurrentQuestionIndex={setCurrentQuestionIndex} />;
            case 'test': return currentTest && <TestTakerView currentTest={currentTest} testAnswers={testAnswers} setTestAnswers={setTestAnswers} confirmAndSubmitTest={handleConfirmAndSubmitTest} currentQuestionIndex={currentQuestionIndex} setCurrentQuestionIndex={setCurrentQuestionIndex} isLoading={isLoading} />;
            case 'results': return testResult && <TestResultsView testResult={testResult} reports={reports} saveReport={saveReport} setCurrentView={setCurrentView}/>;
            case 'reports': return <ReportsListView reports={reports} setViewingReport={setViewingReport} setCurrentView={setCurrentView} deleteReport={handleDeleteReport} />;
            case 'reportDetail': return viewingReport && <ReportDetailView viewingReport={viewingReport} setCurrentView={setCurrentView}/>;
            case 'goals': return <GoalsView goals={goals} deleteGoal={deleteGoal} addGoal={addGoal} reports={reports} />;
            case 'tutor': return <AiTutorView chatHistory={chatHistory} tutorInput={tutorInput} setTutorInput={setTutorInput} isLoading={isLoading} handleTutorSubmit={handleTutorSubmit} />;
            case 'poemsAndStories': return <FunLearningView 
                isLoading={isLoading} 
                funContent={funContent} 
                funContentError={funContentError} 
                handleGenerateFunContent={handleGenerateFunContent} 
                handleGenerateRandomQuiz={handleGenerateRandomQuiz}
                studyNotes={studyNotes}
                studyNotesError={studyNotesError}
                handleGenerateStudyNotes={handleGenerateStudyNotes} 
            />;
            case 'settings': return <SettingsView userProfile={userProfile} updateUserProfile={updateUserProfile} />;
            default: return <DashboardView userProfile={userProfile} reports={reports} goals={goals} setCurrentView={setCurrentView} />;
        }
    };
    

    if (!userProfile) {
        return <WelcomeScreen onProfileCreate={handleProfileCreate} />;
    }

    return (
        <div className="h-screen bg-slate-50 dark:bg-slate-900 flex overflow-hidden">
            <div className="hidden md:flex flex-shrink-0">
                <Sidebar userProfile={userProfile} currentView={currentView} onNavClick={handleNavClick} onLogout={handleLogout} theme={theme} toggleTheme={toggleTheme} />
            </div>

            <div className={`fixed inset-0 z-40 transition-opacity duration-300 md:hidden ${isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                <div className="absolute inset-0 bg-black/50" onClick={() => setIsSidebarOpen(false)}></div>
                <div className={`relative z-10 h-full w-64 transition-transform duration-300 ${isSidebarOpen ? 'transform-none' : '-translate-x-full'}`}>
                    <Sidebar userProfile={userProfile} currentView={currentView} onNavClick={handleNavClick} onLogout={handleLogout} theme={theme} toggleTheme={toggleTheme}/>
                </div>
            </div>

            <div className="flex-1 flex flex-col min-w-0">
                <Header currentView={currentView} viewingReport={viewingReport} onMenuClick={() => setIsSidebarOpen(true)} />
                <main className="flex-1 overflow-y-auto pt-16 md:pt-0">
                    {isLoading && currentView !== 'tutor' && currentView !== 'poemsAndStories' && currentView !== 'test' ? <Spinner /> : error ? <ErrorDisplay message={error}/> : renderView()}
                </main>
            </div>
            
            {confirmation?.isOpen && (
                <ConfirmationModal
                    isOpen={confirmation.isOpen}
                    title={confirmation.title}
                    message={confirmation.message}
                    onConfirm={confirmation.onConfirm}
                    // FIX: Use onCancel from the confirmation state object for consistency.
                    onCancel={confirmation.onCancel}
                    confirmText={confirmation.confirmText}
                    confirmButtonClass={confirmation.confirmButtonClass}
                    cancelText={confirmation.cancelText}
                />
            )}
            {newlyAwardedBadges.length > 0 && (
                <BadgeNotificationModal 
                    badges={BADGES.filter(b => newlyAwardedBadges.includes(b.id))}
                    onClose={() => setNewlyAwardedBadges([])}
                />
            )}
        </div>
    );
};

export default App;