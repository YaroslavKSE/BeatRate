import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Music, Disc, Heart, Star, MessageSquare, Scale, Trash2 } from 'lucide-react';
import { DiaryEntry } from './types';
import ComplexRatingModal from '../common/ComplexRatingModal.tsx';

interface DiaryEntryProps {
    entry: DiaryEntry;
    onReviewClick: (e: React.MouseEvent, entry: DiaryEntry) => void;
    onDeleteClick?: (e: React.MouseEvent, entry: DiaryEntry) => void;
}

const DiaryEntryComponent = ({ entry, onReviewClick, onDeleteClick }: DiaryEntryProps) => {
    const navigate = useNavigate();
    const [isHovered, setIsHovered] = useState(false);
    const [isComplexRatingModalOpen, setIsComplexRatingModalOpen] = useState(false);

    const handleItemClick = () => {
        navigate(`/interaction/${entry.interaction.aggregateId}`);
    };

    const handleAlbumClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!entry.catalogItem) return;

        if (entry.interaction.itemType === 'Album') {
            navigate(`/album/${entry.catalogItem.spotifyId}`);
        } else if (entry.interaction.itemType === 'Track') {
            navigate(`/track/${entry.catalogItem.spotifyId}`);
        }
    };

    const handleComplexRatingClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (entry.interaction.rating?.isComplex && entry.interaction.rating?.ratingId) {
            setIsComplexRatingModalOpen(true);
        }
    };

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onDeleteClick) {
            onDeleteClick(e, entry);
        }
    };

    return (
        <>
            <div
                className="p-3 sm:p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={handleItemClick}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            >
                {/* Mobile Layout (sm and below) */}
                <div className="sm:hidden">
                    {/* Top row: Image + Title/Artist + Time */}
                    <div className="flex items-start space-x-3">
                        {/* Item image */}
                        <div className="flex-shrink-0 h-12 w-12 bg-gray-200 rounded-md overflow-hidden">
                            {entry.catalogItem?.imageUrl ? (
                                <img
                                    src={entry.catalogItem.imageUrl}
                                    alt={entry.catalogItem.name}
                                    className="h-full w-full object-cover"
                                />
                            ) : (
                                <div className="h-full w-full flex items-center justify-center bg-gray-200">
                                    {entry.interaction.itemType === 'Album' ? (
                                        <Disc className="h-6 w-6 text-gray-400" />
                                    ) : (
                                        <Music className="h-6 w-6 text-gray-400" />
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Content container */}
                        <div className="flex-1 min-w-0 flex flex-col">
                            {/* Title and type */}
                            <div className="flex items-center space-x-2">
                                <h3 className="text-sm font-medium text-gray-900 truncate">
                                    {entry.catalogItem?.name || 'Unknown Title'}
                                </h3>
                                <span className="px-1.5 py-0.5 text-[0.600rem] font-medium rounded bg-gray-100 text-gray-800">
                    {entry.interaction.itemType === 'Album' ? 'Album' : 'Track'}
                </span>
                            </div>

                            {/* Rating + Like + Review */}
                            <div className="mt-2 flex items-center justify-start space-x-2">
                                {/* Rating stars */}
                                <div className="flex">
                                    {[1, 2, 3, 4, 5].map((star) => {
                                        if (!entry.interaction.rating) {
                                            return <Star key={star} className="h-4 w-4 text-gray-300" fill="none" />;
                                        }

                                        const ratingInStars = entry.interaction.rating.normalizedGrade / 2;
                                        const isFilled = star <= Math.floor(ratingInStars);
                                        const isHalf = !isFilled && star === Math.ceil(ratingInStars) && !Number.isInteger(ratingInStars);

                                        return (
                                            <div key={star} className="relative">
                                                <Star
                                                    className={`h-4 w-4 ${isFilled || isHalf ? 'text-yellow-400' : 'text-gray-300'}`}
                                                    fill={isFilled ? 'currentColor' : 'none'}
                                                />
                                                {isHalf && (
                                                    <div className="absolute inset-0 overflow-hidden w-1/2">
                                                        <Star className="h-4 w-4 text-yellow-400" fill="currentColor" />
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Complex rating indicator */}
                                {entry.interaction.rating?.isComplex && (
                                    <Scale
                                        className="h-3.5 w-3.5 text-primary-500 cursor-pointer hover:text-primary-700"
                                        onClick={handleComplexRatingClick}
                                    />
                                )}

                                {/* Like & Review */}
                                {entry.interaction.isLiked && (
                                    <Heart className="h-4 w-4 text-red-500 fill-red-500" />
                                )}

                                {entry.interaction.review && (
                                    <MessageSquare
                                        className="h-4 w-4 text-primary-600 cursor-pointer hover:text-primary-800"
                                        onClick={(e) => onReviewClick(e, entry)}
                                    />
                                )}
                            </div>
                        </div>

                        {/* Time + Actions */}
                        <div className="flex flex-col items-end justify-between h-full space-y-1 ml-1 mt-0.5">
                            <div className="text-xs text-gray-500">
                                {new Date(entry.interaction.createdAt).toLocaleTimeString('en-US', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    hour12: true
                                })}
                            </div>

                            <div className="flex space-x-2">
                                <button
                                    onClick={handleAlbumClick}
                                    className="p-1 text-gray-400 hover:text-primary-600 rounded-full hover:bg-gray-100"
                                    title="Go to album"
                                >
                                    <Disc className="h-4 w-4" />
                                </button>

                                {!entry.isPublic && onDeleteClick && (
                                    <button
                                        onClick={handleDelete}
                                        className="p-1 text-gray-400 hover:text-red-500 rounded-full hover:bg-gray-100"
                                        title="Delete this entry"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Desktop Layout (sm and above) - Original layout */}
                <div className="hidden sm:flex items-center">
                    {/* Item image */}
                    <div className="flex-shrink-0 h-16 w-16 bg-gray-200 rounded-md overflow-hidden mr-4">
                        {entry.catalogItem?.imageUrl ? (
                            <img
                                src={entry.catalogItem.imageUrl}
                                alt={entry.catalogItem.name}
                                className="h-full w-full object-cover"
                            />
                        ) : (
                            <div className="h-full w-full flex items-center justify-center bg-gray-200">
                                {entry.interaction.itemType === 'Album' ? (
                                    <Disc className="h-8 w-8 text-gray-400" />
                                ) : (
                                    <Music className="h-8 w-8 text-gray-400" />
                                )}
                            </div>
                        )}
                    </div>

                    {/* Item details */}
                    <div className="flex-grow min-w-0">
                        <div className="flex items-center">
                            <h3 className="text-base font-medium text-gray-900 truncate">
                                {entry.catalogItem?.name || 'Unknown Title'}
                            </h3>
                            <span className="ml-2 px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
                                {entry.interaction.itemType}
                            </span>
                        </div>
                        <p className="text-sm text-gray-500 truncate">
                            {entry.catalogItem?.artistName || 'Unknown Artist'}
                        </p>
                        <div className="mt-1 text-xs text-gray-500">
                            {new Date(entry.interaction.createdAt).toLocaleTimeString('en-US', {
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: true
                            })}
                        </div>
                    </div>

                    {/* ItemHistory indicators */}
                    <div className="flex items-center space-x-4 ml-4">
                        {/* Rating stars */}
                        <div className="flex items-center">
                            <div className="flex">
                                {[1, 2, 3, 4, 5].map((star) => {
                                    if (!entry.interaction.rating) {
                                        return (
                                            <div key={star} className="relative">
                                                <Star className="h-5 w-5 text-gray-300" fill="none" />
                                            </div>
                                        );
                                    }

                                    const ratingInStars = entry.interaction.rating.normalizedGrade / 2;
                                    const isFilled = star <= Math.floor(ratingInStars);
                                    const isHalf = !isFilled && star === Math.ceil(ratingInStars) && !Number.isInteger(ratingInStars);

                                    return (
                                        <div key={star} className="relative">
                                            <Star
                                                className={`h-5 w-5 ${isFilled || isHalf ? 'text-yellow-400' : 'text-gray-300'}`}
                                                fill={isFilled ? 'currentColor' : 'none'}
                                            />
                                            {isHalf && (
                                                <div className="absolute inset-0 overflow-hidden w-1/2">
                                                    <Star className="h-5 w-5 text-yellow-400" fill='currentColor' />
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                            {entry.interaction.rating?.isComplex ? (
                                <Scale
                                    className="ml-1 h-4 w-4 text-primary-500 visible cursor-pointer hover:text-primary-700"
                                    onClick={handleComplexRatingClick}
                                />
                            ) : (
                                <Scale className="ml-1 h-4 w-4 invisible" />
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
                            <MessageSquare
                                className="h-5 w-5 text-primary-600 cursor-pointer hover:text-primary-800"
                                onClick={(e) => onReviewClick(e, entry)}
                            />
                        ) : (
                            <MessageSquare className="h-5 w-5 text-gray-300" />
                        )}
                    </div>
                    {/* Album navigation icon */}
                    <button
                        onClick={handleAlbumClick}
                        className={`ml-4 p-2 text-gray-500 hover:text-primary-600 hover:bg-gray-100 rounded-full ${isHovered ? 'visible' : 'invisible'}`}
                        title={`Go to ${entry.interaction.itemType === 'Album' ? 'album' : 'track\'s album'}`}
                    >
                        <Disc className="h-5 w-5" />
                    </button>

                    {/* Delete button */}
                    {!entry.isPublic && onDeleteClick && (
                        <button
                            onClick={handleDelete}
                            className={`ml-2 p-2 text-gray-400 hover:text-red-500 hover:bg-gray-100 rounded-full transition-colors ${isHovered ? 'visible' : 'invisible'}`}
                            title="Delete this entry"
                        >
                            <Trash2 className="h-5 w-5" />
                        </button>
                    )}
                </div>
            </div>

            {/* Complex Rating Modal */}
            {entry.interaction.rating?.isComplex && (
                <ComplexRatingModal
                    isOpen={isComplexRatingModalOpen}
                    onClose={() => setIsComplexRatingModalOpen(false)}
                    ratingId={entry.interaction.rating.ratingId}
                    itemName={entry.catalogItem?.name || 'Unknown Title'}
                    artistName={entry.catalogItem?.artistName || 'Unknown Artist'}
                    date={new Date(entry.interaction.createdAt).toLocaleString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    })}
                />
            )}
        </>
    );
};

export default DiaryEntryComponent;