import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Music, MessageSquare, ListMusic, History } from 'lucide-react';
import { AlbumDetail, TrackSummary } from '../../api/catalog';
import AlbumTrackList from './AlbumTrackList';
import ItemHistoryComponent from '../common/ItemHistoryComponent';
import ItemReviewsComponent from '../common/ItemReviewsComponent';
import InListsTab from '../common/InListsTab.tsx';
import useAuthStore from '../../store/authStore';

interface AlbumContentTabsProps {
    activeTab: 'tracks' | 'reviews' | 'lists' | 'my-history';
    setActiveTab: (tab: 'tracks' | 'reviews' | 'lists' | 'my-history') => void;
    album: AlbumDetail;
    playingTrack: string | null;
    hoveredTrack: string | null;
    setHoveredTrack: (trackId: string | null) => void;
    handlePreviewToggle: (track: TrackSummary) => Promise<void>;
    handleTrackInteraction: (track: TrackSummary) => void;
    handleAlbumInteraction: () => void;
    tracksTotal: number;
    tracksOffset: number;
    loadingMoreTracks: boolean;
    onLoadMoreTracks: () => void;
    refreshTrigger?: number; // Prop to trigger refresh
}

const AlbumContentTabs = ({
                              activeTab,
                              setActiveTab,
                              album,
                              playingTrack,
                              hoveredTrack,
                              setHoveredTrack,
                              handlePreviewToggle,
                              handleTrackInteraction,
                              handleAlbumInteraction,
                              tracksTotal,
                              tracksOffset,
                              loadingMoreTracks,
                              onLoadMoreTracks,
                              refreshTrigger = 0 // Default value to avoid undefined
                          }: AlbumContentTabsProps) => {
    const navigate = useNavigate();
    const { isAuthenticated } = useAuthStore();

    return (
        <div className="bg-white rounded-lg shadow-md overflow-hidden mb-8">
            <div className="border-b border-gray-200">
                <nav className="flex -mb-px whitespace-nowrap">
                    <TabButton
                        active={activeTab === 'tracks'}
                        onClick={() => setActiveTab('tracks')}
                        icon={<Music className="h-4 w-4 mr-1 sm:mr-2" />}
                        label="Tracks"
                    />
                    <TabButton
                        active={activeTab === 'reviews'}
                        onClick={() => setActiveTab('reviews')}
                        icon={<MessageSquare className="h-4 w-4 mr-1 sm:mr-2" />}
                        label="Reviews"
                    />
                    <TabButton
                        active={activeTab === 'lists'}
                        onClick={() => setActiveTab('lists')}
                        icon={<ListMusic className="h-4 w-4 mr-1 sm:mr-2" />}
                        label="In Lists"
                    />
                    <TabButton
                        active={activeTab === 'my-history'}
                        onClick={() => setActiveTab('my-history')}
                        icon={<History className="h-4 w-4 mr-1 sm:mr-2" />}
                        label="History"
                    />
                </nav>
            </div>

            {/* Tracks Tab Content */}
            {activeTab === 'tracks' && (
                <AlbumTrackList
                    tracks={album.tracks}
                    playingTrack={playingTrack}
                    hoveredTrack={hoveredTrack}
                    setHoveredTrack={setHoveredTrack}
                    handlePreviewToggle={handlePreviewToggle}
                    handleTrackInteraction={handleTrackInteraction}
                    tracksTotal={tracksTotal}
                    tracksOffset={tracksOffset}
                    loadingMoreTracks={loadingMoreTracks}
                    onLoadMore={onLoadMoreTracks}
                />
            )}

            {/* Reviews Tab Content */}
            {activeTab === 'reviews' && (
                <div className="p-4 sm:p-6">
                    <ItemReviewsComponent
                        itemId={album.spotifyId}
                        itemType="Album"
                        onWriteReview={handleAlbumInteraction}
                    />
                </div>
            )}

            {/* Lists Tab Content */}
            {activeTab === 'lists' && (
                <div className="p-4 sm:p-6">
                    <InListsTab spotifyId={album.spotifyId} />
                </div>
            )}

            {/* History Tab Content */}
            {activeTab === 'my-history' && (
                <div className="p-4 sm:p-6">
                    {isAuthenticated ? (
                        <ItemHistoryComponent
                            itemId={album.spotifyId}
                            itemType="Album"
                            onLogInteraction={handleAlbumInteraction}
                            refreshTrigger={refreshTrigger}
                        />
                    ) : (
                        <EmptyState
                            title="Please log in"
                            message="You need to be logged in to see your history with this album."
                            icon={<History className="h-10 w-10 sm:h-12 sm:w-12 text-gray-400" />}
                            action={{
                                label: "Log In",
                                onClick: () => navigate('/login', { state: { from: `/album/${album.spotifyId}` } })
                            }}
                        />
                    )}
                </div>
            )}
        </div>
    );
};

// Helper component for tabs
interface TabButtonProps {
    active: boolean;
    onClick: () => void;
    icon: ReactNode;
    label: string;
}

const TabButton = ({ active, onClick, icon, label }: TabButtonProps) => {
    return (
        <button
            onClick={onClick}
            className={`py-3 px-3 sm:px-6 border-b-2 font-medium text-xs sm:text-sm flex items-center ${
                active
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
        >
            {icon}
            {label}
        </button>
    );
};

// Import EmptyState component for use in History tab
const EmptyState = ({ title, message, icon, action }: {
    title: string;
    message: string;
    icon?: ReactNode;
    action?: {
        label: string;
        onClick: () => void;
    };
}) => {
    return (
        <div className="text-center py-12 px-4 rounded-lg border border-gray-200 bg-white">
            <div className="mx-auto flex justify-center">
                {icon || <MessageSquare className="h-12 w-12 text-gray-400" />}
            </div>
            <h3 className="mt-4 text-lg font-medium text-gray-900">{title}</h3>
            <p className="mt-2 text-sm text-gray-500 max-w-md mx-auto">{message}</p>
            {action && (
                <div className="mt-6">
                    <button
                        type="button"
                        onClick={action.onClick}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                    >
                        {action.label}
                    </button>
                </div>
            )}
        </div>
    );
};

export default AlbumContentTabs;