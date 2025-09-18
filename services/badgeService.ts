import { Report } from '../types';

/**
 * Checks all badge criteria against the user's reports and returns a list of earned badge IDs.
 * @param reports - An array of the user's test reports.
 * @returns An array of strings, where each string is the ID of an earned badge.
 */
export const checkAllBadges = (reports: Report[]): string[] => {
    const earnedBadges: Set<string> = new Set();

    if (!reports || reports.length === 0) {
        return [];
    }

    // Badge 1: First Test
    if (reports.length >= 1) {
        earnedBadges.add('first_test');
    }

    // Badge 2: Perfect Score
    if (reports.some(r => r.score === 100)) {
        earnedBadges.add('perfect_score');
    }

    // Badge 3: 5-Day Streak
    // Get unique days by setting hours to 0, then sort them
    const uniqueDayTimestamps = [...new Set(reports.map(r => new Date(r.date).setHours(0, 0, 0, 0)))].sort((a, b) => a - b);
    
    if (uniqueDayTimestamps.length >= 5) {
        let maxStreak = 0;
        let currentStreak = 1;
        for (let i = 1; i < uniqueDayTimestamps.length; i++) {
            const dayInMillis = 24 * 60 * 60 * 1000;
            const diff = uniqueDayTimestamps[i] - uniqueDayTimestamps[i-1];
            if (diff === dayInMillis) {
                currentStreak++;
            } else if (diff > dayInMillis) {
                // If there's a gap, check the streak that just ended and reset
                maxStreak = Math.max(maxStreak, currentStreak);
                currentStreak = 1;
            }
        }
        maxStreak = Math.max(maxStreak, currentStreak); // Check the last streak
        if (maxStreak >= 5) {
            earnedBadges.add('streak_5_day');
        }
    }

    // Badge 4: Math Whiz
    const mathTests = reports.filter(r => r.subject.toLowerCase().includes('math'));
    if (mathTests.length >= 3) {
        earnedBadges.add('math_whiz');
    }
    
    // Badge 5: Science Genius
    const scienceTests = reports.filter(r => r.subject.toLowerCase().includes('science'));
    if (scienceTests.length >= 3) {
        earnedBadges.add('science_genius');
    }
    
    return Array.from(earnedBadges);
};
