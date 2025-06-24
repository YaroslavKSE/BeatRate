import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import CatalogService from '../api/catalog';
import InteractionService, {
    GradingMethodSummary,
    GradingMethodDetail,
    GradeComponent,
    BlockComponent,
    PostInteractionRequest
} from '../api/interaction';
// import { getTrackPreviewUrl } from '../utils/preview-extractor';
import LoadingState from '../components/Album/LoadingState';
import ErrorState from '../components/Song/ErrorState';
import NotFoundState from '../components/Song/NotFoundState';
import InteractionHeader from '../components/CreateInteraction/InteractionHeader';
import InteractionSuccessMessage from '../components/CreateInteraction/InteractionSuccessMessage';
import InteractionItemDetails from '../components/CreateInteraction/InteractionItemDetails';
import GradingSelector from '../components/CreateInteraction/GradingSelector';
import InteractionButtons from '../components/CreateInteraction/InteractionButtons';
import ReviewTextArea from '../components/CreateInteraction/ReviewTextArea';
import InteractionSubmitButton from '../components/CreateInteraction/InteractionSubmitButton';

const CreateInteractionPage = () => {
    const { itemType, itemId } = useParams<{ itemType: string; itemId: string }>();
    const navigate = useNavigate();
    const { user, isAuthenticated } = useAuthStore();
    //eslint-disable-next-line
    const [item, setItem] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [submitSuccess, setSubmitSuccess] = useState(false);

    const [rating, setRating] = useState<number | null>(null);
    const [hoveredRating, setHoveredRating] = useState<number | null>(null);
    const [isLiked, setIsLiked] = useState(false);
    const [hasListened, setHasListened] = useState(false);
    const [reviewText, setReviewText] = useState('');

    const [useComplexGrading, setUseComplexGrading] = useState(false);
    const [gradingMethods, setGradingMethods] = useState<GradingMethodSummary[]>([]);
    const [selectedMethodId, setSelectedMethodId] = useState<string | null>(null);
    const [selectedMethod, setSelectedMethod] = useState<GradingMethodDetail | null>(null);
    const [gradeValues, setGradeValues] = useState<Record<string, number>>({});

    const [isPlaying, setIsPlaying] = useState(false);
    const audio = useRef<HTMLAudioElement | null>(null);

    const formattedItemType = itemType === 'album' ? 'Album' : 'Track';

    useEffect(() => {
        if (!itemId) return;

        const fetchData = async () => {
            setLoading(true);
            setError(null);

            try {
                let itemData;
                if (itemType === 'album') {
                    itemData = await CatalogService.getAlbum(itemId);
                } else if (itemType === 'track') {
                    itemData = await CatalogService.getTrack(itemId);
                    // loadTrackPreview(itemData);
                } else {
                    setError('Invalid item type specified');
                    setLoading(false);
                    return;
                }

                setItem(itemData);

                if (isAuthenticated && user?.id) {
                    const methods = await InteractionService.getUserGradingMethods(user.id);
                    setGradingMethods(methods);
                }
            } catch (err) {
                console.error('Error fetching data:', err);
                setError('Failed to load item information. Please try again later.');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [itemId, itemType, isAuthenticated, user]);

    useEffect(() => {
        if (!selectedMethodId) {
            setSelectedMethod(null);
            setGradeValues({});
            return;
        }

        const fetchGradingMethod = async () => {
            try {
                const methodDetail = await InteractionService.getGradingMethodById(selectedMethodId);
                setSelectedMethod(methodDetail);

                const initialValues: Record<string, number> = {};
                const initializeGradeValues = (
                    components: (GradeComponent | BlockComponent)[],
                    path = ''
                ) => {
                    components.forEach(component => {
                        if (component.componentType === 'grade') {
                            const fullPath = path ? `${path}.${component.name}` : component.name;
                            initialValues[fullPath] = component.minGrade;
                        } else if (component.componentType === 'block') {
                            const newPath = path ? `${path}.${component.name}` : component.name;
                            initializeGradeValues(component.subComponents, newPath);
                        }
                    });
                };

                initializeGradeValues(methodDetail.components);
                setGradeValues(initialValues);
            } catch (err) {
                console.error('Error fetching grading method:', err);
                setSubmitError('Failed to load grading method details');
                setSelectedMethod(null);
            }
        };

        fetchGradingMethod();
    }, [selectedMethodId]);

    useEffect(() => {
        if (rating !== null || isLiked || reviewText.trim() !== '') {
            setHasListened(true);
        }
    }, [rating, isLiked, reviewText]);

    useEffect(() => {
        if (!isPlaying && audio) {
            audio.current?.pause();
        }
    }, [isPlaying, audio]);

    const displayRating = hoveredRating !== null ? hoveredRating : rating;

    // const loadTrackPreview = async (track: TrackSummary | null) => {
    //     if(track == null) return;
    //     if(track.previewUrl) return;
    //     const preview = await getTrackPreviewUrl(track.spotifyId);
    //     if(preview){
    //         track.previewUrl = preview;
    //     }
    // }

    const handleListenedToggle = () => {
        if (hasListened && !isLiked && rating === null && reviewText.trim() === '') {
            setHasListened(false);
        } else {
            setHasListened(true);
        }
    };

    const handleTogglePreview = async () => {
        if (isPlaying && audio) {
            audio.current?.pause();
            setIsPlaying(false);
            return;
        }

        try {
            if (formattedItemType !== 'Track') return;

            const previewUrl = item.previewUrl;
            if (!previewUrl) {
                console.error('No preview URL available for this track');
                return;
            }

            if (!previewUrl) {
                console.error('No preview available');
                return;
            }

            if (audio) {
                audio.current?.pause();
            }

            const newAudio = new Audio(previewUrl);
            newAudio.addEventListener('ended', () => {
                setIsPlaying(false);
            });

            audio.current = newAudio;
            await audio.current.play();
            setIsPlaying(true);
        } catch (err) {
            console.error('Error playing preview:', err);
        }
    };

    const handleGradeChange = (name: string, value: number) => {
        setGradeValues(prev => ({ ...prev, [name]: value }));
    };

    const formatGradeInputs = () => {
        return Object.entries(gradeValues).map(([name, value]) => ({
            componentName: name,
            value
        }));
    };

    const handleSubmit = async () => {
        if (!user) {
            setSubmitError('You must be logged in to submit an interaction');
            return;
        }

        if (!hasListened) {
            setSubmitError(`Please select at least "Listened" to log your interaction`);
            return;
        }

        if (useComplexGrading && !selectedMethodId) {
            setSubmitError('Please select a grading method');
            return;
        }

        try {
            setIsSubmitting(true);
            setSubmitError(null);

            const interactionData: PostInteractionRequest = {
                userId: user.id,
                itemId: itemId as string,
                itemType: formattedItemType,
                isLiked: isLiked,
                reviewText: reviewText.trim(),
            };

            if (useComplexGrading && selectedMethodId) {
                interactionData.useComplexGrading = true;
                interactionData.gradingMethodId = selectedMethodId;
                interactionData.gradeInputs = formatGradeInputs();
            } else if (rating !== null) {
                interactionData.useComplexGrading = false;
                interactionData.basicGrade = rating * 2;
            }

            const result = await InteractionService.createInteraction(interactionData);

            if (result.interactionCreated) {
                setSubmitSuccess(true);
                setTimeout(() => {
                    navigate(`/${itemType}/${itemId}`);
                }, 1500);
            } else {
                setSubmitError(result.errorMessage || 'Failed to create interaction');
            }
        } catch (err) {
            console.error('Error submitting interaction:', err);
            setSubmitError('An error occurred while submitting your interaction');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) return <LoadingState />;
    if (error) return <ErrorState error={error} />;
    if (!item) return <NotFoundState />;

    return (
        <div className="max-w-6xl mx-auto pb-12">
            <InteractionHeader formattedItemType={formattedItemType} navigate={navigate} audio={audio}/>
            {submitSuccess && <InteractionSuccessMessage />}

            <div className="bg-white shadow rounded-lg mb-6">
                <div className="p-6">
                    <InteractionItemDetails
                        item={item}
                        formattedItemType={formattedItemType}
                        isPlaying={isPlaying}
                        handleTogglePreview={handleTogglePreview}
                    />

                    {submitError && (
                        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 p-4 rounded-md">
                            {submitError}
                        </div>
                    )}

                    <GradingSelector
                        useComplexGrading={useComplexGrading}
                        setUseComplexGrading={setUseComplexGrading}
                        gradingMethods={gradingMethods}
                        selectedMethodId={selectedMethodId}
                        setSelectedMethodId={setSelectedMethodId}
                        selectedMethod={selectedMethod}
                        gradeValues={gradeValues}
                        handleGradeChange={handleGradeChange}
                        rating={rating}
                        displayRating={displayRating}
                        setRating={setRating}
                        setHoveredRating={setHoveredRating}
                    />

                    <InteractionButtons
                        isLiked={isLiked}
                        setIsLiked={setIsLiked}
                        hasListened={hasListened}
                        handleListenedToggle={handleListenedToggle}
                        rating={rating}
                        reviewText={reviewText}
                        useComplexGrading={useComplexGrading}
                    />

                    <ReviewTextArea reviewText={reviewText} setReviewText={setReviewText} formattedItemType={formattedItemType} />

                    <InteractionSubmitButton
                        handleSubmit={handleSubmit}
                        isSubmitting={isSubmitting}
                        hasListened={hasListened}
                    />
                </div>
            </div>
        </div>
    );
};

export default CreateInteractionPage;
