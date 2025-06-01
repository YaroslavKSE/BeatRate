import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Calendar, Globe, Lock, Loader, HelpCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import InteractionService, { GradingMethodSummary } from '../../api/interaction';
import { formatDate } from '../../utils/formatters';
import useIsMobile from '../../utils/useIsMobile';

interface GradingMethodsTabProps {
    userId?: string;        // Optional: For viewing another user's grading methods
    username?: string;      // Optional: Username for display purposes
    isOwnProfile?: boolean; // Whether this is the current user's profile
}

const GradingMethodsTab = ({ userId, username, isOwnProfile = true }: GradingMethodsTabProps) => {
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const isMobile = useIsMobile();

    const [gradingMethods, setGradingMethods] = useState<GradingMethodSummary[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [deletingIds, setDeletingIds] = useState<Record<string, boolean>>({});

    // Determine which user ID to use
    const targetUserId = userId || (isOwnProfile && user ? user.id : null);

    // Wrap the fetchGradingMethods in useCallback to prevent unnecessary recreations
    const fetchGradingMethods = useCallback(async () => {
        if (!targetUserId) return;

        setIsLoading(true);
        setError(null);

        try {
            const methods = await InteractionService.getUserGradingMethods(targetUserId);

            // Filter to only public methods if not viewing own profile
            const filteredMethods = isOwnProfile
                ? methods
                : methods.filter(method => method.isPublic);

            setGradingMethods(filteredMethods);
        } catch (err) {
            console.error('Error fetching grading methods:', err);
            setError('Failed to load grading methods. Please try again later.');
        } finally {
            setIsLoading(false);
        }
    }, [targetUserId, isOwnProfile]);

    useEffect(() => {
        fetchGradingMethods();
    }, [fetchGradingMethods]);

    const handleDeleteMethod = async (id: string) => {
        if (!isOwnProfile) return;

        const confirmed = isMobile
            ? confirm('Delete this grading method? This action cannot be undone.')
            : confirm('Are you sure you want to delete this grading method?');

        if (confirmed) {
            try {
                setDeletingIds(prev => ({ ...prev, [id]: true }));
                await InteractionService.deleteGradingMethod(id);
                // Refresh the list
                fetchGradingMethods();
            } catch (err) {
                console.error('Error deleting grading method:', err);
                alert('Failed to delete the grading method. Please try again.');
            } finally {
                setDeletingIds(prev => ({ ...prev, [id]: false }));
            }
        }
    };

    const handleViewMethod = (id: string) => {
        navigate(`/grading-methods/${id}`);
    };

    const handleCreateNew = () => {
        navigate('/grading-methods/create');
    };

    // Mobile Card Component
    const MobileGradingMethodCard = ({ method }: { method: GradingMethodSummary }) => (
        <div
            className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => handleViewMethod(method.id)}
        >
            {/* Header with name and actions */}
            <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0 mr-2">
                    <h3 className="font-medium text-gray-900 truncate text-sm">
                        {method.name}
                    </h3>
                    <div className="flex items-center mt-1 space-x-2 text-xs text-gray-500">
                        <Calendar className="h-3 w-3" />
                        <span>{formatDate(method.createdAt)}</span>
                    </div>
                </div>

                {/* Action buttons */}
                <div className="flex items-center space-x-1 flex-shrink-0">
                    {/* Visibility badge */}
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        method.isPublic
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                    }`}>
                        {method.isPublic ? (
                            <>
                                <Globe className="h-3 w-3 mr-1" />
                                Public
                            </>
                        ) : (
                            <>
                                <Lock className="h-3 w-3 mr-1" />
                                Private
                            </>
                        )}
                    </span>

                    {isOwnProfile && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteMethod(method.id);
                            }}
                            disabled={deletingIds[method.id]}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50"
                            aria-label={`Delete ${method.name}`}
                            title="Delete method"
                        >
                            {deletingIds[method.id] ? (
                                <Loader className="h-4 w-4 animate-spin" />
                            ) : (
                                <Trash2 className="h-4 w-4" />
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );

    // Desktop Table Row Component
    const DesktopGradingMethodRow = ({ method }: { method: GradingMethodSummary }) => (
        <tr className="hover:bg-gray-50 cursor-pointer" onClick={() => handleViewMethod(method.id)}>
            <td className="px-6 py-4 whitespace-nowrap">
                <div className="font-medium text-gray-900">{method.name}</div>
            </td>
            <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm text-gray-500">{formatDate(method.createdAt)}</div>
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <div className="flex justify-end items-center space-x-2">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        method.isPublic
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                    }`}>
                        {method.isPublic ? 'Public' : 'Private'}
                    </span>
                    {isOwnProfile && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteMethod(method.id);
                            }}
                            disabled={deletingIds[method.id]}
                            className="text-red-600 hover:text-red-900 transition-colors disabled:opacity-50"
                            aria-label={`Delete ${method.name}`}
                            title={`Delete ${method.name}`}
                        >
                            {deletingIds[method.id] ? (
                                <Loader className="h-5 w-5 animate-spin" />
                            ) : (
                                <Trash2 className="h-5 w-5" />
                            )}
                        </button>
                    )}
                </div>
            </td>
        </tr>
    );

    return (
        <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="px-4 py-3 sm:px-6 sm:py-4 bg-primary-50 border-b border-primary-100">
                <div className="flex justify-between items-center">
                    <h3 className="text-base sm:text-lg font-medium text-primary-800 flex items-center">
                        <HelpCircle className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                        {isOwnProfile ? 'Your Grading Methods' : `${username || 'User'}'s Grading Methods`}
                    </h3>
                    {isOwnProfile && (
                        <button
                            onClick={handleCreateNew}
                            className="bg-primary-600 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-md flex items-center hover:bg-primary-700 transition-colors text-sm sm:text-base"
                        >
                            <Plus className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                            Create New
                        </button>
                    )}
                </div>
            </div>

            <div className="p-3 sm:p-6">
                {isLoading ? (
                    <div className="flex justify-center py-8 sm:py-12">
                        <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-t-2 border-b-2 border-primary-600"></div>
                    </div>
                ) : error ? (
                    <div className="bg-red-50 border border-red-200 rounded-md p-3 sm:p-4 text-red-700 text-sm sm:text-base">
                        {error}
                    </div>
                ) : gradingMethods.length === 0 ? (
                    <div className="text-center py-6 sm:py-12 px-4">
                        <div className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-gray-400 mb-3 sm:mb-4">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                className="w-full h-full"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                                />
                            </svg>
                        </div>
                        <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">
                            {isOwnProfile ? 'No grading methods yet' : 'No public grading methods'}
                        </h3>
                        <p className="text-gray-500 mb-4 text-sm sm:text-base">
                            {isOwnProfile
                                ? 'Create your first grading method to start rating music in your unique way.'
                                : `${username || 'This user'} hasn't shared any public grading methods yet.`
                            }
                        </p>
                        {isOwnProfile && (
                            <button
                                onClick={handleCreateNew}
                                className="inline-flex items-center px-3 py-2 sm:px-4 sm:py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700"
                            >
                                <Plus className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                                Create Your First Grading Method
                            </button>
                        )}
                    </div>
                ) : (
                    <>
                        {/* Mobile Layout - Card View */}
                        <div className="sm:hidden space-y-3">
                            {gradingMethods.map((method) => (
                                <MobileGradingMethodCard key={method.id} method={method} />
                            ))}
                        </div>

                        {/* Desktop Layout - Table View */}
                        <div className="hidden sm:block overflow-hidden rounded-md border border-gray-200">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                <tr>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Name
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Created
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                {gradingMethods.map((method) => (
                                    <DesktopGradingMethodRow key={method.id} method={method} />
                                ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default GradingMethodsTab;