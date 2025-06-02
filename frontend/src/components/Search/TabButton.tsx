import React from 'react';
import { TabButtonProps } from './types';

const TabButton: React.FC<TabButtonProps> = ({
                                                 active,
                                                 onClick,
                                                 icon,
                                                 label
                                             }) => {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`py-3 px-3 sm:py-4 sm:px-1 sm:mr-8 border-b-2 font-medium text-xs sm:text-sm flex items-center justify-center sm:justify-start flex-1 sm:flex-initial ${
                active
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
        >
            {icon && <span className="mr-1 sm:mr-1">{icon}</span>}
            <span>{label}</span>
        </button>
    );
};

export default TabButton;