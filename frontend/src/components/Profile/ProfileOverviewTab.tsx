import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {Clock, Disc, Music, User, Loader, SlidersHorizontal, Heart, MessageSquare} from 'lucide-react';
import InteractionService from '../../api/interaction';
import CatalogService, {AlbumSummary, ArtistSummary, TrackSummary} from '../../api/catalog';
import UsersService, { UserPreferencesResponse } from '../../api/users';
import NormalizedStarDisplay from '../CreateInteraction/NormalizedStarDisplay';
import ArtistCard from '../Search/ArtistCard';
import AlbumCard from '../Search/AlbumCard';
import TrackRow from '../Search/TrackRow';
import { DiaryEntry } from '../Diary/types';

interface ProfileOverviewTabProps {
    userId?: string;        // Optional: If provided, shows public user preferences
    isOwnProfile?: boolean; // Whether this is the current user's profile
}

const ProfileOverviewTab = ({ userId }: ProfileOverviewTabProps) => {
    const navigate = useNavigate();
    const [recentEntries, setRecentEntries] = useState<DiaryEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Preferences state
    const [artistItems, setArtistItems] = useState<ArtistSummary[]>([]);
    const [albumItems, setAlbumItems] = useState<AlbumSummary[]>([]);
    const [trackItems, setTrackItems] = useState<TrackSummary[]>([]);
    const [preferencesLoading, setPreferencesLoading] = useState(true);

    // Load recent diary entries
    const loadRecentEntries = useCallback(async () => {
        if (!userId) return;

        try {
            setLoading(true);
            setError(null);

            // Fetch interactions for the user - limit to 5 for the overview
            const { items: recentInteractions } =
                await InteractionService.getUserInteractionsByUserId(userId, 5, 0);

            if (recentInteractions.length === 0) {
                setRecentEntries([]);
                setLoading(false);
                return;
            }

            // Extract all item ids for preview info
            const itemIds: string[] = recentInteractions.map(interaction => interaction.itemId);

            // Fetch preview information for all items in a single request
            const previewResponse = await CatalogService.getItemPreviewInfo(itemIds, ['album', 'track']);

            // Create lookup maps for quick access
            const itemsMap = new Map();

            // Process results from the preview response
            previewResponse.results?.forEach(resultGroup => {
                resultGroup.items?.forEach(item => {
                    // Create a simplified catalog item with the preview information
                    const catalogItem = {
                        spotifyId: item.spotifyId,
                        name: item.name,
                        imageUrl: item.imageUrl,
                        artistName: item.artistName
                    };

                    itemsMap.set(item.spotifyId, catalogItem);
                });
            });

            // Combine interactions with catalog items
            const entries = recentInteractions.map(interaction => {
                const entry: DiaryEntry = { interaction };

                // Get the preview info from our map
                entry.catalogItem = itemsMap.get(interaction.itemId);

                return entry;
            });

            setRecentEntries(entries);
        } catch (err: unknown) {
            console.error('Error loading recent entries:', err);
            setError('Failed to load your recent activity. Please try again later.');
        } finally {
            setLoading(false);
        }
    }, [userId]);

    // Load preferences
    const loadPreferences = useCallback(async () => {
        if (!userId) return;

        try {
            setPreferencesLoading(true);

            // Fetch user preferences
            const preferences: UserPreferencesResponse = await UsersService.getUserPreferencesById(userId);

            // Fetch details for artists
            if (preferences.artists.length > 0) {
                const artistDetails = await Promise.all(
                    preferences.artists.map(async (id) => {
                        try {
                            return await CatalogService.getArtist(id);
                        } catch (err) {
                            console.error(`Error fetching artist with ID ${id}:`, err);
                            return null;
                        }
                    })
                );
                setArtistItems(artistDetails.filter(item => item !== null));
            }

            // Fetch details for albums
            if (preferences.albums.length > 0) {
                const response = await CatalogService.getBatchAlbums(preferences.albums);
                setAlbumItems(response.albums || []);
            }

            // Fetch details for tracks
            if (preferences.tracks.length > 0) {
                const response = await CatalogService.getBatchTracks(preferences.tracks);
                setTrackItems(response.tracks || []);
            }
        } catch (err) {
            console.error('Error fetching preferences:', err);
            // Don't set an error state for preferences, just show empty state
        } finally {
            setPreferencesLoading(false);
        }
    }, [userId]);

    // Load data on initial render
    useEffect(() => {
        if (!userId) {
            navigate('/login', { state: { from: '/profile' } });
            return;
        }

        loadRecentEntries();
        loadPreferences();
    }, [userId, navigate, loadRecentEntries, loadPreferences]);

    // Helper function to render the recent activity section
    const renderRecentActivity = () => {
        if (loading) {
            return (
                <div className="flex justify-center py-6 sm:py-8">
                    <Loader className="h-6 w-6 sm:h-8 sm:w-8 text-primary-600 animate-spin mr-2 sm:mr-3" />
                    <span className="text-sm sm:text-base text-gray-600">Loading recent activity...</span>
                </div>
            );
        }

        if (recentEntries.length === 0 || error) {
            return (
                <div className="text-center py-6 sm:py-8 bg-gray-50 rounded-lg border border-gray-200">
                    <Clock className="h-8 w-8 sm:h-12 sm:w-12 text-gray-400 mx-auto mb-3 sm:mb-4" />
                    <p className="text-sm sm:text-base text-gray-600">No recent activity yet.</p>
                </div>
            );
        }

        return (
            <>
                {/* Mobile Layout - Horizontal scrolling */}
                <div className="sm:hidden">
                    <div className="flex space-x-3 overflow-x-auto pb-2 px-1">
                        {recentEntries.map((entry) => (
                            <div
                                key={entry.interaction.aggregateId}
                                onClick={() => navigate(`/interaction/${entry.interaction.aggregateId}`)}
                                className="flex-none w-32 relative group bg-white rounded-lg overflow-visible shadow-sm hover:shadow-md transition-shadow duration-200 cursor-pointer"
                                role="listitem"
                            >
                                <div className="aspect-square w-full overflow-hidden rounded-t-lg">
                                    <img
                                        src={entry.catalogItem?.imageUrl || '/placeholder-album.jpg'}
                                        alt={`${entry.catalogItem?.name || 'Unknown'} by ${entry.catalogItem?.artistName || 'Unknown Artist'}`}
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                                <div className="p-2">
                                    <h3 className="font-medium text-gray-900 truncate text-xs">{entry.catalogItem?.name || 'Unknown Title'}</h3>
                                    <p className="text-xs text-gray-600 truncate">{entry.catalogItem?.artistName || 'Unknown Artist'}</p>

                                    {/* Interaction details */}
                                    <div className="mt-1 flex flex-wrap gap-1 items-center text-xs">
                                        {entry.interaction.rating && (
                                            <div className="flex items-center">
                                                <NormalizedStarDisplay
                                                    currentGrade={entry.interaction.rating.normalizedGrade}
                                                    minGrade={1}
                                                    maxGrade={10}
                                                    size="mbl"
                                                />

                                                {entry.interaction.rating.isComplex && (
                                                    <SlidersHorizontal className="h-3 w-3 ml-1 text-primary-500" />
                                                )}
                                            </div>
                                        )}

                                        {entry.interaction.isLiked && <Heart className="h-3 w-3 text-red-500 fill-red-500" />}
                                        {entry.interaction.review && <MessageSquare className="h-3 w-3 text-primary-600" />}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Desktop Layout - Grid */}
                <div className="hidden sm:grid sm:grid-cols-3 md:grid-cols-5 gap-4" role="list">
                    {recentEntries.map((entry) => (
                        <div
                            key={entry.interaction.aggregateId}
                            onClick={() => navigate(`/interaction/${entry.interaction.aggregateId}`)}
                            className="relative group bg-white rounded-lg overflow-visible shadow-sm hover:shadow-md transition-shadow duration-200 cursor-pointer"
                            role="listitem"
                        >
                            <div className="aspect-square w-full overflow-hidden rounded-t-lg">
                                <img
                                    src={entry.catalogItem?.imageUrl || '/placeholder-album.jpg'}
                                    alt={`${entry.catalogItem?.name || 'Unknown'} by ${entry.catalogItem?.artistName || 'Unknown Artist'}`}
                                    className="w-full h-full object-cover"
                                />
                            </div>
                            <div className="p-3">
                                <h3 className="font-medium text-gray-900 truncate">{entry.catalogItem?.name || 'Unknown Title'}</h3>
                                <p className="text-sm text-gray-600 truncate">{entry.catalogItem?.artistName || 'Unknown Artist'}</p>

                                {/* Interaction details */}
                                <div className="mt-2 flex flex-wrap gap-2 items-center text-xs">
                                    {entry.interaction.rating && (
                                        <div className="flex items-center">
                                            <NormalizedStarDisplay
                                                currentGrade={entry.interaction.rating.normalizedGrade}
                                                minGrade={1}
                                                maxGrade={10}
                                            />

                                            {entry.interaction.rating.isComplex && (
                                                <SlidersHorizontal className="h-4 w-4 ml-1 text-primary-500" />
                                            )}
                                        </div>
                                    )}

                                    {entry.interaction.isLiked && <Heart className="h-3.5 w-3.5 text-red-500 fill-red-500" />}
                                    {entry.interaction.review && <MessageSquare className="h-3.5 w-3.5 text-primary-600" />}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </>
        );
    };

    // Helper function to determine if there are any preferences to show
    const hasPreferences = artistItems.length > 0 || albumItems.length > 0 || trackItems.length > 0;

    return (
        <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="p-4 sm:p-6 space-y-4 sm:space-y-8">
                {/* Recent Activity Section */}
                <div>
                    <h2 className="text-base sm:text-xl font-medium text-gray-900 flex items-center mb-2 sm:mb-4">
                        <Clock className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-primary-600"/>
                        Recent Activity
                    </h2>
                    {renderRecentActivity()}
                </div>

                {/* Preferences Section - Only show if there are preferences */}
                {(hasPreferences || preferencesLoading) && (
                    <div>
                        {preferencesLoading ? (
                            <div className="flex justify-center py-4 sm:py-6">
                                <Loader className="h-5 w-5 sm:h-6 sm:w-6 text-primary-600 animate-spin mr-2" />
                                <span className="text-sm sm:text-base text-gray-600">Loading preferences...</span>
                            </div>
                        ) : (
                            <div className="space-y-4 sm:space-y-6">
                                {/* Favorite Artists */}
                                {artistItems.length > 0 && (
                                    <div>
                                        <h3 className="text-base sm:text-lg font-medium text-gray-800 flex items-center mb-2 sm:mb-3">
                                            <User className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-indigo-600" />
                                            Favorite Artists
                                        </h3>

                                        {/* Mobile: Horizontal scrolling */}
                                        <div className="sm:hidden">
                                            <div className="flex space-x-3 overflow-x-auto pb-2 px-1">
                                                {artistItems.slice(0, 5).map((artist) => (
                                                    <div key={artist.spotifyId} className="flex-none w-32">
                                                        <ArtistCard
                                                            artist={artist}
                                                            mobile={true}
                                                            compact={true}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Desktop: Grid */}
                                        <div className="hidden sm:grid sm:grid-cols-3 md:grid-cols-5 gap-4">
                                            {artistItems.slice(0, 5).map((artist) => (
                                                <ArtistCard
                                                    key={artist.spotifyId}
                                                    artist={artist}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Favorite Albums */}
                                {albumItems.length > 0 && (
                                    <div>
                                        <h3 className="text-base sm:text-lg font-medium text-gray-800 flex items-center mb-2 sm:mb-3">
                                            <Disc className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-purple-600" />
                                            Favorite Albums
                                        </h3>

                                        {/* Mobile: Horizontal scrolling */}
                                        <div className="sm:hidden">
                                            <div className="flex space-x-3 overflow-x-auto pb-2 px-1">
                                                {albumItems.slice(0, 5).map((album) => (
                                                    <div key={album.spotifyId} className="flex-none w-32">
                                                        <AlbumCard
                                                            album={album}
                                                            mobile={true}
                                                            compact={true}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Desktop: Grid */}
                                        <div className="hidden sm:grid sm:grid-cols-3 md:grid-cols-5 gap-4">
                                            {albumItems.slice(0, 5).map((album) => (
                                                <AlbumCard
                                                    key={album.spotifyId}
                                                    album={album}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Favorite Tracks */}
                                {trackItems.length > 0 && (
                                    <div>
                                        <h3 className="text-base sm:text-lg font-medium text-gray-800 flex items-center mb-2 sm:mb-3">
                                            <Music className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-pink-600" />
                                            Favorite Tracks
                                        </h3>
                                        <div className="bg-white rounded-lg shadow overflow-hidden">
                                            {trackItems.slice(0, 5).map((track, index) => (
                                                <TrackRow
                                                    key={track.spotifyId}
                                                    track={track}
                                                    index={index}
                                                    compact={true}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProfileOverviewTab;