import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ThumbsUp, MessageSquare, Loader, Heart, SlidersHorizontal } from 'lucide-react';
import InteractionService, { InteractionDetailDTO } from '../../api/interaction';
import UsersService, { PublicUserProfile } from '../../api/users';
import { formatDate } from '../../utils/formatters';
import NormalizedStarDisplay from '../CreateInteraction/NormalizedStarDisplay';
import EmptyState from '../common/EmptyState';

interface ItemReviewsProps {
    itemId: string;
    itemType: 'Album' | 'Track';
    onWriteReview?: () => void;
}

const ItemReviewsComponent = ({ itemId, itemType, onWriteReview }: ItemReviewsProps) => {
    const navigate = useNavigate();
    const [reviews, setReviews] = useState<InteractionDetailDTO[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(true);
    const [offset, setOffset] = useState(0);
    const [, setTotalReviews] = useState(0);
    const [userProfiles, setUserProfiles] = useState<Map<string, PublicUserProfile>>(new Map());

    const observerRef = useRef<IntersectionObserver | null>(null);
    const loadMoreTriggerRef = useRef<HTMLDivElement | null>(null);

    const limit = 20;

    // Fetch user profiles for the reviews using the new batch endpoint
    const fetchUserProfiles = useCallback(async (userIds: string[]) => {
        if (userIds.length === 0) return;

        const uniqueUserIds = [...new Set(userIds)];

        try {
            const profiles = await UsersService.getUserProfilesBatch(uniqueUserIds);
            const newProfiles = new Map<string, PublicUserProfile>();

            profiles.forEach(profile => {
                newProfiles.set(profile.id, profile);
            });

            setUserProfiles(prevProfiles => {
                const mergedProfiles = new Map(prevProfiles);
                newProfiles.forEach((profile, id) => {
                    mergedProfiles.set(id, profile);
                });
                return mergedProfiles;
            });
        } catch (error) {
            console.error('Failed to fetch user profiles batch:', error);
        }
    }, []);

    // Initial load of reviews
    useEffect(() => {
        const fetchReviews = async () => {
            if (!itemId) return;

            setLoading(true);
            setError(null);

            try {
                const { items: reviewItems, totalCount } = await InteractionService.getItemReviews(
                    itemId,
                    limit,
                    0
                );

                setReviews(reviewItems);
                setTotalReviews(totalCount);
                setOffset(reviewItems.length);
                setHasMore(reviewItems.length < totalCount);

                if (reviewItems.length > 0) {
                    await fetchUserProfiles(reviewItems.map(review => review.userId));
                }
            } catch (err) {
                console.error('Error fetching reviews:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchReviews();
    }, [itemId, itemType, fetchUserProfiles]);

    // Load more reviews when triggered
    const loadMoreReviews = useCallback(async () => {
        if (!itemId || loadingMore || !hasMore) return;

        setLoadingMore(true);

        try {
            const { items: moreReviews, totalCount } = await InteractionService.getItemReviews(
                itemId,
                limit,
                offset
            );

            if (moreReviews.length === 0) {
                setHasMore(false);
                return;
            }

            setReviews(prev => [...prev, ...moreReviews]);
            setOffset(prev => prev + moreReviews.length);
            setHasMore(offset + moreReviews.length < totalCount);

            await fetchUserProfiles(moreReviews.map(review => review.userId));
        } catch (err) {
            console.error('Error loading more reviews:', err);
        } finally {
            setLoadingMore(false);
        }
    }, [itemId, offset, loadingMore, hasMore, fetchUserProfiles]);

    // Set up intersection observer for infinite scroll
    useEffect(() => {
        if (loading || !hasMore) return;

        if (observerRef.current) {
            observerRef.current.disconnect();
        }

        observerRef.current = new IntersectionObserver(entries => {
            const [entry] = entries;
            if (entry.isIntersecting && !loadingMore) {
                loadMoreReviews();
            }
        }, { threshold: 0.5 });

        if (loadMoreTriggerRef.current) {
            observerRef.current.observe(loadMoreTriggerRef.current);
        }

        return () => {
            if (observerRef.current) {
                observerRef.current.disconnect();
            }
        };
    }, [loadingMore, hasMore, loading, loadMoreReviews]);

    const handleReviewClick = (interactionId: string) => {
        navigate(`/interaction/${interactionId}`);
    };

    if (loading && reviews.length === 0) {
        return (
            <div className="flex justify-center items-center py-10">
                <Loader className="h-8 w-8 text-primary-600 animate-spin mr-2" />
                <span className="text-gray-600">Loading reviews...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
                {error}
                <button
                    onClick={() => window.location.reload()}
                    className="ml-2 underline hover:text-red-900"
                >
                    Try again
                </button>
            </div>
        );
    }

    if (reviews.length === 0 && !loading) {
        return (
            <EmptyState
                title="No reviews yet"
                message={`Be the first to share your thoughts about this ${itemType.toLowerCase()}.`}
                icon={<MessageSquare className="h-12 w-12 text-gray-400" />}
                action={onWriteReview ? {
                    label: "Write a Review",
                    onClick: onWriteReview
                } : undefined}
            />
        );
    }

    return (
        <div className="space-y-6">
            {/* Reviews list */}
            <div className="space-y-6">
                {reviews.map(review => {
                    const userProfile = userProfiles.get(review.userId);

                    return (
                        <div
                            key={review.aggregateId}
                            className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-200"
                            onClick={() => handleReviewClick(review.aggregateId)}
                        >
                            {/* Mobile Layout */}
                            <div className="sm:hidden">
                                <div className="p-3 cursor-pointer">
                                    {/* Top row: User info + Rating + Date */}
                                    <div className="flex items-start justify-between mb-2">
                                        <div className="flex items-center flex-1 min-w-0">
                                            {/* User avatar */}
                                            <div className="flex-shrink-0 mr-2">
                                                {userProfile?.avatarUrl ? (
                                                    <img
                                                        src={userProfile.avatarUrl}
                                                        alt={userProfile.name}
                                                        className="h-9 w-9 rounded-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="h-9 w-9 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-xs font-bold">
                                                        {userProfile ?
                                                            `${userProfile.name.charAt(0)}${userProfile.surname.charAt(0)}` :
                                                            '?'}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Username and rating */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center space-x-2 mb-1">
                                                    <span className="font-medium text-gray-900 text-sm truncate">
                                                        {userProfile ? `${userProfile.name} ${userProfile.surname}` : 'Unknown User'}
                                                    </span>
                                                </div>

                                                {/* Rating display */}
                                                {review.rating && (
                                                    <div className="flex items-center space-x-1">
                                                        <NormalizedStarDisplay
                                                            currentGrade={review.rating.normalizedGrade}
                                                            minGrade={1}
                                                            maxGrade={10}
                                                            size="sm"
                                                        />
                                                        {review.rating.isComplex && (
                                                            <SlidersHorizontal className="h-3 w-3 text-primary-600" />
                                                        )}
                                                        {review.isLiked && (
                                                            <Heart className="h-3 w-3 text-red-500 fill-red-500 ml-2" />
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Date */}
                                        <span className="text-xs text-gray-500 flex-shrink-0">
                                            {formatDate(review.createdAt)}
                                        </span>
                                    </div>

                                    {/* Review text */}
                                    {review.review && (
                                        <div className="mt-2 text-gray-800 text-sm">
                                            {review.review.reviewText.length > 300
                                                ? `${review.review.reviewText.substring(0, 300)}...`
                                                : review.review.reviewText}
                                        </div>
                                    )}

                                    {/* Likes and comments count */}
                                    {review.review && (
                                        <div className="mt-3 flex items-center text-xs text-gray-600 space-x-4">
                                            <div className="flex items-center">
                                                <ThumbsUp className="h-3 w-3 mr-1" />
                                                <span>{review.review.likes}</span>
                                            </div>
                                            <div className="flex items-center">
                                                <MessageSquare className="h-3 w-3 mr-1" />
                                                <span>{review.review.comments}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Desktop Layout (original) */}
                            <div className="hidden sm:block">
                                <div className="p-4 cursor-pointer">
                                    {/* User and rating info */}
                                    <div className="flex items-start mb-3">
                                        {/* User avatar */}
                                        <div className="flex-shrink-0 mr-3">
                                            {userProfile?.avatarUrl ? (
                                                <img
                                                    src={userProfile.avatarUrl}
                                                    alt={userProfile.name}
                                                    className="h-10 w-10 rounded-full object-cover"
                                                />
                                            ) : (
                                                <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-lg font-bold">
                                                    {userProfile ?
                                                        `${userProfile.name.charAt(0)}${userProfile.surname.charAt(0)}` :
                                                        '?'}
                                                </div>
                                            )}
                                        </div>

                                        {/* Username, rating and date */}
                                        <div className="flex-grow">
                                            <div className="flex flex-wrap items-center gap-x-2 mb-1">
                                                <span className="font-medium text-gray-900">
                                                    {userProfile ? `${userProfile.name} ${userProfile.surname}` : 'Unknown User'}
                                                </span>

                                                {/* Rating display */}
                                                {review.rating && (
                                                    <div className="flex items-center">
                                                        <NormalizedStarDisplay
                                                            currentGrade={review.rating.normalizedGrade}
                                                            minGrade={1}
                                                            maxGrade={10}
                                                            size="sm"
                                                        />

                                                        {review.rating.isComplex && (
                                                            <span className="ml-1 text-primary-600">
                                                                <SlidersHorizontal className="h-3.5 w-3.5" />
                                                            </span>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Like indicator */}
                                                {review.isLiked && (
                                                    <Heart className="h-4 w-4 text-red-500 fill-red-500" />
                                                )}

                                                {/* Date */}
                                                <span className="text-xs text-gray-500">
                                                    {formatDate(review.createdAt)}
                                                </span>
                                            </div>

                                            {/* Review text */}
                                            {review.review && (
                                                <div className="mt-2 text-gray-800 whitespace-pre-line">
                                                    {review.review.reviewText.length > 500
                                                        ? `${review.review.reviewText.substring(0, 500)}...`
                                                        : review.review.reviewText}
                                                </div>
                                            )}

                                            {/* Likes and comments count */}
                                            <div className="mt-3 flex items-center text-xs text-gray-600 space-x-4">
                                                {review.review && (
                                                    <>
                                                        <div className="flex items-center">
                                                            <ThumbsUp className="h-3.5 w-3.5 mr-1" />
                                                            <span>{review.review.likes} {review.review.likes === 1 ? 'like' : 'likes'}</span>
                                                        </div>
                                                        <div className="flex items-center">
                                                            <MessageSquare className="h-3.5 w-3.5 mr-1" />
                                                            <span>{review.review.comments} {review.review.comments === 1 ? 'comment' : 'comments'}</span>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Load more trigger */}
            <div
                ref={loadMoreTriggerRef}
                className={`h-10 ${!hasMore ? 'hidden' : ''}`}
            >
                {loadingMore && (
                    <div className="flex justify-center items-center py-4">
                        <Loader className="h-5 w-5 text-primary-600 animate-spin mr-2" />
                        <span className="text-gray-600">Loading more reviews...</span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ItemReviewsComponent;