import { Star } from 'lucide-react';

interface NormalizedStarDisplayProps {
    currentGrade: number;
    minGrade: number;
    maxGrade: number;
    size?: 'mb' |'sm' | 'md' | 'lg';
}

/**
 * Calculates the normalized star rating (0.5-5 scale) based on current grade and range
 * Uses the exact same algorithm as the backend
 */
const calculateNormalizedStars = (current: number, min: number, max: number): number => {
    // Ensure we don't divide by zero
    if (max === min) return 2.5; // Default to middle value

    // Calculate normalized percentage (0-1 range)
    const range = max - min;
    const normalizedPercentage = (current - min) / range;

    // Convert to 1-10 scale (same algorithm as backend)
    const normalizedValue = 1 + normalizedPercentage * 9;

    const roundedValue = Math.round(normalizedValue);

    return roundedValue / 2;
};

const NormalizedStarDisplay: React.FC<NormalizedStarDisplayProps> = ({
                                                                         currentGrade,
                                                                         minGrade,
                                                                         maxGrade,
                                                                         size = 'sm'
                                                                     }) => {
    // Calculate star rating (0.5-5 scale)
    const starRating = calculateNormalizedStars(currentGrade, minGrade, maxGrade);

    // Determine star sizes based on the size prop
    const starSizes = {
        mb: 'h-2.5 w-2.5',
        sm: 'h-4 w-4',
        md: 'h-6 w-6',
        lg: 'h-8 w-8'
    };

    const starSize = starSizes[size];

    // Render 5 stars
    return (
        <div className="flex space-x-0">
            {[1, 2, 3, 4, 5].map((position) => {
                const starValue = position;
                const halfStarValue = position - 0.5;

                // Full star
                if (starRating >= starValue) {
                    return (
                        <Star
                            key={position}
                            className={`${starSize} text-yellow-400 fill-yellow-400`}
                        />
                    );
                }
                // Half star
                else if (starRating >= halfStarValue) {
                    return (
                        <div key={position} className="relative inline-block">
                            <Star
                                className={`${starSize} text-gray-300`}
                            />
                            <div className="absolute inset-0 overflow-hidden w-1/2">
                                <Star
                                    className={`${starSize} text-yellow-400 fill-yellow-400`}
                                />
                            </div>
                        </div>
                    );
                }
                // Empty star
                else {
                    return (
                        <Star
                            key={position}
                            className={`${starSize} text-gray-300`}
                        />
                    );
                }
            })}
        </div>
    );
};

export default NormalizedStarDisplay;