import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
    Calendar,
    Send,
    MessageSquare,
    Trash2,
    Flag,
    ArrowLeft,
    ThumbsUp,
    Music,
    Disc,
    Pencil
} from 'lucide-react';
import ListsService, { ListDetail, ListComment } from '../api/lists';
import CatalogService from '../api/catalog';
import UsersService, { PublicUserProfile } from '../api/users';
import useAuthStore from '../store/authStore';
import { formatDate } from '../utils/formatters';

const ListDetailsPage = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user, isAuthenticated } = useAuthStore();

    // State
    const [list, setList] = useState<ListDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [creatorProfile, setCreatorProfile] = useState<PublicUserProfile | null>(null);
    const [hasLiked, setHasLiked] = useState(false);
    const [likeCount, setLikeCount] = useState(0);
    const [processingLike, setProcessingLike] = useState(false);
    const [comments, setComments] = useState<ListComment[]>([]);
    const [commentUsers, setCommentUsers] = useState<Map<string, PublicUserProfile>>(new Map());
    const [commentsLoading, setCommentsLoading] = useState(false);
    const [commentsError, setCommentsError] = useState<string | null>(null);
    const [hasMoreComments, setHasMoreComments] = useState(false);
    const [commentsOffset, setCommentsOffset] = useState(0);
    const [totalComments, setTotalComments] = useState(0);
    const [newComment, setNewComment] = useState('');
    const [submittingComment, setSubmittingComment] = useState(false);
    const [itemImages, setItemImages] = useState<Record<string, string>>({});
    const [itemNames, setItemNames] = useState<Record<string, string>>({});
    const [itemArtists, setItemArtists] = useState<Record<string, string>>({});

    // Fetch list data
    useEffect(() => {
        const fetchListData = async () => {
            if (!id) return;

            setLoading(true);
            setError(null);

            try {
                // Get list details
                const listData = await ListsService.getListById(id);

                if (!listData) {
                    setError('List not found');
                    setLoading(false);
                    return;
                }

                setList(listData);
                setLikeCount(listData.likes);

                // Fetch creator profile
                try {
                    const creatorData = await UsersService.getUserProfileById(listData.userId);
                    setCreatorProfile(creatorData);
                } catch (err) {
                    console.error('Error fetching creator profile:', err);
                }

                // Check if current user has liked the list
                if (isAuthenticated && user) {
                    try {
                        const likeStatus = await ListsService.checkUserLikedList(listData.listId, user.id);
                        setHasLiked(likeStatus);
                    } catch (err) {
                        console.error('Error checking like status:', err);
                    }
                }

                // Fetch item details (images, names, artists)
                if (listData.items.length > 0) {
                    const itemIds = listData.items.map(item => item.spotifyId);
                    const previewResponse = await CatalogService.getItemPreviewInfo(
                        itemIds,
                        [listData.listType.toLowerCase()]
                    );

                    const newItemImages: Record<string, string> = {};
                    const newItemNames: Record<string, string> = {};
                    const newItemArtists: Record<string, string> = {};

                    previewResponse.results?.forEach(group => {
                        group.items?.forEach(item => {
                            newItemImages[item.spotifyId] = item.imageUrl;
                            newItemNames[item.spotifyId] = item.name;
                            newItemArtists[item.spotifyId] = item.artistName;
                        });
                    });

                    setItemImages(newItemImages);
                    setItemNames(newItemNames);
                    setItemArtists(newItemArtists);
                }

            } catch (err) {
                console.error('Error fetching list data:', err);
                setError('Failed to load list data. Please try again later.');
            } finally {
                setLoading(false);
            }
        };

        fetchListData();
    }, [id, isAuthenticated, user]);

    // Fetch initial comments
    useEffect(() => {
        const fetchComments = async () => {
            if (!list?.listId) return;

            setCommentsLoading(true);
            setCommentsError(null);

            try {
                const result = await ListsService.getListComments(list.listId, 10, 0);

                setComments(result.comments || []);
                setTotalComments(result.totalCount);
                setHasMoreComments(result.totalCount > 10);
                setCommentsOffset(result.comments?.length || 0);

                // Fetch user data for each comment
                if (result.comments && result.comments.length > 0) {
                    const userIds = [...new Set(result.comments.map(comment => comment.userId))];

                    try {
                        const userProfiles = await UsersService.getUserProfilesBatch(userIds);
                        const usersMap = new Map<string, PublicUserProfile>();

                        userProfiles.forEach(profile => {
                            usersMap.set(profile.id, profile);
                        });

                        setCommentUsers(usersMap);
                    } catch (error) {
                        console.error('Error fetching users for comments:', error);
                    }
                }
            } catch (err) {
                console.error('Error fetching comments:', err);
                setCommentsError('Failed to load comments');
            } finally {
                setCommentsLoading(false);
            }
        };

        if (list?.listId) {
            fetchComments();
        }
    }, [list]);

    const handleLoadMoreComments = async () => {
        if (!list?.listId || commentsLoading || !hasMoreComments) return;

        setCommentsLoading(true);

        try {
            const result = await ListsService.getListComments(list.listId, 10, commentsOffset);

            const newComments = result.comments || [];
            setComments((prev) => [...prev, ...newComments]);
            setCommentsOffset((prev) => prev + newComments.length);
            setHasMoreComments((commentsOffset + newComments.length) < result.totalCount);

            // Fetch user data for new comments
            if (newComments.length > 0) {
                const newUserIds = [...new Set(newComments.map(comment => comment.userId))];
                const userIdsToFetch = newUserIds.filter(id => !commentUsers.has(id));

                if (userIdsToFetch.length > 0) {
                    try {
                        const userProfiles = await UsersService.getUserProfilesBatch(userIdsToFetch);

                        setCommentUsers(prev => {
                            const updated = new Map(prev);
                            userProfiles.forEach(profile => {
                                updated.set(profile.id, profile);
                            });
                            return updated;
                        });
                    } catch (error) {
                        console.error('Error fetching users for new comments:', error);
                    }
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
        if (!list?.listId || !user || !newComment.trim() || submittingComment) return;

        setSubmittingComment(true);

        try {
            const request = {
                userId: user.id,
                commentText: newComment
            };

            const response = await ListsService.addListComment(list.listId, request);

            if (response.success && response.comment) {
                // Add the new comment to the list (optimistic update)
                const newCommentObj: ListComment = response.comment;

                // Make sure we have the current user in our users map
                if (!commentUsers.has(user.id)) {
                    setCommentUsers(prev => {
                        const updated = new Map(prev);
                        updated.set(user.id, {
                            id: user.id,
                            username: user.username || '',
                            name: user.name,
                            surname: user.surname,
                            avatarUrl: user.avatarUrl,
                            followerCount: 0,
                            followingCount: 0,
                            createdAt: new Date().toISOString()
                        });
                        return updated;
                    });
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
            const success = await ListsService.deleteListComment(commentId, user.id);

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
        if (!list?.listId || !user || processingLike) return;

        setProcessingLike(true);

        try {
            if (hasLiked) {
                const success = await ListsService.unlikeList(list.listId, user.id);

                if (success) {
                    setHasLiked(false);
                    setLikeCount((prev) => Math.max(0, prev - 1));
                }
            } else {
                const success = await ListsService.likeList(list.listId, user.id);

                if (success) {
                    setHasLiked(true);
                    setLikeCount((prev) => prev + 1);
                }
            }
        } catch (err) {
            console.error('Error toggling like:', err);
        } finally {
            setProcessingLike(false);
        }
    };

    const navigateToItemPage = (spotifyId: string) => {
        if (!list) return;

        const itemType = list.listType.toLowerCase();
        navigate(`/${itemType}/${spotifyId}`);
    };

    if (loading) {
        return (
            <div className="max-w-6xl mx-auto py-8 px-4">
                <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary-600"></div>
                    <span className="ml-3 text-lg text-gray-600">Loading list details...</span>
                </div>
            </div>
        );
    }

    if (error || !list) {
        return (
            <div className="max-w-6xl mx-auto py-8 px-4">
                <div className="bg-red-50 border border-red-200 text-red-700 p-6 rounded-lg">
                    <h2 className="text-xl font-semibold mb-2">Error</h2>
                    <p>{error || "Couldn't find the list you're looking for."}</p>
                    <button
                        onClick={() => navigate(-1)}
                        className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
                    >
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto py-2 sm:py-8 px-2 sm:px-4">
            {/* Header with back button */}
            <div className="mb-4 sm:mb-6 flex justify-between items-center">
                <button
                    onClick={() => navigate(-1)}
                    className="text-gray-600 hover:text-gray-900 flex items-center"
                >
                    <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5 mr-1" />
                    <span className="text-sm sm:text-base">Back</span>
                </button>

                <div className="w-10"></div>
            </div>

            {/* Main list details section */}
            <div className="bg-white shadow rounded-lg mb-4 sm:mb-6">
                <div className="p-3 sm:p-6">
                    {/* Mobile Layout */}
                    <div className="sm:hidden">
                        {/* Creator info - compact */}
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

                        {/* List title and meta */}
                        <h1 className="text-lg font-bold text-gray-900 mb-2">{list.listName}</h1>

                        {/* Date and type */}
                        <div className="flex items-center text-gray-600 text-xs mb-3">
                            <Calendar className="h-3 w-3 mr-1"/>
                            {formatDate(list.createdAt)}
                        </div>

                        {/* Description */}
                        {list.listDescription && (
                            <div className="mb-4 text-gray-700 text-sm">
                                <p>{list.listDescription}</p>
                            </div>
                        )}
                    </div>

                    {/* Desktop Layout - Keep original */}
                    <div className="hidden sm:block">
                        {/* Creator info */}
                        <div className="flex items-center mb-4 group">
                            <Link to={`/people/${creatorProfile?.id}`} className="flex items-center">
                                {creatorProfile?.avatarUrl ? (
                                    <img
                                        src={creatorProfile.avatarUrl}
                                        alt={creatorProfile.name}
                                        className="h-12 w-12 rounded-full object-cover mr-3"
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

                        {/* List details */}
                        <div className="flex flex-col md:flex-row gap-6 mb-6">
                            {/* List info */}
                            <div className="flex-grow">
                                <div className="flex items-center mb-2">
                                    <h1 className="text-2xl font-bold text-gray-900 mr-3">{list.listName}</h1>
                                </div>

                                {/* List type and date */}
                                <div className="flex items-center text-gray-600 text-sm mb-4">
                                    <span className="flex items-center">
                                        <Calendar className="h-3.5 w-3.5 mr-1"/>
                                        {formatDate(list.createdAt)}
                                    </span>
                                </div>

                                {/* Description */}
                                {list.listDescription && (
                                    <div className="mb-4 text-gray-700">
                                        <p>{list.listDescription}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* List items grid */}
                    <div className="mb-4 sm:mb-6">
                        {/* Mobile Grid - 3 columns */}
                        <div className="grid grid-cols-3 gap-2 sm:hidden">
                            {list.items.map((item, index) => (
                                <div
                                    key={item.spotifyId}
                                    className="relative flex flex-col items-center"
                                >
                                    {/* Item card - mobile */}
                                    <div
                                        onClick={() => navigateToItemPage(item.spotifyId)}
                                        className="w-full group bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200 cursor-pointer mb-1"
                                    >
                                        {/* Item image */}
                                        <div className="aspect-square w-full overflow-hidden rounded-t-lg">
                                            {itemImages[item.spotifyId] ? (
                                                <img
                                                    src={itemImages[item.spotifyId]}
                                                    alt={itemNames[item.spotifyId] || 'Unknown item'}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                                                    {list.listType === 'Album' ? (
                                                        <Disc className="h-6 w-6 text-gray-400"/>
                                                    ) : (
                                                        <Music className="h-6 w-6 text-gray-400"/>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* Item details - compact */}
                                        <div className="p-1">
                                            <p className="text-xs font-medium text-gray-900 truncate leading-tight">
                                                {itemNames[item.spotifyId] || 'Unknown item'}
                                            </p>
                                            <p className="text-[0.700rem] text-gray-500 truncate leading-tight">
                                                {itemArtists[item.spotifyId] || 'Unknown artist'}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Show rank if list is ranked - mobile */}
                                    {list.isRanked && (
                                        <div className="flex-shrink-0 w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center text-purple-800 font-medium text-xs">
                                            {item.number || index + 1}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Desktop Grid - Keep original 5 columns */}
                        <div className="hidden sm:grid sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                            {list.items.map((item, index) => (
                                <div
                                    key={item.spotifyId}
                                    className="relative flex flex-col items-center"
                                >
                                    {/* Item card */}
                                    <div
                                        onClick={() => navigateToItemPage(item.spotifyId)}
                                        className="w-full group bg-white rounded-lg overflow-visible shadow-sm hover:shadow-md transition-shadow duration-200 cursor-pointer mb-1.5"
                                    >
                                        {/* Item image */}
                                        <div className="aspect-square w-full overflow-hidden rounded-t-lg">
                                            {itemImages[item.spotifyId] ? (
                                                <img
                                                    src={itemImages[item.spotifyId]}
                                                    alt={itemNames[item.spotifyId] || 'Unknown item'}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                                                    {list.listType === 'Album' ? (
                                                        <Disc className="h-12 w-12 text-gray-400"/>
                                                    ) : (
                                                        <Music className="h-12 w-12 text-gray-400"/>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* Item details */}
                                        <div className="p-2">
                                            <p className="text-sm font-medium text-gray-900 truncate">
                                                {itemNames[item.spotifyId] || 'Unknown item'}
                                            </p>
                                            <p className="text-xs text-gray-500 truncate">
                                                {itemArtists[item.spotifyId] || 'Unknown artist'}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Show rank if list is ranked - desktop */}
                                    {list.isRanked && (
                                        <div className="flex-shrink-0 w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center text-purple-800 font-medium">
                                            {item.number || index + 1}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* List actions */}
                    <div className="flex items-center space-x-3 sm:space-x-4 border-t border-gray-200 pt-3 sm:pt-4">
                        {isAuthenticated && (
                            <button
                                onClick={handleToggleLike}
                                disabled={processingLike}
                                className={`flex items-center text-xs sm:text-sm ${
                                    hasLiked ? 'text-primary-600' : 'text-gray-500 hover:text-primary-600'
                                }`}
                            >
                                <ThumbsUp className={`h-3 w-3 sm:h-4 sm:w-4 mr-1 ${hasLiked ? 'fill-primary-600' : ''}`}/>
                                <span>{hasLiked ? 'Liked' : 'Like'}</span>
                                {likeCount > 0 && <span className="ml-1">({likeCount})</span>}
                            </button>
                        )}

                        <button
                            onClick={() => document.getElementById('comments-section')?.scrollIntoView({behavior: 'smooth'})}
                            className="flex items-center text-xs sm:text-sm text-gray-500 hover:text-primary-600"
                        >
                            <MessageSquare className="h-3 w-3 sm:h-4 sm:w-4 mr-1"/>
                            <span>Comments</span>
                            {totalComments > 0 && <span className="ml-1">({totalComments})</span>}
                        </button>

                        {isAuthenticated && user?.id === list.userId && (
                            <button
                                onClick={() => {
                                    navigate(`/lists/edit/${list.listId}`);
                                }}
                                className="flex items-center text-xs sm:text-sm text-gray-500 hover:text-gray-700"
                            >
                                <Pencil className="h-3 w-3 sm:h-4 sm:w-4 mr-1"/>
                                <span className="hidden sm:inline">Edit</span>
                            </button>
                        )}

                        {isAuthenticated && user?.id !== list.userId && (
                            <button
                                onClick={() => {
                                    alert('Report functionality to be implemented');
                                }}
                                className="flex items-center text-xs sm:text-sm text-gray-500 hover:text-gray-700"
                            >
                                <Flag className="h-3 w-3 sm:h-4 sm:w-4 mr-1"/>
                                <span className="hidden sm:inline">Report</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Comments section */}
            <div id="comments-section" className="bg-white shadow rounded-lg p-3 sm:p-6">
                <h2 className="text-lg sm:text-xl font-bold mb-4 sm:mb-6 flex items-center">
                    <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-gray-500"/>
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
                            onClick={() => navigate('/login', { state: { from: `/lists/${id}` } })}
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
        </div>
    );
};

export default ListDetailsPage;