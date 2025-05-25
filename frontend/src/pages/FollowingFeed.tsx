import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { RefreshCw, Heart, SlidersHorizontal, Calendar, MessageSquare, UserRoundPlus, Loader, ArrowLeft } from 'lucide-react';
import InteractionService, { InteractionDetailDTO } from '../api/interaction';
import CatalogService from '../api/catalog';
import UsersService from '../api/users';
import useAuthStore from '../store/authStore';
import { formatDate } from '../utils/formatters';
import NormalizedStarDisplay from '../components/CreateInteraction/NormalizedStarDisplay';

interface FollowingFeedItemData {
    interaction: InteractionDetailDTO;
    catalogItem?: {
        spotifyId: string;
        name: string;
        imageUrl: string;
        artistName: string;
    };
    userProfile?: {
        id: string;
        name: string;
        surname: string;
        username: string;
        avatarUrl?: string;
    };
}

const FollowingFeed = () => {
    const navigate = useNavigate();
    const { user, isAuthenticated } = useAuthStore();
    const [feedItems, setFeedItems] = useState<FollowingFeedItemData[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [offset, setOffset] = useState(0);
    const [, setTotalInteractions] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const itemsPerPage = 20;

    // Redirect unauthenticated users
    useEffect(() => {
        if (!isAuthenticated) {
            navigate('/login', { state: { from: '/following-feed' } });
        }
    }, [isAuthenticated, navigate]);

    // Initial load of feed items
    useEffect(() => {
        const fetchInitialFeed = async () => {
            if (!isAuthenticated || !user) {
                setLoading(false);
                return;
            }

            setLoading(true);
            setError(null);

            try {
                const { items, totalCount } = await InteractionService.getUserFollowingFeed(
                    user.id,
                    itemsPerPage,
                    0
                );
                setTotalInteractions(totalCount);
                setHasMore(totalCount > itemsPerPage);

                if (items.length === 0) {
                    setFeedItems([]);
                    setLoading(false);
                    return;
                }

                // Extract item IDs for preview info
                const itemIds = items.map(interaction => interaction.itemId);

                // Fetch preview information for all items
                const previewResponse = await CatalogService.getItemPreviewInfo(
                    itemIds,
                    ['album', 'track']
                );

                // Create a map for catalog items
                const itemsMap = new Map<string, FollowingFeedItemData['catalogItem']>();
                previewResponse.results?.forEach(group => {
                    group.items?.forEach(item => {
                        itemsMap.set(item.spotifyId, {
                            spotifyId: item.spotifyId,
                            name: item.name,
                            imageUrl: item.imageUrl,
                            artistName: item.artistName,
                        });
                    });
                });

                // Fetch user profiles for all interactions
                const userIds = [...new Set(items.map(i => i.userId))];
                const userProfiles = await UsersService.getUserProfilesBatch(userIds);

                // Create a map for user profiles
                const userProfilesMap = new Map<string, FollowingFeedItemData['userProfile']>();
                userProfiles.forEach(profile => {
                    userProfilesMap.set(profile.id, {
                        id: profile.id,
                        name: profile.name,
                        surname: profile.surname,
                        username: profile.username,
                        avatarUrl: profile.avatarUrl,
                    });
                });

                // Combine interactions with catalog items and user profiles
                const feedData = items.map(interaction => ({
                    interaction,
                    catalogItem: itemsMap.get(interaction.itemId),
                    userProfile: userProfilesMap.get(interaction.userId),
                }));

                setFeedItems(feedData);
                setOffset(items.length);
            } catch (err) {
                console.error('Error fetching following feed:', err);
                setError('Failed to load following feed. Please try again later.');
            } finally {
                setLoading(false);
            }
        };

        fetchInitialFeed();
    }, [isAuthenticated, user]);

    // Load more feed items
    const loadMoreFeed = useCallback(async () => {
        if (!isAuthenticated || !user || loadingMore || !hasMore) return;

        const currentOffset = offset;
        setLoadingMore(true);

        try {
            const { items, totalCount } = await InteractionService.getUserFollowingFeed(
                user.id,
                itemsPerPage,
                currentOffset
            );

            if (items.length === 0) {
                setHasMore(false);
                setLoadingMore(false);
                return;
            }

            // Extract item IDs for preview info
            const itemIds = items.map(interaction => interaction.itemId);

            // Fetch preview information for all items
            const previewResponse = await CatalogService.getItemPreviewInfo(
                itemIds,
                ['album', 'track']
            );

            // Create a map for catalog items
            const itemsMap = new Map<string, FollowingFeedItemData['catalogItem']>();
            previewResponse.results?.forEach(group => {
                group.items?.forEach(item => {
                    itemsMap.set(item.spotifyId, {
                        spotifyId: item.spotifyId,
                        name: item.name,
                        imageUrl: item.imageUrl,
                        artistName: item.artistName,
                    });
                });
            });

            // Fetch user profiles for new interactions
            const userIds = [...new Set(items.map(i => i.userId))];
            const userProfiles = await UsersService.getUserProfilesBatch(userIds);

            // Create a map for user profiles
            const userProfilesMap = new Map<string, FollowingFeedItemData['userProfile']>();
            userProfiles.forEach(profile => {
                userProfilesMap.set(profile.id, {
                    id: profile.id,
                    name: profile.name,
                    surname: profile.surname,
                    username: profile.username,
                    avatarUrl: profile.avatarUrl,
                });
            });

            // Combine new interactions with catalog items and user profiles
            const newFeedItems = items.map(interaction => ({
                interaction,
                catalogItem: itemsMap.get(interaction.itemId),
                userProfile: userProfilesMap.get(interaction.userId),
            }));

            // Update hasMore status based on whether we've reached the total count
            const newOffset = currentOffset + items.length;
            const newHasMore = newOffset < totalCount;
            setHasMore(newHasMore);

            // Append new entries to existing entries
            setFeedItems(prev => [...prev, ...newFeedItems]);
            setOffset(newOffset);
        } catch (err) {
            console.error('Error loading more feed items:', err);
            setError('Failed to load more feed items. Please try again.');
        } finally {
            setLoadingMore(false);
        }
    }, [isAuthenticated, user, offset, loadingMore, hasMore]);

    // Set up scroll event for loading more items
    useEffect(() => {
        if (loading || !hasMore || feedItems.length === 0) return;

        let scrollTimeout: number | null = null;
        let isLoadingTriggered = false;

        const handleScroll = () => {
            if (isLoadingTriggered || loadingMore) return;

            // Check if user has scrolled to bottom (with 200px threshold)
            if (
                window.innerHeight + window.scrollY >=
                document.documentElement.scrollHeight - 200
            ) {
                isLoadingTriggered = true;

                if (scrollTimeout) {
                    window.clearTimeout(scrollTimeout);
                }

                scrollTimeout = window.setTimeout(() => {
                    if (!loadingMore && hasMore) {
                        console.log('Scroll threshold reached, loading more entries');
                        loadMoreFeed();
                    }
                    isLoadingTriggered = false;
                }, 300); // 300ms debounce
            }
        };

        window.addEventListener('scroll', handleScroll);

        return () => {
            window.removeEventListener('scroll', handleScroll);
            if (scrollTimeout) window.clearTimeout(scrollTimeout);
        };
    }, [loading, loadingMore, hasMore, loadMoreFeed, feedItems.length]);

    if (!isAuthenticated) {
        return null; // This should never render because of the redirect in useEffect
    }

    return (
        <div className="max-w-6xl mx-auto py-8 px-4">
            {/* Header with back button */}
            <div className="flex justify-between items-center mb-6">
                <button
                    onClick={() => navigate(-1)}
                    className="text-gray-600 hover:text-gray-900 flex items-center"
                >
                    <ArrowLeft className="h-5 w-5 mr-1" />
                    Back
                </button>

                <div className="w-10"></div> {/* Empty div for balance */}
            </div>

            {/* Error message */}
            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-6">
                    {error}
                    <button
                        onClick={() => window.location.reload()}
                        className="ml-2 underline hover:text-red-900"
                    >
                        Try again
                    </button>
                </div>
            )}

            {/* Initial loading state */}
            {loading && feedItems.length === 0 ? (
                <div className="flex justify-center items-center py-20">
                    <RefreshCw className="h-10 w-10 text-primary-600 animate-spin mr-3" />
                    <span className="text-lg text-gray-600">Loading feed...</span>
                </div>
            ) : feedItems.length === 0 ? (
                <div className="bg-white shadow rounded-lg p-8 text-center">
                    <UserRoundPlus className="h-16 w-16 text-primary-400 mx-auto mb-4" />
                    <h2 className="text-xl font-semibold text-gray-800 mb-2">Your feed is empty</h2>
                    <p className="text-gray-600 mb-6">
                        Follow more people to see their music interactions here.
                    </p>
                    <Link
                        to="/people"
                        className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700"
                    >
                        Discover People
                    </Link>
                </div>
            ) : (
                <>
                    {/* Feed grid - Mobile: 3 cols, Desktop: 5 cols */}
                    <div className="grid grid-cols-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4" role="list">
                        {feedItems.map((item) => (
                            <Link
                                key={item.interaction.aggregateId}
                                to={`/interaction/${item.interaction.aggregateId}`}
                                className="relative group bg-white rounded-lg overflow-visible shadow-sm hover:shadow-md transition-shadow duration-200"
                                role="listitem"
                            >
                                <div className="aspect-square w-full overflow-hidden rounded-t-lg">
                                    <img
                                        src={item.catalogItem?.imageUrl || '/placeholder-album.jpg'}
                                        alt={`${item.catalogItem?.name || 'Unknown'} by ${item.catalogItem?.artistName || 'Unknown Artist'}`}
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                                <div className="p-1.5">
                                    {/* User info */}
                                    <div className="flex items-center mb-1">
                                        {item.userProfile?.avatarUrl ? (
                                            <img
                                                src={item.userProfile.avatarUrl}
                                                alt={`${item.userProfile.name} ${item.userProfile.surname}`}
                                                className="w-5 h-5 sm:w-7 sm:h-7 rounded-full mr-1 sm:mr-2 object-cover flex-shrink-0"
                                            />
                                        ) : (
                                            <div
                                                className="w-5 h-5 sm:w-7 sm:h-7 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-xs font-bold mr-1 sm:mr-2 flex-shrink-0">
                                                {item.userProfile?.name.charAt(0) || '?'}{item.userProfile?.surname.charAt(0) || ''}
                                            </div>
                                        )}
                                        <div className="truncate text-xs sm:text-sm leading-tight">
                                            {item.userProfile ? `${item.userProfile.name} ${item.userProfile.surname}` : 'Unknown User'}
                                        </div>
                                    </div>
                                    <h3 className="font-medium text-gray-900 truncate text-[0.650rem] sm:text-sm">{item.catalogItem?.name || 'Unknown Title'}</h3>
                                    {/* Interaction details */}
                                    <div className="flex items-center text-xs mt-1">
                                        {item.interaction.rating && (
                                            <div className="flex items-center">
                                                <div className="sm:hidden">
                                                    <NormalizedStarDisplay
                                                        currentGrade={item.interaction.rating.normalizedGrade}
                                                        minGrade={1}
                                                        maxGrade={10}
                                                        size="mb"
                                                    />
                                                </div>
                                                <div className="hidden sm:block">
                                                    <NormalizedStarDisplay
                                                        currentGrade={item.interaction.rating.normalizedGrade}
                                                        minGrade={1}
                                                        maxGrade={10}
                                                        size="sm"
                                                    />
                                                </div>

                                                {item.interaction.rating.isComplex && (
                                                    <SlidersHorizontal
                                                        className="hidden sm:block h-2.5 w-2.5 sm:h-4 sm:w-4 ml-0.5 sm:ml-1 text-primary-500"/>
                                                )}
                                            </div>
                                        )}

                                        {item.interaction.isLiked &&
                                            <Heart
                                                className="h-2.5 w-2.5 sm:h-4 sm:w-4 ml-0.5 sm:ml-1 text-red-500 fill-red-500"/>}
                                        {item.interaction.review &&
                                            <MessageSquare className="h-2.5 w-2.5 sm:h-4 sm:w-4 ml-0.5 sm:ml-1 text-primary-600"/>}
                                    </div>

                                    <div className="flex items-center mt-1 text-[0.600rem] sm:text-xs text-gray-500">
                                        <Calendar className="hidden sm:block h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5 sm:mr-1 flex-shrink-0"/>
                                        <span className="truncate">{formatDate(item.interaction.createdAt)}</span>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>

                    {/* Loading more indicator */}
                    {loadingMore && (
                        <div className="flex items-center justify-center py-6">
                            <Loader className="h-6 w-6 text-primary-600 animate-spin mr-2" />
                            <span className="text-gray-600">Loading more...</span>
                        </div>
                    )}

                    {/* End of list message */}
                    {!hasMore && feedItems.length > 0 && !loadingMore && (
                        <div className="text-center py-6 text-gray-500">
                            You've reached the end of your feed
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default FollowingFeed;