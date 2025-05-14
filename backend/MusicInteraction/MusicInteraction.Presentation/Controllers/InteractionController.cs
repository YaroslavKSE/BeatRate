using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MusicInteraction.Application;

namespace MusicInteraction.Presentation.Controllers;

[ApiController]
[Route("api/v1/interactions/")]
public class InteractionController : ControllerBase
{
    private readonly IMediator mediator;

    public InteractionController(IMediator _mediator)
    {
        this.mediator = _mediator;
    }

    [HttpPost("create")]
    [Authorize]
    public async Task<IActionResult> PostInteraction([FromBody] PostInteractionCommand command)
    {
        // Validate required fields
        if (string.IsNullOrEmpty(command.UserId) ||
            string.IsNullOrEmpty(command.ItemId) ||
            string.IsNullOrEmpty(command.ItemType))
        {
            return BadRequest("UserId, ItemId, and ItemType are required fields");
        }

        // Validate that if UseComplexGrading is true, GradingMethodId is provided
        if (command.UseComplexGrading && (!command.GradingMethodId.HasValue || command.GradingMethodId == Guid.Empty))
        {
            return BadRequest("GradingMethodId is required when UseComplexGrading is true");
        }

        var result = await mediator.Send(command);

        if (!result.InteractionCreated)
        {
            return BadRequest("Error interaction not created");
        }

        if (!string.IsNullOrEmpty(result.ErrorMessage))
        {
            return Ok(result);
        }

        return Ok(result);
    }

    [HttpPut("update")]
    [Authorize]
    public async Task<IActionResult> UpdateInteraction([FromBody] UpdateInteractionCommand command)
    {
        var result = await mediator.Send(command);

        if (!result.InteractionUpdated)
        {
            return BadRequest("Error interaction not updated");
        }

        if (!string.IsNullOrEmpty(result.ErrorMessage))
        {
            return Ok(result);
        }

        return Ok(result);
    }

    [HttpGet("all")]
    public async Task<IActionResult> GetInteractions([FromQuery] int? limit = null, [FromQuery] int? offset = null)
    {
        var command = new GetInteractionsCommand
        {
            Limit = limit,
            Offset = offset
        };

        var result = await mediator.Send(command);

        if (result.InteractionsEmpty && result.TotalCount == 0)
            return NotFound("There are no interactions");

        return Ok(new {
            items = result.Interactions,
            totalCount = result.TotalCount
        });
    }

    [HttpGet("by-id/{id}")]
    public async Task<IActionResult> GetInteractionById(Guid id)
    {
        var command = new GetInteractionByIdCommand() { InteractionId = id };
        var result = await mediator.Send(command);

        if (!result.Success)
        {
            return NotFound(result.ErrorMessage);
        }

        return Ok(result.Interaction);
    }

    [HttpGet("by-user-id/{userId}")]
    public async Task<IActionResult> GetInteractionsByUserId(string userId, [FromQuery] int? limit = null, [FromQuery] int? offset = null)
    {
        var command = new GetInteractionsByUserIdCommand()
        {
            UserId = userId,
            Limit = limit,
            Offset = offset
        };

        var result = await mediator.Send(command);

        if (result.InteractionsEmpty && result.TotalCount == 0)
        {
            return NotFound($"No interactions found for user {userId}");
        }

        return Ok(new {
            items = result.Interactions,
            totalCount = result.TotalCount
        });
    }

    [HttpGet("by-item-id/{itemId}")]
    public async Task<IActionResult> GetInteractionsByItemId(string itemId, [FromQuery] int? limit = null, [FromQuery] int? offset = null)
    {
        var command = new GetInteractionsByItemIdCommand()
        {
            ItemId = itemId,
            Limit = limit,
            Offset = offset
        };

        var result = await mediator.Send(command);

        if (result.InteractionsEmpty && result.TotalCount == 0)
        {
            return NotFound($"No interactions found for item {itemId}");
        }

        return Ok(new {
            items = result.Interactions,
            totalCount = result.TotalCount
        });
    }

    [HttpGet("reviews-by-item-id/{itemId}")]
    public async Task<IActionResult> GetReviewedInteractionsByItemId(string itemId, [FromQuery] int? limit = null, [FromQuery] int? offset = null, [FromQuery]bool? useHotScore = true)
    {
        var command = new GetReviewedInteractionsByItemIdCommand()
        {
            ItemId = itemId,
            Limit = limit,
            Offset = offset,
            UseHotScore = useHotScore
        };

        var result = await mediator.Send(command);

        if (result.InteractionsEmpty && result.TotalCount == 0)
        {
            return NotFound($"No interactions found for item {itemId}");
        }

        return Ok(new {
            items = result.Interactions,
            totalCount = result.TotalCount
        });
    }

    [HttpGet("by-user-and-item")]
    public async Task<IActionResult> GetInteractionsByUserAndItem(
        [FromQuery] string userId,
        [FromQuery] string itemId,
        [FromQuery] int? limit = null,
        [FromQuery] int? offset = null)
    {
        if (string.IsNullOrEmpty(userId) || string.IsNullOrEmpty(itemId))
        {
            return BadRequest("Both userId and itemId are required parameters");
        }

        var command = new GetInteractionsByUserAndItemCommand()
        {
            UserId = userId,
            ItemId = itemId,
            Limit = limit,
            Offset = offset
        };

        var result = await mediator.Send(command);

        if (result.InteractionsEmpty && result.TotalCount == 0)
        {
            return NotFound($"No interactions found for user {userId} and item {itemId}");
        }

        return Ok(new {
            items = result.Interactions,
            totalCount = result.TotalCount
        });
    }

    [HttpPost("by-several-user-ids")]
    public async Task<IActionResult> GetInteractionsByUserIds([FromBody] List<string> userIds, [FromQuery] int? limit = null, [FromQuery] int? offset = null)
    {
        if (userIds == null || userIds.Count == 0)
        {
            return BadRequest("At least one userId is required");
        }

        var command = new GetInteractionsByUserIdsCommand()
        {
            UserIds = userIds,
            Limit = limit,
            Offset = offset
        };

        var result = await mediator.Send(command);

        if (result.InteractionsEmpty && result.TotalCount == 0)
        {
            return NotFound($"No interactions found for the specified users");
        }

        return Ok(new {
            items = result.Interactions,
            totalCount = result.TotalCount
        });
    }

    [HttpPost("by-several-item-ids")]
    public async Task<IActionResult> GetInteractionsByItemIds([FromBody] List<string> itemIds, [FromQuery] int? limit = null, [FromQuery] int? offset = null)
    {
        if (itemIds == null || itemIds.Count == 0)
        {
            return BadRequest("At least one itemId is required");
        }

        var command = new GetInteractionsByItemIdsCommand()
        {
            ItemIds = itemIds,
            Limit = limit,
            Offset = offset
        };

        var result = await mediator.Send(command);

        if (result.InteractionsEmpty && result.TotalCount == 0)
        {
            return NotFound($"No interactions found for the specified items");
        }

        return Ok(new {
            items = result.Interactions,
            totalCount = result.TotalCount
        });
    }

    [HttpGet("likes-all")]
    public async Task<IActionResult> GetLikes()
    {
        var result = await mediator.Send(new GetLikesCommand());
        if (result.LikesEmpty) return NotFound("There are no likes");
        return Ok(result.Likes);
    }

    [HttpGet("reviews-all")]
    public async Task<IActionResult> GetReviews()
    {
        var result = await mediator.Send(new GetReviewsCommand());
        if (result.ReviewsEmpty) return NotFound("There are no reviews");
        return Ok(result.Reviews);
    }

    [HttpGet("ratings-all")]
    public async Task<IActionResult> GetRatings()
    {
        var result = await mediator.Send(new GetRatingsCommand());
        if (result.RatingsEmpty) return NotFound("There are no ratings");
        return Ok(result.Ratings);
    }

    [HttpGet("rating-by-id/{id}")]
    public async Task<IActionResult> GetRatingById(Guid id)
    {
        var command = new GetRatingByIdCommand { RatingId = id };
        var result = await mediator.Send(command);

        if (!result.Success)
        {
            return NotFound(result.ErrorMessage);
        }

        return Ok(result.Rating);
    }

    [HttpDelete("by-id/{id}")]
    [Authorize]
    public async Task<IActionResult> DeleteInteractionById(Guid id)
    {
        var command = new DeleteInteractionCommand { InteractionId = id };
        var result = await mediator.Send(command);

        if (!result.Success)
        {
            return NotFound(result.ErrorMessage);
        }

        return Ok();
    }

    [HttpGet("item-stats/{itemId}")]
    public async Task<IActionResult> GetItemStats(string itemId)
    {
        if (string.IsNullOrEmpty(itemId))
        {
            return BadRequest("Item ID is required");
        }

        var command = new GetItemStatsByIdCommand
        {
            ItemId = itemId
        };

        var result = await mediator.Send(command);

        if (!result.Success)
        {
            return BadRequest(result.ErrorMessage);
        }

        return Ok(result.Stats);
    }

    [HttpGet("following-feed")]
    [Authorize]
    public async Task<IActionResult> GetFollowingInteractions(
        [FromQuery] string userId,
        [FromQuery] int? limit = null,
        [FromQuery] int? offset = null)
    {
        if (string.IsNullOrEmpty(userId))
        {
            return BadRequest("UserId is required");
        }

        var command = new GetFollowingInteractionsCommand
        {
            UserId = userId,
            Limit = limit,
            Offset = offset
        };

        var result = await mediator.Send(command);

        if (result.InteractionsEmpty && result.TotalCount == 0)
        {
            return NotFound("No interactions found from users you follow");
        }

        return Ok(new
        {
            items = result.Interactions,
            totalCount = result.TotalCount
        });
    }
}