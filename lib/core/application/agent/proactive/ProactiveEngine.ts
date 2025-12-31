/**
 * Proactive Engine - Manages proactive engagement.
 */

export enum TimeOfDay {
    MORNING = 'MORNING',
    AFTERNOON = 'AFTERNOON',
    EVENING = 'EVENING',
    NIGHT = 'NIGHT'
}

export enum MilestoneType {
    BIRTHDAY = 'BIRTHDAY',
    ANNIVERSARY = 'ANNIVERSARY',
    HOLIDAY = 'HOLIDAY',
    SESSION_STREAK = 'SESSION_STREAK'
}

export class ProactiveEngine {
    shouldEngage(context: any): boolean {
        return false;
    }
}
