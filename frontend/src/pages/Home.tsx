import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Calendar, Disc, RefreshCcw, ArrowRight, Search, Music, Star, ListMusic } from 'lucide-react';
import CatalogService, { AlbumSummary } from '../api/catalog';
import { formatDate } from '../utils/formatters';
import useAuthStore from '../store/authStore';
import FollowingFeedComponent from '../components/Home/FollowingFeedComponent';

const Home = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [newReleases, setNewReleases] = useState<AlbumSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const featureScrollRef = useRef<HTMLDivElement | null>(null);
  const scrollIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const fetchNewReleases = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await CatalogService.getNewReleases(10, 0);
        setNewReleases(data.albums);
      } catch (err) {
        console.error('Error fetching new releases:', err);
        setError('Failed to load new releases. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchNewReleases();
  }, []);

  useEffect(() => {
    const scrollEl = featureScrollRef.current;
    if (!scrollEl) return;

    const handleUserScroll = () => {
      if (scrollIntervalRef.current) {
        clearInterval(scrollIntervalRef.current);
      }
    };

    scrollEl.addEventListener('pointerdown', handleUserScroll, { once: true });

    let scrollAmount = 0;
    const maxScroll = scrollEl.scrollWidth - scrollEl.clientWidth;
    scrollIntervalRef.current = setInterval(() => {
      if (scrollAmount < maxScroll) {
        scrollAmount += 1;
        scrollEl.scrollLeft = scrollAmount;
      } else {
        clearInterval(scrollIntervalRef.current!);
      }
    }, 20);

    return () => {
      if (scrollIntervalRef.current) clearInterval(scrollIntervalRef.current);
      scrollEl.removeEventListener('pointerdown', handleUserScroll);
    };
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
      <div className="max-w-6xl mx-auto py-4 sm:py-8 px-3 sm:px-4">
        {/* Hero Section with Search */}
        <div className="text-center mb-8 sm:mb-12 px-2 sm:px-4">
          <h1 className="text-2xl sm:text-4xl font-bold text-gray-900 mb-2 sm:mb-3">Welcome to BeatRate</h1>
          <p className="text-l sm:text-xl text-gray-600 mb-6 sm:mb-8">Discover, rate, and share your music experiences</p>

          {/* Search Bar */}
          <div className="max-w-2xl mx-auto">
            <form onSubmit={handleSearchSubmit} className="relative">
              <div className="flex items-center relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400"/>
                </div>
                <input
                    type="text"
                    placeholder="Search for artists, albums, or tracks..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="hidden sm:block w-full py-3 px-5 pl-10 rounded-full text-base focus:outline-none border border-gray-300 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 shadow-sm"
                    aria-label="Search for music"
                />
                <input
                    type="text"
                    placeholder="Search for music..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="sm:hidden w-full py-3 px-5 pl-10 rounded-full text-base focus:outline-none border border-gray-300 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 shadow-sm"
                    aria-label="Search for music"
                />
                <button
                    type="submit"
                    className="absolute right-2 bg-primary-600 text-white p-2 rounded-full hover:bg-primary-700 transition-colors"
                    aria-label="Submit search"
                >
                  <Search className="h-4 w-4"/>
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Main features section */}
        <div
            className="flex overflow-x-auto space-x-4 sm:grid sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 mb-8 sm:mb-12"
            ref={featureScrollRef}
        >
          {[{
            title: 'Rate Your Way',
            icon: <Star className="h-4 sm:h-5 w-4 sm:w-5 mr-2 text-primary-500"/>,
            description: 'Create custom grading methods to evaluate music your way.',
            link: '/grading-methods/create',
            linkText: 'Create a grading method'
          }, {
            title: 'Share Reviews',
            icon: <Music className="h-4 sm:h-5 w-4 sm:w-5 mr-2 text-primary-500" />,
            description: 'Document your music journey and share detailed reviews.',
            link: '/search',
            linkText: 'Find music to review'
          }, {
            title: 'Build Collections',
            icon: <ListMusic className="h-4 sm:h-5 w-4 sm:w-5 mr-2 text-primary-500" />,
            description: 'Create lists of your favorite tracks and albums.',
            link: '/lists',
            linkText: 'Explore lists'
          }].map((feature, index) => (
              <div key={index} className="bg-white shadow rounded-lg overflow-hidden min-w-[85%] sm:min-w-0">
                <div className="p-4 sm:p-6">
                  <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2 sm:mb-3 flex items-center">
                    {feature.icon}
                    {feature.title}
                  </h3>
                  <p className="text-gray-600 mb-3 sm:mb-4 text-sm sm:text-base">{feature.description}</p>
                  <Link
                      to={feature.link}
                      className="text-primary-600 hover:text-primary-800 font-medium flex items-center text-sm sm:text-base"
                  >
                    {feature.linkText} <ArrowRight className="ml-1 h-3 sm:h-4 w-3 sm:w-4" />
                  </Link>
                </div>
              </div>
          ))}
        </div>

        {/* Following Feed section - only visible when authenticated */}
        {isAuthenticated && (
            <FollowingFeedComponent />
        )}

        {/* New Releases section */}
        <div className="bg-white shadow rounded-lg overflow-hidden mb-8">
          <div className="px-3 py-3 sm:px-6 sm:py-4 bg-gradient-to-r from-primary-600 to-primary-500 flex justify-between items-center">
            <h2 className="text-l sm:text-xl font-bold text-white flex items-center">
              <Disc className="mr-2 h-4 sm:h-5 w-4 sm:w-5" />
              New Releases
            </h2>
            <Link
                to="/search?type=album"
                className="text-white hover:text-primary-100 flex items-center text-xs sm:text-sm font-medium"
                aria-label="View all new releases"
            >
              View all <ArrowRight className="ml-1 h-3 sm:h-4 w-3 sm:w-4" />
            </Link>
          </div>

          {loading ? (
              <div className="p-6 sm:p-8 flex justify-center">
                <RefreshCcw className="h-8 w-8 text-primary-500 animate-spin" />
              </div>
          ) : error ? (
              <div className="p-6 sm:p-8 text-center">
                <div className="text-red-500 mb-4">{error}</div>
                <button
                    onClick={() => window.location.reload()}
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700"
                    aria-label="Try again"
                >
                  <RefreshCcw className="mr-2 h-3 sm:h-4 w-3 sm:w-4" /> Try Again
                </button>
              </div>
          ) : (
              <div className="grid grid-cols-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 p-4 sm:p-6" role="list">
                {newReleases.map((album, index) => {
                  // Show 9 items on mobile, 10 on desktop
                  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
                  const maxItems = isMobile ? 9 : 10;
                  if (index >= maxItems) return null;

                  return (
                      <Link
                          key={album.spotifyId}
                          to={`/album/${album.spotifyId}`}
                          className="bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200"
                          role="listitem"
                      >
                        <div className="aspect-square w-full overflow-hidden">
                          <img
                              src={album.imageUrl || '/placeholder-album.jpg'}
                              alt={`Album cover of ${album.name} by ${album.artistName}`}
                              className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="p-2 sm:p-3">
                          <h3 className="font-medium text-gray-900 truncate text-xs sm:text-base leading-tight">{album.name}</h3>
                          <p className="text-xs sm:text-sm text-gray-600 truncate leading-tight">{album.artistName}</p>
                          <div className="flex items-center mt-1 text-[0.600rem] sm:text-xs text-gray-500">
                            <Calendar className="hidden sm:block h-2.5 w-2.5 sm:h-3 sm:w-3 mr-1 flex-shrink-0" />
                            <span className="truncate">{formatDate(album.releaseDate || '')}</span></div>
                        </div>
                      </Link>
                  );
                })}
              </div>
          )}
        </div>
      </div>
  );
};

export default Home;