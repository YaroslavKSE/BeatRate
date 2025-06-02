import React from 'react';
import {Scale, History, Settings, UserCog, ListMusic, Headphones, Users, UserPlus} from 'lucide-react';

// Define the tab types that can be used in both Profile and UserProfile
export type ProfileTabType =
    | 'overview'
    | 'grading-methods'
    | 'history'
    | 'settings'
    | 'following'
    | 'followers'
    | 'preferences'
    | 'lists'

interface ProfileTabProps {
    active: boolean;
    onClick: () => void;
    icon: React.ReactNode;
    label: string;
    mobileLabel?: string; // Optional shorter label for mobile
}

interface ProfileTabsProps {
    activeTab: ProfileTabType;
    onTabChange: (tab: ProfileTabType) => void;
    isOwnProfile: boolean;
}

// Individual tab button component - updated for mobile optimization
const ProfileTabButton: React.FC<ProfileTabProps> = ({
                                                         active,
                                                         onClick,
                                                         icon,
                                                         label,
                                                         mobileLabel
                                                     }) => {
    return (
        <button
            onClick={onClick}
            className={`
            flex items-center justify-center
            px-2 py-3 sm:py-4 sm:px-1 sm:mr-6
            border-b-2 font-medium
            text-xs sm:text-sm
            flex-1 sm:flex-initial
            ${active
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }
          `}
        >
            <div className="mr-1 sm:mr-2">{icon}</div>
            {/* Show mobile label on small screens, full label on larger screens */}
            <span className="sm:hidden">{mobileLabel || label}</span>
            <span className="hidden sm:inline">{label}</span>
        </button>
    );
};

const ProfileTabs: React.FC<ProfileTabsProps> = ({
                                                     activeTab,
                                                     onTabChange,
                                                     isOwnProfile,
                                                 }) => {
    // Filter out following and followers tabs for mobile
    const getMobileTabs = () => {
        const baseTabs = [
            {
                key: 'overview' as ProfileTabType,
                icon: <Headphones className="h-4 w-4" />,
                label: 'Overview',
                mobileLabel: 'Overview'
            },
            {
                key: 'history' as ProfileTabType,
                icon: <History className="h-4 w-4" />,
                label: 'History',
                mobileLabel: 'History'
            },
            {
                key: 'lists' as ProfileTabType,
                icon: <ListMusic className="h-4 w-4" />,
                label: 'Lists',
                mobileLabel: 'Lists'
            },
            {
                key: 'grading-methods' as ProfileTabType,
                icon: <Scale className="h-4 w-4" />,
                label: 'Grading Methods',
                mobileLabel: 'Grading'
            }
        ];

        // Add preferences tab only for own profile
        if (isOwnProfile) {
            baseTabs.push({
                key: 'preferences' as ProfileTabType,
                icon: <UserCog className="h-4 w-4" />,
                label: 'Preferences',
                mobileLabel: 'Prefs'
            });
        }

        // Add settings tab only for own profile
        if (isOwnProfile) {
            baseTabs.push({
                key: 'settings' as ProfileTabType,
                icon: <Settings className="h-4 w-4" />,
                label: 'Settings',
                mobileLabel: 'Settings'
            });
        }

        return baseTabs;
    };

    const getDesktopTabs = () => {
        return [
            {
                key: 'overview' as ProfileTabType,
                icon: <Headphones className="h-4 w-4" />,
                label: 'Overview'
            },
            {
                key: 'history' as ProfileTabType,
                icon: <History className="h-4 w-4" />,
                label: 'History'
            },
            {
                key: 'lists' as ProfileTabType,
                icon: <ListMusic className="h-4 w-4" />,
                label: 'Lists'
            },
            {
                key: 'grading-methods' as ProfileTabType,
                icon: <Scale className="h-4 w-4" />,
                label: 'Grading Methods'
            },
            {
                key: 'following' as ProfileTabType,
                icon: <UserPlus className="h-4 w-4" />,
                label: 'Following'
            },
            {
                key: 'followers' as ProfileTabType,
                icon: <Users className="h-4 w-4" />,
                label: 'Followers'
            },
            ...(isOwnProfile ? [
                {
                    key: 'preferences' as ProfileTabType,
                    icon: <UserCog className="h-4 w-4" />,
                    label: 'Preferences'
                },
                {
                    key: 'settings' as ProfileTabType,
                    icon: <Settings className="h-4 w-4" />,
                    label: 'Settings'
                }
            ] : [])
        ];
    };

    return (
        <div className="border-b border-gray-200">
            {/* Mobile Navigation - Compact with shorter labels */}
            <nav className="sm:hidden flex overflow-x-auto px-2 gap-2">
                {getMobileTabs().map((tab) => (
                    <ProfileTabButton
                        key={tab.key}
                        active={activeTab === tab.key}
                        onClick={() => onTabChange(tab.key)}
                        icon={tab.icon}
                        label={tab.label}
                        mobileLabel={tab.mobileLabel}
                    />
                ))}
            </nav>

            {/* Desktop Navigation - Original layout with all tabs */}
            <nav className="hidden sm:flex overflow-x-auto px-6 md:pl-[136px] items-start">
                {getDesktopTabs().map((tab) => (
                    <ProfileTabButton
                        key={tab.key}
                        active={activeTab === tab.key}
                        onClick={() => onTabChange(tab.key)}
                        icon={tab.icon}
                        label={tab.label}
                    />
                ))}
            </nav>
        </div>
    );
};

export default ProfileTabs;