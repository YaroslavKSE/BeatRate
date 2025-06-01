import { Calendar } from 'lucide-react';
import DiaryEntryComponent from './DiaryEntry';
import { DiaryEntry, GroupedEntries } from './types';

interface DiaryDateGroupProps {
    group: GroupedEntries;
    onReviewClick: (e: React.MouseEvent, entry: DiaryEntry) => void;
    onDeleteClick: (e: React.MouseEvent, entry: DiaryEntry) => void;
}

const DiaryDateGroup = ({ group, onReviewClick, onDeleteClick }: DiaryDateGroupProps) => {
    return (
        <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="bg-primary-50 px-6 py-2 sm:py-3 border-b border-primary-100">
                <div className="flex items-center">
                    <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-primary-600 mr-2" />
                    <h2 className="text-sm sm:text-lg font-medium text-primary-800">{group.date}</h2>
                </div>
            </div>

            <div className="divide-y divide-gray-200">
                {group.entries.map((entry) => (
                    <DiaryEntryComponent
                        key={entry.interaction.aggregateId}
                        entry={entry}
                        onReviewClick={onReviewClick}
                        onDeleteClick={onDeleteClick}
                    />
                ))}
            </div>
        </div>
    );
};

export default DiaryDateGroup;