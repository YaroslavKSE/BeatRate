import { useState, useEffect } from 'react';
import {Loader, RefreshCw, History, AlertTriangle, Trash2} from 'lucide-react';
import InteractionService from '../../api/interaction';
import CatalogService from '../../api/catalog';
import UsersService from '../../api/users';
import { ItemHistoryEntry, GroupedHistoryEntries } from '../ItemHistory/ItemHistoryTypes';
import useAuthStore from '../../store/authStore';
import EmptyState from "./EmptyState.tsx";
import NormalizedStarDisplay from '../CreateInteraction/NormalizedStarDisplay';
import { Heart, MessageSquare, Calendar, SlidersHorizontal } from 'lucide-react';

interface ItemHistoryComponentProps {
    itemId: string;
    itemType: 'Album' | 'Track';
    onLogInteraction?: () => void;
    refreshTrigger?: number;
}

const ItemHistoryComponent = ({
                                  itemId,
                                  itemType,
                                  onLogInteraction,
                                  refreshTrigger = 0
                              }: ItemHistoryComponentProps) => {
    const { user, isAuthenticated } = useAuthStore();
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [historyEntries, setHistoryEntries] = useState<ItemHistoryEntry[]>([]);
    const [groupedEntries, setGroupedEntries] = useState<GroupedHistoryEntries[]>([]);
    const [offset, setOffset] = useState(0);
    const [, setTotalInteractions] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const itemsPerPage = 10;

    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [entryToDelete, setEntryToDelete] = useState<ItemHistoryEntry | null>(null);
    const [deleteSuccess, setDeleteSuccess] = useState(false);

    // Load item interactions history
    useEffect(() => {
        const loadItemHistory = async () => {
            if (!isAuthenticated || !user || !itemId) return;

            setLoading(true);
            setError(null);

            try {
                const { items: interactions, totalCount } =
                    await InteractionService.getUserItemHistory(user.id, itemId, itemsPerPage, 0);

                setTotalInteractions(totalCount);
                setHasMore(totalCount > itemsPerPage);

                if (totalCount === 0) {
                    setLoading(false);
                    return;
                }

                const userProfiles = new Map();
                if (user) {
                    try {
                        const profile = await UsersService.getUserProfileById(user.id);
                        userProfiles.set(user.id, profile);
                    } catch (error) {
                        console.error(`Failed to fetch profile for user ${user.id}:`, error);
                    }
                }

                // Fetch catalog item preview
                const itemIds: string[] = interactions.map(interaction => interaction.itemId);
                const previewResponse = await CatalogService.getItemPreviewInfo(itemIds, [itemType.toLowerCase()]);
                const itemsMap = new Map();

                previewResponse.results?.forEach(resultGroup => {
                    resultGroup.items?.forEach(item => {
                        const catalogItem = {
                            spotifyId: item.spotifyId,
                            name: item.name,
                            imageUrl: item.imageUrl,
                            artistName: item.artistName
                        };
                        itemsMap.set(item.spotifyId, catalogItem);
                    });
                });

                // Combine interactions with user profiles and catalog items
                const entries = interactions.map(interaction => {
                    const entry: ItemHistoryEntry = {
                        interaction,
                        userProfile: userProfiles.get(interaction.userId),
                        catalogItem: itemsMap.get(interaction.itemId)
                    };
                    return entry;
                });

                setHistoryEntries(entries);
                setOffset(interactions.length);
            } catch (err) {
                console.error('Error loading item history:', err);
            } finally {
                setLoading(false);
            }
        };

        loadItemHistory();
    }, [user, itemId, itemType, isAuthenticated, refreshTrigger]);

    // Load more history entries
    const loadMoreHistory = async () => {
        if (!isAuthenticated || !user || !itemId || loadingMore || !hasMore) return;

        const currentOffset = offset;
        setLoadingMore(true);

        try {
            const { items: interactions, totalCount } =
                await InteractionService.getUserItemHistory(user.id, itemId, itemsPerPage, currentOffset);

            if (interactions.length === 0) {
                setHasMore(false);
                setLoadingMore(false);
                return;
            }

            // Fetch catalog item preview
            const itemIds: string[] = interactions.map(interaction => interaction.itemId);
            const previewResponse = await CatalogService.getItemPreviewInfo(itemIds, [itemType.toLowerCase()]);
            const itemsMap = new Map();

            previewResponse.results?.forEach(resultGroup => {
                resultGroup.items?.forEach(item => {
                    const catalogItem = {
                        spotifyId: item.spotifyId,
                        name: item.name,
                        imageUrl: item.imageUrl,
                        artistName: item.artistName
                    };
                    itemsMap.set(item.spotifyId, catalogItem);
                });
            });

            const newEntries = interactions.map(interaction => {
                const entry: ItemHistoryEntry = {
                    interaction,
                    userProfile: user ? {
                        id: user.id,
                        username: user.username || '',
                        name: user.name,
                        surname: user.surname,
                        avatarUrl: user.avatarUrl,
                        followerCount: 0,
                        followingCount: 0,
                        createdAt: ''
                    } : undefined,
                    catalogItem: itemsMap.get(interaction.itemId)
                };
                return entry;
            });

            const newOffset = currentOffset + interactions.length;
            const newHasMore = newOffset < totalCount;
            setHasMore(newHasMore);

            setHistoryEntries(prevEntries => [...prevEntries, ...newEntries]);
            setOffset(newOffset);
        } catch (err) {
            console.error('Error loading more history entries:', err);
        } finally {
            setLoadingMore(false);
        }
    };

    // Group entries by date whenever history entries change
    useEffect(() => {
        if (historyEntries.length === 0) return;

        const grouped: Record<string, ItemHistoryEntry[]> = {};
        historyEntries.forEach(entry => {
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

        const result: GroupedHistoryEntries[] = Object.keys(grouped)
            .map(date => ({ date, entries: grouped[date] }))
            .sort((a, b) => new Date(b.entries[0].interaction.createdAt).getTime() -
                new Date(a.entries[0].interaction.createdAt).getTime());

        setGroupedEntries(result);
    }, [historyEntries]);

    // Show success message briefly
    useEffect(() => {
        if (deleteSuccess) {
            const timer = setTimeout(() => {
                setDeleteSuccess(false);
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [deleteSuccess]);

    // Handle delete click - prepare for deletion
    const handleDeleteClick = (e: React.MouseEvent, entry: ItemHistoryEntry) => {
        e.stopPropagation();
        setEntryToDelete(entry);
        setDeleteModalOpen(true);
    };

    // Confirm deletion of entry
    const confirmDelete = async () => {
        if (!entryToDelete) return;

        try {
            await InteractionService.deleteInteraction(entryToDelete.interaction.aggregateId);

            const updatedEntries = historyEntries.filter(
                entry => entry.interaction.aggregateId !== entryToDelete.interaction.aggregateId
            );
            setHistoryEntries(updatedEntries);

            setTotalInteractions(prev => prev - 1);
            setDeleteSuccess(true);
        } catch (err) {
            console.error('Error deleting entry:', err);
            setError('Failed to delete the entry. Please try again.');
        } finally {
            setDeleteModalOpen(false);
            setEntryToDelete(null);
        }
    };

    if (loading && historyEntries.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-8">
                <RefreshCw className="h-8 w-8 text-primary-600 animate-spin mb-4" />
                <div className="text-gray-600">Loading history...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-6">
                {error}
                <button
                    onClick={() => window.location.reload()}
                    className="ml-2 underline hover:text-red-900"
                >
                    Try again
                </button>
            </div>
        );
    }

    if (historyEntries.length === 0) {
        return (
            <EmptyState
                title="No history"
                message={`You haven't interacted with this ${itemType.toLowerCase()}.`}
                icon={<History className="h-12 w-12 text-gray-400" />}
                action={onLogInteraction ? {
                    label: "Write a Review",
                    onClick: onLogInteraction
                } : undefined}
            />
        );
    }

    return (
        <div className="space-y-6">
            {deleteSuccess && (
                <div className="fixed top-4 right-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded z-50 shadow-md">
                    Entry has been deleted successfully!
                </div>
            )}

            {/* History entries by date */}
            <div className="space-y-6">
                {groupedEntries.map((group) => (
                    <div key={group.date} className="bg-white rounded-lg shadow overflow-hidden">
                        <div className="bg-primary-50 px-6 py-2 sm:py-3 border-b border-primary-100">
                            <div className="flex items-center">
                                <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-primary-600 mr-2" />
                                <h2 className="text-sm sm:text-lg font-medium text-primary-800">{group.date}</h2>
                            </div>
                        </div>

                        <div className="divide-y divide-gray-200">
                            {group.entries.map((entry) => (
                                <HistoryEntryComponent
                                    key={entry.interaction.aggregateId}
                                    entry={entry}
                                    onDeleteClick={handleDeleteClick}
                                />
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* Loading more indicator */}
            {loadingMore && (
                <div className="flex items-center justify-center py-4">
                    <Loader className="h-5 w-5 text-primary-600 animate-spin mr-2" />
                    <span className="text-gray-600">Loading more entries...</span>
                </div>
            )}

            {/* Load more button */}
            {hasMore && !loadingMore && (
                <div className="flex justify-center pt-2">
                    <button
                        onClick={loadMoreHistory}
                        className="px-4 py-2 bg-white border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                    >
                        Load More
                    </button>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteModalOpen && entryToDelete && (
                <div className="fixed inset-0 z-50">
                    <div className="flex items-center justify-center min-h-screen p-4">
                        <div
                            className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
                            onClick={() => setDeleteModalOpen(false)}
                        ></div>

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

// History Entry Component with mobile optimization
interface HistoryEntryProps {
    entry: ItemHistoryEntry;
    onDeleteClick: (e: React.MouseEvent, entry: ItemHistoryEntry) => void;
}

const HistoryEntryComponent = ({ entry, onDeleteClick }: HistoryEntryProps) => {
    const [isHovered, setIsHovered] = useState(false);

    const handleItemClick = () => {
        // Navigate to interaction detail page
        window.location.href = `/interaction/${entry.interaction.aggregateId}`;
    };

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        onDeleteClick(e, entry);
    };

    return (
        <div
            className="p-3 sm:p-4 hover:bg-gray-50 cursor-pointer transition-colors"
            onClick={handleItemClick}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Mobile Layout */}
            <div className="sm:hidden">
                {/* Top row: User info + Time + Delete */}
                <div className="flex items-start space-x-3">
                    {/* User avatar */}
                    <div className="flex-shrink-0 h-10 w-10 bg-primary-100 rounded-full overflow-hidden">
                        {entry.userProfile?.avatarUrl ? (
                            <img
                                src={entry.userProfile.avatarUrl}
                                alt={entry.userProfile.name}
                                className="h-full w-full object-cover"
                            />
                        ) : (
                            <div className="h-full w-full flex items-center justify-center text-primary-700 text-sm font-bold">
                                {entry.userProfile ? (
                                    `${entry.userProfile.name.charAt(0)}${entry.userProfile.surname.charAt(0)}`
                                ) : (
                                    '?'
                                )}
                            </div>
                        )}
                    </div>

                    {/* Content container */}
                    <div className="flex-1 min-w-0 flex flex-col">
                        {/* User name and time */}
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-medium text-gray-900 truncate">
                                {entry.userProfile ? `${entry.userProfile.name} ${entry.userProfile.surname}` : 'You'}
                            </h3>
                            <div className="flex items-center space-x-2">
                                <div className="text-xs text-gray-500">
                                    {new Date(entry.interaction.createdAt).toLocaleTimeString('en-US', {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                        hour12: true
                                    })}
                                </div>
                                <button
                                    onClick={handleDelete}
                                    className="p-1 text-gray-400 hover:text-red-500 rounded-full hover:bg-gray-100"
                                    title="Delete this entry"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                        </div>

                        {/* Rating + Like + Review */}
                        <div className="mt-1 flex items-center justify-start space-x-2">
                            {/* Rating stars */}
                            {entry.interaction.rating ? (
                                <div className="flex items-center">
                                    <NormalizedStarDisplay
                                        currentGrade={entry.interaction.rating.normalizedGrade}
                                        minGrade={1}
                                        maxGrade={10}
                                        size="sm"
                                    />
                                    {entry.interaction.rating.isComplex && (
                                        <SlidersHorizontal className="h-3.5 w-3.5 text-primary-500 ml-1" />
                                    )}
                                </div>
                            ) : (
                                <div className="flex">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <div key={star} className="relative">
                                            <MessageSquare className="h-4 w-4 text-gray-300" />
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Like & Review */}
                            {entry.interaction.isLiked && (
                                <Heart className="h-4 w-4 text-red-500 fill-red-500" />
                            )}

                            {entry.interaction.review && (
                                <MessageSquare className="h-4 w-4 text-primary-600" />
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Desktop Layout */}
            <div className="hidden sm:flex items-center">
                {/* User avatar */}
                <div className="flex-shrink-0 h-12 w-12 bg-primary-100 rounded-full overflow-hidden mr-4">
                    {entry.userProfile?.avatarUrl ? (
                        <img
                            src={entry.userProfile.avatarUrl}
                            alt={entry.userProfile.name}
                            className="h-full w-full object-cover"
                        />
                    ) : (
                        <div className="h-full w-full flex items-center justify-center text-primary-700 text-lg font-bold">
                            {entry.userProfile ? (
                                `${entry.userProfile.name.charAt(0)}${entry.userProfile.surname.charAt(0)}`
                            ) : (
                                '?'
                            )}
                        </div>
                    )}
                </div>

                {/* User details */}
                <div className="flex-grow min-w-0">
                    <div className="flex items-center">
                        <h3 className="text-base font-medium text-gray-900 truncate">
                            {entry.userProfile ? `${entry.userProfile.name} ${entry.userProfile.surname}` : 'You'}
                        </h3>
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                        {new Date(entry.interaction.createdAt).toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true
                        })}
                    </div>
                </div>

                {/* Interaction indicators */}
                <div className="flex items-center space-x-4 ml-4">
                    {/* Rating */}
                    <div className="flex items-center">
                        {entry.interaction.rating ? (
                            <div className="flex items-center">
                                <NormalizedStarDisplay
                                    currentGrade={entry.interaction.rating.normalizedGrade}
                                    minGrade={1}
                                    maxGrade={10}
                                    size="sm"
                                />
                                {entry.interaction.rating.isComplex && (
                                    <SlidersHorizontal className="ml-1 h-4 w-4 text-primary-500" />
                                )}
                            </div>
                        ) : (
                            <div className="flex">
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <MessageSquare key={star} className="h-5 w-5 text-gray-300" />
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Like icon */}
                    {entry.interaction.isLiked ? (
                        <Heart className="h-5 w-5 text-red-500 fill-red-500"/>
                    ) : (
                        <Heart className="h-5 w-5 text-gray-300"/>
                    )}

                    {/* Review icon */}
                    {entry.interaction.review ? (
                        <MessageSquare className="h-5 w-5 text-primary-600" />
                    ) : (
                        <MessageSquare className="h-5 w-5 text-gray-300" />
                    )}
                </div>

                {/* Delete button */}
                <button
                    onClick={handleDelete}
                    className={`ml-4 p-2 text-gray-400 hover:text-red-500 hover:bg-gray-100 rounded-full transition-colors ${isHovered ? 'visible' : 'invisible'}`}
                    title="Delete this entry"
                >
                    <Trash2 className="h-5 w-5" />
                </button>
            </div>
        </div>
    );
};

export default ItemHistoryComponent;