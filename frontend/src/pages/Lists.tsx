import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, List, RefreshCw, AlertTriangle, Disc, Music, Loader } from 'lucide-react';
import useAuthStore from '../store/authStore';
import ListsService, { ListOverview } from '../api/lists';
import CreateListModal from '../components/Lists/CreateListModal';
import ListRowItem from '../components/Lists/ListRowItem';

const Lists = () => {
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

    // Fetch initial album lists
    const fetchAlbumLists = useCallback(async (offset = 0) => {
        if (!isAuthenticated || !user) return;

        try {
            if (offset === 0) {
                setLoadingAlbums(true);
            } else {
                setLoadingMoreAlbums(true);
            }

            setAlbumError(null);

            const response = await ListsService.getUserLists(
                user.id,
                PAGE_SIZE,
                offset,
                'Album' // Set list type to Album
            );

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
    }, [isAuthenticated, user]);

    // Fetch initial track lists
    const fetchTrackLists = useCallback(async (offset = 0) => {
        if (!isAuthenticated || !user) return;

        try {
            if (offset === 0) {
                setLoadingTracks(true);
            } else {
                setLoadingMoreTracks(true);
            }

            setTrackError(null);

            const response = await ListsService.getUserLists(
                user.id,
                PAGE_SIZE,
                offset,
                'Track' // Set list type to Track
            );

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
    }, [isAuthenticated, user]);

    // Initial data loading
    useEffect(() => {
        if (!isAuthenticated || !user) {
            navigate('/login', { state: { from: '/lists' } });
            return;
        }

        fetchAlbumLists(0);
        fetchTrackLists(0);
    }, [isAuthenticated, user, navigate, fetchAlbumLists, fetchTrackLists]);

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
        if (!user) return;

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

    if (!isAuthenticated) {
        return null;
    }

    return (
        <div className="max-w-6xl mx-auto py-2 px-4">
            {/* Header section */}
            <div className="flex justify-between items-center mb-2 sm:mb-6">
                <div>
                    <h1 className="text-xl sm:text-3xl font-bold text-gray-900 mb-2">Your Lists</h1>
                    <p className="text-xs sm:text-base text-gray-600">
                        {getTotalLists() > 0
                            ? `You have ${getTotalLists()} ${getTotalLists() === 1 ? 'list' : 'lists'}`
                            : 'You have no lists'}
                    </p>
                </div>

                <button
                    onClick={handleCreateList}
                    className="flex items-center px-3 py-2 bg-primary-600 text-xs sm:text-base text-white rounded-md hover:bg-primary-700 transition-colors"
                >
                    <Plus className="h-3 w-3 mr-1 sm:h-4 sm:w-4 sm:mr-2" />
                    Create List
                </button>
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
                <div className="flex space-x-2 mb-3 sm:mb-6">
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
                        Loading your {activeListType.toLowerCase()} lists...
                    </span>
                </div>
            )}

            {/* Empty state when no lists at all */}
            {!isLoading() && albumLists.length === 0 && trackLists.length === 0 && (
                <div className="bg-white shadow rounded-lg p-6 sm:p-8 text-center">
                    <List className="h-10 w-10 sm:h-16 sm:w-16 text-gray-400 mx-auto mb-3 sm:mb-4"/>
                    <h2 className="text-base sm:text-xl font-semibold text-gray-800 mb-1 sm:mb-2">
                        You don't have any lists yet
                    </h2>
                    <p className="text-xs sm:text-base text-gray-600 mb-4 sm:mb-6">
                        Create your first list to organize your favorite albums and tracks
                    </p>
                    <button
                        onClick={handleCreateList}
                        className="inline-flex items-center px-3 py-1.5 sm:px-4 sm:py-2 border border-transparent rounded-md shadow-sm text-xs sm:text-sm font-medium text-white bg-primary-600 hover:bg-primary-700"
                    >
                        <Plus className="h-3 w-3 sm:h-5 sm:w-5 mr-1 sm:mr-2"/>
                        Create Your First List
                    </button>
                </div>
            )}

            {/* Empty state for specific list type */}
            {!isLoading() && getTotalLists() > 0 && getCurrentLists().length === 0 && (
                <div className="bg-white shadow rounded-lg p-6 sm:p-8 text-center">
                    <List className="h-10 w-10 sm:h-16 sm:w-16 text-gray-400 mx-auto mb-3 sm:mb-4"/>
                    <h2 className="text-base sm:text-xl font-semibold text-gray-800 mb-1 sm:mb-2">
                        You don't have
                        any {getTotalLists() === 0 ? 'lists' : `${activeListType.toLowerCase()} lists`} yet
                    </h2>
                    <p className="text-xs sm:text-base text-gray-600 mb-4 sm:mb-6">
                        Create your first {getTotalLists() === 0 ? '' : activeListType.toLowerCase() + ' '}list to
                        organize your music
                    </p>
                    <button
                        onClick={handleCreateList}
                        className="inline-flex items-center px-3 py-1.5 sm:px-4 sm:py-2 border border-transparent rounded-md shadow-sm text-xs sm:text-sm font-medium text-white bg-primary-600 hover:bg-primary-700"
                    >
                        <Plus className="h-3 w-3 sm:h-5 sm:w-5 mr-1 sm:mr-2"/>
                        Create {getTotalLists() === 0 ? 'Your First' : activeListType} List
                    </button>
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
                            isPublic={false}
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
                            <Loader className="h-5 w-5 text-primary-600 animate-spin mr-2"/>
                            <span className="text-gray-600">Loading more lists...</span>
                        </div>
                    )}
                </div>
            )}

            {/* Create List Modal */}
            <CreateListModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onListCreated={handleListCreated}
                initialListType={activeListType}
            />
        </div>
    );
};

export default Lists;