import React from 'react';
import { ChevronRight } from 'lucide-react';
import TrackRow from './TrackRow';
import LoadMoreButton from './LoadMoreButton';
import { TrackSummary } from '../../api/catalog';

interface TrackResultsProps {
    tracks: TrackSummary[];
    totalCount: number;
    isLoading: boolean;
    isLoadingMore: boolean;
    compact?: boolean;
    onLoadMore: (e: React.MouseEvent) => void;
    onShowMore?: () => void;
}

const TrackResults: React.FC<TrackResultsProps> = ({
                                                       tracks,
                                                       totalCount,
                                                       isLoading,
                                                       isLoadingMore,
                                                       compact = false,
                                                       onLoadMore,
                                                       onShowMore
                                                   }) => {
    if (isLoading && tracks.length === 0) {
        return (
            <div className="animate-pulse bg-white rounded-lg shadow overflow-hidden">
                <div className="space-y-1 sm:space-y-4">
                    {[...Array(compact ? 5 : 10)].map((_, i) => (
                        <div key={i} className="flex items-center px-3 py-2 sm:px-6 sm:py-4">
                            <div className="w-8 h-8 sm:w-12 sm:h-12 bg-gray-200 mr-2 sm:mr-4 rounded"></div>
                            <div className="flex-1">
                                <div className="h-3 sm:h-4 bg-gray-200 rounded w-3/4 mb-1 sm:mb-2"></div>
                                <div className="h-2 sm:h-3 bg-gray-200 rounded w-1/2"></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (!isLoading && tracks.length === 0) {
        return null;
    }

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg sm:text-xl font-bold">Tracks</h2>
                {compact && onShowMore && totalCount > tracks.length && (
                    <button
                        type="button"
                        onClick={onShowMore}
                        className="text-primary-600 hover:text-primary-800 flex items-center text-sm font-medium"
                    >
                        View all <ChevronRight className="h-4 w-4 ml-1" />
                    </button>
                )}
            </div>

            <div className="bg-white rounded-lg shadow overflow-hidden">
                {tracks.map((track, index) => (
                    <TrackRow key={track.spotifyId} track={track} index={index} compact={compact} />
                ))}
            </div>

            {!compact && tracks.length < totalCount && (
                <LoadMoreButton
                    isLoading={isLoadingMore}
                    onClick={onLoadMore}
                    currentCount={tracks.length}
                    totalCount={totalCount}
                />
            )}
        </div>
    );
};

export default TrackResults;