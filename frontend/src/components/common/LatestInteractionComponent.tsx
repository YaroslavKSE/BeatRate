import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Heart, MessageSquare, Scale } from 'lucide-react';
import InteractionService, { InteractionDetailDTO } from '../../api/interaction';
import useAuthStore from '../../store/authStore';
import NormalizedStarDisplay from '../CreateInteraction/NormalizedStarDisplay';

interface LatestInteractionComponentProps {
    itemId: string;
    itemType: 'Album' | 'Track';
    onCreateInteraction?: () => void;
    refreshTrigger?: number; // New prop to trigger refresh
}

const LatestInteractionComponent = ({
                                        itemId,
                                        itemType,
                                        refreshTrigger = 0 // Default value to avoid undefined
                                    }: LatestInteractionComponentProps) => {
    const { user, isAuthenticated } = useAuthStore();
    const [latestInteraction, setLatestInteraction] = useState<InteractionDetailDTO | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchUserLatestInteraction = async () => {
            if (!isAuthenticated || !user || !itemId) {
                setLoading(false);
                return;
            }

            setLoading(true);
            setError(null);

            try {
                // Get the user's latest interaction with this item (limit: 1, offset: 0)
                const { items, totalCount } = await InteractionService.getUserItemHistory(
                    user.id,
                    itemId,
                    1,
                    0
                );

                if (items.length > 0 && totalCount > 0) {
                    setLatestInteraction(items[0]);
                } else {
                    setLatestInteraction(null);
                }
            } catch (err) {
                console.error('Error fetching user interaction:', err);
                setError('Failed to load your interaction history.');
            } finally {
                setLoading(false);
            }
        };

        fetchUserLatestInteraction();
    }, [user, itemId, itemType, isAuthenticated, refreshTrigger]); // Added refreshTrigger dependency

    if (loading) {
        return (
            <div className="bg-white shadow rounded-lg p-4">
                <div className="animate-pulse flex space-x-4">
                    <div className="rounded-full bg-gray-200 h-12 w-12"></div>
                    <div className="flex-1 space-y-4 py-1">
                        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                        <div className="space-y-2">
                            <div className="h-4 bg-gray-200 rounded"></div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return null;
    }

    // If no interaction yet, show prompt to create one
    if (!latestInteraction) {
        return (
            <div>
            </div>
        );
    }

    // Format the date nicely
    const interactionDate = new Date(latestInteraction.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    return (
        <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="p-3 sm:p-4">
                <div className="flex justify-between items-center sm:mb-3">
                    <h3 className="text-[0.700rem] sm:text-sm font-medium text-gray-700">Your Latest Activity</h3>
                    <span className="text-[0.700rem] sm:text-xs text-gray-500">{interactionDate}</span>
                </div>

                <Link
                    to={`/interaction/${latestInteraction.aggregateId}`}
                    className="flex items-center space-x-4 hover:bg-gray-50 mt-2 rounded-md transition-colors"
                >
                    {/* ItemHistory indicators */}
                    <div className="flex items-center space-x-2 sm:space-x-3">
                        {/* Rating */}
                        {latestInteraction.rating && (
                            <div className="flex items-center">
                                <NormalizedStarDisplay
                                    currentGrade={latestInteraction.rating.normalizedGrade}
                                    minGrade={1}
                                    maxGrade={10}
                                    size="sm"
                                />

                                {latestInteraction.rating.isComplex && (
                                    <Scale
                                        className="ml-1 h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary-500"
                                    />
                                )}
                            </div>
                        )}

                        {/* Like icon */}
                        {latestInteraction.isLiked ? (
                            <Heart className="h-4 w-4 sm:h-5 sm:w-5 text-red-500 fill-red-500"/>
                        ) : (
                            <Heart className="h-4 w-4 sm:h-5 sm:w-5 text-gray-300"/>
                        )}

                        {/* Review icon */}
                        {latestInteraction.review ? (
                            <MessageSquare
                                className="h-4 w-4 sm:h-5 sm:w-5 text-primary-600"
                            />
                        ) : (
                            <MessageSquare
                                className="h-4 w-4 sm:h-5 sm:w-5 text-gray-300"
                            />
                        )}
                    </div>
                </Link>
            </div>
        </div>
    );
};

export default LatestInteractionComponent;