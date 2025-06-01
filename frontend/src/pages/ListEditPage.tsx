import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Disc,
    Music,
    Save,
    ArrowLeft,
    Trash2,
    Plus,
    GripVertical,
    Medal
} from 'lucide-react';
import ListsService, { ListDetail, UpdateListRequest, ListItem } from '../api/lists';
import useAuthStore from '../store/authStore';
import AddItemModal from '../components/Lists/AddItemModal';
import { CSS } from '@dnd-kit/utilities';
import { useSortable } from '@dnd-kit/sortable';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent
} from '@dnd-kit/core';
import CatalogService from '../api/catalog';

const ListEditPage = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user, isAuthenticated } = useAuthStore();

    // State for the list
    const [list, setList] = useState<ListDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [listName, setListName] = useState('');
    const [listDescription, setListDescription] = useState('');
    const [isRanked, setIsRanked] = useState(false);
    const [items, setItems] = useState<ListItem[]>([]);
    const [itemImages, setItemImages] = useState<Record<string, string>>({});
    const [itemNames, setItemNames] = useState<Record<string, string>>({});
    const [itemArtists, setItemArtists] = useState<Record<string, string>>({});
    const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    // Fetch list data
    useEffect(() => {
        const fetchListData = async () => {
            if (!id) return;

            setLoading(true);
            setError(null);

            try {
                // Get list details
                const listData = await ListsService.getListById(id);

                if (!listData) {
                    setError('List not found');
                    setLoading(false);
                    return;
                }

                // Check if the current user is the owner of the list
                if (isAuthenticated && user && listData.userId !== user.id) {
                    setError('You do not have permission to edit this list');
                    setLoading(false);
                    return;
                }

                setList(listData);
                setListName(listData.listName);
                setListDescription(listData.listDescription || '');
                setIsRanked(listData.isRanked);

                // Convert list items to sorted array
                const sortedItems = [...listData.items].sort((a, b) => a.number - b.number);
                setItems(sortedItems);

                // Fetch item details (images, names, artists)
                if (listData.items.length > 0) {
                    const itemIds = listData.items.map(item => item.spotifyId);
                    const previewResponse = await CatalogService.getItemPreviewInfo(
                        itemIds,
                        [listData.listType.toLowerCase()]
                    );

                    const newItemImages: Record<string, string> = {};
                    const newItemNames: Record<string, string> = {};
                    const newItemArtists: Record<string, string> = {};

                    previewResponse.results?.forEach(group => {
                        group.items?.forEach(item => {
                            newItemImages[item.spotifyId] = item.imageUrl;
                            newItemNames[item.spotifyId] = item.name;
                            newItemArtists[item.spotifyId] = item.artistName;
                        });
                    });

                    setItemImages(newItemImages);
                    setItemNames(newItemNames);
                    setItemArtists(newItemArtists);
                }

            } catch (err) {
                console.error('Error fetching list data:', err);
                setError('Failed to load list data. Please try again later.');
            } finally {
                setLoading(false);
            }
        };

        fetchListData();
    }, [id, isAuthenticated, user]);

    // Redirect if not authenticated
    useEffect(() => {
        if (!isAuthenticated) {
            navigate('/login', { state: { from: `/lists/edit/${id}` } });
        }
    }, [isAuthenticated, navigate, id]);

    // Reorder items when drag ends
    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            setItems((items) => {
                const oldIndex = items.findIndex((item) => item.spotifyId === active.id);
                const newIndex = items.findIndex((item) => item.spotifyId === over.id);

                // Create a new array with the updated order
                const newItems = [...items];
                const [movedItem] = newItems.splice(oldIndex, 1);
                newItems.splice(newIndex, 0, movedItem);

                // Update the number property for each item
                return newItems.map((item, index) => ({
                    ...item,
                    number: index + 1
                }));
            });
        }
    };

    // Configure sensors for drag and drop
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor)
    );

    // Remove an item from the list
    const handleRemoveItem = (spotifyId: string) => {
        setItems((prevItems) => {
            const newItems = prevItems.filter(item => item.spotifyId !== spotifyId);
            // Update the number property for each item
            return newItems.map((item, index) => ({
                ...item,
                number: index + 1
            }));
        });
    };

    // Add items to the list
    const handleAddItems = (newItems: { spotifyId: string }[]) => {
        if (!list) return;

        // Get the current count of items
        const startIndex = items.length;

        // Add the new items to the list
        const itemsToAdd = newItems.map((item, index) => ({
            spotifyId: item.spotifyId,
            number: startIndex + index + 1
        }));

        setItems([...items, ...itemsToAdd]);

        // Fetch details for the new items
        const fetchNewItemDetails = async () => {
            const newItemIds = newItems.map(item => item.spotifyId);
            const previewResponse = await CatalogService.getItemPreviewInfo(
                newItemIds,
                [list.listType.toLowerCase()]
            );

            const newItemImages = { ...itemImages };
            const newItemNames = { ...itemNames };
            const newItemArtists = { ...itemArtists };

            previewResponse.results?.forEach(group => {
                group.items?.forEach(item => {
                    newItemImages[item.spotifyId] = item.imageUrl;
                    newItemNames[item.spotifyId] = item.name;
                    newItemArtists[item.spotifyId] = item.artistName;
                });
            });

            setItemImages(newItemImages);
            setItemNames(newItemNames);
            setItemArtists(newItemArtists);
        };

        fetchNewItemDetails();

        // Close the modal
        setIsAddItemModalOpen(false);
    };

    // Save the updated list
    const handleSaveList = async () => {
        if (!list || !user || !listName.trim()) return;

        setSubmitting(true);
        setError(null);

        try {
            const updateRequest: UpdateListRequest = {
                listId: list.listId,
                listType: list.listType,
                listName: listName.trim(),
                listDescription: listDescription.trim(),
                isRanked,
                items
            };

            const response = await ListsService.updateList(list.listId, updateRequest);

            if (response.success) {
                setSaveSuccess(true);
                navigate(-1);
            } else {
                setError(response.errorMessage || 'Failed to update list');
            }
        } catch (err) {
            console.error('Error updating list:', err);
            setError('An error occurred while updating the list');
        } finally {
            setSubmitting(false);
        }
    };

    // Don't render anything if not authenticated or loading
    if (!isAuthenticated) return null;

    if (loading) {
        return (
            <div className="max-w-6xl mx-auto py-4 sm:py-8 px-2 sm:px-4">
                <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 sm:h-10 sm:w-10 border-t-2 border-b-2 border-primary-600"></div>
                    <span className="ml-3 text-sm sm:text-lg text-gray-600">Loading list...</span>
                </div>
            </div>
        );
    }

    if (error || !list) {
        return (
            <div className="max-w-6xl mx-auto py-4 sm:py-8 px-2 sm:px-4">
                <div className="bg-red-50 border border-red-200 text-red-700 p-4 sm:p-6 rounded-lg">
                    <h2 className="text-lg sm:text-xl font-semibold mb-2">Error</h2>
                    <p className="text-sm sm:text-base">{error || "Couldn't find the list you're looking for."}</p>
                    <button
                        onClick={() => navigate('/lists')}
                        className="mt-4 px-3 py-1.5 sm:px-4 sm:py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 text-sm sm:text-base"
                    >
                        Return to Lists
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto py-2 sm:py-8 px-2 sm:px-4">
            {/* Header with back button */}
            <div className="mb-4 sm:mb-6 flex justify-between items-center">
                <button
                    onClick={() => navigate(-1)}
                    className="text-gray-600 hover:text-gray-900 flex items-center"
                >
                    <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5 mr-1" />
                    <span className="text-sm sm:text-base">Back to List</span>
                </button>

                <h1 className="text-lg sm:text-2xl font-bold text-gray-900">Edit List</h1>

                <button
                    onClick={handleSaveList}
                    disabled={submitting || !listName.trim()}
                    className="flex items-center px-3 py-1.5 sm:px-4 sm:py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors disabled:bg-primary-400 disabled:cursor-not-allowed text-sm sm:text-base"
                >
                    {submitting ? (
                        <>
                            <span className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                            <span className="hidden sm:inline">Saving...</span>
                            <span className="sm:hidden">Save</span>
                        </>
                    ) : (
                        <>
                            <Save className="h-3 w-3 sm:h-5 sm:w-5 mr-1 sm:mr-2" />
                            <span className="hidden sm:inline">Save Changes</span>
                            <span className="sm:hidden">Save</span>
                        </>
                    )}
                </button>
            </div>

            {/* Success message */}
            {saveSuccess && (
                <div className="fixed top-4 right-4 bg-green-100 border border-green-400 text-green-700 px-3 py-2 sm:px-4 sm:py-3 rounded z-50 shadow-md text-sm sm:text-base">
                    List saved successfully! Redirecting...
                </div>
            )}

            {/* Error message */}
            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 sm:px-4 sm:py-3 rounded-md mb-4 sm:mb-6 text-sm sm:text-base">
                    {error}
                </div>
            )}

            {/* List edit form */}
            <div className="bg-white shadow rounded-lg mb-4 sm:mb-6">
                <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
                    {/* List details */}
                    <div className="space-y-3 sm:space-y-4">
                        <div>
                            <label htmlFor="listName" className="block text-sm font-medium text-gray-700 mb-1">
                                List Name*
                            </label>
                            <input
                                type="text"
                                id="listName"
                                value={listName}
                                onChange={(e) => setListName(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-sm sm:text-base"
                                placeholder="My Favorite Albums"
                                required
                            />
                        </div>

                        <div>
                            <label htmlFor="listDescription" className="block text-sm font-medium text-gray-700 mb-1">
                                Description
                            </label>
                            <textarea
                                id="listDescription"
                                value={listDescription}
                                onChange={(e) => setListDescription(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-sm sm:text-base"
                                placeholder="A collection of my all-time favorites..."
                                rows={2}
                            />
                        </div>

                        <div className="flex items-center">
                            <input
                                id="isRanked"
                                type="checkbox"
                                checked={isRanked}
                                onChange={(e) => setIsRanked(e.target.checked)}
                                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                            />
                            <label htmlFor="isRanked" className="ml-2 text-sm text-gray-900 flex items-center">
                                Make this a ranked list
                                <Medal className="ml-1 h-3 w-3 sm:h-4 sm:w-4 text-purple-600" />
                            </label>
                        </div>

                        <div className="flex items-center text-xs sm:text-sm text-gray-500">
                            <span>
                                {items.length} {items.length === 1 ?
                                (list.listType === 'Album' ? 'album' : 'track') :
                                (list.listType === 'Album' ? 'albums' : 'tracks')}
                            </span>
                        </div>
                    </div>

                    {/* Divider */}
                    <div className="border-t border-gray-200 pt-4 sm:pt-6">
                        <div className="flex justify-between items-center mb-3 sm:mb-4">
                            <h2 className="text-base sm:text-lg font-medium text-gray-900">
                                List Items
                            </h2>
                            <button
                                onClick={() => setIsAddItemModalOpen(true)}
                                className="flex items-center px-2 py-1 sm:px-3 sm:py-1.5 bg-primary-600 text-white rounded-md hover:bg-primary-700 text-xs sm:text-sm"
                            >
                                <Plus className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                                <span className="hidden sm:inline">Add Items</span>
                                <span className="sm:hidden">Add</span>
                            </button>
                        </div>

                        {/* List items */}
                        <div className="space-y-2">
                            {items.length === 0 ? (
                                <div className="text-center py-6 sm:py-8 text-gray-500 border border-dashed border-gray-300 rounded-lg">
                                    <p className="text-sm sm:text-base">This list has no items. Click "Add Items" to get started.</p>
                                </div>
                            ) : (
                                <DndContext
                                    sensors={sensors}
                                    collisionDetection={closestCenter}
                                    onDragEnd={handleDragEnd}
                                >
                                    <SortableContext
                                        items={items.map(item => item.spotifyId)}
                                        strategy={verticalListSortingStrategy}
                                    >
                                        {items.map((item) => (
                                            <SortableItem
                                                key={item.spotifyId}
                                                id={item.spotifyId}
                                                item={item}
                                                image={itemImages[item.spotifyId]}
                                                name={itemNames[item.spotifyId] || 'Unknown item'}
                                                artist={itemArtists[item.spotifyId] || 'Unknown artist'}
                                                isRanked={isRanked}
                                                listType={list.listType}
                                                onRemove={handleRemoveItem}
                                            />
                                        ))}
                                    </SortableContext>
                                </DndContext>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Add Item Modal */}
            <AddItemModal
                isOpen={isAddItemModalOpen}
                onClose={() => setIsAddItemModalOpen(false)}
                onAddItems={handleAddItems}
                listType={list.listType}
                existingItemIds={items.map(item => item.spotifyId)}
            />
        </div>
    );
};

// Sortable item component
interface SortableItemProps {
    id: string;
    item: ListItem;
    image?: string;
    name: string;
    artist: string;
    isRanked: boolean;
    listType: string;
    onRemove: (id: string) => void;
}

function SortableItem({ id, item, image, name, artist, isRanked, listType, onRemove }: SortableItemProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className="bg-white border border-gray-200 rounded-lg flex items-center"
        >
            {/* Mobile Layout */}
            <div className="sm:hidden w-full p-2 flex items-center gap-2">
                <div
                    {...attributes}
                    {...listeners}
                    className="cursor-grab active:cursor-grabbing flex-shrink-0"
                >
                    <GripVertical className="h-4 w-4 text-gray-400" />
                </div>

                {/* Rank number - mobile */}
                {isRanked && (
                    <div className="flex-shrink-0 w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center text-purple-800 font-medium text-xs">
                        {item.number}
                    </div>
                )}

                {/* Item image - mobile */}
                <div className="w-10 h-10 flex-shrink-0">
                    {image ? (
                        <img
                            src={image}
                            alt={name}
                            className="w-full h-full object-cover rounded"
                        />
                    ) : (
                        <div className="w-full h-full bg-gray-200 rounded flex items-center justify-center">
                            {listType === 'Album' ? (
                                <Disc className="h-5 w-5 text-gray-400" />
                            ) : (
                                <Music className="h-5 w-5 text-gray-400" />
                            )}
                        </div>
                    )}
                </div>

                {/* Item details - mobile */}
                <div className="flex-grow min-w-0">
                    <p className="font-medium text-gray-900 truncate text-sm leading-tight">{name}</p>
                    <p className="text-xs text-gray-500 truncate">{artist}</p>
                </div>

                {/* Remove button - mobile */}
                <button
                    onClick={() => onRemove(id)}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-gray-100 rounded-full flex-shrink-0"
                    title="Remove item"
                >
                    <Trash2 className="h-4 w-4" />
                </button>
            </div>

            {/* Desktop Layout - Keep original */}
            <div className="hidden sm:flex w-full p-3 items-center gap-2">
                <div
                    {...attributes}
                    {...listeners}
                    className="cursor-grab active:cursor-grabbing"
                >
                    <GripVertical className="h-6 w-6 text-gray-400" />
                </div>

                {/* Rank number */}
                {isRanked && (
                    <div className="flex-shrink-0 w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center text-purple-800 font-medium">
                        {item.number || 1}
                    </div>
                )}

                {/* Item image */}
                <div className="w-12 h-12 flex-shrink-0">
                    {image ? (
                        <img
                            src={image}
                            alt={name}
                            className="w-full h-full object-cover rounded"
                        />
                    ) : (
                        <div className="w-full h-full bg-gray-200 rounded flex items-center justify-center">
                            {listType === 'Album' ? (
                                <Disc className="h-6 w-6 text-gray-400" />
                            ) : (
                                <Music className="h-6 w-6 text-gray-400" />
                            )}
                        </div>
                    )}
                </div>

                {/* Item details */}
                <div className="flex-grow">
                    <p className="font-medium text-gray-900 truncate">{name}</p>
                    <p className="text-sm text-gray-500 truncate">{artist}</p>
                </div>

                {/* Remove button */}
                <button
                    onClick={() => onRemove(id)}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-gray-100 rounded-full"
                    title="Remove item"
                >
                    <Trash2 className="h-5 w-5" />
                </button>
            </div>
        </div>
    );
}

export default ListEditPage;