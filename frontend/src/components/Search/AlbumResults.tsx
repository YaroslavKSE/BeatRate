import React from 'react';
import { ChevronRight } from 'lucide-react';
import AlbumCard from './AlbumCard';
import LoadMoreButton from './LoadMoreButton';
import { AlbumSummary } from '../../api/catalog';

interface AlbumResultsProps {
    albums: AlbumSummary[];
    totalCount: number;
    isLoading: boolean;
    isLoadingMore: boolean;
    compact?: boolean;
    onLoadMore: (e: React.MouseEvent) => void;
    onShowMore?: () => void;
}

const AlbumResults: React.FC<AlbumResultsProps> = ({
                                                       albums,
                                                       totalCount,
                                                       isLoading,
                                                       isLoadingMore,
                                                       compact = false,
                                                       onLoadMore,
                                                       onShowMore
                                                   }) => {
    if (isLoading && albums.length === 0) {
        return (
            <div className="animate-pulse">
                {/* Mobile skeleton */}
                <div className="sm:hidden">
                    <div className="flex space-x-3 overflow-x-hidden px-1">
                        {[...Array(3)].map((_, i) => (
                            <div key={i} className="flex-none w-32">
                                <div className="bg-gray-200 aspect-square w-full rounded-lg"></div>
                                <div className="p-2">
                                    <div className="h-3 bg-gray-200 rounded w-3/4 mb-1"></div>
                                    <div className="h-2 bg-gray-200 rounded w-1/2"></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Desktop skeleton */}
                <div className="hidden sm:grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    {[...Array(compact ? 5 : 10)].map((_, i) => (
                        <div key={i} className="bg-white rounded-lg shadow overflow-hidden">
                            <div className="bg-gray-200 aspect-square w-full"></div>
                            <div className="p-3">
                                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (!isLoading && albums.length === 0) {
        return null;
    }

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg sm:text-xl font-bold">Albums</h2>
                {compact && onShowMore && totalCount > albums.length && (
                    <button
                        type="button"
                        onClick={onShowMore}
                        className="text-primary-600 hover:text-primary-800 flex items-center text-sm font-medium"
                    >
                        View all <ChevronRight className="h-4 w-4 ml-1" />
                    </button>
                )}
            </div>

            {/* Mobile Layout - Conditional rendering */}
            <div className="sm:hidden">
                {compact ? (
                    /* Horizontal scrolling for "All Results" */
                    <div className="flex space-x-3 overflow-x-auto pb-2 px-1">
                        {albums.map((album) => (
                            <div key={album.spotifyId} className="flex-none w-32">
                                <AlbumCard album={album} mobile={true} compact={compact} />
                            </div>
                        ))}
                    </div>
                ) : (
                    /* Grid layout for dedicated Albums tab */
                    <div className="grid grid-cols-2 gap-3">
                        {albums.map((album) => (
                            <AlbumCard key={album.spotifyId} album={album} mobile={true} compact={compact} />
                        ))}
                    </div>
                )}
            </div>

            {/* Desktop Layout - Grid */}
            <div className="hidden sm:grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {albums.map((album) => (
                    <AlbumCard key={album.spotifyId} album={album} mobile={false} compact={compact} />
                ))}
            </div>

            {!compact && albums.length < totalCount && (
                <LoadMoreButton
                    isLoading={isLoadingMore}
                    onClick={onLoadMore}
                    currentCount={albums.length}
                    totalCount={totalCount}
                />
            )}
        </div>
    );
};

export default AlbumResults;