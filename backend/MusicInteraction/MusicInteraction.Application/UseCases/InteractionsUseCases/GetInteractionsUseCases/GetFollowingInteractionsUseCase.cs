using MediatR;
using Microsoft.Extensions.Logging;
using MusicInteraction.Application.Interfaces;
using MusicInteraction.Application.Services;

namespace MusicInteraction.Application.UseCases.InteractionsUseCases.GetInteractionsUseCases;

public class GetFollowingInteractionsUseCase : IRequestHandler<GetFollowingInteractionsCommand, GetInteractionsResult>
{
    private readonly IInteractionStorage _interactionStorage;
    private readonly IUserService _userService;
    private readonly ILogger<GetFollowingInteractionsUseCase> _logger;

    public GetFollowingInteractionsUseCase(
        IInteractionStorage interactionStorage,
        IUserService userService,
        ILogger<GetFollowingInteractionsUseCase> logger)
    {
        _interactionStorage = interactionStorage;
        _userService = userService;
        _logger = logger;
    }

    public async Task<GetInteractionsResult> Handle(GetFollowingInteractionsCommand request, CancellationToken cancellationToken)
    {
        try
        {
            _logger.LogInformation("Fetching following interactions for user: {UserId}", request.UserId);

            // Collect all following user IDs
            var followingIds = new List<string>();
            int currentPage = 1;
            bool hasNextPage = true;

            while (hasNextPage)
            {
                var result = await _userService.GetFollowingUsersAsync(
                    request.UserId, 
                    currentPage, 
                    2000, 
                    cancellationToken);

                if (result?.FollowingIds == null || result.FollowingIds.Count == 0)
                    break;

                followingIds.AddRange(result.FollowingIds);
                hasNextPage = result.HasNextPage;
                currentPage++;

                _logger.LogDebug("Collected {Count} following IDs from page {Page}", 
                    result.FollowingIds.Count, currentPage - 1);
            }

            _logger.LogInformation("Total following users found: {Count}", followingIds.Count);

            if (followingIds.Count == 0)
            {
                return new GetInteractionsResult
                {
                    InteractionsEmpty = true,
                    TotalCount = 0
                };
            }

            // Get interactions from users this user follows
            var paginatedResult = await _interactionStorage.GetInteractionsByUserIds(
                followingIds,
                request.Limit,
                request.Offset);

            return MapToInteractionsResult(paginatedResult);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching following interactions for user {UserId}", request.UserId);
            
            // Return empty result instead of throwing to maintain service availability
            return new GetInteractionsResult
            {
                InteractionsEmpty = true,
                TotalCount = 0
            };
        }
    }

    private GetInteractionsResult MapToInteractionsResult(PaginatedResult<Domain.InteractionsAggregate> paginatedResult)
    {
        if (paginatedResult.Items.Count == 0)
        {
            return new GetInteractionsResult
            {
                InteractionsEmpty = true,
                TotalCount = paginatedResult.TotalCount
            };
        }

        var interactionAggregateDtos = paginatedResult.Items.Select(interaction => new InteractionAggregateShowDto
        {
            AggregateId = interaction.AggregateId,
            UserId = interaction.UserId,
            ItemId = interaction.ItemId,
            ItemType = interaction.ItemType,
            CreatedAt = interaction.CreatedAt,
            IsLiked = interaction.IsLiked,
            Rating = interaction.Rating != null ? new RatingNormalizedDTO
            {
                RatingId = interaction.Rating.RatingId,
                NormalizedGrade = interaction.Rating.Grade.getNormalizedGrade(),
                IsComplex = interaction.Rating.IsComplex
            } : null,
            Review = interaction.Review != null ? new ReviewDTO
            {
                ReviewId = interaction.Review.ReviewId,
                ReviewText = interaction.Review.ReviewText,
                Likes = interaction.Review.Likes,
                Comments = interaction.Review.Comments
            } : null
        }).ToList();

        return new GetInteractionsResult
        {
            InteractionsEmpty = false,
            Interactions = interactionAggregateDtos,
            TotalCount = paginatedResult.TotalCount
        };
    }
}