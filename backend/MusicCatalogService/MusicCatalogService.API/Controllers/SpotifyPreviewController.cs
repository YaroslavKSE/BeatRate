using Microsoft.AspNetCore.Mvc;
using MusicCatalogService.API.Models;
using MusicCatalogService.Core.Interfaces;
using MusicCatalogService.Core.Responses;
using System.Text.Json;
using System.Text.RegularExpressions;
using ErrorResponse = MusicCatalogService.API.Models.ErrorResponse;

namespace MusicCatalogService.API.Controllers;

[Route("api/v1/catalog/spotify-preview")]
public class SpotifyPreviewController : BaseApiController
{
    private readonly ISpotifyPreviewExtractor _spotifyPreviewExtractor;

    public SpotifyPreviewController(
        ISpotifyPreviewExtractor spotifyPreviewExtractor,
        ILogger<SpotifyPreviewController> logger)
        : base(logger)
    {
        _spotifyPreviewExtractor = spotifyPreviewExtractor;
    }

    [HttpGet("track/{spotifyId}")]
    [ProducesResponseType(typeof(SpotifyPreviewResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> GetTrackPreview(string spotifyId)
    {
        if (string.IsNullOrWhiteSpace(spotifyId))
        {
            return BadRequest(new ErrorResponse
            {
                Message = "Spotify track ID is required",
                ErrorCode = ErrorCodes.ValidationError,
                TraceId = HttpContext.TraceIdentifier
            });
        }

        try
        {
            _logger.LogInformation("Fetching preview URL for track {SpotifyId}", spotifyId);
            var previewUrl = await _spotifyPreviewExtractor.GetTrackPreviewUrlAsync(spotifyId);

            if (previewUrl == null)
            {
                return NotFound(new ErrorResponse
                {
                    Message = $"No preview URL found for track {spotifyId}",
                    ErrorCode = ErrorCodes.ResourceNotFound,
                    TraceId = HttpContext.TraceIdentifier
                });
            }

            return Ok(new SpotifyPreviewResponse
            {
                SpotifyId = spotifyId,
                PreviewUrl = previewUrl,
                Type = "track"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching preview URL for track {SpotifyId}", spotifyId);
            return StatusCode(StatusCodes.Status500InternalServerError, new ErrorResponse
            {
                Message = "An error occurred while fetching the preview URL",
                ErrorCode = ErrorCodes.InternalServerError,
                TraceId = HttpContext.TraceIdentifier
            });
        }
    }

    [HttpGet("album/{spotifyId}/previews")]
    [ProducesResponseType(typeof(SpotifyAlbumPreviewsResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> GetAlbumPreviews(string spotifyId)
    {
        if (string.IsNullOrWhiteSpace(spotifyId))
        {
            return BadRequest(new ErrorResponse
            {
                Message = "Spotify album ID is required",
                ErrorCode = ErrorCodes.ValidationError,
                TraceId = HttpContext.TraceIdentifier
            });
        }

        try
        {
            _logger.LogInformation("Fetching preview URLs for album {SpotifyId}", spotifyId);
            var previewUrls = await _spotifyPreviewExtractor.GetAlbumPreviewUrlsAsync(spotifyId);

            return Ok(new SpotifyAlbumPreviewsResponse
            {
                SpotifyId = spotifyId,
                PreviewUrls = previewUrls ?? new List<string>(),
                Type = "album",
                Count = previewUrls?.Count ?? 0
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching preview URLs for album {SpotifyId}", spotifyId);
            return StatusCode(StatusCodes.Status500InternalServerError, new ErrorResponse
            {
                Message = "An error occurred while fetching the preview URLs",
                ErrorCode = ErrorCodes.InternalServerError,
                TraceId = HttpContext.TraceIdentifier
            });
        }
    }

    // This is required by BaseApiController, but not used in this controller
    [NonAction]
    public override Task<IActionResult> GetById(Guid id)
    {
        return Task.FromResult<IActionResult>(NotFound());
    }
}

// Response DTOs
public class SpotifyPreviewResponse
{
    public string SpotifyId { get; set; }
    public string PreviewUrl { get; set; }
    public string Type { get; set; }
}

public class SpotifyAlbumPreviewsResponse
{
    public string SpotifyId { get; set; }
    public List<string> PreviewUrls { get; set; } = new();
    public string Type { get; set; }
    public int Count { get; set; }
}