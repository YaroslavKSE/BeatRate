import { useState } from 'react';
import { UserProfile } from '../../api/auth';
import { PublicUserProfile } from '../../api/users';
import { Edit, Calendar, User } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { formatDate } from '../../utils/formatters';
import AvatarUploadModal from './AvatarUploadModal';
import FollowButton from './FollowButton';
import ProfileEditForm from './ProfileEditForm';
import { ProfileTabType } from './ProfileTabs';

interface ProfileHeaderProps {
  profile: UserProfile | PublicUserProfile;
  isOwnProfile: boolean;
  isFollowing?: boolean;
  onFollowToggle?: () => void;
  onAvatarUpdate?: () => void;
  isAuthenticated: boolean;
  followLoading?: boolean;
  onTabChange?: (tab: ProfileTabType) => void;
}

const ProfileHeader = ({
                         profile,
                         isOwnProfile,
                         isFollowing = false,
                         onFollowToggle,
                         onAvatarUpdate,
                         isAuthenticated,
                         followLoading = false,
                         onTabChange
                       }: ProfileHeaderProps) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isAvatarUploadModalOpen, setIsAvatarUploadModalOpen] = useState(false);
  const [isProfileEditModalOpen, setIsProfileEditModalOpen] = useState(false);
  const [mobileAvatarClicked, setMobileAvatarClicked] = useState(false);

  // Define variables based on profile type with proper fallbacks
  const followerCount = 'followerCount' in profile ? profile.followerCount || 0 : 0;
  const followingCount = 'followingCount' in profile ? profile.followingCount || 0 : 0;

  // Better date formatting with proper fallback
  const formatMemberSince = (dateString?: string) => {
    if (!dateString) return 'Unknown';

    try {
      return formatDate(dateString);
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Unknown';
    }
  };

  const memberSince = formatMemberSince(profile.createdAt);

  const handleAvatarUploadSuccess = () => {
    setIsAvatarUploadModalOpen(false);
    if (onAvatarUpdate) {
      onAvatarUpdate();
    }
  };

  const handleProfileEditSuccess = () => {
    setIsProfileEditModalOpen(false);
    if (onAvatarUpdate) {
      onAvatarUpdate();
    }
  };

  // Tab navigation functions
  const handleTabNavigation = (tab: ProfileTabType) => {
    // Create a new URLSearchParams instance to preserve other params
    const newParams = new URLSearchParams(searchParams);
    // Set the tab parameter
    newParams.set('tab', tab);

    // Navigate to the same path but with the updated tab parameter
    if (isOwnProfile) {
      navigate(`/profile?${newParams.toString()}`);
    } else {
      navigate(`/people/${profile.id}?${newParams.toString()}`);
    }

    // Call the onTabChange prop if provided
    if (onTabChange) {
      onTabChange(tab);
    }
  };

  const handleMobileAvatarClick = () => {
    if (!isOwnProfile) return;
    setMobileAvatarClicked(!mobileAvatarClicked);
  };

  return (
      <div className="bg-gradient-to-r from-primary-600 to-primary-400 px-3 sm:px-6 py-3 sm:py-8 text-white">
        {/* Mobile Layout */}
        <div className="md:hidden">
          <div className="flex items-start space-x-3">
            {/* Smaller Avatar */}
            <div className="flex-shrink-0 relative">
              <div
                  className={`relative ${isOwnProfile ? 'cursor-pointer' : ''}`}
                  onClick={handleMobileAvatarClick}
              >
                {profile.avatarUrl ? (
                    <img
                        src={profile.avatarUrl}
                        alt={`${profile.name} ${profile.surname} avatar`}
                        className="h-20 w-20 rounded-full object-cover border-[0.100rem] border-primary-300"
                    />
                ) : (
                    <div className="h-20 w-20 rounded-full bg-primary-500 flex items-center justify-center text-lg font-bold border-2 border-primary-300">
                      <User className="h-10 w-10 text-white" />
                    </div>
                )}

                {/* Upload button appears when avatar is clicked */}
                {isOwnProfile && mobileAvatarClicked && (
                    <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsAvatarUploadModalOpen(true);
                          setMobileAvatarClicked(false);
                        }}
                        className="absolute -bottom-1 -right-1 bg-white rounded-full p-1.5 shadow-md"
                        aria-label="Edit profile picture"
                    >
                      <Edit className="h-3 w-3 text-primary-700" />
                    </button>
                )}
              </div>
            </div>

            {/* User Info to the right of avatar */}
            <div className="flex-1 min-w-0">
              {/* Name */}
              <h1 className="text-[1.100rem] font-bold text-white truncate">
                {profile.name} {profile.surname}
              </h1>

              {/* Username */}
              {profile.username && (
                  <p className="text-primary-200 text-sm">@{profile.username}</p>
              )}

              {/* Follow/Following Counters */}
              <div className="mt-1 flex flex-wrap gap-2">
                <button
                    onClick={() => handleTabNavigation('followers')}
                    className="bg-white bg-opacity-10 px-2 py-1 rounded-md text-xs"
                >
                  <span className="font-medium">{followerCount}</span> Followers
                </button>

                <button
                    onClick={() => handleTabNavigation('following')}
                    className="bg-white bg-opacity-10 px-2 py-1 rounded-md text-xs"
                >
                  <span className="font-medium">{followingCount}</span> Following
                </button>
              </div>
            </div>
          </div>

          {/* Joined Date and Action Buttons */}
          <div className="mt-3 flex items-center justify-between">
            <div className="py-1 rounded-md text-xs flex items-center">
              <Calendar className="h-3 w-3 mr-1"/>
              Joined {memberSince}
            </div>

            {/* Action buttons on the same row */}
            <div className="flex items-center gap-2">
              {!isOwnProfile && isAuthenticated && (
                  <FollowButton
                      isFollowing={isFollowing}
                      isLoading={followLoading}
                      onClick={onFollowToggle}
                      variant="header"
                  />
              )}

              {isOwnProfile && (
                  <button
                      onClick={() => {
                        setIsProfileEditModalOpen(true);
                        setMobileAvatarClicked(false);
                      }}
                      className="px-2 py-1 rounded-md text-xs font-medium bg-primary-500 bg-opacity-40 text-white hover:bg-opacity-60 focus:outline-none transition-colors flex items-center"
                  >
                    <Edit className="h-3 w-3 mr-1.5" />
                    Edit Profile
                  </button>
              )}
            </div>
          </div>

          {/* Bio below joined date */}
          {'bio' in profile && profile.bio && (
              <div className="mt-2 text-white text-xs">
                <div className="whitespace-pre-line">{profile.bio}</div>
              </div>
          )}
        </div>

        {/* Desktop Layout - Unchanged */}
        <div className="hidden md:flex md:flex-col md:items-start">
          <div className="flex flex-col md:flex-row md:items-center w-full">
            <div className="flex-shrink-0 mb-4 md:mb-0 md:mr-6">
              {/* Avatar with Edit Button (if own profile) */}
              <div className="relative group">
                {profile.avatarUrl ? (
                    <img
                        src={profile.avatarUrl}
                        alt={`${profile.name} ${profile.surname} avatar`}
                        className="h-48 w-48 rounded-full object-cover border-2 border-primary-300"
                    />
                ) : (
                    <div className="h-48 w-48 rounded-full bg-primary-500 flex items-center justify-center text-3xl font-bold border-2 border-primary-300">
                      <User className="h-24 w-24 text-white" />
                    </div>
                )}
                {isOwnProfile && (
                    <button
                        onClick={() => setIsAvatarUploadModalOpen(true)}
                        className="absolute bottom-1 right-1 bg-white rounded-full p-1.5 shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                        aria-label="Edit profile picture"
                    >
                      <Edit className="h-3.5 w-3.5 text-primary-700" />
                    </button>
                )}
              </div>
            </div>

            <div className="flex-grow">
              <div className="flex items-center justify-between">
                <h1 className="text-2xl md:text-3xl font-bold text-white">{profile.name} {profile.surname}</h1>

                {/* Edit button for desktop, repositioned to top right of this section */}
                {isOwnProfile && (
                    <button
                        onClick={() => setIsProfileEditModalOpen(true)}
                        className="flex items-center px-3 py-1.5 rounded-md text-sm font-medium bg-primary-500 bg-opacity-40 text-white hover:bg-opacity-60 focus:outline-none transition-colors"
                    >
                      <Edit className="h-4 w-4 mr-1.5" />
                      Edit Profile
                    </button>
                )}
              </div>

              {profile.username && (
                  <p className="text-primary-200 mt-1">@{profile.username}</p>
              )}

              <div className="mt-2 flex flex-wrap gap-3">
                {/* Updated to use the combined function for both URL and state updates */}
                <button
                    onClick={() => handleTabNavigation('followers')}
                    className="bg-white bg-opacity-10 px-3 py-1 rounded-md text-sm"
                >
                  <span className="font-medium">{followerCount}</span> Followers
                </button>

                <button
                    onClick={() => handleTabNavigation('following')}
                    className="bg-white bg-opacity-10 px-3 py-1 rounded-md text-sm"
                >
                  <span className="font-medium">{followingCount}</span> Following
                </button>

                {!isOwnProfile && isAuthenticated && (
                    <FollowButton
                        isFollowing={isFollowing}
                        isLoading={followLoading}
                        onClick={onFollowToggle}
                        variant="header"
                    />
                )}

                <div className="px-3 py-1 rounded-md text-sm flex items-center">
                  <Calendar className="h-4 w-4 mr-1"/>
                  Joined {memberSince}
                </div>
              </div>

              {/* Bio added here*/}
              {'bio' in profile && profile.bio && (
                  <div className="mt-4 max-w-3xl rounded-md text-white text-sm relative">
                    <div className="flex">
                      <div className="whitespace-pre-line">{profile.bio}</div>
                    </div>
                  </div>
              )}
            </div>
          </div>
        </div>

        {/* Avatar Upload Modal */}
        {isAvatarUploadModalOpen && (
            <AvatarUploadModal
                isOpen={isAvatarUploadModalOpen}
                onClose={() => setIsAvatarUploadModalOpen(false)}
                onSuccess={handleAvatarUploadSuccess}
                currentAvatarUrl={profile.avatarUrl}
            />
        )}

        {/* Edit Profile Modal */}
        {isProfileEditModalOpen && (
            <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
              <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <ProfileEditForm
                    onCancel={() => setIsProfileEditModalOpen(false)}
                    onSuccess={handleProfileEditSuccess}
                    initialData={profile}
                />
              </div>
            </div>
        )}
      </div>
  );
};

export default ProfileHeader;