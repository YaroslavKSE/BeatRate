import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Star, Share, Disc, Calendar, ListMusic } from 'lucide-react';
import { AlbumDetail } from '../../api/catalog';
import { formatDate } from '../../utils/formatters';
import ItemStatsComponent from '../common/ItemStatsComponent';
import LatestInteractionComponent from '../common/LatestInteractionComponent';
import AddToListModal from '../Lists/AddToListModal';

interface AlbumHeaderProps {
    album: AlbumDetail;
    handleAlbumInteraction: () => void;
    refreshTrigger?: number;
}

const AlbumHeader = ({
                         album,
                         handleAlbumInteraction,
                         refreshTrigger = 0
                     }: AlbumHeaderProps) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isAddToListModalOpen, setIsAddToListModalOpen] = useState(false);

    // Determine if title is likely to be too long (roughly more than one line)
    const isTitleLong = album.name.length > 40;

    return (
        <>
            {/* Mobile Layout */}
            <div className="flex flex-col items-center md:hidden mb-3">
                {/* Album Artwork - Smaller and centered */}
                <div className="w-64 flex-shrink-0 mb-2">
                    <div className="aspect-square w-full shadow-md rounded-lg overflow-hidden">
                        <img
                            src={album.imageUrl || '/placeholder-album.jpg'}
                            alt={album.name}
                            className="w-full h-full object-cover"
                        />
                    </div>
                </div>

                {/* Album Info - Centered */}
                <div className="text-center mb-2 px-1">
                    {/* Album Name */}
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 line-clamp-3">{album.name}</h1>
                    </div>

                    {/* Artist */}
                    <div className="mb-1">
                        <Link
                            to={`/artist/${album.artists[0]?.spotifyId || '#'}`}
                            className="text-xl font-medium text-primary-600 hover:underline"
                        >
                            {album.artistName}
                        </Link>
                    </div>

                    {/* Date • Length • Type */}
                    <div className="flex items-center justify-center text-[0.750rem] text-gray-600 space-x-2">
                        {album.releaseDate && (
                            <>
                                <span>{formatDate(album.releaseDate)}</span>
                                <span>•</span>
                            </>
                        )}
                        {album.totalTracks && (
                            <>
                                <span>{album.totalTracks} tracks</span>
                                <span>•</span>
                            </>
                        )}
                        <span>{album.albumType === 'album' ? 'Album' : album.albumType}</span>
                    </div>

                    {/* Spotify Link */}
                    {album.externalUrls && album.externalUrls.length > 0 && (
                        <div className="mt-2">
                            <a
                                href={`https://open.spotify.com/album/${album.spotifyId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center text-[0.800rem] text-gray-600 hover:text-primary-600"
                            >
                                <svg
                                    className="h-5 w-5 mr-1"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                >
                                    <circle cx="12" cy="12" r="12" fill="#1DB954" />
                                    <path
                                        d="M17.9 10.9C14.7 9 9.35 8.8 6.3 9.75C5.8 9.9 5.3 9.6 5.15 9.15C5 8.65 5.3 8.15 5.75 8C9.3 6.95 15.15 7.15 18.85 9.35C19.3 9.6 19.45 10.2 19.2 10.65C18.95 11 18.35 11.15 17.9 10.9ZM17.8 13.9C17.55 14.25 17.1 14.35 16.75 14.1C14.05 12.45 9.95 11.9 6.8 12.85C6.4 12.95 5.95 12.75 5.85 12.35C5.75 11.95 5.95 11.5 6.35 11.4C10 10.35 14.5 10.95 17.6 12.85C17.9 13 18.05 13.5 17.8 13.9ZM16.6 16.8C16.4 17.1 16.05 17.2 15.75 17C13.4 15.55 10.45 15.3 6.95 16.1C6.6 16.2 6.3 15.95 6.2 15.65C6.1 15.3 6.35 15 6.65 14.9C10.45 14.1 13.75 14.35 16.35 16C16.7 16.15 16.75 16.5 16.6 16.8Z"
                                        fill="white"
                                    />
                                </svg>
                                Listen on Spotify
                            </a>
                        </div>
                    )}
                </div>

                {/* Action Buttons - Single Row */}
                <div className="flex space-x-3 mb-3 w-full">
                    <button
                        onClick={handleAlbumInteraction}
                        className="flex-1 flex items-center justify-center py-2 px-4 border border-transparent text-[0.800rem] font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none"
                    >
                        <Star className="h-3.5 w-3.5 mr-2" />
                        Rate Album
                    </button>

                    <button
                        className="flex-1 flex items-center justify-center py-2 px-4 border border-gray-300 text-[0.800rem] font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
                        onClick={() => setIsAddToListModalOpen(true)}
                    >
                        <ListMusic className="h-3.5 w-3.5 mr-2" />
                        Add to List
                    </button>
                </div>

                {/* Stats and Latest Interaction */}
                <div className="w-full space-y-4">
                    <div className="flex justify-center items-center w-full">
                        <div className="transform scale-110 origin-center">
                            <ItemStatsComponent itemId={album.spotifyId}/>
                        </div>
                    </div>

                    <div className="transform origin-center">
                        <LatestInteractionComponent
                            itemId={album.spotifyId}
                            itemType="Album"
                            onCreateInteraction={handleAlbumInteraction}
                            refreshTrigger={refreshTrigger}
                        />
                    </div>
                </div>
            </div>

            {/* Desktop Layout - Original */}
            <div className="hidden md:flex flex-col md:flex-row gap-8 mb-8">
                {/* Album Artwork */}
                <div className="w-full md:w-64 flex-shrink-0">
                    <div className="aspect-square w-full shadow-md rounded-lg overflow-hidden">
                        <img
                            src={album.imageUrl || '/placeholder-album.jpg'}
                            alt={album.name}
                            className="w-full h-full object-cover"
                        />
                    </div>

                    {/* Primary Album Action Button */}
                    <div className="mt-4">
                        <button
                            onClick={handleAlbumInteraction}
                            className="w-full flex items-center justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none"
                        >
                            <Star className="h-4 w-4 mr-2" />
                            Rate Album
                        </button>
                    </div>

                    <div className="mt-3 flex justify-between space-x-2">
                        <button
                            className="flex-1 flex items-center justify-center py-2 px-4 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
                            onClick={() => setIsAddToListModalOpen(true)}
                        >
                            <ListMusic className="h-4 w-4 mr-2" />
                            Add to List
                        </button>

                        <button className="flex items-center justify-center p-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none">
                            <Share className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                {/* Album Info */}
                <div className="flex-grow">
                    <div className="flex items-center text-gray-500 text-sm mb-2">
                        <span className="uppercase bg-gray-200 rounded px-2 py-0.5">
                            {album.albumType === 'album' ? 'Album' : album.albumType}
                        </span>

                        {album.releaseDate && (
                            <span className="ml-2 flex items-center">
                                <Calendar className="h-3.5 w-3.5 mr-1" />
                                {formatDate(album.releaseDate)}
                            </span>
                        )}
                    </div>

                    <div className="relative mb-2">
                        {isTitleLong && !isExpanded ? (
                            <div className="relative">
                                <h1 className="text-3xl md:text-4xl font-bold text-gray-900 line-clamp-1">{album.name}</h1>
                                <button
                                    onClick={() => setIsExpanded(true)}
                                    className="absolute right-0 bottom-0 bg-white pl-2 pr-1 text-primary-600 hover:text-primary-800"
                                    aria-label="Show more"
                                >
                                    <span className="text-sm">...</span>
                                </button>
                            </div>
                        ) : (
                            <div>
                                <h1 className="text-3xl md:text-4xl font-bold text-gray-900">{album.name}</h1>
                                {isTitleLong && isExpanded && (
                                    <button
                                        onClick={() => setIsExpanded(false)}
                                        className="text-primary-600 hover:text-primary-800 focus:outline-none text-sm mt-1 inline-block"
                                        aria-label="Show less"
                                    >
                                        Show less
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="flex items-center mb-4">
                        <Link to={`/artist/${album.artists[0]?.spotifyId || '#'}`} className="text-lg font-medium text-primary-600 hover:underline">
                            {album.artistName}
                        </Link>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-y-2 gap-x-8 text-sm mb-6">
                        {album.totalTracks && (
                            <div className="flex items-center text-gray-600">
                                <Disc className="h-4 w-4 mr-2" />
                                <span>{album.totalTracks} tracks</span>
                            </div>
                        )}
                    </div>

                    {album.copyright && (
                        <div className="text-xs text-gray-500 mt-2 border-t border-gray-200 pt-2">
                            {album.copyright}
                        </div>
                    )}

                    {album.externalUrls && album.externalUrls.length > 0 && (
                        <div className="mt-4">
                            <a
                                href={`https://open.spotify.com/album/${album.spotifyId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center text-sm text-gray-600 hover:text-primary-600"
                            >
                                <svg
                                    className="h-5 w-5 mr-1"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                >
                                    <circle cx="12" cy="12" r="12" fill="#1DB954" />
                                    <path
                                        d="M17.9 10.9C14.7 9 9.35 8.8 6.3 9.75C5.8 9.9 5.3 9.6 5.15 9.15C5 8.65 5.3 8.15 5.75 8C9.3 6.95 15.15 7.15 18.85 9.35C19.3 9.6 19.45 10.2 19.2 10.65C18.95 11 18.35 11.15 17.9 10.9ZM17.8 13.9C17.55 14.25 17.1 14.35 16.75 14.1C14.05 12.45 9.95 11.9 6.8 12.85C6.4 12.95 5.95 12.75 5.85 12.35C5.75 11.95 5.95 11.5 6.35 11.4C10 10.35 14.5 10.95 17.6 12.85C17.9 13 18.05 13.5 17.8 13.9ZM16.6 16.8C16.4 17.1 16.05 17.2 15.75 17C13.4 15.55 10.45 15.3 6.95 16.1C6.6 16.2 6.3 15.95 6.2 15.65C6.1 15.3 6.35 15 6.65 14.9C10.45 14.1 13.75 14.35 16.35 16C16.7 16.15 16.75 16.5 16.6 16.8Z"
                                        fill="white"
                                    />
                                </svg>
                                Listen on Spotify
                            </a>
                        </div>
                    )}

                    {/* Album Stats and Latest Interaction in a flex row */}
                    <div className="flex flex-col md:flex-row gap-3 items-start">
                        <div className="md:w-1/2 scale-[1.3] origin-top-left">
                            <ItemStatsComponent itemId={album.spotifyId} />
                        </div>

                        <div className="hidden lg:block lg:w-1/3 xl:w-1/2 scale-[0.9] lg:ml-20 xl:ml-0 pt-2">
                            <LatestInteractionComponent
                                itemId={album.spotifyId}
                                itemType="Album"
                                onCreateInteraction={handleAlbumInteraction}
                                refreshTrigger={refreshTrigger}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Add to List Modal */}
            <AddToListModal
                isOpen={isAddToListModalOpen}
                onClose={() => setIsAddToListModalOpen(false)}
                spotifyId={album.spotifyId}
                itemType="Album"
                onSuccess={() => {
                    // Optional callback when successfully added to list
                }}
            />
        </>
    );
};

export default AlbumHeader;