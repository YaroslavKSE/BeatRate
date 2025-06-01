import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Disc } from 'lucide-react';
import CatalogService, {AlbumDetail, TrackDetail, TrackSummary} from '../api/catalog';
import EmptyState from '../components/common/EmptyState';
import {getSeveralPreviewsUrl, getTrackPreviewUrl} from '../utils/preview-extractor';
import AlbumHeader from '../components/Album/AlbumHeader';
import AlbumContentTabs from '../components/Album/AlbumContentTabs';
import LoadingState from '../components/Album/LoadingState';
import MusicInteractionModal from '../components/CreateInteraction/MusicInteractionModal.tsx';
import useAuthStore from '../store/authStore';

const Album = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { isAuthenticated } = useAuthStore();
    const [album, setAlbum] = useState<AlbumDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadingMoreTracks, setLoadingMoreTracks] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'tracks' | 'reviews' | 'lists' | 'my-history'>('tracks');
    const [hoveredTrack, setHoveredTrack] = useState<string | null>(null);
    const [playingTrack, setPlayingTrack] = useState<string | null>(null);
    const [isInteractionModalOpen, setIsInteractionModalOpen] = useState(false);
    const [interactionSuccess, setInteractionSuccess] = useState(false);
    const [selectedTrack, setSelectedTrack] = useState<TrackDetail | null>(null);
    const [isAlbumInteraction, setIsAlbumInteraction] = useState(true);
    const [tracksOffset, setTracksOffset] = useState(0);
    const [tracksTotal, setTracksTotal] = useState(0);
    const [refreshLatestInteraction, setRefreshLatestInteraction] = useState(0); // New state for refresh trigger
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const animationFrameRef = useRef<number | null>(null);

    useEffect(() => {
        const fetchAlbumDetails = async () => {
            if (!id) return;

            setLoading(true);
            setError(null);

            try {
                const albumData = await CatalogService.getAlbum(id);

                // Update the tracks offset and total for pagination tracking
                if (albumData.tracks) {
                    setTracksOffset(albumData.tracks.length);
                    setTracksTotal(albumData.totalTracks || albumData.tracks.length);
                }
                loadAlbumPreviews(albumData);
                setAlbum(albumData);
            } catch (err) {
                console.error('Error fetching album details:', err);
                setError('Failed to load album information. Please try again later.');
            } finally {
                setLoading(false);
            }
        };
        fetchAlbumDetails();
    }, [id]);

    useEffect(() => {
        const animationFrameId = animationFrameRef.current; // Store the value in a variable

        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
            }
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId); // Use the stored variable
            }
        };
    }, []);

    const loadAlbumPreviews = async (albumData: AlbumDetail | null) => {
        console.log("reloading previews");
        if(albumData == null) return;
        const previewsArray = await getSeveralPreviewsUrl(albumData.spotifyId);
        let i = 0;
        if(previewsArray){
            for(const track of albumData.tracks){
                if (i < previewsArray.length) {
                    track.previewUrl = previewsArray[i];
                    i++;
                }
            }
        }
    };

    const loadMoreTracks = async () => {
        if (!id || !album || loadingMoreTracks || tracksOffset >= tracksTotal) return;

        setLoadingMoreTracks(true);

        try {
            const response = await CatalogService.getAlbumTracks(album.spotifyId, 50, tracksOffset);

            const newTracks = response.tracks || [];

            if (newTracks.length === 0) {
                setTracksOffset(tracksTotal);
                setLoadingMoreTracks(false);
                return;
            }

            const updatedAlbum = { ...album };

            // Append the new tracks to the existing ones
            updatedAlbum.tracks = [...updatedAlbum.tracks, ...newTracks];

            // Update the tracksOffset for next pagination
            setTracksOffset(tracksOffset + newTracks.length);
            if(tracksOffset <= 99){
                loadAlbumPreviews(updatedAlbum);
            }

            setAlbum(updatedAlbum);

        } catch (err) {
            console.error('Error loading more tracks:', err);
            setError('Failed to load additional tracks. Please try again.');
        } finally {
            setLoadingMoreTracks(false);
        }
    };

    const handlePreviewToggle = async (track: TrackSummary) => {
        if (playingTrack === track.spotifyId) {
            // Stop playing the current track
            if (audioRef.current) {
                audioRef.current.pause();
            }
            setPlayingTrack(null);
        } else {
            if(!track.previewUrl && track.trackNumber && track.trackNumber > 100){
                track.previewUrl = await getTrackPreviewUrl(track.spotifyId) as string;
                console.log("track preview extracted");
            }
            const previewUrl = track.previewUrl;
            if (!previewUrl) return;
            // Stop any currently playing track
            if (audioRef.current) {
                audioRef.current.pause();
            }

            // Start playing the new track
            audioRef.current = new Audio(previewUrl);

            // Set up ended event to clear the playing state
            audioRef.current.addEventListener('ended', () => {
                setPlayingTrack(null);
            });

            await audioRef.current.play();
            setPlayingTrack(track.spotifyId);
        }
    };

    const handleAlbumInteraction = () => {
        if (!isAuthenticated) {
            navigate('/login', { state: { from: `/album/${id}` } });
            return;
        }
        setIsAlbumInteraction(true);
        setSelectedTrack(null);
        setIsInteractionModalOpen(true);
    };

    const handleTrackInteraction = async (track: TrackSummary) => {
        if (!isAuthenticated) {
            navigate('/login', { state: { from: `/album/${id}` } });
            return;
        }
        // Stop any playing preview
        if (audioRef.current) {
            audioRef.current.pause();
            setPlayingTrack(null);
        }

        if (!album) return;
        try {
            // Need to fetch the full TrackDetail since TrackSummary isn't enough
            setIsInteractionModalOpen(false); // Close any open modal first

            // Fetch the complete track details
            const trackDetail = await CatalogService.getTrack(track.spotifyId);
            trackDetail.previewUrl = track.previewUrl;
            // Set the track and open the modal
            setSelectedTrack(trackDetail);
            setIsAlbumInteraction(false);
            setIsInteractionModalOpen(true);
        } catch (error) {
            console.error('Error fetching track details:', error);
            // Optionally show an error message to the user
        }
    };

    const handleInteractionSuccess = (interactionId: string) => {
        console.log('Interaction created with ID:', interactionId);
        setIsInteractionModalOpen(false);
        setInteractionSuccess(true);

        // Trigger refresh of the latest interaction component
        setRefreshLatestInteraction(prev => prev + 1);

        // Show success message briefly
        setTimeout(() => {
            setInteractionSuccess(false);
        }, 3000);
    };

    if (loading) {
        return <LoadingState />;
    }

    if (error) {
        return (
            <div className="max-w-4xl mx-auto py-8">
                <EmptyState
                    title="Failed to load album"
                    message={error}
                    icon={<Disc className="h-12 w-12 text-gray-400" />}
                    action={{
                        label: "Try Again",
                        onClick: () => window.location.reload()
                    }}
                />
            </div>
        );
    }

    if (!album) {
        return (
            <div className="max-w-4xl mx-auto py-8">
                <EmptyState
                    title="Album Not Found"
                    message="We couldn't find the album you're looking for."
                    icon={<Disc className="h-12 w-12 text-gray-400" />}
                />
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto pb-12 overflow-x-hidden">
            {interactionSuccess && (
                <div className="fixed top-4 right-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded z-50 shadow-md">
                    Your interaction has been posted successfully!
                </div>
            )}

            <AlbumHeader
                album={album}
                handleAlbumInteraction={handleAlbumInteraction}
                refreshTrigger={refreshLatestInteraction} // Pass refresh trigger to AlbumHeader
            />

            <AlbumContentTabs
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                album={album}
                playingTrack={playingTrack}
                hoveredTrack={hoveredTrack}
                setHoveredTrack={setHoveredTrack}
                handlePreviewToggle={handlePreviewToggle}
                handleTrackInteraction={handleTrackInteraction}
                handleAlbumInteraction={handleAlbumInteraction}
                tracksTotal={tracksTotal}
                tracksOffset={tracksOffset}
                loadingMoreTracks={loadingMoreTracks}
                onLoadMoreTracks={loadMoreTracks}
                refreshTrigger={refreshLatestInteraction}
            />

            {/* Modal for Album interaction */}
            {album && isAlbumInteraction && (
                <MusicInteractionModal
                    item={album}
                    itemType="Album"
                    isOpen={isInteractionModalOpen}
                    onClose={() => setIsInteractionModalOpen(false)}
                    onSuccess={handleInteractionSuccess}
                />
            )}

            {/* Modal for Track interaction */}
            {selectedTrack && !isAlbumInteraction && (
                <MusicInteractionModal
                    item={selectedTrack}
                    itemType="Track"
                    isOpen={isInteractionModalOpen}
                    onClose={() => setIsInteractionModalOpen(false)}
                    onSuccess={handleInteractionSuccess}
                />
            )}
        </div>
    );
};

export default Album;