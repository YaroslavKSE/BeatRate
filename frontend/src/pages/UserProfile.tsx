import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import UsersService, { PublicUserProfile, UserSubscriptionResponse } from '../api/users';
import InteractionService, { GradingMethodSummary } from '../api/interaction';
import useAuthStore from '../store/authStore';
import ProfileLoadingState from '../components/Profile/ProfileLoadingState';
import ProfileHeader from '../components/Profile/ProfileHeader';
import ProfileTabs, { ProfileTabType } from '../components/Profile/ProfileTabs';
import SocialTabContent from '../components/Profile/SocialTabContent';
import TabContentWrapper from '../components/Profile/TabContentWrapper';
import HistoryTab from '../components/Profile/HistoryTab';
import ProfileListsTab from '../components/Profile/ProfileListsTab';
import ProfileOverviewTab from "../components/Profile/ProfileOverviewTab.tsx";

const UserProfile = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { isAuthenticated, user: currentUser } = useAuthStore();
    const [userProfile, setUserProfile] = useState<PublicUserProfile | null>(null);
    const [isFollowing, setIsFollowing] = useState(false);
    const [gradingMethods, setGradingMethods] = useState<GradingMethodSummary[]>([]);

    // Get active tab from URL params or default to history (changed from grading-methods)
    const tabParam = searchParams.get('tab');
    const [activeTab, setActiveTab] = useState<ProfileTabType>(
      (tabParam as ProfileTabType) || 'overview'
    );

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [followLoading, setFollowLoading] = useState(false);
    const [followersData, setFollowersData] = useState<UserSubscriptionResponse[]>([]);
    const [followingData, setFollowingData] = useState<UserSubscriptionResponse[]>([]);
    const [socialLoading, setSocialLoading] = useState(false);

    // Check if viewing own profile
    const isOwnProfile = currentUser?.id === id;

    // Helper to validate tab parameters
    const isValidTab = (tab: string): boolean => {
        return ['grading-methods', 'history', 'preferences', 'following', 'followers', 'overview', 'lists'].includes(tab);
    };

    // Listen for URL changes to update the active tab
    useEffect(() => {
        const newTabParam = searchParams.get('tab');
        if (newTabParam && isValidTab(newTabParam) && newTabParam !== activeTab) {
            setActiveTab(newTabParam as ProfileTabType);
        }
    }, [searchParams, activeTab]);

    // Update URL when tab changes
    const handleTabChange = (tab: ProfileTabType) => {
        setActiveTab(tab);
        setSearchParams({ tab });
    };

    // Fetch user profile data
    useEffect(() => {
        const fetchUserProfile = async () => {
            if (!id) return;

            try {
                setLoading(true);
                setError(null);

                // Fetch public user profile by ID
                const userData = await UsersService.getUserProfileById(id);
                setUserProfile(userData);

                // Check if the current user is following this user
                if (isAuthenticated && !isOwnProfile && id) {
                    const followStatus = await UsersService.checkFollowingStatus(id);
                    setIsFollowing(followStatus);
                }

                // Fetch public grading methods
                try {
                    if (id) {
                        const methods = await InteractionService.getUserGradingMethods(id);
                        // Filter to only public methods if not viewing own profile
                        const filteredMethods = isOwnProfile
                            ? methods
                            : methods.filter(method => method.isPublic);

                        setGradingMethods(filteredMethods);
                    }
                } catch (err) {
                    console.error('Error fetching grading methods:', err);
                    // Non-critical error, don't set the main error state
                }

                // If user is viewing their own profile from this page, redirect to Profile
                if (isOwnProfile) {
                    navigate('/profile');
                }

            } catch (err) {
                console.error('Error fetching user profile:', err);
                setError('Failed to load user profile. The user may not exist or has been removed.');
            } finally {
                setLoading(false);
            }
        };

        fetchUserProfile();
    }, [id, isAuthenticated, isOwnProfile, navigate]);

    // Load followers and following data when those tabs are selected
    useEffect(() => {
        const loadSocialData = async () => {
            if (!id || !userProfile) return;

            // Only load when viewing followers or following tab
            if (activeTab === 'followers' || activeTab === 'following') {
                setSocialLoading(true);

                try {
                    if (activeTab === 'followers' && id) {
                        // Call the public endpoint for followers
                        const response = await UsersService.getPublicUserFollowers(id);
                        setFollowersData(response.items);
                    } else if (activeTab === 'following' && id) {
                        // Call the public endpoint for following
                        const response = await UsersService.getPublicUserFollowing(id);
                        setFollowingData(response.items);
                    }
                } catch (err) {
                    console.error(`Error loading ${activeTab} data:`, err);
                } finally {
                    setSocialLoading(false);
                }
            }
        };

        loadSocialData();
    }, [activeTab, id, userProfile]);

    const handleFollow = async () => {
        if (!isAuthenticated) {
            navigate('/login', { state: { from: `/people/${id}` } });
            return;
        }

        if (!id) return;

        try {
            setFollowLoading(true);

            if (isFollowing) {
                await UsersService.unfollowUser(id);
            } else {
                await UsersService.followUser(id);
            }

            setIsFollowing(!isFollowing);

            // Update user profile to reflect the new follower count
            if (id) {
                const updatedProfile = await UsersService.getUserProfileById(id);
                setUserProfile(updatedProfile);
            }
        } catch (err) {
            console.error('Error toggling follow status:', err);
        } finally {
            setFollowLoading(false);
        }
    };

    if (loading) {
        return <ProfileLoadingState message="Loading user profile..." />;
    }

    if (error || !userProfile) {
        return (
            <div className="max-w-4xl mx-auto py-8 px-4">
                <div className="bg-red-50 border border-red-200 text-red-700 p-6 rounded-lg">
                    <div className="flex items-center mb-4">
                        <AlertTriangle className="h-6 w-6 mr-2" />
                        <h2 className="text-xl font-semibold">User Not Found</h2>
                    </div>
                    <p>{error || "This user doesn't exist or has been removed."}</p>
                    <button
                        onClick={() => navigate('/people')}
                        className="mt-4 px-4 py-2 bg-white border border-red-300 rounded-md text-red-600 hover:bg-red-50"
                    >
                        Return to People Page
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto">
            {/* Profile Header */}
            <div className="bg-white shadow rounded-lg overflow-hidden mb-6">
                <ProfileHeader
                    profile={userProfile}
                    isOwnProfile={isOwnProfile}
                    isFollowing={isFollowing}
                    onFollowToggle={handleFollow}
                    isAuthenticated={isAuthenticated}
                    followLoading={followLoading}
                    onTabChange={handleTabChange}
                />

                {/* Profile Tabs */}
                <ProfileTabs
                    activeTab={activeTab}
                    onTabChange={handleTabChange}
                    isOwnProfile={isOwnProfile}
                />
            </div>

            {/* Tab Content */}
            <div className="mb-8">
                {/* Grading Methods Tab */}
                {activeTab === 'grading-methods' && (
                    <TabContentWrapper title="Grading Methods">
                        {gradingMethods.length > 0 ? (
                            <div className="space-y-4">
                                {gradingMethods.map((method) => (
                                    <div
                                        key={method.id}
                                        className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                                    >
                                        <h3 className="font-medium text-lg">{method.name}</h3>
                                        <div className="mt-2 flex items-center justify-between">
                                            <div className="text-sm text-gray-500">
                                                Created: {new Date(method.createdAt).toLocaleDateString()}
                                            </div>
                                            <div className="flex">
                                                <span
                                                    className={`px-2 py-0.5 text-xs rounded-full ${
                                                        method.isPublic 
                                                        ? 'bg-green-100 text-green-800' 
                                                        : 'bg-gray-100 text-gray-800'
                                                    }`}
                                                >
                                                    {method.isPublic ? 'Public' : 'Private'}
                                                </span>
                                                <button
                                                    onClick={() => navigate(`/grading-methods/${method.id}`)}
                                                    className="ml-3 text-sm text-primary-600 hover:text-primary-800"
                                                >
                                                    View Details
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center p-8 border border-dashed border-gray-300 rounded-lg">
                                <p className="text-gray-600">
                                    {userProfile.username} hasn't shared any public grading methods.
                                </p>
                            </div>
                        )}
                    </TabContentWrapper>
                )}

                {activeTab === 'overview' && <ProfileOverviewTab userId={id} />}

                {/* Using the unified components */}
                {activeTab === 'history' && id && (
                    <HistoryTab
                        userId={id}
                        username={userProfile.username}
                    />
                )}

                {/* Lists Tab */}
                {activeTab === 'lists' && id && (
                    <ProfileListsTab
                        userId={id}
                        username={userProfile.username}
                        isOwnProfile={false}
                    />
                )}

                {/* Following Tab */}
                {activeTab === 'following' && (
                    <SocialTabContent
                        type="following"
                        users={followingData}
                        loading={socialLoading}
                        error={null}
                        isOwnProfile={false}
                        username={userProfile.username}
                    />
                )}

                {/* Followers Tab */}
                {activeTab === 'followers' && (
                    <SocialTabContent
                        type="followers"
                        users={followersData}
                        loading={socialLoading}
                        error={null}
                        isOwnProfile={false}
                        username={userProfile.username}
                        isFollowing={isFollowing}
                        onFollow={handleFollow}
                        followLoading={followLoading}
                        isAuthenticated={isAuthenticated}
                    />
                )}
            </div>
        </div>
    );
};

export default UserProfile;