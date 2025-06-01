import {ReactNode} from "react";

interface TabButtonProps {
    active: boolean;
    onClick: () => void;
    icon: ReactNode;
    label: string;
}

const TabButton = ({ active, onClick, icon, label }: TabButtonProps) => {
    return (
        <button
            onClick={onClick}
            className={`py-3 px-3 sm:py-4 sm:px-6 sm:mr-8 border-b-2 font-medium text-xs sm:text-sm flex items-center justify-center sm:justify-start flex-1 sm:flex-initial ${
                active
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
        >
            {icon}
            {label}
        </button>
    );
};

export default TabButton;