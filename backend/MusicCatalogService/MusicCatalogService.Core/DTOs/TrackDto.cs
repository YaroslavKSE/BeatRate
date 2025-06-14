namespace MusicCatalogService.Core.DTOs;

public class TrackSummaryDto : BaseSpotifyItemDto
{
    public string ArtistName { get; set; }
    public int DurationMs { get; set; }
    public bool IsExplicit { get; set; }
    public int? TrackNumber { get; set; }
    public string AlbumId { get; set; }
    
    public string PreviewUrl { get; set; }

}

public class TrackDetailDto : TrackSummaryDto
{
    public List<ArtistSummaryDto> Artists { get; set; } = new();
    public AlbumSummaryDto Album { get; set; }
    public int DiscNumber { get; set; }
    public string Isrc { get; set; }
    public string PreviewUrl { get; set; }

    // Formatted duration string (e.g., "3:24")
    public string Duration => FormatDuration(DurationMs);

    private string FormatDuration(int ms)
    {
        var totalSeconds = ms / 1000;
        var minutes = totalSeconds / 60;
        var seconds = totalSeconds % 60;
        return $"{minutes}:{seconds:D2}";
    }
}