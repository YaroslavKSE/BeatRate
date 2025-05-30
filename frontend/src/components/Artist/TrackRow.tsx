import {TrackSummary} from "../../api/catalog.ts";
import {useState, useEffect} from "react";
import {Disc2, Pause, Play} from "lucide-react";
import {Link} from "react-router-dom";
import {formatDuration} from "../../utils/formatters.ts";

interface TrackRowProps {
    track: TrackSummary;
    index: number;
    isPlaying: boolean;
    onPlayClick: () => void;
    compact?: boolean;
}

const TrackRow = ({ track, index, isPlaying, onPlayClick, compact = false }: TrackRowProps) => {
    const [isHovered, setIsHovered] = useState(false);
    const [isMobile, setIsMobile] = useState(false);

    // Detect if device is mobile/touch device
    useEffect(() => {
        const checkIsMobile = () => {
            setIsMobile(window.innerWidth < 768 || 'ontouchstart' in window);
        };

        checkIsMobile();
        window.addEventListener('resize', checkIsMobile);

        return () => window.removeEventListener('resize', checkIsMobile);
    }, []);

    // Handle mouse events only on non-mobile devices
    const handleMouseEnter = () => {
        if (!isMobile) {
            setIsHovered(true);
        }
    };

    const handleMouseLeave = () => {
        if (!isMobile) {
            setIsHovered(false);
        }
    };

    // For mobile, show play button when playing OR when tapped/touched
    // For desktop, show on hover or when playing
    const shouldShowPlayButton = isMobile ? isPlaying : (isHovered || isPlaying);

    return (
        <div
            className={`flex items-center ${
                compact ? 'px-3 py-2 sm:px-6 sm:py-5' : 'px-6 py-5'
            } ${
                index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
            } hover:bg-gray-100`}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            {/* Track number or play button */}
            <div className={`${compact ? 'w-6 sm:w-8' : 'w-8'} flex-shrink-0 flex items-center justify-center ${compact ? 'mr-2' : 'mr-2'}`}>
                {shouldShowPlayButton ? (
                    <button
                        onClick={onPlayClick}
                        className="w-6 sm:w-8 h-6 sm:h-8 flex items-center justify-center text-primary-600"
                    >
                        {isPlaying ? (
                            <Pause className={`${compact ? 'h-3.5 w-3.5 sm:h-5 sm:w-5' : 'h-5 w-5'} fill-current sm:fill-none`} />
                        ) : (
                            <Play className={`${compact ? 'h-3.5 w-3.5 sm:h-5 sm:w-5' : 'h-5 w-5'} fill-current`} />
                        )}
                    </button>
                ) : isMobile ? (
                    // On mobile, show gray play button
                    <button
                        onClick={onPlayClick}
                        className="w-6 sm:w-8 h-6 sm:h-8 flex items-center justify-center text-gray-400 hover:text-gray-600"
                    >
                        <Play className={`${compact ? 'h-3.5 w-3.5 sm:h-5 sm:w-5' : 'h-5 w-5'} fill-current`} />
                    </button>
                ) : (
                    // On desktop, show track number
                    <span className={`text-gray-500 font-medium ${compact ? 'text-[0.800rem] sm:text-base' : 'text-base'}`}>
                        {index + 1}
                    </span>
                )}
            </div>

            {/* Track image */}
            <div className={`${compact ? 'w-12 h-12 sm:w-16 sm:h-16' : 'w-16 h-16'} flex-shrink-0 ${compact ? 'mr-3 sm:mr-4' : 'mr-4'}`}>
                <img
                    src={track.imageUrl || '/placeholder-album.jpg'}
                    alt={track.name}
                    className="w-full h-full object-cover shadow"
                />
            </div>

            {/* Track info */}
            <div className="flex-grow min-w-0">
                <Link to={`/track/${track.spotifyId}`} className="block">
                    <h4 className={`font-medium truncate flex items-center ${
                        isHovered ? 'text-primary-600' : 'text-gray-900'
                    } transition-colors duration-200 ${
                        compact ? 'text-sm sm:text-base' : 'text-base'
                    }`}>
                        {track.name}
                        {track.isExplicit && (
                            <span className={`ml-1 sm:ml-2 px-1 sm:px-1.5 py-0.5 text-gray-700 bg-gray-200 rounded ${
                                compact ? 'text-xs' : 'text-xs'
                            }`}>
                                E
                            </span>
                        )}
                    </h4>
                </Link>
                <p className={`text-gray-500 truncate mt-0.5 sm:mt-1 ${
                    compact ? 'text-xs sm:text-sm' : 'text-sm'
                }`}>
                    {track.artistName}
                </p>
            </div>

            {/* Track duration */}
            <div className={`${compact ? 'ml-2 sm:ml-4' : 'ml-4'} flex-shrink-0 flex items-center`}>
                <span className={`text-gray-500 ${compact ? 'mr-2 sm:mr-4' : 'mr-4'} ${
                    compact ? 'hidden sm:block sm:text-sm' : 'text-sm'
                }`}>
                    {formatDuration(track.durationMs)}
                </span>

                {/* Album button - redirects to album page instead of track page */}
                <Link
                    to={`/album/${track.albumId}`}
                    className="text-gray-400 hover:text-primary-600 focus:outline-none"
                    title="View Album"
                >
                    <Disc2 className={`${compact ? 'h-4 w-4 sm:h-6 sm:w-6' : 'h-6 w-6'}`} />
                </Link>
            </div>
        </div>
    );
};

export default TrackRow;