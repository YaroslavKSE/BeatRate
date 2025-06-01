import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Search, Loader, UserPlus, UserCheck, Users, User } from 'lucide-react';
import UsersService, { UserSummary } from '../api/users';
import useAuthStore from '../store/authStore';

const People = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { isAuthenticated, user: currentUser } = useAuthStore();
    const searchQuery = searchParams.get('q') || '';
    const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery);
    const [users, setUsers] = useState<UserSummary[]>([]);
    const [userFollowingStatus, setUserFollowingStatus] = useState<Record<string, boolean>>({});
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [totalUsers, setTotalUsers] = useState(0);
    const [followingChanges, setFollowingChanges] = useState<Record<string, boolean>>({});
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);

    // Create a ref for the observer element at the bottom of the list
    const observerRef = useRef<IntersectionObserver | null>(null);
    const loadMoreRef = useRef<HTMLDivElement | null>(null);

    // Fetch users when search changes (reset the list)
    useEffect(() => {
        const fetchUsers = async () => {
            try {
                setLoading(true);
                setError(null);
                setPage(1); // Reset to page 1

                const response = await UsersService.getUsers(1, 20, searchQuery);
                setUsers(response.items);
                setTotalUsers(response.totalCount);
                setHasMore(response.hasNextPage);

                // If authenticated, check following status for all users at once using batch check
                if (isAuthenticated && response.items.length > 0) {
                    // Filter out the current user's ID from the check
                    const userIdsToCheck = response.items
                        .filter(user => !currentUser || user.id !== currentUser.id)
                        .map(user => user.id);

                    if (userIdsToCheck.length > 0) {
                        try {
                            const followStatusMap = await UsersService.checkBatchFollowingStatus(userIdsToCheck);
                            setUserFollowingStatus(followStatusMap);
                        } catch (error) {
                            console.error('Error checking batch follow status:', error);
                            // Fallback to empty map on error
                            setUserFollowingStatus({});
                        }
                    }
                }
            } catch (err) {
                console.error('Error fetching users:', err);
                setError('Failed to load users. Please try again.');
            } finally {
                setLoading(false);
            }
        };

        fetchUsers();
    }, [searchQuery, isAuthenticated, currentUser]);

    // Load more users function
    const loadMoreUsers = useCallback(async () => {
        if (!hasMore || loadingMore) return;

        try {
            setLoadingMore(true);
            const nextPage = page + 1;
            const response = await UsersService.getUsers(nextPage, 20, searchQuery);

            if (response.items.length > 0) {
                setUsers(prevUsers => [...prevUsers, ...response.items]);
                setPage(nextPage);
                setHasMore(response.hasNextPage);

                // Check following status for new users
                if (isAuthenticated && response.items.length > 0) {
                    const userIdsToCheck = response.items
                        .filter(user => !currentUser || user.id !== currentUser.id)
                        .map(user => user.id);

                    if (userIdsToCheck.length > 0) {
                        try {
                            const followStatusMap = await UsersService.checkBatchFollowingStatus(userIdsToCheck);
                            setUserFollowingStatus(prev => ({...prev, ...followStatusMap}));
                        } catch (error) {
                            console.error('Error checking batch follow status:', error);
                        }
                    }
                }
            } else {
                setHasMore(false);
            }
        } catch (err) {
            console.error('Error loading more users:', err);
        } finally {
            setLoadingMore(false);
        }
    }, [page, searchQuery, hasMore, loadingMore, isAuthenticated, currentUser]);

    // Set up the intersection observer
    useEffect(() => {
        if (loading) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && hasMore) {
                    loadMoreUsers();
                }
            },
            { threshold: 0.5 }
        );

        observerRef.current = observer;

        if (loadMoreRef.current) {
            observer.observe(loadMoreRef.current);
        }

        return () => {
            if (observerRef.current) {
                observerRef.current.disconnect();
            }
        };
    }, [loading, hasMore, loadMoreUsers]);

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (localSearchQuery !== searchQuery) {
            setSearchParams(localSearchQuery ? { q: localSearchQuery } : {});
        }
    };

    const handleFollowToggle = async (e: React.MouseEvent, userId: string) => {
        e.stopPropagation(); // Prevent card click navigation

        if (!isAuthenticated) {
            navigate('/login', { state: { from: '/people' } });
            return;
        }

        try {
            const currentlyFollowing = followingChanges[userId] !== undefined
                ? followingChanges[userId]
                : userFollowingStatus[userId];

            // Optimistically update UI
            setFollowingChanges({
                ...followingChanges,
                [userId]: !currentlyFollowing
            });

            if (currentlyFollowing) {
                await UsersService.unfollowUser(userId);
            } else {
                await UsersService.followUser(userId);
            }
        } catch (error) {
            console.error('Error toggling follow status:', error);

            // Revert the optimistic update on error
            setFollowingChanges({
                ...followingChanges,
                [userId]: userFollowingStatus[userId]
            });
        }
    };

    // Determine if a user is being followed (considering both original status and pending changes)
    const isFollowing = (userId: string) => {
        return followingChanges[userId] !== undefined
            ? followingChanges[userId]
            : userFollowingStatus[userId] || false;
    };

    // Check if the user is the current logged-in user
    const isCurrentUser = (userId: string) => {
        return currentUser && currentUser.id === userId;
    };

    // Function to navigate to profile page or specific user page
    const navigateToProfile = (userId: string) => {
        if (isCurrentUser(userId)) {
            navigate('/profile'); // Go to own profile page
        } else {
            navigate(`/people/${userId}`); // Go to specific user's page
        }
    };

    // Handle card click for mobile
    const handleCardClick = (userId: string) => {
        navigateToProfile(userId);
    };

    return (
        <div className="max-w-6xl mx-auto py-2 px-4">
            <div className="mb-4">
                <h1 className="text-xl sm:text-3xl font-bold mb-2">People</h1>
                <p className="text-xs sm:text-base text-gray-600">Connect with other music enthusiasts</p>
            </div>

            {/* Search Bar */}
            <div className="mb-4">
                <form onSubmit={handleSearchSubmit} className="relative max-w-3xl">
                    <div className="flex items-center">
                        <input
                            type="text"
                            placeholder="Search by name or username..."
                            value={localSearchQuery}
                            onChange={(e) => setLocalSearchQuery(e.target.value)}
                            className="sm:hidden w-full py-2 px-4 pl-10 rounded-full text-xs focus:outline-none border border-gray-300 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 shadow-sm"
                        />
                        <input
                            type="text"
                            placeholder="Search by name or username..."
                            value={localSearchQuery}
                            onChange={(e) => setLocalSearchQuery(e.target.value)}
                            className="hidden sm:block w-full py-3 px-5 pl-12 rounded-full text-base focus:outline-none border border-gray-300 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 shadow-sm"
                        />
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <Search className="h-3 w-3 sm:h-5 sm:w-5 text-gray-400"/>
                        </div>
                        <button
                            type="submit"
                            className="absolute right-3 bg-primary-600 text-white p-1.5 sm:p-2 rounded-full hover:bg-primary-700 transition-colors"
                        >
                            <Search className="h-3 w-3 sm:h-5 sm:w-5"/>
                        </button>
                    </div>
                </form>
            </div>

            {/* Initial Loading State */}
            {loading && (
                <div className="flex justify-center items-center py-12">
                    <Loader className="h-8 w-8 text-primary-600 animate-spin mr-3"/>
                    <span className="text-lg text-gray-600">Loading users...</span>
                </div>
            )}

            {/* Error State */}
            {error && !loading && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-4">
                    {error}
                </div>
            )}

            {/* Users List */}
            {!loading && !error && (
                <>
                    {/* Results count */}
                    <div className="text-sm sm:text-base mb-4 text-gray-600">
                        {totalUsers > 0 ? (
                            <>
                                Found <span className="font-medium">{totalUsers}</span>
                                {searchQuery ? ` users matching "${searchQuery}"` : ' users'}
                            </>
                        ) : (
                            'No users found'
                        )}
                    </div>

                    {/* Users grid - Responsive layout */}
                    {users.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                            {users.map((user) => (
                                <div
                                    key={user.id}
                                    className="bg-white rounded-lg shadow overflow-hidden hover:shadow-md transition-shadow duration-200 cursor-pointer"
                                    onClick={() => handleCardClick(user.id)}
                                >
                                    {/* Mobile Layout (2 cards per row) */}
                                    <div className="sm:hidden">
                                        <div className="p-2 flex flex-col items-center text-center">
                                            {/* Avatar - smaller for mobile */}
                                            {user.avatarUrl ? (
                                                <img
                                                    src={user.avatarUrl}
                                                    alt={`${user.name} ${user.surname}`}
                                                    className="h-12 w-12 rounded-full object-cover mb-2 border border-primary-200"
                                                />
                                            ) : (
                                                <div className="h-12 w-12 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-sm font-bold mb-2 border border-primary-200">
                                                    {user.name.charAt(0).toUpperCase()}{user.surname.charAt(0).toUpperCase()}
                                                </div>
                                            )}

                                            {/* Name - smaller text for mobile */}
                                            <h3 className="font-medium text-gray-900 text-sm leading-tight mb-1 truncate w-full">
                                                {user.name} {user.surname}
                                            </h3>
                                            <p className="text-xs text-gray-600 truncate">@{user.username}</p>
                                        </div>
                                    </div>

                                    {/* Desktop Layout (unchanged for larger screens) */}
                                    <div className="hidden sm:block">
                                        <div className="p-4 flex flex-col items-center text-center">
                                            {/* Avatar Display - Now showing avatar if available */}
                                            {user.avatarUrl ? (
                                                <img
                                                    src={user.avatarUrl}
                                                    alt={`${user.name} ${user.surname}`}
                                                    className="h-20 w-20 rounded-full object-cover mb-3 border-2 border-primary-200"
                                                />
                                            ) : (
                                                <div className="h-20 w-20 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-2xl font-bold mb-3 border-2 border-primary-200">
                                                    {user.name.charAt(0).toUpperCase()}{user.surname.charAt(0).toUpperCase()}
                                                </div>
                                            )}
                                            <h3 className="font-medium text-gray-900 mb-1">{user.name} {user.surname}</h3>
                                            <p className="text-sm text-gray-600 mb-4">@{user.username}</p>

                                            <div className="flex space-x-2 mt-2">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        navigateToProfile(user.id);
                                                    }}
                                                    className="px-3 py-1.5 border border-gray-300 rounded text-sm font-medium bg-white hover:bg-gray-50"
                                                >
                                                    {isCurrentUser(user.id) ? 'My Profile' : 'View Profile'}
                                                </button>

                                                {isAuthenticated && !isCurrentUser(user.id) ? (
                                                    <button
                                                        onClick={(e) => handleFollowToggle(e, user.id)}
                                                        className={`px-3 py-1.5 border rounded text-sm font-medium flex items-center ${
                                                            isFollowing(user.id)
                                                                ? 'border-primary-300 bg-primary-50 text-primary-700 hover:bg-primary-100'
                                                                : 'border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100'
                                                        }`}
                                                    >
                                                        {isFollowing(user.id) ? (
                                                            <>
                                                                <UserCheck className="h-4 w-4 mr-1" />
                                                                Following
                                                            </>
                                                        ) : (
                                                            <>
                                                                <UserPlus className="h-4 w-4 mr-1" />
                                                                Follow
                                                            </>
                                                        )}
                                                    </button>
                                                ) : isCurrentUser(user.id) ? (
                                                    <button
                                                        className="px-3 py-1.5 border border-green-300 rounded text-sm font-medium flex items-center bg-green-50 text-green-700"
                                                    >
                                                        <User className="h-4 w-4 mr-1" />
                                                        You
                                                    </button>
                                                ) : null}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="bg-white rounded-lg p-8 text-center shadow">
                            <Users className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-gray-900 mb-2">No users found</h3>
                            <p className="text-gray-600">
                                {searchQuery
                                    ? `No users matching "${searchQuery}"`
                                    : "There are no users to display"}
                            </p>
                        </div>
                    )}

                    {/* Load more indicator */}
                    {users.length > 0 && (
                        <div
                            ref={loadMoreRef}
                            className="mt-8 flex justify-center items-center py-4"
                        >
                            {loadingMore ? (
                                <div className="flex items-center">
                                    <Loader className="h-5 w-5 text-primary-600 animate-spin mr-2" />
                                    <span className="text-gray-600">Loading more users...</span>
                                </div>
                            ) : hasMore ? (
                                <span className="text-gray-500 text-sm">Scroll for more users</span>
                            ) : (
                                <span className="text-gray-500 text-sm">That's all users</span>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default People;