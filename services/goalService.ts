import { Goal, Report } from '../types';

const getStartDate = (timeframe: 'week' | 'month', startDateStr: string): Date => {
    const date = new Date(startDateStr);
    date.setHours(0, 0, 0, 0);
    if (timeframe === 'week') {
        const day = date.getDay();
        const diff = date.getDate() - day; // Set to the last Sunday
        return new Date(date.setDate(diff));
    }
    // Start of the month
    return new Date(date.getFullYear(), date.getMonth(), 1);
};

const getEndDate = (timeframe: 'week' | 'month', startDate: Date): Date => {
    const endDate = new Date(startDate);
    if (timeframe === 'week') {
        endDate.setDate(startDate.getDate() + 7);
    } else {
        endDate.setMonth(startDate.getMonth() + 1);
    }
    return endDate;
};

export const updateGoalProgress = (goals: Goal[], reports: Report[]): Goal[] => {
    if (!reports) {
        return goals;
    }

    const now = new Date();

    return goals.map(goal => {
        if (goal.status === 'completed') {
            return goal;
        }

        const goalStartDate = new Date(goal.startDate);
        const timeframeStartDate = getStartDate(goal.timeframe, goal.startDate);
        const timeframeEndDate = getEndDate(goal.timeframe, timeframeStartDate);

        // Deactivate goal if timeframe has passed
        if (now > timeframeEndDate && goal.status === 'active') {
            return { ...goal, status: 'completed' }; // Mark as completed (or expired)
        }

        let currentValue = 0;

        if (goal.type === 'completion') {
            const relevantReports = reports.filter(r => {
                const reportDate = new Date(r.date);
                const subjectMatch = goal.subject.toLowerCase() === 'any' || r.subject.toLowerCase().includes(goal.subject.toLowerCase());
                return subjectMatch && reportDate >= timeframeStartDate && reportDate < timeframeEndDate;
            });
            currentValue = relevantReports.length;

        } else if (goal.type === 'improvement') {
            const subjectReports = reports
                .filter(r => goal.subject.toLowerCase() === 'any' || r.subject.toLowerCase().includes(goal.subject.toLowerCase()))
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

            const baselineReports = subjectReports.filter(r => new Date(r.date) < goalStartDate);
            const progressReports = subjectReports.filter(r => {
                const reportDate = new Date(r.date);
                return reportDate >= timeframeStartDate && reportDate < timeframeEndDate;
            });

            const calculateAverage = (arr: Report[]) => arr.length > 0 ? arr.reduce((sum, r) => sum + r.score, 0) / arr.length : 0;
            
            const baselineScore = calculateAverage(baselineReports);
            const currentAvgScore = calculateAverage(progressReports);

            if (progressReports.length > 0) {
                 currentValue = currentAvgScore - baselineScore;
            } else {
                currentValue = 0;
            }
        }
        
        const isCompleted = currentValue >= goal.targetValue;

        const updatedGoal: Goal = {
            ...goal,
            currentValue: Math.max(0, currentValue), // Ensure it's not negative
            status: isCompleted ? 'completed' : 'active'
        };

        return updatedGoal;
    });
};

export const getMotivationalMessage = (goal: Goal): string => {
    const progress = goal.targetValue > 0 ? (goal.currentValue / goal.targetValue) * 100 : 0;
    
    if (goal.status === 'completed' && progress < 100) {
        return "Time's up! You made great progress.";
    }
     if (goal.status === 'completed') {
        return "Goal Achieved! Amazing job! 🎉";
    }

    if (progress <= 0) {
        return "Let's get started on your goal! You can do it.";
    }
    if (progress < 50) {
        return "Good start! Every step counts towards success.";
    }
    if (progress < 100) {
        return "You're getting so close! Keep up the great work.";
    }
    return "You're on fire! Almost there!";
};
