import React from 'react';
import { ChevronRight } from 'lucide-react';
import ArtistCard from './ArtistCard';
import LoadMoreButton from './LoadMoreButton';
import { ArtistSummary } from '../../api/catalog';

interface ArtistResultsProps {
    artists: ArtistSummary[];
    totalCount: number;
    isLoading: boolean;
    isLoadingMore: boolean;
    compact?: boolean;
    onLoadMore: (e: React.MouseEvent) => void;
    onShowMore?: () => void;
}

const ArtistResults: React.FC<ArtistResultsProps> = ({
                                                         artists,
                                                         totalCount,
                                                         isLoading,
                                                         isLoadingMore,
                                                         compact = false,
                                                         onLoadMore,
                                                         onShowMore
                                                     }) => {
    if (isLoading && artists.length === 0) {
        return (
            <div className="animate-pulse">
                {/* Mobile skeleton */}
                <div className="sm:hidden">
                    <div className="flex space-x-3 overflow-x-hidden px-1">
                        {[...Array(3)].map((_, i) => (
                            <div key={i} className="flex-none w-32">
                                <div className="aspect-square bg-gray-200 w-full rounded-full mx-auto p-2"></div>
                                <div className="p-2 text-center">
                                    <div className="h-3 bg-gray-200 rounded w-3/4 mx-auto mb-1"></div>
                                    <div className="h-2 bg-gray-200 rounded w-1/2 mx-auto"></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Desktop skeleton */}
                <div className="hidden sm:grid sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {[...Array(compact ? 5 : 10)].map((_, i) => (
                        <div key={i} className="bg-white rounded-lg shadow overflow-hidden">
                            <div className="aspect-square bg-gray-200 w-full rounded-full mx-auto p-2"></div>
                            <div className="p-3 text-center">
                                <div className="h-4 bg-gray-200 rounded w-3/4 mx-auto mb-2"></div>
                                <div className="h-3 bg-gray-200 rounded w-1/2 mx-auto"></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (!isLoading && artists.length === 0) {
        return null;
    }

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg sm:text-xl font-bold">Artists</h2>
                {compact && onShowMore && totalCount > artists.length && (
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
                        {artists.map((artist) => (
                            <div key={artist.spotifyId} className="flex-none w-32">
                                <ArtistCard artist={artist} mobile={true} compact={compact} />
                            </div>
                        ))}
                    </div>
                ) : (
                    /* Grid layout for dedicated Artists tab */
                    <div className="grid grid-cols-2 gap-3">
                        {artists.map((artist) => (
                            <ArtistCard key={artist.spotifyId} artist={artist} mobile={true} compact={compact} />
                        ))}
                    </div>
                )}
            </div>

            {/* Desktop Layout - Grid */}
            <div className="hidden sm:grid sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {artists.map((artist) => (
                    <ArtistCard key={artist.spotifyId} artist={artist} mobile={false} compact={compact} />
                ))}
            </div>

            {!compact && artists.length < totalCount && (
                <LoadMoreButton
                    isLoading={isLoadingMore}
                    onClick={onLoadMore}
                    currentCount={artists.length}
                    totalCount={totalCount}
                />
            )}
        </div>
    );
};

export default ArtistResults;