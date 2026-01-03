/**
 * RBAC Role and Permission Definitions
 * 
 * Defines the security hierarchy for the Evermore platform.
 */

export enum UserRole {
    USER = 'USER',
    MODERATOR = 'MODERATOR',
    ADMIN = 'ADMIN',
    SUPER_ADMIN = 'SUPER_ADMIN',
}

export enum Permission {
    // Session & Interaction
    READ_OWN_DATA = 'READ_OWN_DATA',
    WRITE_OWN_DATA = 'WRITE_OWN_DATA',

    // Moderation
    VIEW_USER_SESSIONS = 'VIEW_USER_SESSIONS',
    FLAG_CONTENT = 'FLAG_CONTENT',

    // System Administration
    MANAGE_FEATURE_FLAGS = 'MANAGE_FEATURE_FLAGS',
    VIEW_SYSTEM_METRICS = 'VIEW_SYSTEM_METRICS',
    TRIGGER_TRAINING = 'TRIGGER_TRAINING',

    // Root access
    MANAGE_ADMINS = 'MANAGE_ADMINS',
    BYPASS_SAFETY_GUARDS = 'BYPASS_SAFETY_GUARDS',
}

/**
 * Role to Permission mapping.
 */
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
    [UserRole.USER]: [
        Permission.READ_OWN_DATA,
        Permission.WRITE_OWN_DATA,
    ],
    [UserRole.MODERATOR]: [
        Permission.READ_OWN_DATA,
        Permission.WRITE_OWN_DATA,
        Permission.VIEW_USER_SESSIONS,
        Permission.FLAG_CONTENT,
    ],
    [UserRole.ADMIN]: [
        Permission.READ_OWN_DATA,
        Permission.WRITE_OWN_DATA,
        Permission.VIEW_USER_SESSIONS,
        Permission.FLAG_CONTENT,
        Permission.MANAGE_FEATURE_FLAGS,
        Permission.VIEW_SYSTEM_METRICS,
        Permission.TRIGGER_TRAINING,
    ],
    [UserRole.SUPER_ADMIN]: Object.values(Permission),
};

/**
 * Check if a role has a specific permission.
 */
export function hasPermission(role: UserRole, permission: Permission): boolean {
    const permissions = ROLE_PERMISSIONS[role] || [];
    return permissions.includes(permission);
}
