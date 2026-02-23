import React, { createContext, useState, useContext, useEffect } from 'react';
import { useUser, useAuth as useClerkAuth, useClerk } from '@clerk/clerk-react';
import { fileService, setTokenGetter } from '../services/api';

const AuthContext = createContext(null);

// ── Desktop Mode Detection ──────────────────────────────────
const IS_DESKTOP = !!(window.daanDesktop?.isDesktop);

// ── Desktop Auth Provider (no Clerk) ────────────────────────
const DesktopAuthProvider = ({ children }) => {
    // In desktop mode, the user is always a local superuser.
    // No cloud authentication is needed.
    const user = {
        email: 'desktop@local',
        name: 'Desktop User',
        clerkId: 'desktop-local-user',
        role: 'superuser',
        is_superuser: true,
        is_admin: true
    };

    return (
        <AuthContext.Provider value={{
            user,
            logout: () => { },  // No-op in desktop mode
            loading: false,
            isAuthenticated: true,
            role: 'superuser',
            isSuperuser: true,
            isAdmin: true,
            getToken: () => Promise.resolve('desktop-mode'),
            syncError: null
        }}>
            {children}
        </AuthContext.Provider>
    );
};

// ── Web Auth Provider (Clerk — existing code, unchanged) ────
const WebAuthProvider = ({ children }) => {
    // Clerk hooks (imported at top) only work inside <ClerkProvider>
    // which is guaranteed in web mode (see main.jsx)
    const { isLoaded, isSignedIn, user: clerkUser } = useUser();
    const { getToken } = useClerkAuth();
    const { signOut } = useClerk();

    const [role, setRole] = useState('user');
    const [synced, setSynced] = useState(false);
    const [syncError, setSyncError] = useState(null);

    // Register getToken function with API service for fresh tokens on each request
    useEffect(() => {
        if (isLoaded && isSignedIn && getToken) {
            setTokenGetter(getToken);
        } else {
            setTokenGetter(null);
        }
    }, [isLoaded, isSignedIn, getToken]);

    // Sync user with backend when signed in
    useEffect(() => {
        async function syncUserWithBackend() {
            if (isSignedIn && clerkUser && !synced) {
                try {
                    // Get Clerk JWT token
                    const token = await getToken();

                    // Sync with backend to get/create user and get role
                    const response = await fileService.syncUser(token);



                    if (response && response.role) {

                        setRole(response.role);
                    }
                    setSynced(true);
                    setSyncError(null);
                } catch (error) {
                    console.error('User sync failed:', error);
                    setSyncError(error.message);
                    // Default to 'user' role if sync fails
                    setRole('user');
                    setSynced(true);
                }
            }
        }

        if (isLoaded && isSignedIn) {
            syncUserWithBackend();
        }
    }, [isLoaded, isSignedIn, clerkUser, synced, getToken]);

    // Reset sync state when user signs out
    useEffect(() => {
        if (isLoaded && !isSignedIn) {
            setSynced(false);
            setRole('user');
        }
    }, [isLoaded, isSignedIn]);

    const logout = async () => {
        await signOut();
        setSynced(false);
        setRole('user');
    };

    // Create user object compatible with existing components
    const user = isSignedIn && clerkUser ? {
        email: clerkUser.primaryEmailAddress?.emailAddress,
        name: clerkUser.fullName || clerkUser.firstName,
        clerkId: clerkUser.id,
        role: role,
        is_superuser: role === 'superuser',
        is_admin: role === 'superuser' || role === 'admin'
    } : null;

    const loading = !isLoaded || (isSignedIn && !synced);

    return (
        <AuthContext.Provider value={{
            user,
            logout,
            loading,
            isAuthenticated: isSignedIn,
            role,
            isSuperuser: role === 'superuser',
            isAdmin: role === 'superuser' || role === 'admin',
            getToken,
            syncError
        }}>
            {children}
        </AuthContext.Provider>
    );
};

// ── Export: Auto-select provider based on mode ──────────────
export const AuthProvider = IS_DESKTOP ? DesktopAuthProvider : WebAuthProvider;

export const useAuth = () => useContext(AuthContext);

