import { useState } from 'react';
import { Heart, Share, Music, Users } from 'lucide-react';
import { ArtistDetail } from '../../api/catalog';
import { formatNumberWithCommas } from '../../utils/formatters';

interface ArtistHeaderProps {
    artist: ArtistDetail;
}

const ArtistHeader = ({ artist }: ArtistHeaderProps) => {
    const [isFollowing, setIsFollowing] = useState(false);

    const formatFollowers = (count: number): string => {
        return formatNumberWithCommas(count);
    };

    // Function to generate a CSS gradient based on artist popularity
    const getPopularityGradient = (popularity: number) => {
        if (popularity >= 90) {
            return 'from-purple-800 to-purple-900';
        } else if (popularity >= 80) {
            return 'from-purple-700 to-purple-800';
        } else if (popularity >= 70) {
            return 'from-purple-600 to-purple-700';
        } else if (popularity >= 60) {
            return 'from-purple-500 to-purple-600';
        } else if (popularity >= 50) {
            return 'from-purple-400 to-purple-500';
        } else if (popularity >= 40) {
            return 'from-purple-300 to-purple-400';
        } else {
            return 'from-purple-200 to-purple-300';
        }
    };

    const handleFollowToggle = () => {
        setIsFollowing(!isFollowing);
        // In a real implementation, you would call an API to update the follow status
    };

    return (
        <>
            {/* Mobile Layout */}
            <div className="flex flex-col items-center md:hidden mb-3">
                {/* Artist Image - Smaller and centered */}
                <div className="w-64 flex-shrink-0 mb-2">
                    <div className="aspect-square w-full shadow-md rounded-full overflow-hidden border-4 border-white">
                        <img
                            src={artist.imageUrl || '/placeholder-artist.jpg'}
                            alt={artist.name}
                            className="w-full h-full object-cover"
                        />
                    </div>
                </div>

                {/* Artist Info - Centered */}
                <div className="text-center mb-2 px-1">
                    {/* Artist Name */}
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 line-clamp-3">{artist.name}</h1>
                    </div>

                    {/* Artist genres */}
                    <div className="flex flex-wrap justify-center gap-1 mb-2">
                        {artist.genres.slice(0, 3).map((genre) => {
                            const capitalizedGenre = genre.charAt(0).toUpperCase() + genre.slice(1);
                            return (
                                <span
                                    key={genre}
                                    className="px-2 py-1 bg-gray-100 rounded-full text-xs font-medium text-gray-700">
                                    {capitalizedGenre}
                                </span>
                            );
                        })}
                        {artist.genres.length > 3 && (
                            <span className="px-2 py-1 bg-gray-100 rounded-full text-xs font-medium text-gray-700">
                                +{artist.genres.length - 3} more
                            </span>
                        )}
                    </div>

                    {/* Spotify Link */}
                    {artist.externalUrls && artist.externalUrls.length > 0 && (
                        <div className="mt-2">
                            <a
                                href={`https://open.spotify.com/artist/${artist.spotifyId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center text-[0.800rem] text-gray-600 hover:text-primary-600"
                            >
                                {/* Spotify logo SVG */}
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
                        onClick={handleFollowToggle}
                        className={`flex-1 flex items-center justify-center py-2 px-4 border text-[0.800rem] font-medium rounded-md focus:outline-none transition-colors ${
                            isFollowing
                                ? 'border-primary-300 bg-primary-50 text-primary-700 hover:bg-primary-100'
                                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                        }`}
                    >
                        <Heart className="h-3.5 w-3.5 mr-2" />
                        {isFollowing ? 'Following' : 'Follow'}
                    </button>

                    <button className="flex items-center justify-center p-2 border border-gray-300 text-[0.800rem] font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none">
                        <Share className="h-3.5 w-3.5" />
                    </button>
                </div>
            </div>

            {/* Desktop Layout - Original */}
            <div className="hidden md:flex flex-col md:flex-row gap-8 mb-8">
                {/* Artist Image */}
                <div className="w-full md:w-64 flex-shrink-0">
                    <div className="aspect-square w-full shadow-md rounded-full overflow-hidden border-4 border-white">
                        <img
                            src={artist.imageUrl || '/placeholder-artist.jpg'}
                            alt={artist.name}
                            className="w-full h-full object-cover"
                        />
                    </div>

                    {/* Action Buttons */}
                    <div className="mt-4 flex justify-between space-x-2">
                        <button
                            onClick={handleFollowToggle}
                            className={`flex-1 flex items-center justify-center py-2 px-4 border text-sm font-medium rounded-md focus:outline-none transition-colors ${
                                isFollowing
                                    ? 'border-primary-300 bg-primary-50 text-primary-700 hover:bg-primary-100'
                                    : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                            }`}
                        >
                            {isFollowing ? (
                                <>
                                    <Heart className="h-4 w-4 mr-2" />
                                    Following
                                </>
                            ) : (
                                <>
                                    <Heart className="h-4 w-4 mr-2" />
                                    Follow
                                </>
                            )}
                        </button>

                        <button className="flex items-center justify-center p-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none">
                            <Share className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                {/* Artist Info */}
                <div className="flex-grow">
                    <div className="flex items-center text-gray-500 text-sm mb-2">
                        <span className="uppercase bg-gray-200 rounded px-2 py-0.5">
                            Artist
                        </span>
                    </div>

                    <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">{artist.name}</h1>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        {/* Followers */}
                        <div className="bg-gradient-to-br from-primary-50 to-primary-100 p-4 rounded-lg shadow-sm border border-primary-200">
                            <div className="flex items-center">
                                <Users className="h-6 w-6 text-primary-600 mr-3" />
                                <div>
                                    <div className="text-sm font-medium text-primary-700">Spotify Followers</div>
                                    <div className="text-2xl font-bold text-primary-800">
                                        {formatFollowers(artist.followersCount)}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Popularity Card with dynamic gradient */}
                        {artist.popularity && artist.popularity > 0 && (
                            <div
                                className={`bg-gradient-to-br ${getPopularityGradient(artist.popularity)} p-4 rounded-lg shadow-sm border`}>
                                <div className="flex items-center">
                                    <Music className="h-6 w-6 text-white mr-3"/>
                                    <div>
                                        <div className="text-sm font-medium text-white">Popularity Score</div>
                                        <div className="text-2xl font-bold text-white">
                                            {artist.popularity}/100
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Artist genres - If available from API */}
                    <div className="mt-4 flex flex-wrap gap-2">
                        {artist.genres.map((genre) => {
                            const capitalizedGenre = genre.charAt(0).toUpperCase() + genre.slice(1);
                            return (
                                <span
                                    key={genre}
                                    className="px-3 py-1 bg-gray-100 rounded-full text-xs font-medium text-gray-700">
                                    {capitalizedGenre}
                                </span>
                            );
                        })}
                    </div>

                    {/* External links */}
                    {artist.externalUrls && artist.externalUrls.length > 0 && (
                        <div className="mt-4">
                            <a
                                href={`https://open.spotify.com/artist/${artist.spotifyId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center text-sm text-gray-600 hover:text-primary-600"
                            >
                                {/* Spotify logo SVG */}
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
            </div>
        </>
    );
};

export default ArtistHeader;