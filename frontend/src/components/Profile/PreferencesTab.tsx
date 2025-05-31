import { useState, useEffect } from 'react';
import { Music, Disc, User, Plus, Loader, AlertCircle, Trash2 } from 'lucide-react';
import UserPreferencesService, { UserPreferencesResponse } from '../../api/preferences';
import UsersService from '../../api/users';
import SearchModal from './SearchModal';
import ArtistCard from '../Search/ArtistCard';
import AlbumCard from '../Search/AlbumCard';
import TrackRow from '../Search/TrackRow';
import CatalogService, { ArtistSummary, AlbumSummary, TrackSummary } from '../../api/catalog';
import axios from 'axios';

type PreferenceType = 'artists' | 'albums' | 'tracks';

interface PreferencesTabProps {
  userId?: string;        // Optional: If provided, shows public user preferences
  username?: string;      // Optional: Alternative to userId for public preferences
  isOwnProfile?: boolean; // Whether this is the current user's profile
}

const PreferencesTab = ({ userId, username, isOwnProfile = false }: PreferencesTabProps) => {
  // Maximum number of items per category
  const MAX_ITEMS_PER_CATEGORY = 5;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [currentSearchType, setCurrentSearchType] = useState<PreferenceType>('artists');
  const [deletingItems, setDeletingItems] = useState<Record<string, boolean>>({});

  // Properly defined with specific types
  const [artistItems, setArtistItems] = useState<ArtistSummary[]>([]);
  const [albumItems, setAlbumItems] = useState<AlbumSummary[]>([]);
  const [trackItems, setTrackItems] = useState<TrackSummary[]>([]);

  // Loading states for each type
  const [artistsLoading, setArtistsLoading] = useState(false);
  const [albumsLoading, setAlbumsLoading] = useState(false);
  const [tracksLoading, setTracksLoading] = useState(false);
  const [hasPreferences, setHasPreferences] = useState(true);

  useEffect(() => {
    fetchPreferences();
  }, [userId, username]);

  // Fetch preferences based on whether it's the current user or a public user
  const fetchPreferences = async () => {
    try {
      setLoading(true);
      setError(null);

      // Reset item states
      setArtistItems([]);
      setAlbumItems([]);
      setTrackItems([]);

      let response: UserPreferencesResponse;

      // Determine which API to call based on the provided props
      if (isOwnProfile) {
        // Current user preferences
        response = await UserPreferencesService.getUserPreferences();
      } else if (userId) {
        // Public user preferences by ID
        response = await UsersService.getUserPreferencesById(userId);
      } else if (username) {
        // Public user preferences by username
        response = await UsersService.getUserPreferencesByUsername(username);
      } else {
        throw new Error('Either userId, username, or isOwnProfile must be provided');
      }

      // Limit each category to MAX_ITEMS_PER_CATEGORY maximum
      const limitedArtists = response.artists.slice(0, MAX_ITEMS_PER_CATEGORY);
      const limitedAlbums = response.albums.slice(0, MAX_ITEMS_PER_CATEGORY);
      const limitedTracks = response.tracks.slice(0, MAX_ITEMS_PER_CATEGORY);

      // Determine if the user has any preferences
      const hasAnyPreferences =
          (limitedArtists.length > 0) ||
          (limitedAlbums.length > 0) ||
          (limitedTracks.length > 0);

      setHasPreferences(hasAnyPreferences);

      // Fetch details for each type of preference
      if (limitedArtists.length > 0) {
        const artistDetails = await fetchItemDetails(limitedArtists, 'artists');
        setArtistItems(artistDetails as ArtistSummary[]);
      }

      if (limitedAlbums.length > 0) {
        const albumDetails = await fetchItemDetails(limitedAlbums, 'albums');
        setAlbumItems(albumDetails as AlbumSummary[]);
      }

      if (limitedTracks.length > 0) {
        const trackDetails = await fetchItemDetails(limitedTracks, 'tracks');
        setTrackItems(trackDetails as TrackSummary[]);
      }
    } catch (err) {
      console.error('Error fetching preferences:', err);

      // Handle 404 as no preferences available rather than an error
      if (axios.isAxiosError(err) && err.response?.status === 404) {
        // This means the user has no preferences - this is not an error state
        setHasPreferences(false);
        setArtistItems([]);
        setAlbumItems([]);
        setTrackItems([]);
      } else {
        // For other errors, set the error state
        const userDisplayName = isOwnProfile ? 'your' : (username ? `${username}'s` : "user's");
        setError(`Failed to load ${userDisplayName} preferences. Please try again later.`);
      }
    } finally {
      setLoading(false);
    }
  };

  // Delete a preference
  const handleDeletePreference = async (id: string, type: PreferenceType) => {
    if (deletingItems[id]) return; // Prevent double submission

    try {
      setDeletingItems(prev => ({ ...prev, [id]: true }));

      // Use singular form: 'artist', 'album', 'track'
      const itemType = type === 'artists' ? 'artist' :
          type === 'albums' ? 'album' : 'track';

      await UserPreferencesService.removePreference(itemType, id);

      // Update the local state to remove the item
      if (type === 'artists') {
        setArtistItems(prev => prev.filter(item => item.spotifyId !== id));
      } else if (type === 'albums') {
        setAlbumItems(prev => prev.filter(item => item.spotifyId !== id));
      } else {
        setTrackItems(prev => prev.filter(item => item.spotifyId !== id));
      }

      // No success message shown as requested

    } catch (err) {
      console.error('Error removing preference:', err);
      setError('Failed to remove preference. Please try again.');
    } finally {
      setDeletingItems(prev => ({ ...prev, [id]: false }));
    }
  };

  // Fetch details for a specific item type
  const fetchItemDetails = async (ids: string[], type: PreferenceType) => {
    if (ids.length === 0) return [];

    // Ensure we respect the MAX_ITEMS_PER_CATEGORY limit
    const limitedIds = ids.slice(0, MAX_ITEMS_PER_CATEGORY);

    try {
      const loadingStateSetter =
          type === 'artists' ? setArtistsLoading :
              type === 'albums' ? setAlbumsLoading :
                  setTracksLoading;

      loadingStateSetter(true);

      // Limit the number of requests by using batch endpoints when possible
      if (type === 'albums' && limitedIds.length > 0) {
        // BatchAlbums supports up to 20 IDs at once
        const batchSize = 20;
        let fetchedAlbums: AlbumSummary[] = [];

        for (let i = 0; i < limitedIds.length; i += batchSize) {
          const batchIds = limitedIds.slice(i, i + batchSize);
          const response = await CatalogService.getBatchAlbums(batchIds);
          if (response.albums) {
            fetchedAlbums = [...fetchedAlbums, ...response.albums];
          }
        }

        return fetchedAlbums;
      } else if (type === 'tracks' && limitedIds.length > 0) {
        // BatchTracks supports up to 20 IDs at once
        const batchSize = 20;
        let fetchedTracks: TrackSummary[] = [];

        for (let i = 0; i < limitedIds.length; i += batchSize) {
          const batchIds = limitedIds.slice(i, i + batchSize);
          const response = await CatalogService.getBatchTracks(batchIds);
          if (response.tracks) {
            fetchedTracks = [...fetchedTracks, ...response.tracks];
          }
        }

        return fetchedTracks;
      } else {
        // For artists, we need to fetch them one by one (no batch endpoint available)
        return await Promise.all(
            limitedIds.map(async (id) => {
              try {
                if (type === 'artists') return await CatalogService.getArtist(id);
                return null; // Should not reach here
              } catch (err) {
                console.error(`Error fetching ${type} with ID ${id}:`, err);
                return null;
              }
            })
        ).then(results => results.filter(item => item !== null) as ArtistSummary[]);
      }
    } catch (err) {
      console.error(`Error fetching ${type} details:`, err);
      return [];
    } finally {
      const loadingStateSetter =
          type === 'artists' ? setArtistsLoading :
              type === 'albums' ? setAlbumsLoading :
                  setTracksLoading;

      loadingStateSetter(false);
    }
  };

  const handleAddPreference = (type: PreferenceType) => {
    // Check if we've already reached the maximum for this category
    const currentCount =
        type === 'artists' ? artistItems.length :
            type === 'albums' ? albumItems.length :
                trackItems.length;

    if (currentCount >= MAX_ITEMS_PER_CATEGORY) {
      // Could show an error message here
      alert(`You can only have up to ${MAX_ITEMS_PER_CATEGORY} ${type} in your preferences.`);
      return;
    }

    setCurrentSearchType(type);
    setSearchModalOpen(true);
  };

  const handlePreferenceAdded = () => {
    // Refresh preferences after adding new ones
    fetchPreferences();
    setSearchModalOpen(false);
  };

  // Render section for a specific preference type (artists, albums, tracks)
  const renderPreferenceSection = (type: PreferenceType, items: ArtistSummary[] | AlbumSummary[] | TrackSummary[]) => {
    const isLoading =
        type === 'artists' ? artistsLoading :
            type === 'albums' ? albumsLoading :
                tracksLoading;

    const title =
        type === 'artists' ? 'Favorite Artists' :
            type === 'albums' ? 'Favorite Albums' :
                'Favorite Tracks';

    const icon =
        type === 'artists' ? <User className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-indigo-600" /> :
            type === 'albums' ? <Disc className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-purple-600" /> :
                <Music className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-pink-600" />;

    const emptyIcon =
        type === 'artists' ? <User className="h-8 w-8 sm:h-10 sm:w-10 mx-auto text-gray-400 mb-2" /> :
            type === 'albums' ? <Disc className="h-8 w-8 sm:h-10 sm:w-10 mx-auto text-gray-400 mb-2" /> :
                <Music className="h-8 w-8 sm:h-10 sm:w-10 mx-auto text-gray-400 mb-2" />;

    const emptyText = isOwnProfile
        ? `You haven't added any favorite ${type} yet.`
        : `${username || 'This user'} hasn't added any favorite ${type} yet.`;

    // Get count of current items
    const currentCount = items.length;
    const canAdd = isOwnProfile && currentCount < MAX_ITEMS_PER_CATEGORY;

    // Loading skeleton UI
    const renderLoadingSkeleton = () => {
      if (type === 'artists') {
        return (
            <>
              {/* Mobile skeleton - horizontal scrolling */}
              <div className="sm:hidden">
                <div className="animate-pulse flex space-x-3 overflow-x-hidden px-1">
                  {[...Array(3)].map((_, i) => (
                      <div key={i} className="flex-none w-32">
                        <div className="aspect-square w-full overflow-hidden bg-gray-200 rounded-full mx-auto p-2"></div>
                        <div className="p-2 text-center">
                          <div className="h-3 bg-gray-200 rounded w-3/4 mx-auto mb-1"></div>
                          <div className="h-2 bg-gray-200 rounded w-1/2 mx-auto"></div>
                        </div>
                      </div>
                  ))}
                </div>
              </div>

              {/* Desktop skeleton */}
              <div className="hidden sm:block animate-pulse grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {[...Array(MAX_ITEMS_PER_CATEGORY)].map((_, i) => (
                    <div key={i} className="bg-white rounded-lg shadow overflow-hidden">
                      <div className="aspect-square w-full overflow-hidden bg-gray-200 rounded-full mx-auto p-2"></div>
                      <div className="p-3 text-center">
                        <div className="h-4 bg-gray-200 rounded w-3/4 mx-auto mb-2"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/2 mx-auto"></div>
                      </div>
                    </div>
                ))}
              </div>
            </>
        );
      } else if (type === 'albums') {
        return (
            <>
              {/* Mobile skeleton - horizontal scrolling */}
              <div className="sm:hidden">
                <div className="animate-pulse flex space-x-3 overflow-x-hidden px-1">
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
              <div className="hidden sm:block animate-pulse grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {[...Array(MAX_ITEMS_PER_CATEGORY)].map((_, i) => (
                    <div key={i} className="bg-white rounded-lg shadow overflow-hidden">
                      <div className="bg-gray-200 aspect-square w-full"></div>
                      <div className="p-3">
                        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                      </div>
                    </div>
                ))}
              </div>
            </>
        );
      } else {
        return (
            <div className="animate-pulse space-y-4 bg-white rounded-lg shadow overflow-hidden">
              {[...Array(MAX_ITEMS_PER_CATEGORY)].map((_, i) => (
                  <div key={i} className="flex items-center px-3 py-2 sm:px-6 sm:py-4">
                    <div className="w-12 h-12 bg-gray-200 mr-4"></div>
                    <div className="flex-1">
                      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  </div>
              ))}
            </div>
        );
      }
    };

    // Render items based on type
    const renderItems = () => {
      if (items.length === 0) {
        return (
            <div className="text-center py-4 sm:py-6 bg-gray-50 rounded-lg border border-gray-200">
              {emptyIcon}
              <p className="text-gray-500 text-sm sm:text-base">{emptyText}</p>
              {canAdd && (
                  <button
                      onClick={() => handleAddPreference(type)}
                      className="mt-3 inline-flex items-center px-3 py-1.5 sm:px-4 sm:py-2 border border-gray-300 shadow-sm text-xs sm:text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                  >
                    <Plus className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                    Add {type === 'artists' ? 'Artists' : type === 'albums' ? 'Albums' : 'Tracks'}
                  </button>
              )}
            </div>
        );
      }

      if (type === 'artists') {
        return (
            <>
              {/* Mobile Layout - Horizontal scrolling */}
              <div className="sm:hidden">
                <div className="flex space-x-3 overflow-x-auto pb-2 px-1">
                  {(items as ArtistSummary[]).map((artist) => (
                      <div key={artist.spotifyId} className="relative group flex-none w-32">
                        <ArtistCard artist={artist} mobile={true} compact={true} />
                        {isOwnProfile && (
                            <button
                                onClick={() => handleDeletePreference(artist.spotifyId, 'artists')}
                                disabled={deletingItems[artist.spotifyId]}
                                className="absolute top-1 right-1 bg-gray-500 text-white p-1 rounded-full shadow"
                                title="Remove from favorites"
                            >
                              {deletingItems[artist.spotifyId] ? (
                                  <Loader className="h-3 w-3 animate-spin" />
                              ) : (
                                  <Trash2 className="h-3 w-3" />
                              )}
                            </button>
                        )}
                      </div>
                  ))}
                </div>
              </div>

              {/* Desktop Layout */}
              <div className="hidden sm:grid sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {(items as ArtistSummary[]).map((artist) => (
                    <div key={artist.spotifyId} className="relative group">
                      <ArtistCard artist={artist} />
                      {isOwnProfile && (
                          <button
                              onClick={() => handleDeletePreference(artist.spotifyId, 'artists')}
                              disabled={deletingItems[artist.spotifyId]}
                              className="absolute top-2 right-2 bg-red-500 text-white p-1.5 rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                              title="Remove from favorites"
                          >
                            {deletingItems[artist.spotifyId] ? (
                                <Loader className="h-4 w-4 animate-spin" />
                            ) : (
                                <Trash2 className="h-4 w-4" />
                            )}
                          </button>
                      )}
                    </div>
                ))}
              </div>
            </>
        );
      } else if (type === 'albums') {
        return (
            <>
              {/* Mobile Layout - Horizontal scrolling */}
              <div className="sm:hidden">
                <div className="flex space-x-3 overflow-x-auto pb-2 px-1">
                  {(items as AlbumSummary[]).map((album) => (
                      <div key={album.spotifyId} className="relative group flex-none w-32">
                        <AlbumCard album={album} mobile={true} compact={true} />
                        {isOwnProfile && (
                            <button
                                onClick={() => handleDeletePreference(album.spotifyId, 'albums')}
                                disabled={deletingItems[album.spotifyId]}
                                className="absolute top-1 right-1 bg-gray-500 text-white p-1 rounded-full shadow"
                                title="Remove from favorites"
                            >
                              {deletingItems[album.spotifyId] ? (
                                  <Loader className="h-3 w-3 animate-spin" />
                              ) : (
                                  <Trash2 className="h-3 w-3" />
                              )}
                            </button>
                        )}
                      </div>
                  ))}
                </div>
              </div>

              {/* Desktop Layout */}
              <div className="hidden sm:grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {(items as AlbumSummary[]).map((album) => (
                    <div key={album.spotifyId} className="relative group">
                      <AlbumCard album={album} />
                      {isOwnProfile && (
                          <button
                              onClick={() => handleDeletePreference(album.spotifyId, 'albums')}
                              disabled={deletingItems[album.spotifyId]}
                              className="absolute top-2 right-2 bg-red-500 text-white p-1.5 rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                              title="Remove from favorites"
                          >
                            {deletingItems[album.spotifyId] ? (
                                <Loader className="h-4 w-4 animate-spin" />
                            ) : (
                                <Trash2 className="h-4 w-4" />
                            )}
                          </button>
                      )}
                    </div>
                ))}
              </div>
            </>
        );
      } else {
        return (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              {(items as TrackSummary[]).map((track, index) => (
                  <div key={track.spotifyId} className="relative group">
                    <div className="pr-12"> {/* Add padding to make room for delete button */}
                      <TrackRow track={track} index={index} compact={true} />
                    </div>
                    {isOwnProfile && (
                        <button
                            onClick={() => handleDeletePreference(track.spotifyId, 'tracks')}
                            disabled={deletingItems[track.spotifyId]}
                            className="absolute top-1/2 right-4 transform -translate-y-1/2 bg-gray-500 text-white p-1 sm:p-1.5 rounded-full shadow sm:opacity-0 sm:group-hover:opacity-100 sm:transition-opacity sm:duration-200 sm:bg-red-500"
                            title="Remove from favorites"
                        >
                          {deletingItems[track.spotifyId] ? (
                              <Loader className="h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
                          ) : (
                              <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                          )}
                        </button>
                    )}
                  </div>
              ))}
            </div>
        );
      }
    };

    return (
        <div>
          <div className="flex justify-between items-center mb-3 sm:mb-4">
            <h4 className="text-sm sm:text-md font-medium text-gray-800 flex items-center">
              {icon}
              {title} <span className="ml-2 text-xs text-gray-500">({currentCount}/{MAX_ITEMS_PER_CATEGORY})</span>
            </h4>
            {canAdd && (
                <button
                    onClick={() => handleAddPreference(type)}
                    className="flex items-center text-xs sm:text-sm text-primary-600 hover:text-primary-800"
                    disabled={currentCount >= MAX_ITEMS_PER_CATEGORY}
                >
                  <Plus className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                  Add {type === 'artists' ? 'Artist' : type === 'albums' ? 'Album' : 'Track'}
                </button>
            )}
          </div>

          {isLoading ? renderLoadingSkeleton() : renderItems()}
        </div>
    );
  };

  if (loading && artistItems.length === 0 && albumItems.length === 0 && trackItems.length === 0) {
    return (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="p-4 sm:p-6">
            <div className="flex justify-center items-center py-8 sm:py-12">
              <Loader className="h-6 w-6 sm:h-8 sm:w-8 text-primary-600 animate-spin mr-2 sm:mr-3" />
              <span className="text-sm sm:text-base text-gray-600">Loading preferences...</span>
            </div>
          </div>
        </div>
    );
  }

  return (
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="p-2 sm:p-6">
          {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 sm:px-4 sm:py-3 rounded-md mb-4 sm:mb-6 flex items-center">
                <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                <span className="text-sm sm:text-base">{error}</span>
              </div>
          )}

          {!hasPreferences && !loading && (
              <div className="text-center py-4 sm:py-6 bg-gray-50 rounded-lg border border-gray-200">
                <Music className="h-12 w-12 sm:h-16 sm:w-16 mx-auto text-gray-400 mb-2" />
                <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">No Public Preferences</h3>
                <p className="text-sm sm:text-base text-gray-500">
                  {isOwnProfile
                      ? "You haven't added any music preferences yet."
                      : `${username ? `${username} hasn't` : "This user hasn't"} shared any public music preferences yet.`}
                </p>
                {isOwnProfile && (
                    <div className="mt-4 flex flex-col sm:flex-row justify-center gap-2">
                      <button
                          onClick={() => handleAddPreference('artists')}
                          className="inline-flex items-center px-3 py-1.5 sm:px-4 sm:py-2 border border-gray-300 shadow-sm text-xs sm:text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                      >
                        <User className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                        Add Artists
                      </button>
                      <button
                          onClick={() => handleAddPreference('albums')}
                          className="inline-flex items-center px-3 py-1.5 sm:px-4 sm:py-2 border border-gray-300 shadow-sm text-xs sm:text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                      >
                        <Disc className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                        Add Albums
                      </button>
                      <button
                          onClick={() => handleAddPreference('tracks')}
                          className="inline-flex items-center px-3 py-1.5 sm:px-4 sm:py-2 border border-gray-300 shadow-sm text-xs sm:text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                      >
                        <Music className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                        Add Tracks
                      </button>
                    </div>
                )}
              </div>
          )}

          {hasPreferences && (
              <div className="space-y-6 sm:space-y-8">
                {/* Artists Section */}
                {renderPreferenceSection('artists', artistItems)}

                {/* Albums Section */}
                {renderPreferenceSection('albums', albumItems)}

                {/* Tracks Section */}
                {renderPreferenceSection('tracks', trackItems)}
              </div>
          )}
        </div>

        {/* Search Modal (only for own profile) */}
        {isOwnProfile && searchModalOpen && (
            <SearchModal
                isOpen={searchModalOpen}
                onClose={() => setSearchModalOpen(false)}
                type={currentSearchType}
                onPreferenceAdded={handlePreferenceAdded}
            />
        )}
      </div>
  );
};

export default PreferencesTab;