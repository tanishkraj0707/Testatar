import React, { useState, useLayoutEffect } from 'react';

interface TourStep {
  targetId: string;
  title: string;
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

const tourSteps: TourStep[] = [
  {
    targetId: 'create-test',
    title: 'Start a New Test',
    content: "This is where you can create a customized test on any subject and topic you want to practice.",
    position: 'bottom',
  },
  {
    targetId: 'recent-reports',
    title: 'Review Your Progress',
    content: "Your most recent test reports will appear here. Click on any of them to see a detailed analysis.",
    position: 'top',
  },
  {
    targetId: 'active-goals',
    title: 'Set and Track Goals',
    content: "Stay motivated by setting weekly or monthly goals and tracking your progress right here on the dashboard.",
    position: 'top',
  },
];

interface OnboardingTourProps {
  onComplete: () => void;
}

export const OnboardingTour: React.FC<OnboardingTourProps> = ({ onComplete }) => {
  const [stepIndex, setStepIndex] = useState(-1); // -1 for the initial welcome modal
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const [highlightStyle, setHighlightStyle] = useState<React.CSSProperties>({});

  const isIntro = stepIndex === -1;
  const currentStep = !isIntro ? tourSteps[stepIndex] : null;

  useLayoutEffect(() => {
    if (isIntro || !currentStep) {
        setHighlightStyle({});
        setTooltipStyle({});
        return;
    }

    const targetElement = document.querySelector<HTMLElement>(`[data-tour-id="${currentStep.targetId}"]`);
    if (targetElement) {
      const targetRect = targetElement.getBoundingClientRect();
      
      const highlightPos: React.CSSProperties = {
        position: 'fixed',
        left: `${targetRect.left - 8}px`,
        top: `${targetRect.top - 8}px`,
        width: `${targetRect.width + 16}px`,
        height: `${targetRect.height + 16}px`,
        boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.6)',
        borderRadius: '1rem',
        zIndex: 9998,
        pointerEvents: 'none',
        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
      };
      setHighlightStyle(highlightPos);
      
      const tooltipPos: React.CSSProperties = {
        position: 'fixed',
        zIndex: 9999,
        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
      };
      
      // Estimated tooltip dimensions to prevent it from going off-screen
      const tooltipWidth = 320; 
      const tooltipHeight = 160; 

      switch (currentStep.position) {
        case 'bottom':
          tooltipPos.top = `${targetRect.bottom + 15}px`;
          tooltipPos.left = `${targetRect.left + targetRect.width / 2 - tooltipWidth / 2}px`;
          break;
        case 'top':
          tooltipPos.top = `${targetRect.top - tooltipHeight - 5}px`;
          tooltipPos.left = `${targetRect.left + targetRect.width / 2 - tooltipWidth / 2}px`;
          break;
        default:
          tooltipPos.top = `${targetRect.bottom + 15}px`;
          tooltipPos.left = `${targetRect.left}px`;
      }

      // Boundary checks to keep the tooltip on screen
      if (parseInt(`${tooltipPos.left}`, 10) < 10) {
        tooltipPos.left = '10px';
      }
      if (parseInt(`${tooltipPos.left}`, 10) + tooltipWidth > window.innerWidth - 10) {
        tooltipPos.left = `${window.innerWidth - tooltipWidth - 10}px`;
      }
      if (parseInt(`${tooltipPos.top}`, 10) < 10) {
        tooltipPos.top = '10px';
      }

      setTooltipStyle(tooltipPos);
      
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [stepIndex, currentStep, isIntro]);

  const handleNext = () => {
    if (isIntro) {
      setStepIndex(0);
    } else if (stepIndex < tourSteps.length - 1) {
      setStepIndex(stepIndex + 1);
    } else {
      onComplete();
    }
  };

  if (isIntro) {
      return (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-[9997] flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg w-full max-w-md p-6 text-center transform transition-all animate-scale-in">
                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Welcome to your Dashboard!</h2>
                <p className="text-slate-600 dark:text-slate-300 my-4">Let's take a quick tour of the key features to get you started.</p>
                <div className="flex justify-center gap-4 mt-6">
                    <button onClick={onComplete} className="px-6 py-2 rounded-lg bg-slate-200 text-slate-800 font-semibold hover:bg-slate-300 transition dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600">
                        Skip Tour
                    </button>
                    <button onClick={handleNext} className="px-6 py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition">
                        Let's Go!
                    </button>
                </div>
            </div>
        </div>
      );
  }

  return (
    <>
      <div style={highlightStyle}></div>
      <div style={tooltipStyle} className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl p-5 w-80 animate-fade-in">
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">{currentStep?.title}</h3>
        <p className="text-sm text-slate-600 dark:text-slate-300 my-2">{currentStep?.content}</p>
        <div className="flex justify-between items-center mt-4">
          <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">{stepIndex + 1} / {tourSteps.length}</span>
          <div>
            <button onClick={onComplete} className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 font-semibold mr-4">Skip</button>
            <button onClick={handleNext} className="bg-indigo-600 text-white font-semibold py-1.5 px-4 rounded-lg hover:bg-indigo-700 transition">
              {stepIndex === tourSteps.length - 1 ? 'Finish' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
