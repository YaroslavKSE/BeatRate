import { useEffect, useState } from 'react';
import { Users, Heart, MessageSquare, Star } from 'lucide-react';
import InteractionService, { ItemStats } from '../../api/interaction.ts';

interface ItemStatsProps {
    itemId: string;
}

const ItemStatsComponent = ({ itemId }: ItemStatsProps) => {
    const [stats, setStats] = useState<ItemStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchStats = async () => {
            if (!itemId) return;
            try {
                setLoading(true);
                const response = await InteractionService.getItemStats(itemId);
                setStats(response);
            } catch (err) {
                console.error('Error fetching album stats:', err);
                setError('Could not load album statistics');
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, [itemId]);

    if (loading) {
        return <div className="animate-pulse bg-gray-100 h-24 rounded-md w-full max-w-md" />;
    }

    if (error || !stats) {
        return null;
    }

    const averageRating = stats.hasRatings ? (stats.averageRating / 2).toFixed(1) : '-';
    const maxBarHeight = 50;
    const maxDistributionValue = Math.max(...stats.ratingDistribution, 1);
    const normalizedDistribution = stats.ratingDistribution.map(
        (count) => (count / maxDistributionValue) * maxBarHeight
    );
    const reversedHeights = [...normalizedDistribution].reverse();
    const reversedCounts = [...stats.ratingDistribution].reverse();

    return (
        <div className="pt-3">
            <div className="flex flex-col items-start">
                <div className="flex flex-col">
                    <div className="flex items-end space-x-3 max-w-full">
                        {/* Average Rating */}
                        <div className="flex flex-col items-center">
                            <div className="text-2xl text-gray-900">{averageRating}</div>
                            <div className="flex text-yellow-400">
                                {Array(5)
                                    .fill(0)
                                    .map((_, idx) => (
                                        <Star key={idx} className="h-3 w-3 fill-yellow-400" />
                                    ))}
                            </div>
                        </div>

                        {/* Rating Distribution */}
                        <div className="flex items-end space-x-0.5 h-[50px]">
                            {reversedHeights.map((height, idx) => {
                                const count = reversedCounts[idx];
                                const ratingValue = 5 - idx * 0.5;
                                const fullStars = Math.floor(ratingValue);
                                const hasHalf = ratingValue % 1 !== 0;
                                const barHeight = stats.hasRatings ? `${height}px` : '2px';

                                return (
                                    <div key={idx} className="flex flex-col items-center">
                                        <div className="relative group">
                                            <div
                                                className={`w-5 rounded-sm ${
                                                    stats.hasRatings
                                                        ? 'bg-primary-500 transition-colors group-hover:bg-primary-600'
                                                        : 'bg-gray-200'
                                                }`}
                                                style={{ height: barHeight, minHeight: '2px' }}
                                            />
                                            {stats.hasRatings && (
                                                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 opacity-0 group-hover:opacity-100 pointer-events-none bg-white text-black text-xs rounded border border-gray-200 shadow z-10 whitespace-nowrap p-1">
                                                    <span>{count}</span>
                                                    <div className="inline-flex items-center align-middle mx-1">
                                                        {Array(fullStars)
                                                            .fill(0)
                                                            .map((_, i) => (
                                                                <div key={i} className="relative translate-y-[-0.5px]">
                                                                    <Star
                                                                        className="h-3 w-3 text-yellow-400"
                                                                        fill="currentColor"
                                                                    />
                                                                </div>
                                                            ))}
                                                        {hasHalf && (
                                                            <div className="relative translate-y-[-0.5px]">
                                                                <Star
                                                                    className="h-3 w-3 text-gray-300"
                                                                    fill="none"
                                                                />
                                                                <div className="absolute inset-0 overflow-hidden w-1/2">
                                                                    <Star className="h-3 w-3 text-yellow-400" fill="currentColor" />
                                                                </div>
                                                            </div>
                                                        )}
                                                        {Array(5 - fullStars - (hasHalf ? 1 : 0))
                                                            .fill(0)
                                                            .map((_, i) => (
                                                                <div key={i} className="hidden sm:block relative translate-y-[-0.5px]">
                                                                    <Star className="h-3 w-3 text-gray-300" fill="none" />
                                                                </div>
                                                            ))}
                                                    </div>
                                                    <span>{count === 1 ? 'rating' : 'ratings'}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Single star */}
                        <div className="flex items-center">
                            <Star className="h-3 w-3 text-yellow-400 fill-yellow-400" />
                        </div>
                    </div>

                    {/* Stats Summary */}
                    <div className="flex space-x-6 mt-4 text-xs text-gray-600 self-center">
                        <div className="flex items-center">
                            <Users className="h-3 w-3 mr-1" />
                            <span>{stats.totalUsersInteracted} listened</span>
                        </div>
                        <div className="flex items-center">
                            <Heart className="h-3 w-3 mr-1" />
                            <span>
                                {stats.totalLikes} {stats.totalLikes === 1 ? 'like' : 'likes'}
                            </span>
                        </div>
                        <div className="flex items-center">
                            <MessageSquare className="h-3 w-3 mr-1" />
                            <span>
                                {stats.totalReviews} {stats.totalReviews === 1 ? 'review' : 'reviews'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ItemStatsComponent;