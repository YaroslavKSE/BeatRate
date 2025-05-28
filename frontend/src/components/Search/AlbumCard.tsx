import {AlbumSummary} from "../../api/catalog.ts";

interface AlbumCardProps {
    album: AlbumSummary;
    mobile?: boolean;
    compact?: boolean;
}

const AlbumCard = ({ album, mobile = false, compact = false }: AlbumCardProps) => {
    return (
        <div className={`bg-white rounded-lg shadow overflow-hidden hover:shadow-md transition-shadow duration-200 ${
            mobile && compact ? 'w-full' : ''
        }`}>
            <a href={`/album/${album.spotifyId}`} className="block">
                <div className="aspect-square w-full overflow-hidden bg-gray-200">
                    <img
                        src={album.imageUrl || '/placeholder-album.jpg'}
                        alt={album.name}
                        className="w-full h-full object-cover"
                    />
                </div>
                <div className={`${mobile && compact ? 'p-1' : 'p-3'}`}>
                    <h3 className={`font-medium text-gray-900 truncate ${
                        mobile && compact ? 'text-[0.800rem]' : 'text-base'
                    }`}>
                        {album.name}
                    </h3>
                    <p className={`text-gray-600 truncate ${
                        mobile && compact ? 'text-xs' : 'text-sm'
                    }`}>
                        {album.artistName}
                    </p>
                    <div className={`flex items-center mt-1 text-gray-500 ${
                        mobile && compact ? 'text-[0.650rem]' : 'text-xs'
                    }`}>
                        <span>{album.releaseDate?.split('-')[0] || 'Unknown year'}</span>
                        <span className="mx-1">•</span>
                        <span>{album.albumType === 'album' ? 'Album' : album.albumType}</span>
                    </div>
                </div>
            </a>
        </div>
    );
};

export default AlbumCard;