import { useState, useEffect } from 'react';

export interface AuthState {
    isAuthenticated: boolean;
    isLoading: boolean;
    user: {
        userId: string;
        role: 'senior' | 'family';
        displayName: string;
    } | null;
}

export function useAuth() {
    const [auth, setAuth] = useState<AuthState>({
        isAuthenticated: false,
        isLoading: true,
        user: null
    });

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const res = await fetch('/api/users/profile');
                if (res.ok) {
                    const profile = await res.json();
                    setAuth({
                        isAuthenticated: true,
                        isLoading: false,
                        user: {
                            userId: profile.userId,
                            role: profile.role,
                            displayName: profile.displayName
                        }
                    });
                } else {
                    setAuth({ isAuthenticated: false, isLoading: false, user: null });
                }
            } catch (error) {
                setAuth({ isAuthenticated: false, isLoading: false, user: null });
            }
        };

        checkAuth();
    }, []);

    return auth;
}
