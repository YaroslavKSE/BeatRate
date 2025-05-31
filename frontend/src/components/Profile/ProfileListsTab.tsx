import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, List, RefreshCw, AlertTriangle, Disc, Music, Loader } from 'lucide-react';
import useAuthStore from '../../store/authStore';
import ListsService, { ListOverview } from '../../api/lists';
import CreateListModal from '../Lists/CreateListModal';
import ListRowItem from '../Lists/ListRowItem';

interface ProfileListsTabProps {
    userId?: string;         // If provided, shows another user's lists (public only)
    username?: string;       // Optional: Username for display purposes
    isOwnProfile?: boolean;  // Whether this is the current user's profile
}

const ProfileListsTab = ({ userId, username, isOwnProfile = false }: ProfileListsTabProps) => {
    const navigate = useNavigate();
    const { user, isAuthenticated } = useAuthStore();

    // Separate lists for albums and tracks
    const [albumLists, setAlbumLists] = useState<ListOverview[]>([]);
    const [trackLists, setTrackLists] = useState<ListOverview[]>([]);

    // Initial loading states
    const [loadingAlbums, setLoadingAlbums] = useState(true);
    const [loadingTracks, setLoadingTracks] = useState(true);

    // Loading more states
    const [loadingMoreAlbums, setLoadingMoreAlbums] = useState(false);
    const [loadingMoreTracks, setLoadingMoreTracks] = useState(false);

    // Error states
    const [albumError, setAlbumError] = useState<string | null>(null);
    const [trackError, setTrackError] = useState<string | null>(null);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    // Pagination states
    const [albumOffset, setAlbumOffset] = useState(0);
    const [trackOffset, setTrackOffset] = useState(0);
    const [albumsTotal, setAlbumsTotal] = useState(0);
    const [tracksTotal, setTracksTotal] = useState(0);
    const [hasMoreAlbums, setHasMoreAlbums] = useState(true);
    const [hasMoreTracks, setHasMoreTracks] = useState(true);

    // UI states
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [, setIsDeleting] = useState(false);
    const [activeListType, setActiveListType] = useState<'Album' | 'Track'>('Album');

    // Refs for infinite scrolling
    const observerRef = useRef<IntersectionObserver | null>(null);
    const loadMoreRef = useRef<HTMLDivElement | null>(null);

    // Items per page
    const PAGE_SIZE = 10;

    // Determine which user ID to use
    const targetUserId = userId || (isOwnProfile && user ? user.id : null);

    // Fetch initial album lists
    const fetchAlbumLists = useCallback(async (offset = 0) => {
        if (!targetUserId) return;

        try {
            if (offset === 0) {
                setLoadingAlbums(true);
            } else {
                setLoadingMoreAlbums(true);
            }

            setAlbumError(null);

            let response;
            if (isOwnProfile) {
                // For own profile, get all lists
                response = await ListsService.getUserLists(
                    targetUserId,
                    PAGE_SIZE,
                    offset,
                    'Album'
                );
            } else {
                // For other users, get only public lists
                response = await ListsService.getUserLists(
                    targetUserId,
                    PAGE_SIZE,
                    offset,
                    'Album'
                );
            }

            if (offset === 0) {
                setAlbumLists(response.lists);
            } else {
                setAlbumLists(prev => [...prev, ...response.lists]);
            }

            setAlbumsTotal(response.totalCount);
            setAlbumOffset(offset + response.lists.length);
            setHasMoreAlbums((offset + response.lists.length) < response.totalCount);
        } catch (err) {
            console.error('Error fetching album lists:', err);
            setAlbumError('Failed to load album lists. Please try again later.');
        } finally {
            if (offset === 0) {
                setLoadingAlbums(false);
            } else {
                setLoadingMoreAlbums(false);
            }
        }
    }, [targetUserId, isOwnProfile]);

    // Fetch initial track lists
    const fetchTrackLists = useCallback(async (offset = 0) => {
        if (!targetUserId) return;

        try {
            if (offset === 0) {
                setLoadingTracks(true);
            } else {
                setLoadingMoreTracks(true);
            }

            setTrackError(null);

            let response;
            if (isOwnProfile) {
                // For own profile, get all lists
                response = await ListsService.getUserLists(
                    targetUserId,
                    PAGE_SIZE,
                    offset,
                    'Track'
                );
            } else {
                // For other users, get only public lists
                response = await ListsService.getUserLists(
                    targetUserId,
                    PAGE_SIZE,
                    offset,
                    'Track'
                );
            }

            if (offset === 0) {
                setTrackLists(response.lists);
            } else {
                setTrackLists(prev => [...prev, ...response.lists]);
            }

            setTracksTotal(response.totalCount);
            setTrackOffset(offset + response.lists.length);
            setHasMoreTracks((offset + response.lists.length) < response.totalCount);
        } catch (err) {
            console.error('Error fetching track lists:', err);
            setTrackError('Failed to load track lists. Please try again later.');
        } finally {
            if (offset === 0) {
                setLoadingTracks(false);
            } else {
                setLoadingMoreTracks(false);
            }
        }
    }, [targetUserId, isOwnProfile]);

    // Initial data loading
    useEffect(() => {
        if (!isAuthenticated && isOwnProfile) {
            navigate('/login', { state: { from: '/profile' } });
            return;
        }

        if (targetUserId) {
            fetchAlbumLists(0);
            fetchTrackLists(0);
        }
    }, [isAuthenticated, targetUserId, navigate, fetchAlbumLists, fetchTrackLists, isOwnProfile]);

    // Set up intersection observer for infinite scrolling
    useEffect(() => {
        if (observerRef.current) {
            observerRef.current.disconnect();
        }

        const observer = new IntersectionObserver(
            (entries) => {
                const [entry] = entries;
                if (entry.isIntersecting) {
                    if (activeListType === 'Album' && hasMoreAlbums && !loadingMoreAlbums) {
                        fetchAlbumLists(albumOffset);
                    } else if (activeListType === 'Track' && hasMoreTracks && !loadingMoreTracks) {
                        fetchTrackLists(trackOffset);
                    }
                }
            },
            {
                root: null,
                rootMargin: '0px',
                threshold: 0.1
            }
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
    }, [
        activeListType,
        albumOffset,
        trackOffset,
        hasMoreAlbums,
        hasMoreTracks,
        loadingMoreAlbums,
        loadingMoreTracks,
        fetchAlbumLists,
        fetchTrackLists
    ]);

    const handleCreateList = () => {
        setIsCreateModalOpen(true);
    };

    const handleListCreated = async () => {
        setIsCreateModalOpen(false);

        // Reload the appropriate list type after creation
        if (activeListType === 'Album') {
            fetchAlbumLists(0);
        } else {
            fetchTrackLists(0);
        }
    };

    const handleDeleteList = async (listId: string) => {
        if (!user || !isOwnProfile) return;

        setIsDeleting(true);
        setDeleteError(null);

        try {
            const response = await ListsService.deleteList(listId);

            if (response.success) {
                // Update the appropriate list in state
                if (activeListType === 'Album') {
                    setAlbumLists(prevLists => prevLists.filter(list => list.listId !== listId));
                    setAlbumsTotal(prev => Math.max(0, prev - 1));
                } else {
                    setTrackLists(prevLists => prevLists.filter(list => list.listId !== listId));
                    setTracksTotal(prev => Math.max(0, prev - 1));
                }
            } else {
                setDeleteError(response.errorMessage || 'Failed to delete the list.');
            }
        } catch (err) {
            console.error('Error deleting list:', err);
            setDeleteError('An error occurred while deleting the list. Please try again.');
        } finally {
            setIsDeleting(false);
        }
    };

    // Handle list type change
    const handleListTypeChange = (type: 'Album' | 'Track') => {
        setActiveListType(type);
    };

    // Get current lists and loading state based on active tab
    const getCurrentLists = () => {
        return activeListType === 'Album' ? albumLists : trackLists;
    };

    const isLoading = () => {
        return activeListType === 'Album' ? loadingAlbums : loadingTracks;
    };

    const isLoadingMore = () => {
        return activeListType === 'Album' ? loadingMoreAlbums : loadingMoreTracks;
    };

    const getCurrentError = () => {
        return activeListType === 'Album' ? albumError : trackError;
    };

    // Get total count of all lists
    const getTotalLists = () => {
        return albumsTotal + tracksTotal;
    };

    // Get display name for the user
    const displayName = username || (isOwnProfile ? 'Your' : 'User\'s');

    // Check if lists are empty
    const hasNoLists = (!loadingAlbums && !loadingTracks && albumLists.length === 0 && trackLists.length === 0);

    return (
        <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="p-2 sm:p-6">
                {/* Header section */}
                <div className="flex justify-between items-center mb-2">
                    <h2 className="text-lg font-bold text-gray-900">{isOwnProfile ? 'Your Lists' : `${displayName} Lists`}</h2>

                    {isOwnProfile && (
                        <button
                            onClick={handleCreateList}
                            className="flex items-center px-3 py-2 bg-primary-600 text-xs sm:text-base text-white rounded-md hover:bg-primary-700 transition-colors"
                        >
                            <Plus className="h-3 w-3 mr-1 sm:h-4 sm:w-4 sm:mr-2"/>
                            Create List
                        </button>
                    )}
                </div>

                {/* Error messages */}
                {getCurrentError() && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-6">
                        {getCurrentError()}
                        <button
                            onClick={() => window.location.reload()}
                            className="ml-2 underline hover:text-red-900"
                        >
                            Try again
                        </button>
                    </div>
                )}

                {deleteError && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-6 flex items-center">
                        <AlertTriangle className="h-5 w-5 mr-2" />
                        {deleteError}
                        <button
                            onClick={() => setDeleteError(null)}
                            className="ml-auto text-red-700 hover:text-red-900"
                        >
                            ×
                        </button>
                    </div>
                )}

                {/* List Type Toggle */}
                {(!isLoading() || albumLists.length > 0 || trackLists.length > 0) && (
                    <div className="flex space-x-2 mb-6">
                        <button
                            onClick={() => handleListTypeChange('Album')}
                            className={`px-4 py-2 rounded-md font-medium text-xs sm:text-sm flex items-center ${
                                activeListType === 'Album'
                                    ? 'bg-primary-600 text-white'
                                    : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                            }`}
                        >
                            <Disc className="h-4 w-4 mr-2" />
                            Albums ({albumsTotal})
                        </button>
                        <button
                            onClick={() => handleListTypeChange('Track')}
                            className={`px-4 py-2 rounded-md font-medium text-xs sm:text-sm flex items-center ${
                                activeListType === 'Track'
                                    ? 'bg-primary-600 text-white'
                                    : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                            }`}
                        >
                            <Music className="h-4 w-4 mr-2" />
                            Tracks ({tracksTotal})
                        </button>
                    </div>
                )}

                {/* Initial Loading state */}
                {isLoading() && getCurrentLists().length === 0 && (
                    <div className="flex justify-center items-center py-20">
                        <RefreshCw className="h-10 w-10 text-primary-600 animate-spin mr-3" />
                        <span className="text-lg text-gray-600">
              Loading {activeListType.toLowerCase()} lists...
            </span>
                    </div>
                )}

                {/* Empty state when no lists at all */}
                {hasNoLists && !isLoading() && (
                    <div className="bg-white rounded-lg p-8 text-center">
                        <List className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                        <h2 className="text-xl font-semibold text-gray-800 mb-2">
                            {isOwnProfile
                                ? "You don't have any lists yet"
                                : `${displayName} doesn't have any public lists yet`}
                        </h2>
                        {isOwnProfile && (
                            <>
                                <p className="text-gray-600 mb-6">
                                    Create your first list to organize your favorite albums and tracks
                                </p>
                                <button
                                    onClick={handleCreateList}
                                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700"
                                >
                                    <Plus className="h-5 w-5 mr-2" />
                                    Create Your First List
                                </button>
                            </>
                        )}
                    </div>
                )}

                {/* Empty state for specific list type */}
                {!isLoading() && getTotalLists() > 0 && getCurrentLists().length === 0 && (
                    <div className="bg-white rounded-lg p-8 text-center">
                        <List className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                        <h2 className="text-xl font-semibold text-gray-800 mb-2">
                            {isOwnProfile
                                ? `You don't have any ${activeListType.toLowerCase()} lists yet`
                                : `${displayName} doesn't have any public ${activeListType.toLowerCase()} lists yet`}
                        </h2>
                        {isOwnProfile && (
                            <>
                                <p className="text-gray-600 mb-6">
                                    Create your first {activeListType.toLowerCase()} list to organize your music
                                </p>
                                <button
                                    onClick={handleCreateList}
                                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700"
                                >
                                    <Plus className="h-5 w-5 mr-2" />
                                    Create {activeListType} List
                                </button>
                            </>
                        )}
                    </div>
                )}

                {/* Lists in row layout */}
                {getCurrentLists().length > 0 && (
                    <div className="space-y-2">
                        {getCurrentLists().map((list) => (
                            <ListRowItem
                                key={list.listId}
                                list={list}
                                onDelete={handleDeleteList}
                                isPublic={!isOwnProfile}
                            />
                        ))}
                    </div>
                )}

                {/* Loading more indicator */}
                {getCurrentLists().length > 0 && (
                    <div
                        ref={loadMoreRef}
                        className="mt-6 py-4 flex justify-center items-center"
                    >
                        {isLoadingMore() && (
                            <div className="flex items-center">
                                <Loader className="h-5 w-5 text-primary-600 animate-spin mr-2" />
                                <span className="text-gray-600">Loading more lists...</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Create List Modal - Only for own profile */}
                {isOwnProfile && (
                    <CreateListModal
                        isOpen={isCreateModalOpen}
                        onClose={() => setIsCreateModalOpen(false)}
                        onListCreated={handleListCreated}
                        initialListType={activeListType}
                    />
                )}
            </div>
        </div>
    );
};

export default ProfileListsTab;