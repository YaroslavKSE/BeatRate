import React, { useEffect, useState, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import useAuthStore from './store/authStore';
import { handleAuthCallback } from './utils/auth0-config';
import './App.css';

// Layout Components (keep these as static imports since they're used immediately)
import MainLayout from './components/layout/MainLayout';
import LoadingIndicator from './components/common/LoadingIndicator';
import TokenRefreshManager from './components/auth/TokenRefreshManager';

// Core pages that are likely to be accessed immediately
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import NotFound from "./pages/NotFound";

// Lazy load pages that may not be immediately needed
const Profile = lazy(() => import('./pages/Profile'));
const Search = lazy(() => import('./pages/Search'));
const Album = lazy(() => import('./pages/Album'));
const Song = lazy(() => import('./pages/Song'));
const Artist = lazy(() => import('./pages/Artist'));
const CreateGradingMethod = lazy(() => import('./pages/CreateGradingMethod'));
const ViewGradingMethod = lazy(() => import('./pages/ViewGradingMethod'));
const Diary = lazy(() => import('./pages/Diary'));
const PeoplePage = lazy(() => import('./pages/People'));
const UserProfilePage = lazy(() => import('./pages/UserProfile'));
const CreateInteractionPage = lazy(() => import('./pages/CreateInteractionPage'));
const InteractionDetailPage = lazy(() => import('./pages/InteractionDetailPage'));
const FollowingFeed = lazy(() => import('./pages/FollowingFeed'));
const Lists = lazy(() => import('./pages/Lists'));
const ListDetailsPage = lazy(() => import('./pages/ListDetailsPage'));
const ListEditPage = lazy(() => import('./pages/ListEditPage'));

// Loading component for lazy-loaded routes
const RouteLoader = () => (
    <div className="min-h-screen flex flex-col justify-center items-center bg-gray-50">
        <LoadingIndicator size="large" text="Loading page..." />
    </div>
);

// Auth callback handler component
const AuthCallback = () => {
    const { socialLogin } = useAuthStore();
    const location = useLocation();

    useEffect(() => {
        const processAuth = async () => {
            try {
                console.log('=== AUTH CALLBACK PROCESSING ===');

                const { code, state } = await handleAuthCallback();

                console.log('Authorization code received:', code ? 'yes' : 'no');
                console.log('State:', state);

                const socialLoginParams = {
                    code: code,
                    redirectUri: `${window.location.origin}/callback`,
                    provider: 'google'
                };

                console.log('Calling socialLogin with:', {
                    hasCode: !!socialLoginParams.code,
                    redirectUri: socialLoginParams.redirectUri,
                    provider: socialLoginParams.provider
                });

                await socialLogin(socialLoginParams.code, socialLoginParams.redirectUri, socialLoginParams.provider);

                console.log('Social login successful, redirecting...');

                window.location.href = location.state?.from || '/';
            } catch (error) {
                console.error('Auth callback error:', error);
                if (error instanceof Error) {
                    console.error('Error message:', error.message);
                }
                window.location.href = '/login?error=auth_callback_failed';
            }
        };

        processAuth();
    }, [socialLogin, location.state]);

    return (
        <div className="min-h-screen flex flex-col justify-center items-center bg-gray-50">
            <LoadingIndicator size="large" text="Completing sign-in" />
        </div>
    );
};

// Protected route wrapper component
interface ProtectedRouteProps {
    children: React.ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
    const { isAuthenticated, isLoading } = useAuthStore();
    const location = useLocation();

    if (isLoading) {
        return (
            <div className="opacity-50 pointer-events-none">
                {children}
                <div className="fixed top-0 left-0 right-0 z-50 bg-primary-600 h-1">
                    <div className="h-full bg-primary-300 animate-pulse"></div>
                </div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" state={{ from: location.pathname }} replace />;
    }

    return <>{children}</>;
};

function App() {
    const { initializeAuth } = useAuthStore();
    const [isInitializing, setIsInitializing] = useState(true);

    useEffect(() => {
        const init = async () => {
            await initializeAuth();
            setIsInitializing(false);
        };

        init();
    }, [initializeAuth]);

    if (isInitializing) {
        return (
            <div className="min-h-screen bg-gray-50">
                <div className="fixed top-0 left-0 right-0 z-50 bg-primary-100 h-1">
                    <div className="h-full bg-primary-600 w-24 animate-pulse"></div>
                </div>
            </div>
        );
    }

    return (
        <Router>
            <TokenRefreshManager />

            <Routes>
                {/* Auth0 callback route - outside MainLayout */}
                <Route path="/callback" element={<AuthCallback />} />

                {/* Main layout with routes */}
                <Route path="/" element={<MainLayout />}>
                    <Route index element={<Home />} />
                    <Route path="login" element={<Login />} />
                    <Route path="register" element={<Register />} />

                    {/* Lazy-loaded routes with Suspense */}
                    <Route
                        path="search"
                        element={
                            <Suspense fallback={<RouteLoader />}>
                                <Search />
                            </Suspense>
                        }
                    />
                    <Route
                        path="album/:id"
                        element={
                            <Suspense fallback={<RouteLoader />}>
                                <Album />
                            </Suspense>
                        }
                    />
                    <Route
                        path="track/:id"
                        element={
                            <Suspense fallback={<RouteLoader />}>
                                <Song />
                            </Suspense>
                        }
                    />
                    <Route
                        path="artist/:id"
                        element={
                            <Suspense fallback={<RouteLoader />}>
                                <Artist />
                            </Suspense>
                        }
                    />

                    {/* Interaction detail page - publicly viewable */}
                    <Route
                        path="interaction/:id"
                        element={
                            <Suspense fallback={<RouteLoader />}>
                                <InteractionDetailPage />
                            </Suspense>
                        }
                    />

                    {/* List detail page - publicly viewable */}
                    <Route
                        path="lists/:id"
                        element={
                            <Suspense fallback={<RouteLoader />}>
                                <ListDetailsPage />
                            </Suspense>
                        }
                    />

                    {/* People Routes */}
                    <Route
                        path="people"
                        element={
                            <Suspense fallback={<RouteLoader />}>
                                <PeoplePage />
                            </Suspense>
                        }
                    />
                    <Route
                        path="people/:id"
                        element={
                            <Suspense fallback={<RouteLoader />}>
                                <UserProfilePage />
                            </Suspense>
                        }
                    />

                    {/* Protected routes */}
                    <Route
                        path="profile"
                        element={
                            <ProtectedRoute>
                                <Suspense fallback={<RouteLoader />}>
                                    <Profile />
                                </Suspense>
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="diary"
                        element={
                            <ProtectedRoute>
                                <Suspense fallback={<RouteLoader />}>
                                    <Diary />
                                </Suspense>
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="grading-methods/create"
                        element={
                            <ProtectedRoute>
                                <Suspense fallback={<RouteLoader />}>
                                    <CreateGradingMethod />
                                </Suspense>
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="grading-methods/:id"
                        element={
                            <Suspense fallback={<RouteLoader />}>
                                <ViewGradingMethod />
                            </Suspense>
                        }
                    />

                    <Route
                        path="create-interaction/:itemType/:itemId"
                        element={
                            <ProtectedRoute>
                                <Suspense fallback={<RouteLoader />}>
                                    <CreateInteractionPage />
                                </Suspense>
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="following-feed"
                        element={
                            <ProtectedRoute>
                                <Suspense fallback={<RouteLoader />}>
                                    <FollowingFeed />
                                </Suspense>
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="lists"
                        element={
                            <ProtectedRoute>
                                <Suspense fallback={<RouteLoader />}>
                                    <Lists />
                                </Suspense>
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="lists/edit/:id"
                        element={
                            <ProtectedRoute>
                                <Suspense fallback={<RouteLoader />}>
                                    <ListEditPage />
                                </Suspense>
                            </ProtectedRoute>
                        }
                    />

                    {/* Catch-all route for 404 */}
                    <Route path="*" element={<NotFound />} />
                </Route>
            </Routes>
        </Router>
    );
}

export default App;