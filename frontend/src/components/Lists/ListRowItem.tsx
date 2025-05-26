import React, { useState, useEffect } from 'react';
import { ListOverview, ListItem } from '../../api/lists';
import { Music, Disc, Trash2, AlertTriangle, Medal } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import CatalogService from '../../api/catalog';

interface ListRowItemProps {
    list: ListOverview;
    onDelete: (listId: string) => void;
    isPublic: boolean;
}

const ListRowItem: React.FC<ListRowItemProps> = ({ list, onDelete, isPublic = false }) => {
    const navigate = useNavigate();
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [itemImages, setItemImages] = useState<Record<string, string>>({});
    const [, setIsLoadingImages] = useState(false);

    // Fetch images for the preview items
    useEffect(() => {
        const fetchItemImages = async () => {
            if (list.previewItems.length === 0) return;

            setIsLoadingImages(true);

            try {
                // Extract the Spotify IDs from the preview items
                const itemIds = list.previewItems.map(item => item.spotifyId);

                // Fetch item details using the Spotify IDs
                const previewResponse = await CatalogService.getItemPreviewInfo(
                    itemIds,
                    [list.listType.toLowerCase()]
                );

                // Create a map of Spotify IDs to image URLs
                const newItemImages: Record<string, string> = {};

                previewResponse.results?.forEach(group => {
                    group.items?.forEach(item => {
                        if (item.imageUrl) {
                            newItemImages[item.spotifyId] = item.imageUrl;
                        }
                    });
                });

                setItemImages(newItemImages);
            } catch (error) {
                console.error('Error fetching item images:', error);
            } finally {
                setIsLoadingImages(false);
            }
        };

        fetchItemImages();
    }, [list.previewItems, list.listType]);

    // Handle row click to navigate to list detail
    const handleRowClick = () => {
        navigate(`/lists/${list.listId}`);
    };

    // Handle delete button click
    const handleDeleteClick = (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent row click
        setDeleteModalOpen(true);
    };

    const confirmDelete = async () => {
        try {
            onDelete(list.listId);
        } finally {
            setDeleteModalOpen(false);
        }
    };

    // Render an item with image if available, or a placeholder - mobile version
    const renderMobileItem = (item: ListItem, index: number) => {
        const hasImage = itemImages[item.spotifyId];

        return (
            <div
                key={`${item.spotifyId}-${index}`}
                className="w-13 h-13 relative rounded overflow-hidden"
                style={{
                    marginLeft: index > 0 ? '-6px' : '0',
                    zIndex: 5 - index,
                    boxShadow: index > 0 ? '-2px 0 4px rgba(0, 0, 0, 0.15)' : 'none',
                }}
            >
                {hasImage ? (
                    <img
                        src={itemImages[item.spotifyId]}
                        alt=""
                        className="h-full w-full object-cover"
                    />
                ) : (
                    <div className="bg-gray-200 h-full w-full flex items-center justify-center">
                        {list.listType === 'Album' ? (
                            <Disc className="h-8 w-8 text-gray-400" />
                        ) : (
                            <Music className="h-8 w-8 text-gray-400" />
                        )}
                    </div>
                )}
            </div>
        );
    };

    // Render an item with image if available, or a placeholder - desktop version (original)
    const renderDesktopItem = (item: ListItem, index: number) => {
        const hasImage = itemImages[item.spotifyId];

        return (
            <div
                key={`${item.spotifyId}-${index}`}
                className="w-24 h-24 relative rounded overflow-hidden"
                style={{
                    marginLeft: index > 0 ? '-30px' : '0',
                    zIndex: 5 - index,
                    boxShadow: index > 0 ? '-2px 0 4px rgba(0, 0, 0, 0.15)' : 'none',
                }}
            >
                {hasImage ? (
                    <img
                        src={itemImages[item.spotifyId]}
                        alt=""
                        className="h-full w-full object-cover"
                    />
                ) : (
                    <div className="bg-gray-200 h-full w-full flex items-center justify-center">
                        {list.listType === 'Album' ? (
                            <Disc className="h-10 w-10 text-gray-400" />
                        ) : (
                            <Music className="h-10 w-10 text-gray-400" />
                        )}
                    </div>
                )}
            </div>
        );
    };

    // Custom style for the trophy icon with only the outline colored
    const trophyStyle = {
        color: '#7a24ec', // This sets the stroke color
        fill: 'none'      // This ensures the fill is transparent
    };

    return (
        <>
            <div
                className="bg-white rounded-lg shadow hover:shadow-md transition-shadow duration-200 mb-4 sm:mb-6 overflow-hidden cursor-pointer"
                onClick={handleRowClick}
            >
                {/* Mobile Layout (sm and below) */}
                <div className="sm:hidden">
                    <div className="px-4 py-3">
                        {/* Header: List name + item count + ranked badge */}
                        <div className="flex items-start justify-between mb-2">
                            <div className="flex-1 min-w-0 mr-3">
                                <h3 className="text-l font-medium text-gray-900 truncate mb-1">{list.listName}</h3>
                                <div className="flex items-center text-[0.650rem] text-gray-500">
                                    <span className="mr-2">
                                        {list.totalItems} {list.totalItems === 1 ?
                                        (list.listType === 'Album' ? 'album' : 'track') :
                                        (list.listType === 'Album' ? 'albums' : 'tracks')}
                                    </span>
                                    {list.isRanked && (
                                        <div className="flex items-center">
                                            <Medal
                                                className="h-3 w-3 mr-1 inline"
                                                style={trophyStyle}
                                                strokeWidth={2}
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Delete button for mobile */}
                            {!isPublic && (
                                <button
                                    onClick={handleDeleteClick}
                                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-gray-100 rounded-full transition-colors flex-shrink-0"
                                    title="Delete list"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            )}
                        </div>

                        {/* Preview items - mobile version: overlapping, 5 in a row */}
                        <div className="mb-2">
                            {list.previewItems && list.previewItems.length > 0 ? (
                                <div className="flex">
                                    {list.previewItems.slice(0, 5).map((item, index) => (
                                        renderMobileItem(item, index)
                                    ))}
                                </div>
                            ) : (
                                <div className="w-16 h-16 bg-gray-100 rounded flex items-center justify-center">
                                    {list.listType === 'Album' ? (
                                        <Disc className="h-8 w-8 text-gray-400" />
                                    ) : (
                                        <Music className="h-8 w-8 text-gray-400" />
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Description - 2 lines max */}
                        {list.listDescription && (
                            <p className="text-[0.700rem] text-gray-500 line-clamp-2 leading-relaxed">
                                {list.listDescription}
                            </p>
                        )}
                    </div>
                </div>

                {/* Desktop Layout (sm and above) - Original layout */}
                <div className="hidden sm:block">
                    <div className="flex items-center p-5">
                        {/* Preview items visualization */}
                        <div className="flex mr-6 flex-shrink-0">
                            {list.previewItems && list.previewItems.length > 0 ? (
                                <div className="flex">
                                    {list.previewItems.slice(0, 5).map((item, index) => (
                                        renderDesktopItem(item, index)
                                    ))}
                                </div>
                            ) : (
                                <div className="w-24 h-24 bg-gray-100 rounded flex items-center justify-center">
                                    {list.listType === 'Album' ? (
                                        <Disc className="h-12 w-12 text-gray-400" />
                                    ) : (
                                        <Music className="h-12 w-12 text-gray-400" />
                                    )}
                                </div>
                            )}
                        </div>

                        {/* List details */}
                        <div className="flex-grow">
                            <h3 className="text-xl font-medium text-gray-900 mb-1">{list.listName}</h3>
                            <div className="flex items-center text-base text-gray-500 mb-1">
                                <span className="mr-3">
                                    {list.totalItems} {list.totalItems === 1 ?
                                    (list.listType === 'Album' ? 'album' : 'track') :
                                    (list.listType === 'Album' ? 'albums' : 'tracks')}
                                </span>
                                {list.isRanked && (
                                    <div className="flex items-center">
                                        <Medal
                                            className="h-5 w-5 mr-1 inline"
                                            style={trophyStyle}
                                            strokeWidth={2}
                                        />
                                        <span style={{ color: '#7a24ec' }}>Ranked</span>
                                    </div>
                                )}
                            </div>
                            {list.listDescription && (
                                <p className="text-sm text-gray-500 mt-2 line-clamp-2">{list.listDescription}</p>
                            )}
                        </div>

                        {/* Delete button - desktop */}
                        {!isPublic && (
                            <button
                                onClick={handleDeleteClick}
                                className="ml-auto p-3 text-gray-400 hover:text-red-500 hover:bg-gray-100 rounded-full transition-colors"
                                title="Delete list"
                            >
                                <Trash2 className="h-6 w-6" />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Delete Confirmation Modal - Similar to Diary page */}
            {deleteModalOpen && (
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
                                    <h3 className="text-lg font-bold text-gray-900">Delete List</h3>
                                </div>

                                <p className="mb-4">
                                    Are you sure you want to delete the list "{list.listName}"?
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
        </>
    );
};

export default ListRowItem;