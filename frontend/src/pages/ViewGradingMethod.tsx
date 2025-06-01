import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ChevronLeft,
    User,
    Calendar,
    Eye,
    Lock,
    Star,
    Scale,
} from 'lucide-react';
import InteractionService, {
    GradingMethodDetail,
} from '../api/interaction';
import UsersService, { PublicUserProfile } from '../api/users';
import { formatDate } from '../utils/formatters';
import { getOperationSymbol, getOperationName } from '../utils/grading-utils';
import GradeComponent from "../components/ViewGradingMethods/GradeComponent.tsx";
import BlockComponentView from "../components/ViewGradingMethods/BlockComponentView.tsx";

const ViewGradingMethod = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [gradingMethod, setGradingMethod] = useState<GradingMethodDetail | null>(null);
    const [creatorProfile, setCreatorProfile] = useState<PublicUserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [creatorLoading, setCreatorLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchGradingMethod = async () => {
            if (!id) return;

            try {
                setLoading(true);
                setError(null);
                const data = await InteractionService.getGradingMethodById(id);
                setGradingMethod(data);

                // Fetch creator profile information
                if (data.creatorId) {
                    setCreatorLoading(true);
                    try {
                        const profile = await UsersService.getUserProfileById(data.creatorId);
                        setCreatorProfile(profile);
                    } catch (profileError) {
                        console.error('Error fetching creator profile:', profileError);
                        // Don't set error state for profile fetch failure, just show fallback
                    } finally {
                        setCreatorLoading(false);
                    }
                }
            } catch (err) {
                console.error('Error fetching grading method:', err);
                setError('Failed to load the grading method. Please try again.');
            } finally {
                setLoading(false);
            }
        };

        fetchGradingMethod();
    }, [id]);

    const handleCreatorClick = () => {
        if (gradingMethod?.creatorId) {
            navigate(`/people/${gradingMethod.creatorId}`);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center py-10 sm:py-20 bg-gray-50">
                <div className="p-4 sm:p-8 bg-white rounded-lg shadow-lg flex flex-col items-center">
                    <div className="animate-spin rounded-full h-12 w-12 sm:h-16 sm:w-16 border-t-2 border-b-2 border-primary-600 mb-4"></div>
                    <span className="text-sm sm:text-lg text-gray-600">Loading grading method details...</span>
                </div>
            </div>
        );
    }

    if (error || !gradingMethod) {
        return (
            <div className="max-w-4xl mx-auto py-6 sm:py-12 px-4">
                <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                    <div className="p-4 sm:p-6 bg-red-50 border-b border-red-200">
                        <div className="flex items-center">
                            <div className="flex-shrink-0">
                                <svg className="h-8 w-8 sm:h-12 sm:w-12 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>
                            <div className="ml-4">
                                <h3 className="text-base sm:text-lg font-medium text-red-800">Unable to load grading method</h3>
                                <p className="mt-2 text-sm sm:text-base text-red-700">{error || "Unable to find the requested grading method."}</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white px-4 py-3 sm:px-6 sm:py-4 flex justify-center">
                        <button
                            onClick={() => navigate(-1)}
                            className="inline-flex items-center px-3 py-2 sm:px-4 sm:py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none"
                        >
                            <ChevronLeft className="h-4 w-4 mr-1" />
                            Go Back
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto pb-6 sm:pb-12 px-2 sm:px-4">
            {/* Header */}
            <div className="bg-white shadow-lg rounded-lg mb-3 sm:mb-6 overflow-hidden border border-gray-100">
                <div className="bg-gradient-to-r from-primary-600 to-primary-700 px-3 py-2 sm:px-6 sm:py-4">
                    {/* Mobile Header */}
                    <div className="sm:hidden">
                        <div className="flex items-center justify-between mb-2">
                            <button
                                onClick={() => navigate(-1)}
                                className="inline-flex items-center text-white hover:bg-white hover:bg-opacity-20 px-2 py-1 rounded-md transition-colors text-sm"
                            >
                                <ChevronLeft className="h-4 w-4 mr-1" />
                                Back
                            </button>
                        </div>
                        <h1 className="text-lg font-bold text-white text-center mb-2">Grading Method</h1>
                    </div>

                    {/* Desktop Header */}
                    <div className="hidden sm:flex justify-between items-center">
                        <button
                            onClick={() => navigate(-1)}
                            className="inline-flex items-center text-white hover:bg-white hover:bg-opacity-20 px-3 py-1 rounded-md transition-colors"
                        >
                            <ChevronLeft className="h-5 w-5 mr-1" />
                            Back
                        </button>
                        <h1 className="text-xl font-bold text-center text-white">Grading Method Details</h1>
                        <div className="w-20"></div> {/* Empty div for flex spacing */}
                    </div>
                </div>
            </div>

            {/* Main content */}
            <div className="bg-white shadow-lg rounded-lg overflow-hidden mb-3 sm:mb-6 border border-gray-100">
                {/* Grading Method Header */}
                <div className="bg-gradient-to-br from-gray-50 to-white p-3 sm:p-6 border-b border-gray-200">
                    {/* Mobile Layout */}
                    <div className="sm:hidden">
                        <div className="flex items-center mb-3">
                            {gradingMethod.isPublic ? (
                                <div className="bg-green-100 text-green-800 rounded-full px-2 py-1 text-xs font-medium flex items-center mr-2">
                                    <Eye className="h-3 w-3 mr-1" />
                                    Public
                                </div>
                            ) : (
                                <div className="bg-gray-100 text-gray-800 rounded-full px-2 py-1 text-xs font-medium flex items-center mr-2">
                                    <Lock className="h-3 w-3 mr-1" />
                                    Private
                                </div>
                            )}
                            <div className="bg-blue-100 text-blue-800 rounded-full px-2 py-1 text-xs font-medium flex items-center">
                                <Scale className="h-3 w-3 mr-1" />
                                Grading Method
                            </div>
                        </div>

                        <h2 className="text-xl font-bold text-gray-900 mb-3 leading-tight">{gradingMethod.name}</h2>

                        {/* Creator info - Mobile */}
                        <div>
                            {creatorLoading ? (
                                <div className="flex items-center">
                                    <div className="animate-pulse">
                                        <div className="h-8 w-8 bg-gray-200 rounded-full mr-2"></div>
                                    </div>
                                    <div className="animate-pulse">
                                        <div className="h-4 bg-gray-200 rounded w-20"></div>
                                    </div>
                                </div>
                            ) : creatorProfile ? (
                                <button
                                    onClick={handleCreatorClick}
                                    className="flex items-center hover:bg-gray-50 transition-colors w-full p-2 rounded-lg"
                                >
                                    {creatorProfile.avatarUrl ? (
                                        <img
                                            src={creatorProfile.avatarUrl}
                                            alt={`${creatorProfile.name} ${creatorProfile.surname}`}
                                            className="h-8 w-8 rounded-full object-cover mr-2"
                                        />
                                    ) : (
                                        <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-sm font-bold mr-2">
                                            {creatorProfile.name.charAt(0).toUpperCase()}{creatorProfile.surname.charAt(0).toUpperCase()}
                                        </div>
                                    )}
                                    <div className="flex-1 text-left">
                                        <div className="text-sm font-medium text-gray-900">
                                            {creatorProfile.name} {creatorProfile.surname}
                                        </div>
                                        <div className="text-xs text-gray-500">@{creatorProfile.username}</div>
                                    </div>
                                </button>
                            ) : (
                                <div className="flex items-center p-2">
                                    <User className="h-5 w-5 text-gray-400 mr-2" />
                                    <span className="text-sm text-gray-600">Creator ID: {gradingMethod.creatorId}</span>
                                </div>
                            )}
                        </div>

                        {/* Date and rating range - Mobile */}
                        <div className="flex flex-col space-y-2">
                            <div className="flex items-center p-2">
                                <Calendar className="h-4 w-4 mr-2 text-primary-500" />
                                <span className="text-sm text-gray-600">Created: {formatDate(gradingMethod.createdAt)}</span>
                            </div>

                            <div className="bg-gradient-to-br from-primary-50 to-primary-100 p-3 rounded-lg shadow-sm border border-primary-200">
                                <div className="text-xs font-medium text-primary-700 mb-1">Overall Rating Range</div>
                                <div className="flex items-center">
                                    <Star className="h-5 w-5 text-primary-500 mr-2" />
                                    <div className="text-lg font-bold text-primary-700">
                                        {gradingMethod.minPossibleGrade} - {gradingMethod.maxPossibleGrade}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Desktop Layout */}
                    <div className="hidden sm:block">
                        <div className="flex flex-col md:flex-row md:justify-between md:items-center">
                            <div className="flex-1">
                                <div className="flex items-center mb-3">
                                    {gradingMethod.isPublic ? (
                                        <div className="bg-green-100 text-green-800 rounded-full px-3 py-1 text-xs font-medium flex items-center mr-3">
                                            <Eye className="h-3 w-3 mr-1" />
                                            Public
                                        </div>
                                    ) : (
                                        <div className="bg-gray-100 text-gray-800 rounded-full px-3 py-1 text-xs font-medium flex items-center mr-3">
                                            <Lock className="h-3 w-3 mr-1" />
                                            Private
                                        </div>
                                    )}
                                    <div className="bg-blue-100 text-blue-800 rounded-full px-3 py-1 text-xs font-medium flex items-center">
                                        <Scale className="h-3 w-3 mr-1" />
                                        Grading Method
                                    </div>
                                </div>

                                <h2 className="text-3xl font-bold text-gray-900 mb-2">{gradingMethod.name}</h2>

                                {/* Creator and Date info - Desktop */}
                                <div className="flex flex-wrap items-center text-sm text-gray-500 gap-4 mt-3">
                                    {creatorLoading ? (
                                        <div className="flex items-center animate-pulse">
                                            <div className="h-8 w-8 bg-gray-200 rounded-full mr-3"></div>
                                            <div className="h-4 bg-gray-200 rounded w-24"></div>
                                        </div>
                                    ) : creatorProfile ? (
                                        <button
                                            onClick={handleCreatorClick}
                                            className="flex items-center hover:bg-gray-50 transition-colors p-2 rounded-lg"
                                        >
                                            {creatorProfile.avatarUrl ? (
                                                <img
                                                    src={creatorProfile.avatarUrl}
                                                    alt={`${creatorProfile.name} ${creatorProfile.surname}`}
                                                    className="h-10 w-10 rounded-full object-cover mr-3"
                                                />
                                            ) : (
                                                <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-sm font-bold mr-3">
                                                    {creatorProfile.name.charAt(0).toUpperCase()}{creatorProfile.surname.charAt(0).toUpperCase()}
                                                </div>
                                            )}
                                            <span className="font-medium text-gray-700">
                                                {creatorProfile.name} {creatorProfile.surname}
                                            </span>
                                        </button>
                                    ) : (
                                        <div className="flex items-center">
                                            <User className="h-4 w-4 mr-2 text-primary-500" />
                                            <span>Creator ID: <span className="font-medium">{gradingMethod.creatorId}</span></span>
                                        </div>
                                    )}

                                    <div className="flex items-center">
                                        <Calendar className="h-4 w-4 mr-2 text-primary-500" />
                                        <span>Created: <span className="font-medium">{formatDate(gradingMethod.createdAt)}</span></span>
                                    </div>
                                </div>
                            </div>

                            <div className="md:ml-4 mt-6 md:mt-0 bg-gradient-to-br from-primary-50 to-primary-100 p-4 rounded-lg shadow-sm border border-primary-200">
                                <div className="text-sm font-medium text-primary-700 mb-1">Overall Rating Range</div>
                                <div className="flex items-center">
                                    <Star className="h-6 w-6 text-primary-500 mr-2" />
                                    <div className="text-2xl font-bold text-primary-700">
                                        {gradingMethod.minPossibleGrade} - {gradingMethod.maxPossibleGrade}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Grading Method Components */}
                <div className="p-3 sm:p-6 space-y-3 sm:space-y-5">
                    {gradingMethod.components.map((component, index) => {
                        const isLast = index === gradingMethod.components.length - 1;

                        return (
                            <div key={index}>
                                {component.componentType === 'block' ? (
                                    <BlockComponentView component={component} level={0} />
                                ) : (
                                    <GradeComponent component={component} level={0} />
                                )}

                                {!isLast && (
                                    <div className="flex items-center justify-center my-3 sm:my-5">
                                        <div className="flex items-center bg-gray-100 px-3 py-2 sm:px-5 sm:py-2 rounded-lg shadow-sm">
                                            <div className="text-xs sm:text-sm font-medium text-gray-700 mr-2 sm:mr-3">
                                                {getOperationName(
                                                    typeof gradingMethod.actions[index] === 'string'
                                                        ? (gradingMethod.actions[index] === 'Add' ? 0 :
                                                            gradingMethod.actions[index] === 'Subtract' ? 1 :
                                                                gradingMethod.actions[index] === 'Multiply' ? 2 : 3)
                                                        : gradingMethod.actions[index]
                                                )}
                                            </div>
                                            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white flex items-center justify-center font-bold text-lg sm:text-xl text-primary-600 shadow-sm border border-gray-200">
                                                {getOperationSymbol(
                                                    typeof gradingMethod.actions[index] === 'string'
                                                        ? (gradingMethod.actions[index] === 'Add' ? 0 :
                                                            gradingMethod.actions[index] === 'Subtract' ? 1 :
                                                                gradingMethod.actions[index] === 'Multiply' ? 2 : 3)
                                                        : gradingMethod.actions[index]
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default ViewGradingMethod;