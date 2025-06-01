import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import InteractionService from '../api/interaction';
import CatalogService from '../api/catalog';
import ReviewModal from "../components/Diary/ReviewModal.tsx";
import { DiaryEntry, GroupedEntries } from '../components/Diary/types';
import { DiaryLoadingState, DiaryErrorState, DiaryEmptyState } from '../components/Diary/DiaryStates';
import DiaryDateGroup from '../components/Diary/DiaryDateGroup';
import { AlertTriangle, Loader } from 'lucide-react';

const Diary = () => {
    const navigate = useNavigate();
    const { user, isAuthenticated } = useAuthStore();
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [diaryEntries, setDiaryEntries] = useState<DiaryEntry[]>([]);
    const [groupedEntries, setGroupedEntries] = useState<GroupedEntries[]>([]);
    const [offset, setOffset] = useState(0);
    const [totalInteractions, setTotalInteractions] = useState(0);
    const [reviewModalOpen, setReviewModalOpen] = useState(false);
    const [selectedReview, setSelectedReview] = useState<{
        review: { reviewId: string; reviewText: string };
        itemName: string;
        artistName: string;
        date: string;
    } | null>(null);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [entryToDelete, setEntryToDelete] = useState<DiaryEntry | null>(null);
    const [deleteSuccess, setDeleteSuccess] = useState(false);
    const [noInteractions, setNoInteractions] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const itemsPerPage = 20;

    // Load initial diary entries
    const loadInitialDiaryEntries = useCallback(async () => {
        if (!user) return;

        setLoading(true);
        setError(null);
        setNoInteractions(false);
        setOffset(0);
        setDiaryEntries([]);

        try {
            // Fetch initial interactions for the user
            const { items: initialInteractions, totalCount } =
                await InteractionService.getUserInteractionsByUserId(user.id, itemsPerPage, 0);

            console.log(`Initial load: ${initialInteractions.length} of ${totalCount} total entries`);

            // Set total interactions and check if there are more to load
            setTotalInteractions(totalCount);
            setHasMore(totalCount > itemsPerPage);

            if (totalCount === 0) {
                setNoInteractions(true);
                setLoading(false);
                return;
            }

            // Extract all item ids for preview info
            const itemIds: string[] = initialInteractions.map(interaction => interaction.itemId);

            // Fetch preview information for all items in a single request
            const previewResponse = await CatalogService.getItemPreviewInfo(itemIds, ['album', 'track']);

            // Create lookup maps for quick access
            const itemsMap = new Map();

            // Process results from the preview response
            previewResponse.results?.forEach(resultGroup => {
                resultGroup.items?.forEach(item => {
                    // Create a simplified catalog item with the preview information
                    const catalogItem = {
                        spotifyId: item.spotifyId,
                        name: item.name,
                        imageUrl: item.imageUrl,
                        artistName: item.artistName
                    };

                    itemsMap.set(item.spotifyId, catalogItem);
                });
            });

            // Combine interactions with catalog items
            const entries = initialInteractions.map(interaction => {
                const entry: DiaryEntry = { interaction };

                // Get the preview info from our map
                entry.catalogItem = itemsMap.get(interaction.itemId);

                return entry;
            });

            setDiaryEntries(entries);
            setOffset(initialInteractions.length);
        } catch (err: unknown) {
            console.error('Error loading diary entries:', err);
            if (err && typeof err === 'object' && 'response' in err &&
                err.response && typeof err.response === 'object' && 'status' in err.response &&
                err.response.status === 404) {
                // When a 404 is received, it means there are no interactions for this user
                setNoInteractions(true);
                setTotalInteractions(0);
            } else {
                setError('Failed to load your diary entries. Please try again later.');
            }
        } finally {
            setLoading(false);
        }
    }, [user]);

    // Load more diary entries
    const loadMoreDiaryEntries = useCallback(async () => {
        if (!user || loadingMore || !hasMore) {
            console.log('Skipping load more:',
                !user ? 'no user' :
                    loadingMore ? 'already loading' :
                        'no more entries');
            return;
        }

        // Store current offset in local variable to ensure consistency during this function execution
        const currentOffset = offset;
        console.log(`Loading more entries from offset ${currentOffset}`);
        setLoadingMore(true);

        try {
            // Fetch additional interactions for the user
            const { items: interactions, totalCount } =
                await InteractionService.getUserInteractionsByUserId(user.id, itemsPerPage, currentOffset);

            console.log(`Loaded ${interactions.length} more entries, total: ${totalCount}`);

            // Check if we received any new interactions
            if (interactions.length === 0) {
                setHasMore(false);
                setLoadingMore(false);
                console.log('No more entries to load');
                return;
            }

            // Extract all item ids for preview info
            const itemIds: string[] = interactions.map(interaction => interaction.itemId);

            // Fetch preview information for all items in a single request
            const previewResponse = await CatalogService.getItemPreviewInfo(itemIds, ['album', 'track']);

            // Create lookup maps for quick access
            const itemsMap = new Map();

            // Process results from the preview response
            previewResponse.results?.forEach(resultGroup => {
                resultGroup.items?.forEach(item => {
                    // Create a simplified catalog item with the preview information
                    const catalogItem = {
                        spotifyId: item.spotifyId,
                        name: item.name,
                        imageUrl: item.imageUrl,
                        artistName: item.artistName
                    };

                    itemsMap.set(item.spotifyId, catalogItem);
                });
            });

            // Combine interactions with catalog items
            const newEntries = interactions.map(interaction => {
                const entry: DiaryEntry = { interaction };

                // Get the preview info from our map
                entry.catalogItem = itemsMap.get(interaction.itemId);

                return entry;
            });

            // Update hasMore status based on whether we've reached the total count
            const newOffset = currentOffset + interactions.length;
            const newHasMore = newOffset < totalCount;
            setHasMore(newHasMore);
            console.log(`Has more entries: ${newHasMore}, new offset: ${newOffset}`);

            // Append new entries to existing entries
            setDiaryEntries(prevEntries => [...prevEntries, ...newEntries]);
            setOffset(newOffset);
        } catch (err: unknown) {
            console.error('Error loading more diary entries:', err);
            setError('Failed to load more entries. Please try again later.');
        } finally {
            setLoadingMore(false);
        }
    }, [user, offset, loadingMore, hasMore]);

    // Setup scroll event for loading more entries
    useEffect(() => {
        // Don't set up scroll handler if we're in initial loading
        // or if there are no more items to load
        if (loading || !hasMore || diaryEntries.length === 0) return;

        // Use a debounce mechanism to prevent multiple rapid scroll events
        let scrollTimeout: number | null = null;
        let isLoadingTriggered = false;

        const handleScroll = () => {
            // Skip if already triggered but not yet processed
            if (isLoadingTriggered || loadingMore) return;

            // Check if user has scrolled to bottom (with 200px threshold)
            if (
                window.innerHeight + window.scrollY >=
                document.documentElement.scrollHeight - 200
            ) {
                // Set flag to avoid multiple triggers before the timeout
                isLoadingTriggered = true;

                // Clear any existing timeout
                if (scrollTimeout) {
                    window.clearTimeout(scrollTimeout);
                }

                // Set a timeout to debounce multiple scroll events
                scrollTimeout = window.setTimeout(() => {
                    if (!loadingMore && hasMore) {
                        console.log('Scroll threshold reached, loading more entries');
                        loadMoreDiaryEntries();
                    }
                    isLoadingTriggered = false;
                }, 300); // 300ms debounce
            }
        };

        // Add scroll event listener
        window.addEventListener('scroll', handleScroll);

        // Clean up
        return () => {
            window.removeEventListener('scroll', handleScroll);
            if (scrollTimeout) window.clearTimeout(scrollTimeout);
        };
    }, [loading, loadingMore, hasMore, loadMoreDiaryEntries, diaryEntries.length]);

    // Load diary entries when authenticated user changes
    useEffect(() => {
        if (!isAuthenticated || !user) {
            navigate('/login', { state: { from: '/diary' } });
            return;
        }

        loadInitialDiaryEntries();
    }, [isAuthenticated, user, navigate, loadInitialDiaryEntries]);

    // Group entries by date whenever diary entries change
    useEffect(() => {
        if (diaryEntries.length === 0) return;

        // Group entries by date
        const grouped: Record<string, DiaryEntry[]> = {};
        diaryEntries.forEach(entry => {
            const date = new Date(entry.interaction.createdAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });

            if (!grouped[date]) {
                grouped[date] = [];
            }
            grouped[date].push(entry);
        });

        // Convert to array sorted by date (newest first)
        const result: GroupedEntries[] = Object.keys(grouped)
            .map(date => ({ date, entries: grouped[date] }))
            .sort((a, b) => new Date(b.entries[0].interaction.createdAt).getTime() -
                new Date(a.entries[0].interaction.createdAt).getTime());

        setGroupedEntries(result);
    }, [diaryEntries]);

    // Show success message briefly
    useEffect(() => {
        if (deleteSuccess) {
            const timer = setTimeout(() => {
                setDeleteSuccess(false);
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [deleteSuccess]);

    const handleReviewClick = (e: React.MouseEvent, entry: DiaryEntry) => {
        e.stopPropagation(); // Prevent triggering the row click

        if (!entry.interaction.review) return;

        const formattedDate = new Date(entry.interaction.createdAt).toLocaleString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        setSelectedReview({
            review: entry.interaction.review,
            itemName: entry.catalogItem?.name || 'Unknown Title',
            artistName: entry.catalogItem?.artistName || 'Unknown Artist',
            date: formattedDate
        });

        setReviewModalOpen(true);
    };

    const handleDeleteClick = (e: React.MouseEvent, entry: DiaryEntry) => {
        e.stopPropagation(); // Prevent triggering the row click
        setEntryToDelete(entry);
        setDeleteModalOpen(true);
    };

    const confirmDelete = async () => {
        if (!entryToDelete) return;

        try {
            await InteractionService.deleteInteraction(entryToDelete.interaction.aggregateId);

            // Remove the deleted entry from the diary entries
            const updatedEntries = diaryEntries.filter(
                entry => entry.interaction.aggregateId !== entryToDelete.interaction.aggregateId
            );
            setDiaryEntries(updatedEntries);

            // Update total interactions count
            setTotalInteractions(prev => prev - 1);

            // Show success message
            setDeleteSuccess(true);
        } catch (err: unknown) {
            console.error('Error deleting entry:', err);
            setError('Failed to delete the entry. Please try again.');
        } finally {
            setDeleteModalOpen(false);
            setEntryToDelete(null);
        }
    };

    // Show loading state
    if (loading && diaryEntries.length === 0) {
        return <DiaryLoadingState />;
    }

    return (
        <div className="max-w-6xl mx-auto py-2">
            <div className="mb-2 sm:mb-6">
                <h1 className="text-xl sm:text-3xl font-bold text-gray-900 mb-2">Your Music Diary</h1>
                <p className="hidden sm:block text-gray-600">A chronological record of your music experiences and thoughts</p>
            </div>

            {error && <DiaryErrorState error={error} onRetry={loadInitialDiaryEntries} />}

            {/* Success notification */}
            {deleteSuccess && (
                <div className="fixed top-4 right-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded z-50 shadow-md">
                    Entry has been deleted successfully!
                </div>
            )}

            {(groupedEntries.length === 0 && !loading && !error) || noInteractions ? (
                <DiaryEmptyState />
            ) : (
                <>
                    {totalInteractions > 0 && (
                        <div className="mb-4 text-xs sm:text-sm text-gray-600">
                            Showing entries for your music interactions ({diaryEntries.length} of {totalInteractions} total)
                        </div>
                    )}

                    {/* Diary entries by date */}
                    <div className="space-y-8">
                        {groupedEntries.map((group) => (
                            <DiaryDateGroup
                                key={group.date}
                                group={group}
                                onReviewClick={handleReviewClick}
                                onDeleteClick={handleDeleteClick}
                            />
                        ))}
                    </div>

                    {/* Loading more indicator */}
                    {loadingMore && (
                        <div className="flex items-center justify-center py-6">
                            <Loader className="h-6 w-6 text-primary-600 animate-spin mr-2" />
                            <span className="text-gray-600">Loading more entries...</span>
                        </div>
                    )}

                    {/* End of list message */}
                    {!hasMore && diaryEntries.length > 0 && !loadingMore && (
                        <div className="text-center py-6 text-gray-500">
                            You've reached the end of your diary entries
                        </div>
                    )}
                </>
            )}

            {/* Review Modal */}
            {selectedReview && (
                <ReviewModal
                    isOpen={reviewModalOpen}
                    onClose={() => setReviewModalOpen(false)}
                    review={selectedReview.review}
                    itemName={selectedReview.itemName}
                    artistName={selectedReview.artistName}
                    date={selectedReview.date}
                />
            )}

            {/* Delete Confirmation Modal */}
            {deleteModalOpen && entryToDelete && (
                <div className="fixed inset-0 z-50 overflow-y-auto">
                    <div className="flex items-center justify-center min-h-screen p-4">
                        {/* Backdrop */}
                        <div
                            className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
                            onClick={() => setDeleteModalOpen(false)}
                        ></div>

                        {/* Modal */}
                        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full z-10">
                            <div className="p-6">
                                <div className="flex items-center mb-4">
                                    <AlertTriangle className="h-8 w-8 text-red-500 mr-4" />
                                    <h3 className="text-lg font-bold text-gray-900">Delete Entry</h3>
                                </div>

                                <p className="mb-4">
                                    Are you sure you want to delete this entry for "{entryToDelete.catalogItem?.name || 'Unknown Title'}"?
                                    This action cannot be undone.
                                </p>

                                <div className="flex justify-end space-x-3 mt-6">
                                    <button
                                        type="button"
                                        onClick={() => setDeleteModalOpen(false)}
                                        className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={confirmDelete}
                                        className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Diary;