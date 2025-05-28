import {TrackSummary} from "../../api/catalog.ts";
import {formatDuration} from "../../utils/formatters.ts";
import {Disc2} from "lucide-react";
import { useState } from "react";

interface TrackRowProps {
    track: TrackSummary;
    index: number;
    compact?: boolean;
}

const TrackRow = ({ track, index, compact = false }: TrackRowProps) => {
    const [isHovered, setIsHovered] = useState(false);

    return (
        <div className={`flex items-center ${
            compact ? 'px-3 py-2 sm:px-6 sm:py-3' : 'px-3 py-3 sm:px-6 sm:py-5'
        } ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
            <div className={`flex-shrink-0 ${compact ? 'mr-3 sm:mr-6' : 'mr-3 sm:mr-6'}`}>
                <img
                    src={track.imageUrl || '/placeholder-album.jpg'}
                    alt={track.name}
                    className={`object-cover shadow ${
                        compact ? 'w-12 h-12 sm:w-16 sm:h-16' : 'w-12 h-12 sm:w-16 sm:h-16'
                    }`}
                />
            </div>
            <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                        <a
                            href={`/track/${track.spotifyId}`}
                            className="block"
                            onMouseEnter={() => setIsHovered(true)}
                            onMouseLeave={() => setIsHovered(false)}
                        >
                            <h4 className={`font-medium truncate flex items-center ${
                                isHovered ? 'text-primary-600' : 'text-gray-900'
                            } transition-colors duration-200 text-[0.800rem] sm:text-base`}>
                                {track.name}
                                {track.isExplicit && (
                                    <span className={`ml-1 sm:ml-2 px-1 sm:px-1.5 py-0.5 text-gray-700 bg-gray-200 rounded text-xs`}>
                                        E
                                    </span>
                                )}
                            </h4>
                            <p className={`text-gray-500 truncate mt-0.5 sm:mt-1 text-[0.700rem] sm:text-sm`}>
                                {track.artistName}
                            </p>
                        </a>
                    </div>
                    <div className={`flex-shrink-0 flex items-center ${compact ? 'ml-2 sm:ml-4' : 'ml-2 sm:ml-4'}`}>
                        <span className={`text-gray-500 ${
                            compact ? 'text-xs sm:text-sm' : 'text-xs sm:text-sm'
                        }`}>
                            {formatDuration(track.durationMs)}
                        </span>
                        <a
                            href={`/album/${track.albumId}`}
                            className={`text-gray-500 hover:text-primary-600 focus:outline-none ${
                                compact ? 'ml-2 sm:ml-4' : 'ml-2 sm:ml-4'
                            }`}
                            title="View Album"
                        >
                            <Disc2 className={compact ? 'h-4 w-4 sm:h-5 sm:w-5' : 'h-5 w-5 sm:h-6 sm:w-6'} />
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TrackRow;