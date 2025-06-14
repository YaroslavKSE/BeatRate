import {useState, useEffect, useRef} from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Heart, MessageSquare, SlidersHorizontal, Trash2, Flag, Send, ThumbsUp, Calendar, Play, Pause, Disc } from 'lucide-react';
import InteractionService, { InteractionDetailDTO, ReviewComment } from '../api/interaction';
import CatalogService, {AlbumDetail, TrackDetail, TrackSummary} from '../api/catalog';
import useAuthStore from '../store/authStore';
import UsersService, { UserSummary, PublicUserProfile } from '../api/users';
import { formatDate } from '../utils/formatters';
import NormalizedStarDisplay from '../components/CreateInteraction/NormalizedStarDisplay';
import ComplexRatingModal from '../components/common/ComplexRatingModal.tsx';
import {getTrackPreviewUrl} from "../utils/preview-extractor.ts";

// Combined type for catalog items
type CatalogItemType = AlbumDetail | TrackDetail;

const InteractionDetailPage = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user, isAuthenticated } = useAuthStore();

    const [interaction, setInteraction] = useState<InteractionDetailDTO | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [catalogItem, setCatalogItem] = useState<CatalogItemType | null>(null);
    const [creatorProfile, setCreatorProfile] = useState<PublicUserProfile | null>(null);
    const [comments, setComments] = useState<ReviewComment[]>([]);
    const [commentUsers, setCommentUsers] = useState<Map<string, UserSummary>>(new Map());
    const [commentsLoading, setCommentsLoading] = useState(false);
    const [commentsError, setCommentsError] = useState<string | null>(null);
    const [hasMoreComments, setHasMoreComments] = useState(false);
    const [commentsOffset, setCommentsOffset] = useState(0);
    const [totalComments, setTotalComments] = useState(0);
    const [newComment, setNewComment] = useState('');
    const [submittingComment, setSubmittingComment] = useState(false);
    const [hasLikedReview, setHasLikedReview] = useState(false);
    const [likeCount, setLikeCount] = useState(0);
    const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);
    const [processingLike, setProcessingLike] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);

    // Fetch interaction data
    useEffect(() => {
        const fetchInteractionData = async () => {
            if (!id) return;

            setLoading(true);
            setError(null);

            try {
                // Get interaction details
                const interactionData = await InteractionService.getInteractionById(id);
                setInteraction(interactionData);

                // Fetch catalog item (album or track)
                let itemData: CatalogItemType;
                if (interactionData.itemType === 'Album') {
                    itemData = await CatalogService.getAlbum(interactionData.itemId);
                } else {
                    itemData = await CatalogService.getTrack(interactionData.itemId);
                    loadTrackPreview(itemData);
                }
                setCatalogItem(itemData);

                // Fetch creator profile
                const creatorData = await UsersService.getUserProfileById(interactionData.userId);
                setCreatorProfile(creatorData);

                // If there's a review, check if current user has liked it
                if (interactionData.review && isAuthenticated && user) {
                    const likeStatus = await InteractionService.checkReviewLike(
                        interactionData.review.reviewId,
                        user.id
                    );
                    setHasLikedReview(likeStatus);

                    setLikeCount(interactionData.review.likes); // This would be replaced with actual like count from backend
                }
            } catch (err) {
                console.error('Error fetching interaction data:', err);
                setError('Failed to load interaction data. Please try again later.');
            } finally {
                setLoading(false);
            }
        };

        fetchInteractionData();
    }, [id, isAuthenticated, user]);

    // Fetch initial comments
    useEffect(() => {
        const fetchComments = async () => {
            if (!interaction?.review?.reviewId) return;

            setCommentsLoading(true);
            setCommentsError(null);

            try {
                const result = await InteractionService.getReviewComments(
                    interaction.review.reviewId,
                    10,
                    0
                );

                setComments(result.comments || []);
                setTotalComments(result.totalCount);
                setHasMoreComments(result.totalCount > 10);
                setCommentsOffset(result.comments?.length || 0);

                // Fetch user data for each comment
                if (result.comments && result.comments.length > 0) {
                    const userIds = [...new Set(result.comments.map(comment => comment.userId))];
                    await fetchUsersForComments(userIds);
                }
            } catch (err) {
                console.error('Error fetching comments:', err);
                setCommentsError('Failed to load comments');
            } finally {
                setCommentsLoading(false);
            }
        };

        if (interaction?.review) {
            fetchComments();
        }
    }, [interaction]);

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

    // Function to fetch user data for comments in batch
    const fetchUsersForComments = async (userIds: string[]) => {
        if (userIds.length === 0) return;

        try {
            // Use the new batch API to fetch all users in a single request
            const userProfiles = await UsersService.getUserProfilesBatch(userIds);

            // Create a map from the returned profiles
            const usersMap = new Map<string, UserSummary>();
            userProfiles.forEach(profile => {
                usersMap.set(profile.id, {
                    id: profile.id,
                    username: profile.username,
                    name: profile.name,
                    surname: profile.surname,
                    avatarUrl: profile.avatarUrl
                });
            });

            setCommentUsers(usersMap);
        } catch (error) {
            console.error('Error fetching users for comments:', error);
        }
    };

    const handlePreviewToggle = async () => {
        if (!catalogItem) return;
        const track = catalogItem as TrackSummary;
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

    const handleLoadMoreComments = async () => {
        if (!interaction?.review?.reviewId || commentsLoading || !hasMoreComments) return;

        setCommentsLoading(true);

        try {
            const result = await InteractionService.getReviewComments(
                interaction.review.reviewId,
                10,
                commentsOffset
            );

            const newComments = result.comments || [];
            setComments((prev) => [...prev, ...newComments]);
            setCommentsOffset((prev) => prev + newComments.length);
            setHasMoreComments((commentsOffset + newComments.length) < result.totalCount);

            // Fetch user data for new comments
            if (newComments.length > 0) {
                const newUserIds = [...new Set(newComments.map(comment => comment.userId))];
                // Filter out users we already have
                const userIdsToFetch = newUserIds.filter(id => !commentUsers.has(id));
                if (userIdsToFetch.length > 0) {
                    await fetchUsersForComments(userIdsToFetch);
                }
            }
        } catch (err) {
            console.error('Error loading more comments:', err);
            setCommentsError('Failed to load more comments');
        } finally {
            setCommentsLoading(false);
        }
    };

    const handleSubmitComment = async () => {
        if (!interaction?.review?.reviewId || !user || !newComment.trim() || submittingComment) return;

        setSubmittingComment(true);

        try {
            const success = await InteractionService.postReviewComment({
                reviewId: interaction.review.reviewId,
                userId: user.id,
                commentText: newComment
            });

            if (success) {
                // Add the new comment to the list (optimistic update)
                const newCommentObj: ReviewComment = {
                    commentId: Date.now().toString(), // Temporary ID
                    reviewId: interaction.review.reviewId,
                    userId: user.id,
                    commentedAt: new Date().toISOString(),
                    commentText: newComment
                };

                // Make sure we have the current user in our users map
                const updatedUsers = new Map(commentUsers);
                if (!updatedUsers.has(user.id)) {
                    updatedUsers.set(user.id, {
                        id: user.id,
                        username: user.username || '',
                        name: user.name,
                        surname: user.surname,
                        avatarUrl: user.avatarUrl
                    });
                    setCommentUsers(updatedUsers);
                }

                setComments((prev) => [newCommentObj, ...prev]);
                setTotalComments((prev) => prev + 1);
                setNewComment('');
            }
        } catch (err) {
            console.error('Error posting comment:', err);
        } finally {
            setSubmittingComment(false);
        }
    };

    const handleDeleteComment = async (commentId: string) => {
        if (!user) return;

        const confirmed = window.confirm('Are you sure you want to delete this comment?');
        if (!confirmed) return;

        try {
            const success = await InteractionService.deleteReviewComment(commentId, user.id);

            if (success) {
                // Remove the comment from the list
                setComments((prev) => prev.filter(comment => comment.commentId !== commentId));
                setTotalComments((prev) => prev - 1);
            }
        } catch (err) {
            console.error('Error deleting comment:', err);
        }
    };

    const handleToggleLike = async () => {
        if (!interaction?.review?.reviewId || !user || processingLike) return;

        setProcessingLike(true);

        try {
            if (hasLikedReview) {
                const success = await InteractionService.unlikeReview(
                    interaction.review.reviewId,
                    user.id
                );

                if (success) {
                    setHasLikedReview(false);
                    setLikeCount((prev) => Math.max(0, prev - 1));
                }
            } else {
                const success = await InteractionService.likeReview(
                    interaction.review.reviewId,
                    user.id
                );

                if (success) {
                    setHasLikedReview(true);
                    setLikeCount((prev) => prev + 1);
                }
            }
        } catch (err) {
            console.error('Error toggling like:', err);
        } finally {
            setProcessingLike(false);
        }
    };

    if (loading) {
        return (
            <div className="max-w-4xl mx-auto py-4 sm:py-8 px-2 sm:px-4">
                <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 sm:h-10 sm:w-10 border-t-2 border-b-2 border-primary-600"></div>
                    <span className="ml-3 text-sm sm:text-lg text-gray-600">Loading interaction...</span>
                </div>
            </div>
        );
    }

    if (error || !interaction || !catalogItem) {
        return (
            <div className="max-w-4xl mx-auto py-4 sm:py-8 px-2 sm:px-4">
                <div className="bg-red-50 border border-red-200 text-red-700 p-4 sm:p-6 rounded-lg">
                    <h2 className="text-lg sm:text-xl font-semibold mb-2">Error</h2>
                    <p className="text-sm sm:text-base">{error || "Couldn't find the interaction you're looking for."}</p>
                    <button
                        onClick={() => navigate(-1)}
                        className="mt-4 px-3 py-1.5 sm:px-4 sm:py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 text-sm sm:text-base"
                    >
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto py-2 sm:py-8 px-2 sm:px-4">
            <div className="bg-white shadow rounded-lg p-3 sm:p-6 mb-4 sm:mb-8">
                {/* Header with back button */}
                <div className="mb-4 sm:mb-6">
                    <button
                        onClick={() => navigate(-1)}
                        className="text-gray-600 hover:text-gray-900 flex items-center"
                    >
                        <svg className="h-4 w-4 sm:h-5 sm:w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        <span className="text-sm sm:text-base">Back</span>
                    </button>
                </div>

                {/* Mobile Layout */}
                <div className="sm:hidden">
                    {/* Creator info - Mobile (moved to top) */}
                    <div className="flex items-center mb-3">
                        <Link to={`/people/${creatorProfile?.id}`} className="flex items-center">
                            {creatorProfile?.avatarUrl ? (
                                <img
                                    src={creatorProfile.avatarUrl}
                                    alt={creatorProfile.name}
                                    className="h-8 w-8 rounded-full object-cover mr-2"
                                />
                            ) : (
                                <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-xs font-bold mr-2">
                                    {creatorProfile?.name.charAt(0).toUpperCase()}{creatorProfile?.surname.charAt(0).toUpperCase()}
                                </div>
                            )}
                            <div>
                                <span className="font-medium text-gray-900 text-sm">{creatorProfile?.name} {creatorProfile?.surname}</span>
                                <span className="text-gray-500 text-xs block">@{creatorProfile?.username}</span>
                            </div>
                        </Link>
                    </div>

                    {/* Item image (half row) and details (half row) */}
                    <div className="flex gap-3 mb-3">
                        {/* Item image - takes half the row */}
                        <div className="w-1/2 flex-shrink-0">
                            <div className="aspect-square w-full rounded-md overflow-hidden shadow-md">
                                <img
                                    src={catalogItem.imageUrl || '/placeholder-album.jpg'}
                                    alt={catalogItem.name}
                                    className="w-full h-full object-cover"
                                />
                            </div>
                        </div>

                        {/* Item info and interaction details - takes other half */}
                        <div className="w-1/2 flex flex-col justify-between">
                            {/* Item info */}
                            <div className="mb-2">
                                <div className="flex items-center mb-1">
                                    <h1 className="text-base font-bold text-gray-900 mr-2 leading-tight line-clamp-3">
                                        <Link
                                            to={`/${interaction.itemType.toLowerCase()}/${catalogItem.spotifyId}`}
                                            className="hover:text-primary-600"
                                        >
                                            {catalogItem.name}
                                        </Link>
                                    </h1>

                                    {/* For tracks, add preview play button */}
                                    {interaction.itemType === 'Track' && (
                                        <button
                                            className={`mr-2 flex items-center justify-center rounded-full p-1 text-xs font-medium transition-colors border ${
                                                isPlaying
                                                    ? 'bg-primary-100 text-primary-700 border-primary-200'
                                                    : 'bg-gray-100 text-gray-800 border-gray-200'
                                            }`}
                                            onClick={handlePreviewToggle}
                                        >
                                            {isPlaying ? (
                                                <Pause className="h-3 w-3" />
                                            ) : (
                                                <Play className="h-3 w-3 fill-gray-800" />
                                            )}
                                        </button>
                                    )}
                                </div>

                                <Link
                                    to={`/artist/${interaction.itemType === 'Album'
                                        ? (catalogItem as AlbumDetail).artists?.[0]?.spotifyId
                                        : (catalogItem as TrackDetail).artists?.[0]?.spotifyId}`}
                                    className="text-sm text-gray-600 hover:text-primary-600 hover:underline leading-tight block mb-1"
                                >
                                    {interaction.itemType === 'Album'
                                        ? (catalogItem as AlbumDetail).artistName
                                        : (catalogItem as TrackDetail).artists?.[0]?.name || 'Unknown Artist'
                                    }
                                </Link>

                                {/* Album reference line for tracks */}
                                {interaction.itemType === 'Track' && (catalogItem as TrackDetail).album && (
                                    <div className="text-xs text-gray-500 flex items-center mb-2">
                                        <Disc className="flex-shrink-0 h-3 w-3 mr-1" />
                                        <Link
                                            to={`/album/${(catalogItem as TrackDetail).album.spotifyId}`}
                                            className="hover:text-primary-600 hover:underline truncate"
                                        >
                                            {(catalogItem as TrackDetail).album.name}
                                        </Link>
                                    </div>
                                )}

                                {/* Rating and Like - moved here below artist */}
                                <div className="flex items-center mb-2">
                                    {interaction.rating && (
                                        <>
                                            <NormalizedStarDisplay
                                                currentGrade={interaction.rating.normalizedGrade}
                                                minGrade={1}
                                                maxGrade={10}
                                                size="sm"
                                            />

                                            {interaction.rating.isComplex && (
                                                <button
                                                    onClick={() => setIsRatingModalOpen(true)}
                                                    className="ml-1 text-primary-600 hover:text-primary-800 focus:outline-none"
                                                    title="View detailed rating"
                                                >
                                                    <SlidersHorizontal className="h-3 w-3" />
                                                </button>
                                            )}
                                        </>
                                    )}

                                    {interaction.isLiked && (
                                        <div className="flex items-center text-red-500 ml-2">
                                            <Heart className="h-4 w-4 fill-red-500" />
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Date - moved to bottom */}
                            <div className="flex items-center text-gray-600 text-xs">
                                <Calendar className="h-3 w-3 mr-1" />
                                <span>{formatDate(interaction.createdAt)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Desktop Layout - Keep original */}
                <div className="hidden sm:block">
                    {/* Main interaction info section - flex row on desktop */}
                    <div className="flex flex-col md:flex-row gap-6">
                        {/* Left column: Item image */}
                        <div className="md:w-1/3 flex-shrink-0">
                            <div className="aspect-square w-full rounded-md overflow-hidden shadow-md">
                                <img
                                    src={catalogItem.imageUrl || '/placeholder-album.jpg'}
                                    alt={catalogItem.name}
                                    className="w-full h-full object-cover"
                                />
                            </div>
                        </div>

                        {/* Right column: ItemHistory details */}
                        <div className="md:w-2/3">
                            {/* Creator info */}
                            <div className="flex items-center mb-4 group">
                                <Link to={`/people/${creatorProfile?.id}`} className="flex items-center">
                                    {creatorProfile?.avatarUrl ? (
                                        <img
                                            src={creatorProfile.avatarUrl}
                                            alt={creatorProfile.name}
                                            className="h-10 w-10 rounded-full object-cover mr-3"
                                        />
                                    ) : (
                                        <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-lg font-bold mr-3">
                                            {creatorProfile?.name.charAt(0).toUpperCase()}{creatorProfile?.surname.charAt(0).toUpperCase()}
                                        </div>
                                    )}
                                    <div>
                                        <span className="font-medium text-gray-900 group-hover:text-primary-600">{creatorProfile?.name} {creatorProfile?.surname}</span>
                                        <span className="text-gray-500 text-sm block">@{creatorProfile?.username}</span>
                                    </div>
                                </Link>
                            </div>

                            {/* Item info */}
                            <div className="mb-4">
                                <div className="flex items-center mb-1">
                                    <h1 className="text-2xl font-bold text-gray-900 mr-3">
                                        <Link
                                            to={`/${interaction.itemType.toLowerCase()}/${catalogItem.spotifyId}`}
                                            className="hover:text-primary-600"
                                        >
                                            {catalogItem.name}
                                        </Link>
                                    </h1>

                                    {/* For tracks, add preview play button */}
                                    {interaction.itemType === 'Track' && (
                                        <button
                                            className={`flex items-center justify-center rounded-full p-1.5 text-sm font-medium transition-colors border ${
                                                isPlaying
                                                    ? 'bg-primary-100 text-primary-700 border-primary-200'
                                                    : 'bg-gray-100 text-gray-800 border-gray-200'
                                            }`}
                                            onClick={handlePreviewToggle}
                                        >
                                            {isPlaying ? (
                                                <Pause className="h-4 w-4" />
                                            ) : (
                                                <Play className="h-4 w-4 fill-gray-800" />
                                            )}
                                        </button>
                                    )}

                                    <div className="flex items-center">
                                        {/* Display year for albums only here - for tracks it will be with the album */}
                                        {interaction.itemType === 'Album' && (
                                            <span className="mr-3 text-gray-600">
                                                {(catalogItem as AlbumDetail).releaseDate
                                                    ? new Date((catalogItem as AlbumDetail).releaseDate!).getFullYear()
                                                    : ''}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <Link
                                    to={`/artist/${interaction.itemType === 'Album'
                                        ? (catalogItem as AlbumDetail).artists?.[0]?.spotifyId
                                        : (catalogItem as TrackDetail).artists?.[0]?.spotifyId}`}
                                    className="text-lg text-gray-600 hover:text-primary-600 hover:underline"
                                >
                                    {interaction.itemType === 'Album'
                                        ? (catalogItem as AlbumDetail).artistName
                                        : (catalogItem as TrackDetail).artists?.[0]?.name || 'Unknown Artist'
                                    }
                                </Link>

                                {/* Album reference line for tracks - with Disc icon instead of "From" text */}
                                {interaction.itemType === 'Track' && (catalogItem as TrackDetail).album && (
                                    <div className="mt-1 text-sm text-gray-500 flex items-center">
                                        <Disc className="h-3.5 w-3.5 mr-1.5" />
                                        <Link
                                            to={`/album/${(catalogItem as TrackDetail).album.spotifyId}`}
                                            className="hover:text-primary-600 hover:underline"
                                        >
                                            {(catalogItem as TrackDetail).album.name}
                                        </Link>

                                        {/* Add year for tracks beside album name */}
                                        {(catalogItem as TrackDetail).album?.releaseDate && (
                                            <span className="ml-2 text-gray-500">
                                                {new Date((catalogItem as TrackDetail).album.releaseDate!).getFullYear()}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* ItemHistory details */}
                            <div className="mb-4">
                                {/* Rating and Like in one row */}
                                <div className="flex items-center mb-3">
                                    {/* Rating */}
                                    <div className="flex items-center">
                                        {interaction.rating && (
                                            <>
                                                <NormalizedStarDisplay
                                                    currentGrade={interaction.rating.normalizedGrade}
                                                    minGrade={1}
                                                    maxGrade={10}
                                                    size="md"
                                                />

                                                {interaction.rating.isComplex && (
                                                    <button
                                                        onClick={() => setIsRatingModalOpen(true)}
                                                        className="ml-2 text-primary-600 hover:text-primary-800 focus:outline-none"
                                                        title="View detailed rating"
                                                    >
                                                        <SlidersHorizontal className="h-4 w-4" />
                                                    </button>
                                                )}
                                            </>
                                        )}
                                    </div>

                                    {/* Like indicator - now placed directly after rating with less spacing */}
                                    {interaction.isLiked && interaction.rating && (
                                        <div className="flex items-center text-red-500 ml-2">
                                            <Heart className="h-5 w-5 fill-red-500 mr-1" />
                                        </div>
                                    )}
                                    {interaction.isLiked && !interaction.rating && (
                                        <div className="flex items-center text-red-500">
                                            <Heart className="h-5 w-5 fill-red-500 mr-1"/>
                                            Liked
                                        </div>
                                    )}
                                </div>

                                {/* Date - moved below rating and like */}
                                <div className="flex items-center text-gray-600 text-sm">
                                    <Calendar className="h-4 w-4 mr-1" />
                                    <span>{formatDate(interaction.createdAt)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Review section - Full width below main info */}
                {interaction.review && (
                    <div className="mt-4 sm:mt-6 space-y-3 border-t pt-4 sm:pt-6">
                        <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">Review</h3>
                        <div className="bg-gray-50 p-3 sm:p-4 rounded-md border border-gray-200">
                            <p className="text-gray-800 whitespace-pre-wrap text-sm sm:text-base">{interaction.review.reviewText}</p>
                        </div>

                        {/* Review actions */}
                        <div className="flex items-center space-x-3 sm:space-x-4">
                            {isAuthenticated && (
                                <button
                                    onClick={handleToggleLike}
                                    disabled={processingLike}
                                    className={`flex items-center text-xs sm:text-sm ${
                                        hasLikedReview ? 'text-primary-600' : 'text-gray-500 hover:text-primary-600'
                                    }`}
                                >
                                    <ThumbsUp className={`h-3 w-3 sm:h-4 sm:w-4 mr-1 ${hasLikedReview ? 'fill-primary-600' : ''}`} />
                                    <span>{hasLikedReview ? 'Liked' : 'Like'}</span>
                                    {likeCount > 0 && <span className="ml-1">({likeCount})</span>}
                                </button>
                            )}

                            <button
                                onClick={() => document.getElementById('comments-section')?.scrollIntoView({ behavior: 'smooth' })}
                                className="flex items-center text-xs sm:text-sm text-gray-500 hover:text-primary-600"
                            >
                                <MessageSquare className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                                <span>Comments</span>
                                {totalComments > 0 && <span className="ml-1">({totalComments})</span>}
                            </button>

                            {isAuthenticated && user?.id !== interaction.userId && (
                                <button
                                    onClick={() => {
                                        alert('Report functionality to be implemented');
                                    }}
                                    className="flex items-center text-xs sm:text-sm text-gray-500 hover:text-gray-700"
                                >
                                    <Flag className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                                    <span className="hidden sm:inline">Report</span>
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Comments section */}
            {interaction.review && (
                <div id="comments-section" className="bg-white shadow rounded-lg p-3 sm:p-6">
                    <h2 className="text-lg sm:text-xl font-bold mb-4 sm:mb-6 flex items-center">
                        <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-gray-500" />
                        <span className="text-sm sm:text-xl">Comments</span>
                        {totalComments > 0 && <span className="ml-2 text-gray-500 text-sm sm:text-xl">({totalComments})</span>}
                    </h2>

                    {/* Comment form */}
                    {isAuthenticated ? (
                        <div className="mb-4 sm:mb-6">
                            <div className="flex">
                                <div className="mr-2 sm:mr-3 flex-shrink-0">
                                    {user?.avatarUrl ? (
                                        <img
                                            src={user.avatarUrl}
                                            alt={user.name}
                                            className="h-8 w-8 sm:h-10 sm:w-10 rounded-full object-cover"
                                        />
                                    ) : (
                                        <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-sm sm:text-lg font-bold">
                                            {user?.name.charAt(0).toUpperCase()}{user?.surname.charAt(0).toUpperCase()}
                                        </div>
                                    )}
                                </div>
                                <div className="flex-grow relative">
                                    <textarea
                                        value={newComment}
                                        onChange={(e) => setNewComment(e.target.value)}
                                        placeholder="Write a comment..."
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-sm sm:text-base"
                                        rows={2}
                                    />
                                    <button
                                        onClick={handleSubmitComment}
                                        disabled={!newComment.trim() || submittingComment}
                                        className="absolute bottom-2 right-2 p-1 rounded-full bg-primary-500 text-white disabled:bg-gray-300 disabled:cursor-not-allowed"
                                    >
                                        <Send className="h-3 w-3 sm:h-4 sm:w-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="mb-4 sm:mb-6 bg-gray-50 p-3 sm:p-4 rounded-md text-center">
                            <p className="text-gray-600 mb-2 text-sm sm:text-base">You need to be logged in to comment</p>
                            <button
                                onClick={() => navigate('/login', { state: { from: `/interaction/${id}` } })}
                                className="px-3 py-1.5 sm:px-4 sm:py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 text-sm sm:text-base"
                            >
                                Log In
                            </button>
                        </div>
                    )}

                    {/* Comments list */}
                    <div className="space-y-3 sm:space-y-4">
                        {commentsError && (
                            <div className="bg-red-50 border border-red-200 text-red-700 p-3 sm:p-4 rounded-md">
                                {commentsError}
                            </div>
                        )}

                        {comments.length === 0 && !commentsLoading && !commentsError ? (
                            <div className="text-center py-6 sm:py-8 text-gray-500">
                                <p className="text-sm sm:text-base">No comments yet. Be the first to comment!</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-200">
                                {comments.map((comment) => {
                                    const commentUser = commentUsers.get(comment.userId);
                                    return (
                                        <div key={comment.commentId} className="py-3 sm:py-4">
                                            {/* Mobile Comment Layout */}
                                            <div className="sm:hidden flex">
                                                <div className="mr-2 flex-shrink-0">
                                                    <Link to={`/people/${comment.userId}`}>
                                                        {commentUser?.avatarUrl ? (
                                                            <img
                                                                src={commentUser.avatarUrl}
                                                                alt={`${commentUser.name}`}
                                                                className="h-7 w-7 rounded-full object-cover"
                                                            />
                                                        ) : (
                                                            <div className="h-7 w-7 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-xs font-bold">
                                                                {commentUser ? (
                                                                    `${commentUser.name.charAt(0)}${commentUser.surname.charAt(0)}`
                                                                ) : (
                                                                    '?'
                                                                )}
                                                            </div>
                                                        )}
                                                    </Link>
                                                </div>
                                                <div className="flex-grow min-w-0">
                                                    <div className="flex justify-between items-start mb-1">
                                                        <div className="flex-grow min-w-0">
                                                            <Link
                                                                to={`/people/${comment.userId}`}
                                                                className="font-medium text-gray-900 hover:text-primary-600 text-sm truncate"
                                                            >
                                                                {commentUser ? (
                                                                    <>
                                                                        {commentUser.name} {commentUser.surname}
                                                                    </>
                                                                ) : (
                                                                    'User'
                                                                )}
                                                            </Link>
                                                            <span className="text-gray-500 text-xs ml-2">
                                                                {formatDate(comment.commentedAt)}
                                                            </span>
                                                        </div>
                                                        {user && user.id === comment.userId && (
                                                            <button
                                                                onClick={() => handleDeleteComment(comment.commentId)}
                                                                className="text-gray-400 hover:text-red-500 ml-2 flex-shrink-0"
                                                                title="Delete comment"
                                                            >
                                                                <Trash2 className="h-3 w-3" />
                                                            </button>
                                                        )}
                                                    </div>
                                                    <p className="text-gray-800 text-sm leading-relaxed">{comment.commentText}</p>
                                                </div>
                                            </div>

                                            {/* Desktop Comment Layout - Keep original */}
                                            <div className="hidden sm:flex">
                                                <div className="mr-3 flex-shrink-0">
                                                    <Link to={`/people/${comment.userId}`}>
                                                        {commentUser?.avatarUrl ? (
                                                            <img
                                                                src={commentUser.avatarUrl}
                                                                alt={`${commentUser.name}`}
                                                                className="h-10 w-10 rounded-full object-cover"
                                                            />
                                                        ) : (
                                                            <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-lg font-bold">
                                                                {commentUser ? (
                                                                    `${commentUser.name.charAt(0)}${commentUser.surname.charAt(0)}`
                                                                ) : (
                                                                    '?'
                                                                )}
                                                            </div>
                                                        )}
                                                    </Link>
                                                </div>
                                                <div className="flex-grow">
                                                    <div className="flex justify-between mb-1">
                                                        <div>
                                                            <Link
                                                                to={`/people/${comment.userId}`}
                                                                className="font-medium text-gray-900 hover:text-primary-600"
                                                            >
                                                                {commentUser ? (
                                                                    <>
                                                                        {commentUser.name} {commentUser.surname}
                                                                    </>
                                                                ) : (
                                                                    'User'
                                                                )}
                                                            </Link>
                                                            <span className="text-gray-500 text-sm ml-2">
                                                                {formatDate(comment.commentedAt)}
                                                            </span>
                                                        </div>
                                                        {user && user.id === comment.userId && (
                                                            <button
                                                                onClick={() => handleDeleteComment(comment.commentId)}
                                                                className="text-gray-400 hover:text-red-500"
                                                                title="Delete comment"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </button>
                                                        )}
                                                    </div>
                                                    <p className="text-gray-800">{comment.commentText}</p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Load more comments button */}
                        {hasMoreComments && (
                            <div className="mt-4 text-center">
                                <button
                                    onClick={handleLoadMoreComments}
                                    disabled={commentsLoading}
                                    className="px-3 py-1.5 sm:px-4 sm:py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50 text-sm sm:text-base"
                                >
                                    {commentsLoading ? (
                                        <>
                                            <span className="inline-block h-3 w-3 sm:h-4 sm:w-4 border-t-2 border-b-2 border-primary-600 rounded-full animate-spin mr-2 align-middle"></span>
                                            Loading...
                                        </>
                                    ) : (
                                        'Load More Comments'
                                    )}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Complex Rating Modal */}
            {interaction.rating?.isComplex && interaction.rating?.ratingId && (
                <ComplexRatingModal
                    isOpen={isRatingModalOpen}
                    onClose={() => setIsRatingModalOpen(false)}
                    ratingId={interaction.rating.ratingId}
                    itemName={catalogItem.name}
                    artistName={interaction.itemType === 'Album'
                        ? (catalogItem as AlbumDetail).artistName
                        : (catalogItem as TrackDetail).artists?.[0]?.name || 'Unknown Artist'}
                    date={formatDate(interaction.createdAt)}
                />
            )}
        </div>
    );
};

export default InteractionDetailPage;