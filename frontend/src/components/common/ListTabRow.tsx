import React, { useState, useEffect } from 'react';
import { ListOverview } from '../../api/lists';
import { Music, Disc, Medal } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import CatalogService from '../../api/catalog';

interface ListsTabRowProps {
    list: ListOverview;
    userAvatar?: string;
    userName: string;
    userSurname?: string;
    userId: string;
}

const ListsTabRow: React.FC<ListsTabRowProps> = ({ list, userAvatar, userName, userSurname, userId }) => {
    const navigate = useNavigate();
    const [itemImages, setItemImages] = useState<Record<string, string>>({});

    // Fetch images for the list items when component mounts
    useEffect(() => {
        const fetchItemImages = async () => {
            if (list.previewItems.length === 0) return;

            try {
                const itemIds = list.previewItems.map(item => item.spotifyId);
                const previewResponse = await CatalogService.getItemPreviewInfo(
                    itemIds,
                    [list.listType.toLowerCase()]
                );

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
            }
        };

        fetchItemImages();
    }, [list.previewItems, list.listType]);

    // Handle row click to navigate to list detail
    const handleRowClick = () => {
        navigate(`/lists/${list.listId}`);
    };

    const trophyStyle = {
        color: '#7a24ec',
        fill: 'none'
    };

    return (
        <div
            className="bg-white rounded-lg shadow hover:shadow-md transition-shadow duration-200 mb-4 sm:mb-6 overflow-hidden cursor-pointer"
            onClick={handleRowClick}
        >
            {/* Mobile Layout */}
            <div className="sm:hidden">
                <div className="px-4 py-3">
                    {/* Header: List name + User info */}
                    <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0 mr-3">
                            <h3 className="text-base font-medium text-gray-900 truncate mb-1">{list.listName}</h3>
                            <div className="flex items-center text-xs text-gray-500">
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
                                        <span style={{ color: '#7a24ec' }}>Ranked</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* User info */}
                        <div className="flex-shrink-0 mt-2">
                            <Link to={`/people/${userId}`} className="flex items-center">
                                {userAvatar ? (
                                    <img
                                        src={userAvatar}
                                        alt={`${userName} ${userSurname}`}
                                        className="h-6 w-6 rounded-full object-cover mr-1"
                                    />
                                ) : (
                                    <div className="h-6 w-6 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-xs font-bold mr-1">
                                        {userName.charAt(0).toUpperCase()}{userSurname?.charAt(0).toUpperCase()}
                                    </div>
                                )}
                                <span className="text-xs font-medium text-gray-700">
                                    {userName}
                                </span>
                            </Link>
                        </div>
                    </div>

                    {/* Preview items - mobile version: overlapping, 5 in a row */}
                    <div className="mb-2">
                        {list.previewItems && list.previewItems.length > 0 ? (
                            <div className="flex">
                                {list.previewItems.slice(0, 5).map((item, index) => (
                                    <div
                                        key={`${item.spotifyId}-${index}`}
                                        className="w-16 h-16 relative rounded overflow-hidden"
                                        style={{
                                            marginLeft: index > 0 ? '-6px' : '0',
                                            zIndex: 5 - index,
                                            boxShadow: index > 0 ? '-2px 0 4px rgba(0, 0, 0, 0.15)' : 'none',
                                        }}
                                    >
                                        {itemImages[item.spotifyId] ? (
                                            <img
                                                src={itemImages[item.spotifyId]}
                                                alt=""
                                                className="h-full w-full object-cover"
                                            />
                                        ) : (
                                            <div className="bg-gray-200 h-full w-full flex items-center justify-center">
                                                {list.listType === 'Album' ? (
                                                    <Disc className="h-6 w-6 text-gray-400" />
                                                ) : (
                                                    <Music className="h-6 w-6 text-gray-400" />
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center">
                                {list.listType === 'Album' ? (
                                    <Disc className="h-6 w-6 text-gray-400" />
                                ) : (
                                    <Music className="h-6 w-6 text-gray-400" />
                                )}
                            </div>
                        )}
                    </div>

                    {/* Description - 2 lines max */}
                    {list.listDescription && (
                        <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
                            {list.listDescription}
                        </p>
                    )}
                </div>
            </div>

            {/* Desktop Layout (original) */}
            <div className="hidden sm:block">
                <div className="flex items-center p-5">
                    {/* Preview items visualization */}
                    <div className="flex mr-6 flex-shrink-0">
                        {list.previewItems && list.previewItems.length > 0 ? (
                            <div className="flex">
                                {list.previewItems.slice(0, 5).map((item, index) => (
                                    <div
                                        key={`${item.spotifyId}-${index}`}
                                        className="w-24 h-24 relative rounded overflow-hidden"
                                        style={{
                                            marginLeft: index > 0 ? '-30px' : '0',
                                            zIndex: 5 - index,
                                            boxShadow: index > 0 ? '-2px 0 4px rgba(0, 0, 0, 0.15)' : 'none',
                                        }}
                                    >
                                        {itemImages[item.spotifyId] ? (
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
                        {/* User info */}
                        <div className="flex items-center mb-2 group">
                            <Link to={`/people/${userId}`} className="flex items-center">
                                {userAvatar ? (
                                    <img
                                        src={userAvatar}
                                        alt={`${userName} ${userSurname}`}
                                        className="h-8 w-8 rounded-full object-cover mr-2"
                                    />
                                ) : (
                                    <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-sm font-bold mr-2">
                                        {userName.charAt(0).toUpperCase()}{userSurname?.charAt(0).toUpperCase()}
                                    </div>
                                )}
                                <span className="text-sm font-medium text-gray-700 group-hover:text-primary-600">
                                    {userName} {userSurname}
                                </span>
                            </Link>
                        </div>

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
                </div>
            </div>
        </div>
    );
};

export default ListsTabRow;