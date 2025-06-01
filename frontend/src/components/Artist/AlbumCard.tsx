import {AlbumSummary} from "../../api/catalog.ts";
import {Link} from "react-router-dom";

interface AlbumCardProps {
    album: AlbumSummary;
}

const AlbumCard = ({ album }: AlbumCardProps) => {
    return (
        <Link to={`/album/${album.spotifyId}`} className="block">
            <div className="bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-200">
                <div className="aspect-square w-full overflow-hidden bg-gray-200">
                    <img
                        src={album.imageUrl || '/placeholder-album.jpg'}
                        alt={album.name}
                        className="w-full h-full object-cover"
                    />
                </div>
                <div className="p-1 sm:p-3">
                    <h3 className="font-medium text-gray-900 truncate">{album.name}</h3>
                    <div className="flex items-center mt-1 text-xs text-gray-500">
                        <span>{album.releaseDate?.split('-')[0] || 'Unknown year'}</span>
                        <span className="mx-1">•</span>
                        <span className="capitalize">{album.albumType || 'Album'}</span>
                    </div>
                </div>
            </div>
        </Link>
    );
};

export default AlbumCard;