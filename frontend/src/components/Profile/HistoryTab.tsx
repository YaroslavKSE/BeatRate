import { useState, useEffect, useCallback } from 'react';
import { Calendar, Loader } from 'lucide-react';
import InteractionService from '../../api/interaction';
import CatalogService from '../../api/catalog';
import ReviewModal from '../Diary/ReviewModal';
import { DiaryEntry, GroupedEntries } from '../Diary/types';
import { DiaryLoadingState, DiaryErrorState } from '../Diary/DiaryStates';
import DiaryDateGroup from '../Diary/DiaryDateGroup';
import axios from 'axios';

interface PublicProfileHistoryTabProps {
  userId: string;
  username?: string;
}

const PublicProfileHistoryTab = ({ userId, username }: PublicProfileHistoryTabProps) => {
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [diaryEntries, setDiaryEntries] = useState<DiaryEntry[]>([]);
  const [groupedEntries, setGroupedEntries] = useState<GroupedEntries[]>([]);
  const [offset, setOffset] = useState(0);
  const [, setTotalInteractions] = useState(0);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedReview, setSelectedReview] = useState<{
    review: { reviewId: string; reviewText: string };
    itemName: string;
    artistName: string;
    date: string;
  } | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [noInteractions, setNoInteractions] = useState(false);
  const itemsPerPage = 20;

  // Load initial diary entries
  const loadInitialDiaryEntries = useCallback(async () => {
    if (!userId) return;

    setLoading(true);
    setError(null);
    setNoInteractions(false);
    setOffset(0);
    setDiaryEntries([]);

    try {
      // Fetch initial interactions for the user - using public endpoint
      const { items: initialInteractions, totalCount } =
          await InteractionService.getUserInteractionsByUserId(userId, itemsPerPage, 0);

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
        const entry: DiaryEntry = {
          interaction,
          isPublic: true  // Mark all entries as public
        };

        // Get the preview info from our map
        entry.catalogItem = itemsMap.get(interaction.itemId);

        return entry;
      });

      setDiaryEntries(entries);
      setOffset(initialInteractions.length);
    } catch (err: unknown) {
      console.error('Error loading diary entries:', err);

      // Handle 404 as no interactions available rather than an error
      if (axios.isAxiosError(err) && err.response?.status === 404) {
        // This means the user has no interactions - this is not an error state
        setNoInteractions(true);
        setDiaryEntries([]);
        setTotalInteractions(0);
        setHasMore(false);
      } else {
        // For other errors, set the error state
        setError(`Failed to load ${username || 'user'}'s rating history.`);
      }
    } finally {
      setLoading(false);
    }
  }, [userId, username]);

  // Load more diary entries
  const loadMoreDiaryEntries = useCallback(async () => {
    if (!userId || loadingMore || !hasMore) {
      return;
    }

    // Store current offset in local variable to ensure consistency during this function execution
    const currentOffset = offset;
    setLoadingMore(true);

    try {
      // Fetch additional interactions for the user
      const { items: interactions, totalCount } =
          await InteractionService.getUserInteractionsByUserId(userId, itemsPerPage, currentOffset);

      // Check if we received any new interactions
      if (interactions.length === 0) {
        setHasMore(false);
        setLoadingMore(false);
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
        const entry: DiaryEntry = {
          interaction,
          isPublic: true  // Mark all entries as public
        };

        // Get the preview info from our map
        entry.catalogItem = itemsMap.get(interaction.itemId);

        return entry;
      });

      // Update hasMore status based on whether we've reached the total count
      const newOffset = currentOffset + interactions.length;
      const newHasMore = newOffset < totalCount;
      setHasMore(newHasMore);

      // Append new entries to existing entries
      setDiaryEntries(prevEntries => [...prevEntries, ...newEntries]);
      setOffset(newOffset);
    } catch (err: unknown) {
      console.error('Error loading more diary entries:', err);
      setError('Failed to load more entries. Please try again later.');
    } finally {
      setLoadingMore(false);
    }
  }, [userId, offset, loadingMore, hasMore]);

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

  // Load diary entries on component mount
  useEffect(() => {
    loadInitialDiaryEntries();
  }, [loadInitialDiaryEntries]);

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

  // No delete function is needed since this is a public profile view

  // Show loading state
  if (loading && diaryEntries.length === 0) {
    return <DiaryLoadingState />;
  }

  return (
      <div className="bg-white shadow rounded-lg overflow-hidden">

        <div className="sm:p-6">
          {error && <DiaryErrorState error={error} onRetry={loadInitialDiaryEntries} />}

          {(groupedEntries.length === 0 && !loading && !error) || noInteractions ? (
              <div className="text-center py-6 border border-dashed border-gray-300 rounded-lg">
                <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Calendar className="h-8 w-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Public Ratings Yet</h3>
                <p className="text-gray-500">
                  {username ? `${username} hasn't` : "This user hasn't"} shared any public ratings yet.
                </p>
              </div>
          ) : (
              <>

                {/* Diary entries by date */}
                <div className="space-y-8">
                  {groupedEntries.map((group) => (
                      <DiaryDateGroup
                          key={group.date}
                          group={group}
                          onReviewClick={handleReviewClick}
                          onDeleteClick={() => {}} // Empty function since deletion isn't allowed for public views
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
                      You've reached the end of {username ? `${username}'s` : "this user's"} rating history
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
        </div>
      </div>
  );
};

export default PublicProfileHistoryTab;