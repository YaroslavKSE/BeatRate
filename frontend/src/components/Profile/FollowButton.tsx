import React from 'react';
import { UserPlus, UserCheck, Loader } from 'lucide-react';

interface FollowButtonProps {
  isFollowing: boolean;
  isLoading: boolean;
  onClick?: () => void;
  variant?: 'default' | 'header' | 'card';
  disabled?: boolean;
}

const FollowButton: React.FC<FollowButtonProps> = ({
  isFollowing,
  isLoading,
  onClick,
  variant = 'default',
  disabled = false
}) => {
  // Styles based on variant
  const getButtonClasses = () => {
    const baseClasses = "font-medium flex items-center transition-colors";

    if (variant === 'header') {
      return `${baseClasses} px-2 sm:px-4 py-1 rounded-full text-xs sm:text-sm ${
        isFollowing 
          ? 'bg-white text-primary-700 hover:bg-primary-100' 
          : 'bg-blue-600 text-white sm:hover:bg-blue-700'
      }`;
    } else if (variant === 'card') {
      return `${baseClasses} px-3 py-1.5 border rounded text-sm ${
        isFollowing
          ? 'border-primary-300 bg-primary-50 text-primary-700 hover:bg-primary-100'
          : 'border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100'
      }`;
    } else {
      // Default variant - larger button with more padding
      return `${baseClasses} px-4 py-2 rounded-md text-sm ${
        isFollowing 
          ? 'bg-primary-50 text-primary-700 border border-primary-300 hover:bg-primary-100' 
          : 'bg-primary-600 text-white hover:bg-primary-700'
      }`;
    }
  };

  return (
    <button
      onClick={onClick}
      disabled={isLoading || disabled}
      className={getButtonClasses()}
    >
      {isLoading ? (
        <Loader className="h-3 w-3 sm:h-4 sm:w-4 mr-2 animate-spin" />
      ) : isFollowing ? (
        <UserCheck className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
      ) : (
        <UserPlus className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
      )}
      {isFollowing ? 'Following' : 'Follow'}
    </button>
  );
};

export default FollowButton;