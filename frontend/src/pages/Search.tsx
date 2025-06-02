import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { Disc, Music, User } from 'lucide-react';
import { SearchTab, SearchState } from '../components/Search/types';
import SearchBar from '../components/Search/SearchBar';
import TabButton from '../components/Search/TabButton';
import SearchResults from '../components/Search/SearchResults';
import { fetchTabResults, clearSearchCache, EXPANDED_LIMIT } from '../utils/searchService';

const DEFAULT_STATE: SearchState = {
    query: '',
    albums: [],
    tracks: [],
    artists: [],
    albumsOffset: 0,
    tracksOffset: 0,
    artistsOffset: 0,
    albumsTotal: 0,
    tracksTotal: 0,
    artistsTotal: 0,
    albumsLoaded: false,
    tracksLoaded: false,
    artistsLoaded: false
};

const SearchPage = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const query = searchParams.get('q') || '';
    const [activeTab, setActiveTab] = useState<SearchTab>('all');
    const location = useLocation();

    // Global state
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Search state with results for each tab
    const [searchState, setSearchState] = useState<SearchState>({
        ...DEFAULT_STATE,
        query
    });

    // Loading states for "load more" operations
    const [isLoadingMoreAlbums, setIsLoadingMoreAlbums] = useState(false);
    const [isLoadingMoreTracks, setIsLoadingMoreTracks] = useState(false);
    const [isLoadingMoreArtists, setIsLoadingMoreArtists] = useState(false);

    // Helper function to update search state
    const updateSearchState = useCallback((updates: Partial<SearchState>) => {
        setSearchState(prev => ({ ...prev, ...updates }));
    }, []);

    // Load search results based on the active tab
    const loadTabResults = useCallback(async (tab: SearchTab) => {
        if (!query.trim()) return;

        // For 'all' tab, we should check if we have at least some data
        // For specific tabs, check if that tab's data is loaded
        const tabAlreadyLoaded =
            (tab === 'all' && searchState.albums.length > 0 && searchState.tracks.length > 0 && searchState.artists.length > 0) ||
            (tab === 'album' && searchState.albumsLoaded) ||
            (tab === 'track' && searchState.tracksLoaded) ||
            (tab === 'artist' && searchState.artistsLoaded);

        // Skip if this tab is already loaded
        if (tabAlreadyLoaded) return;

        setLoading(true);
        setError(null);

        try {
            const offset = tab === 'album' ? searchState.albumsOffset :
                tab === 'track' ? searchState.tracksOffset :
                    searchState.artistsOffset;

            const result = await fetchTabResults(query, tab, offset);

            if (!result) return;

            // Update state based on the tab
            if (tab === 'album') {
                updateSearchState({
                    albums: result.albums || [],
                    albumsTotal: result.totalResults || 0,
                    albumsLoaded: true
                });
            } else if (tab === 'track') {
                updateSearchState({
                    tracks: result.tracks || [],
                    tracksTotal: result.totalResults || 0,
                    tracksLoaded: true
                });
            } else if (tab === 'artist') {
                updateSearchState({
                    artists: result.artists || [],
                    artistsTotal: result.totalResults || 0,
                    artistsLoaded: true
                });
            }
        } catch (err) {
            console.error(`Error loading ${tab} results:`, err);
            setError('Failed to load search results. Please try again.');
        } finally {
            setLoading(false);
        }
    }, [query, searchState, updateSearchState]);

    // Load initial "all" results
    const loadInitialResults = useCallback(async () => {
        if (!query.trim()) return;

        setLoading(true);
        setError(null);

        try {
            // For the "all" tab, we need to fetch results for all types at once
            const result = await fetchTabResults(query, 'all');

            if (!result) return;

            // Update the search state with initial results and make sure the "all" tab is properly initialized
            updateSearchState({
                albums: result.albums || [],
                tracks: result.tracks || [],
                artists: result.artists || [],
                albumsTotal: result.totalResults || 0,
                tracksTotal: result.totalResults || 0,
                artistsTotal: result.totalResults || 0
            });
        } catch (err) {
            console.error('Error loading initial results:', err);
            setError('Failed to load search results. Please try again.');
        } finally {
            setLoading(false);
        }
    }, [query, updateSearchState]);

    // Initial search when query changes
    useEffect(() => {
        if (query !== searchState.query) {
            // Reset state for new query
            setSearchState({
                ...DEFAULT_STATE,
                query
            });

            // Reset active tab
            setActiveTab('all');

            // Load initial results immediately when there's a query
            if (query.trim()) {
                loadInitialResults();
            }
        }
    }, [query, searchState.query, loadInitialResults]);

    // Make sure we load initial results for the "all" tab when the component first mounts
    useEffect(() => {
        if (query.trim() && activeTab === 'all' &&
            searchState.albums.length === 0 &&
            searchState.tracks.length === 0 &&
            searchState.artists.length === 0) {
            loadInitialResults();
        }
    }, [query, activeTab, searchState.albums.length, searchState.tracks.length, searchState.artists.length, loadInitialResults]);

    // Load tab results when activeTab changes
    useEffect(() => {
        loadTabResults(activeTab);
    }, [activeTab, loadTabResults]);

    useEffect(() => {
        return () => {
            clearSearchCache();
            console.log('Search cache cleared');
        };
    }, [location.pathname, query]);

    // Handle tab change
    const handleTabChange = (tab: SearchTab) => {
        setActiveTab(tab);
    };

    // Handle search submission
    const handleSearch = (newQuery: string) => {
        if (newQuery.trim()) {
            setSearchParams({ q: newQuery.trim() });
        }
    };

    // Load more handlers
    const loadMoreAlbums = async (e: React.MouseEvent) => {
        e.preventDefault();
        if (isLoadingMoreAlbums) return;

        const newOffset = searchState.albumsOffset + EXPANDED_LIMIT;
        setIsLoadingMoreAlbums(true);

        try {
            const result = await fetchTabResults(query, 'album', newOffset);
            if (result && result.albums) {
                updateSearchState({
                    albums: [...searchState.albums, ...result.albums],
                    albumsOffset: newOffset
                });
            }
        } catch (err) {
            console.error('Error loading more albums:', err);
            setError('Failed to load more albums. Please try again.');
        } finally {
            setIsLoadingMoreAlbums(false);
        }
    };

    const loadMoreTracks = async (e: React.MouseEvent) => {
        e.preventDefault();
        if (isLoadingMoreTracks) return;

        const newOffset = searchState.tracksOffset + EXPANDED_LIMIT;
        setIsLoadingMoreTracks(true);

        try {
            const result = await fetchTabResults(query, 'track', newOffset);
            if (result && result.tracks) {
                updateSearchState({
                    tracks: [...searchState.tracks, ...result.tracks],
                    tracksOffset: newOffset
                });
            }
        } catch (err) {
            console.error('Error loading more tracks:', err);
            setError('Failed to load more tracks. Please try again.');
        } finally {
            setIsLoadingMoreTracks(false);
        }
    };

    const loadMoreArtists = async (e: React.MouseEvent) => {
        e.preventDefault();
        if (isLoadingMoreArtists) return;

        const newOffset = searchState.artistsOffset + EXPANDED_LIMIT;
        setIsLoadingMoreArtists(true);

        try {
            const result = await fetchTabResults(query, 'artist', newOffset);
            if (result && result.artists) {
                updateSearchState({
                    artists: [...searchState.artists, ...result.artists],
                    artistsOffset: newOffset
                });
            }
        } catch (err) {
            console.error('Error loading more artists:', err);
            setError('Failed to load more artists. Please try again.');
        } finally {
            setIsLoadingMoreArtists(false);
        }
    };

    return (
        <div className="max-w-6xl mx-auto py-2">
            <div className="mb-4">
                <h1 className="text-xl sm:text-3xl font-bold mb-2">Search Results</h1>
                <p className="text-xs sm:text-base text-gray-600">
                    {query ? `Showing results for "${query}"` : 'Enter a search term to find music'}
                </p>
            </div>

            {/* Search Bar */}
            <SearchBar initialQuery={query} onSearch={handleSearch} />

            {/* Search Tabs */}
            <div className="border-b border-gray-200 mb-6">
                <nav className="flex -mb-px">
                    <TabButton
                        active={activeTab === 'all'}
                        onClick={() => handleTabChange('all')}
                        icon={null}
                        label="All Results"
                    />
                    <TabButton
                        active={activeTab === 'album'}
                        onClick={() => handleTabChange('album')}
                        icon={<Disc className="h-4 w-4" />}
                        label="Albums"
                    />
                    <TabButton
                        active={activeTab === 'track'}
                        onClick={() => handleTabChange('track')}
                        icon={<Music className="h-4 w-4" />}
                        label="Tracks"
                    />
                    <TabButton
                        active={activeTab === 'artist'}
                        onClick={() => handleTabChange('artist')}
                        icon={<User className="h-4 w-4" />}
                        label="Artists"
                    />
                </nav>
            </div>

            {/* Search Results */}
            <SearchResults
                searchState={searchState}
                activeTab={activeTab}
                loading={loading}
                error={error}
                isLoadingMoreAlbums={isLoadingMoreAlbums}
                isLoadingMoreTracks={isLoadingMoreTracks}
                isLoadingMoreArtists={isLoadingMoreArtists}
                onShowMoreAlbums={() => handleTabChange('album')}
                onShowMoreTracks={() => handleTabChange('track')}
                onShowMoreArtists={() => handleTabChange('artist')}
                onLoadMoreAlbums={loadMoreAlbums}
                onLoadMoreTracks={loadMoreTracks}
                onLoadMoreArtists={loadMoreArtists}
            />
        </div>
    );
};

export default SearchPage;