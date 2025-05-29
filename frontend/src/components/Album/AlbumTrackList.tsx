// Optimized AlbumTrackList component for mobile view
import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Play, Pause, Star, Loader } from 'lucide-react';
import { TrackSummary } from '../../api/catalog';
import AudioVisualizer from './AudioVisualizer';

interface AlbumTrackListProps {
    tracks: TrackSummary[];
    playingTrack: string | null;
    hoveredTrack: string | null;
    handlePreviewToggle: (track: TrackSummary) => Promise<void>;
    handleTrackInteraction: (track: TrackSummary) => void;
    setHoveredTrack: (trackId: string | null) => void;
    tracksTotal: number;
    tracksOffset: number;
    loadingMoreTracks: boolean;
    onLoadMore: () => void;
}

const AlbumTrackList = ({
    tracks,
    playingTrack,
    hoveredTrack,
    handlePreviewToggle,
    handleTrackInteraction,
    setHoveredTrack,
    tracksTotal,
    tracksOffset,
    loadingMoreTracks,
    onLoadMore
}: AlbumTrackListProps) => {
    const listEndRef = useRef<HTMLDivElement>(null);
    const observerRef = useRef<IntersectionObserver | null>(null);

    // Set up intersection observer for infinite scrolling
    useEffect(() => {
        const hasMoreTracks = tracksOffset < tracksTotal;

        if (!hasMoreTracks || loadingMoreTracks) {
            return;
        }

        // Clean up previous observer
        if (observerRef.current) {
            observerRef.current.disconnect();
        }

        // Create new intersection observer
        observerRef.current = new IntersectionObserver(
            (entries) => {
                const [entry] = entries;
                if (entry.isIntersecting && !loadingMoreTracks) {
                    onLoadMore();
                }
            },
            { threshold: 0.5 } // Trigger when element is 50% visible
        );

        // Start observing the end of the list
        if (listEndRef.current) {
            observerRef.current.observe(listEndRef.current);
        }

        return () => {
            if (observerRef.current) {
                observerRef.current.disconnect();
            }
        };
    }, [tracksOffset, tracksTotal, loadingMoreTracks, onLoadMore]);

    return (
        <div className="divide-y divide-gray-200">
            {tracks.map((track, index) => (
                <div
                    key={track.spotifyId}
                    className={`flex items-center py-2.5 sm:py-3 px-3 sm:px-6 hover:bg-gray-50 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                    onMouseEnter={() => setHoveredTrack(track.spotifyId)}
                    onMouseLeave={() => setHoveredTrack(null)}
                >
                    <div
                        className="w-5 sm:w-8 text-center relative flex-shrink-0"
                    >
                        {/* Playing animation when track is playing but not hovered */}
                        {playingTrack === track.spotifyId && hoveredTrack !== track.spotifyId ? (
                            <AudioVisualizer/>
                        ) : hoveredTrack === track.spotifyId ? (
                            <button
                                onClick={() => handlePreviewToggle(track)}
                                className="absolute inset-0 flex items-center justify-center text-primary-600 hover:text-primary-800"
                                title={playingTrack === track.spotifyId ? "Stop preview" : "Play preview"}
                            >
                                {playingTrack === track.spotifyId ? (
                                    <Pause className="h-4 w-4 sm:h-5 sm:w-5 fill-current" />
                                ) : (
                                    <Play className="h-4 w-4 sm:h-5 sm:w-5 fill-current" />
                                )}
                            </button>
                        ) : (
                            <span className="text-sm sm:text-base text-gray-500 font-medium">
                                {track.trackNumber || index + 1}
                            </span>
                        )}
                    </div>

                    <div className="flex-grow min-w-0 ml-3">
                        <div className="flex items-center">
                            <Link
                                to={`/track/${track.spotifyId}`}
                                className="text-gray-900 font-medium hover:text-primary-600 truncate flex items-center text-sm sm:text-base"
                            >
                                {track.name}
                            </Link>

                            {track.isExplicit && (
                                <span className="ml-2 px-1 py-0.5 text-[0.600rem] sm:text-xs bg-gray-200 text-gray-700 rounded">
                                    E
                                </span>
                            )}
                        </div>

                        <div className="text-xs sm:text-sm text-gray-500 truncate">
                            {track.artistName}
                        </div>
                    </div>

                    <div className="ml-auto flex items-center">
                        {/* Duration removed for mobile view */}
                        <span className="text-xs text-gray-500 mr-4 hidden sm:inline">
                            {/* formatDuration(track.durationMs) */}
                        </span>

                        <button
                            onClick={() => handleTrackInteraction(track)}
                            className="text-gray-400 hover:text-primary-600 focus:outline-none"
                            aria-label="Rate track"
                        >
                            <Star className="h-4 w-4 sm:h-5 sm:w-5" />
                        </button>
                    </div>
                </div>
            ))}

            {/* Loading indicator and observer target */}
            <div
                ref={listEndRef}
                className={`py-4 flex justify-center items-center ${loadingMoreTracks ? 'opacity-100' : 'opacity-0'} ${tracksOffset >= tracksTotal ? 'hidden' : ''}`}
            >
                {loadingMoreTracks && (
                    <div className="flex items-center justify-center">
                        <Loader className="h-5 w-5 text-primary-600 animate-spin mr-2" />
                        <span className="text-gray-600 text-sm">Loading more tracks...</span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AlbumTrackList;