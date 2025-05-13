using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MusicInteraction.Application;

namespace MusicInteraction.Presentation.Controllers;

[ApiController]
[Route("api/v1/review-interactions")]
public class ReviewInteractionController : ControllerBase
{
    private readonly IMediator _mediator;

    public ReviewInteractionController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [HttpPost("likes")]
    [Authorize]
    public async Task<IActionResult> AddReviewLike([FromBody] AddReviewLikeCommand command)
    {
        if (string.IsNullOrEmpty(command.UserId) || command.ReviewId == Guid.Empty)
        {
            return BadRequest("UserId and ReviewId are required");
        }

        var result = await _mediator.Send(command);

        if (!result.Success)
        {
            return BadRequest(result.ErrorMessage);
        }

        return Ok(result.Like);
    }

    [HttpDelete("likes")]
    [Authorize]
    public async Task<IActionResult> RemoveReviewLike([FromQuery] Guid reviewId, [FromQuery] string userId)
    {
        if (string.IsNullOrEmpty(userId) || reviewId == Guid.Empty)
        {
            return BadRequest("UserId and ReviewId are required");
        }

        var command = new RemoveReviewLikeCommand
        {
            ReviewId = reviewId,
            UserId = userId
        };

        var result = await _mediator.Send(command);

        if (!result.Success)
        {
            return BadRequest(result.ErrorMessage);
        }

        return Ok();
    }

    [HttpGet("likes/check")]
    public async Task<IActionResult> CheckUserLikedReview([FromQuery] Guid reviewId, [FromQuery] string userId)
    {
        if (string.IsNullOrEmpty(userId) || reviewId == Guid.Empty)
        {
            return BadRequest("UserId and ReviewId are required");
        }

        var command = new CheckUserLikedReviewCommand
        {
            ReviewId = reviewId,
            UserId = userId
        };

        var result = await _mediator.Send(command);

        if (!result.Success)
        {
            return BadRequest(result.ErrorMessage);
        }

        return Ok(new { hasLiked = result.HasLiked });
    }

    [HttpPost("comments")]
    [Authorize]
    public async Task<IActionResult> AddReviewComment([FromBody] AddReviewCommentCommand command)
    {
        if (string.IsNullOrEmpty(command.UserId) || command.ReviewId == Guid.Empty || string.IsNullOrWhiteSpace(command.CommentText))
        {
            return BadRequest("UserId, ReviewId, and CommentText are required");
        }

        var result = await _mediator.Send(command);

        if (!result.Success)
        {
            return BadRequest(result.ErrorMessage);
        }

        return Ok(result.Comment);
    }

    [HttpDelete("comments/{commentId}")]
    [Authorize]
    public async Task<IActionResult> DeleteReviewComment(Guid commentId, [FromQuery] string userId)
    {
        if (string.IsNullOrEmpty(userId) || commentId == Guid.Empty)
        {
            return BadRequest("UserId and CommentId are required");
        }

        var command = new DeleteReviewCommentCommand
        {
            CommentId = commentId,
            UserId = userId
        };

        var result = await _mediator.Send(command);

        if (!result.Success)
        {
            return BadRequest(result.ErrorMessage);
        }

        return Ok();
    }

    [HttpGet("comments")]
    public async Task<IActionResult> GetReviewComments([FromQuery] Guid reviewId, [FromQuery] int? limit = null, [FromQuery] int? offset = null)
    {
        if (reviewId == Guid.Empty)
        {
            return BadRequest("ReviewId is required");
        }

        var command = new GetReviewCommentsCommand
        {
            ReviewId = reviewId,
            Limit = limit,
            Offset = offset
        };

        var result = await _mediator.Send(command);

        if (!result.Success)
        {
            return BadRequest(result.ErrorMessage);
        }

        return Ok(new {
            comments = result.Comments,
            totalCount = result.TotalCount
        });
    }
}