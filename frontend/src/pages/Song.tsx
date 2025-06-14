import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import CatalogService, {TrackDetail, TrackSummary} from '../api/catalog';
import {getTrackPreviewUrl} from '../utils/preview-extractor';
import SongHeader from '../components/Song/SongHeader';
import SongContentTabs from '../components/Song/SongContentTabs';
import LoadingState from '../components/Song/LoadingState';
import ErrorState from '../components/Song/ErrorState';
import NotFoundState from '../components/Song/NotFoundState';
import MusicInteractionModal from '../components/CreateInteraction/MusicInteractionModal.tsx';
import useAuthStore from '../store/authStore';

const Song = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { isAuthenticated } = useAuthStore();
    const [track, setTrack] = useState<TrackDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'reviews' | 'lists' | 'my-history'>('reviews');
    const [isPlaying, setIsPlaying] = useState(false);
    const [isInteractionModalOpen, setIsInteractionModalOpen] = useState(false);
    const [interactionSuccess, setInteractionSuccess] = useState(false);
    const [refreshLatestInteraction, setRefreshLatestInteraction] = useState(0); // New state for refresh trigger
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        const fetchTrackDetails = async () => {
            if (!id) return;

            setLoading(true);
            setError(null);

            try {
                const trackData = await CatalogService.getTrack(id);
                loadTrackPreview(trackData);
                setTrack(trackData);
            } catch (err) {
                console.error('Error fetching track details:', err);
                setError('Failed to load track information. Please try again later.');
            } finally {
                setLoading(false);
            }
        };

        fetchTrackDetails();
    }, [id]);

    // Clean up audio when component unmounts
    useEffect(() => {
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
            }
        };
    }, []);

    const loadTrackPreview = async (track: TrackSummary | null) => {
        if(track == null) return;
        if(track.previewUrl) return;
        const preview = await getTrackPreviewUrl(track.spotifyId);
        if(preview){
            track.previewUrl = preview;
        }
    }

    const handlePreviewToggle = async () => {
        if (!track) return;
        const previewUrl = track.previewUrl;
        if (!previewUrl) {
            console.error('No preview URL available for this track');
            return;
        }

        if (isPlaying) {
            // Pause the current track
            if (audioRef.current) {
                audioRef.current.pause();
                setIsPlaying(false);
            }
        } else {
            // Start playing the track
            try {
                // If there's already an audio element, pause it
                if (audioRef.current) {
                    audioRef.current.pause();
                }

                // Create a new audio element
                audioRef.current = new Audio(previewUrl);

                // Set up ended event to clear the playing state
                audioRef.current.addEventListener('ended', () => {
                    setIsPlaying(false);
                });

                await audioRef.current.play();
                setIsPlaying(true);
            } catch (error) {
                console.error('Error playing preview:', error);
            }
        }
    };

    const handleTrackInteraction = () => {
        if (!isAuthenticated) {
            navigate('/login', { state: { from: `/track/${id}` } });
            return;
        }
        if (audioRef.current) {
            audioRef.current.pause();
            setIsPlaying(false);
        }
        setIsInteractionModalOpen(true);
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
        return <ErrorState error={error} />;
    }

    if (!track) {
        return <NotFoundState />;
    }

    return (
        <div className="max-w-6xl mx-auto pb-12">
            {interactionSuccess && (
                <div className="fixed top-4 right-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded z-50 shadow-md">
                    Your review has been posted successfully!
                </div>
            )}

            <SongHeader
                track={track}
                isPlaying={isPlaying}
                handlePreviewToggle={handlePreviewToggle}
                handleTrackInteraction={handleTrackInteraction}
                refreshTrigger={refreshLatestInteraction} // Pass refresh trigger to SongHeader
            />

            <SongContentTabs
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                handleTrackInteraction={handleTrackInteraction}
                refreshTrigger={refreshLatestInteraction}
            />

            {track && (
                <MusicInteractionModal
                    item={track}
                    itemType="Track"
                    isOpen={isInteractionModalOpen}
                    onClose={() => setIsInteractionModalOpen(false)}
                    onSuccess={handleInteractionSuccess}
                />
            )}
        </div>
    );
};

export default Song;