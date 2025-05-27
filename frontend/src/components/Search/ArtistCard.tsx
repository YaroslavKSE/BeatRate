import { ArtistSummary } from "../../api/catalog.ts";

interface ArtistCardProps {
    artist: ArtistSummary;
    mobile?: boolean;
    compact?: boolean;
}

const ArtistCard = ({ artist, mobile = false, compact = false }: ArtistCardProps) => {
    return (
        <div className={`bg-white rounded-lg shadow overflow-hidden hover:shadow-md transition-shadow duration-200 ${
            mobile && compact ? 'w-full' : ''
        }`}>
            <a href={`/artist/${artist.spotifyId}`} className="block">
                <div className={`w-full shadow-md rounded-full overflow-hidden border-2 sm:border-4 border-white aspect-square`}>
                    <img
                        src={artist.imageUrl || '/placeholder-artist.jpg'}
                        alt={artist.name}
                        className="w-full h-full object-cover rounded-full"
                    />
                </div>
                <div className={`text-center ${mobile && compact ? 'p-2' : 'p-3'}`}>
                    <h3 className={`font-medium text-gray-900 truncate ${
                        mobile && compact ? 'text-xs' : 'text-sm sm:text-base'
                    }`}>
                        {artist.name}
                    </h3>
                </div>
            </a>
        </div>
    );
};

export default ArtistCard;