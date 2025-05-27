import React from 'react';
import { Search, Loader } from 'lucide-react';
import { SearchState, SearchTab } from './types';
import AlbumResults from './AlbumResults';
import TrackResults from './TrackResults';
import ArtistResults from './ArtistResults';
import EmptyState from '../common/EmptyState';
import { INITIAL_LIMIT } from '../../utils/searchService';

interface SearchResultsProps {
    searchState: SearchState;
    activeTab: SearchTab;
    loading: boolean;
    error: string | null;
    isLoadingMoreAlbums: boolean;
    isLoadingMoreTracks: boolean;
    isLoadingMoreArtists: boolean;
    onShowMoreAlbums: () => void;
    onShowMoreTracks: () => void;
    onShowMoreArtists: () => void;
    onLoadMoreAlbums: (e: React.MouseEvent) => void;
    onLoadMoreTracks: (e: React.MouseEvent) => void;
    onLoadMoreArtists: (e: React.MouseEvent) => void;
}

const SearchResults: React.FC<SearchResultsProps> = ({
                                                         searchState,
                                                         activeTab,
                                                         loading,
                                                         error,
                                                         isLoadingMoreAlbums,
                                                         isLoadingMoreTracks,
                                                         isLoadingMoreArtists,
                                                         onShowMoreAlbums,
                                                         onShowMoreTracks,
                                                         onShowMoreArtists,
                                                         onLoadMoreAlbums,
                                                         onLoadMoreTracks,
                                                         onLoadMoreArtists
                                                     }) => {
    // Check if there are any results
    const hasResults =
        searchState.albums.length > 0 ||
        searchState.tracks.length > 0 ||
        searchState.artists.length > 0;

    // Determine if we should show no results message
    const showNoResults = !loading && !error && searchState.query.trim() && !hasResults;

    // Global Loading State
    if (loading && !hasResults) {
        return (
            <div className="flex justify-center items-center py-12">
                <Loader className="h-8 w-8 text-primary-600 animate-spin" />
                <span className="ml-2 text-gray-600">Loading results...</span>
            </div>
        );
    }

    // Error State
    if (error) {
        return (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-4">
                {error}
            </div>
        );
    }

    // Empty State
    if (showNoResults) {
        return (
            <EmptyState
                title="No results found"
                message="Try adjusting your search or filter to find what you're looking for."
                icon={<Search className="h-12 w-12 text-gray-400" />}
            />
        );
    }

    return (
        <div className="space-y-6 sm:space-y-10">
            {/* All Results Tab */}
            {activeTab === 'all' && (
                <>
                    {/* Albums Section */}
                    <AlbumResults
                        albums={searchState.albums.slice(0, INITIAL_LIMIT)}
                        totalCount={searchState.albumsTotal}
                        isLoading={loading}
                        isLoadingMore={false}
                        compact={true}
                        onLoadMore={() => {}} // Not used in compact mode
                        onShowMore={onShowMoreAlbums}
                    />

                    {/* Tracks Section */}
                    <TrackResults
                        tracks={searchState.tracks.slice(0, INITIAL_LIMIT)}
                        totalCount={searchState.tracksTotal}
                        isLoading={loading}
                        isLoadingMore={false}
                        compact={true}
                        onLoadMore={() => {}} // Not used in compact mode
                        onShowMore={onShowMoreTracks}
                    />

                    {/* Artists Section */}
                    <ArtistResults
                        artists={searchState.artists.slice(0, INITIAL_LIMIT)}
                        totalCount={searchState.artistsTotal}
                        isLoading={loading}
                        isLoadingMore={false}
                        compact={true}
                        onLoadMore={() => {}} // Not used in compact mode
                        onShowMore={onShowMoreArtists}
                    />
                </>
            )}

            {/* Albums Tab */}
            {activeTab === 'album' && (
                <AlbumResults
                    albums={searchState.albums}
                    totalCount={searchState.albumsTotal}
                    isLoading={loading}
                    isLoadingMore={isLoadingMoreAlbums}
                    onLoadMore={onLoadMoreAlbums}
                />
            )}

            {/* Tracks Tab */}
            {activeTab === 'track' && (
                <TrackResults
                    tracks={searchState.tracks}
                    totalCount={searchState.tracksTotal}
                    isLoading={loading}
                    isLoadingMore={isLoadingMoreTracks}
                    onLoadMore={onLoadMoreTracks}
                />
            )}

            {/* Artists Tab */}
            {activeTab === 'artist' && (
                <ArtistResults
                    artists={searchState.artists}
                    totalCount={searchState.artistsTotal}
                    isLoading={loading}
                    isLoadingMore={isLoadingMoreArtists}
                    onLoadMore={onLoadMoreArtists}
                />
            )}
        </div>
    );
};

export default SearchResults;