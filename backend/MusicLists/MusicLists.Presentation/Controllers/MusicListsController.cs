// MusicListsController.cs (updated)
using MediatR;
using Microsoft.AspNetCore.Mvc;
using MusicLists.Application.Commands;
using MusicLists.Application.DTOs;
using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;

namespace MusicLists.Presentation.Controllers;

[ApiController]
[Route("api/v1/music-lists")]
public class MusicListsController : ControllerBase
{
    private readonly IMediator _mediator;

    public MusicListsController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [HttpPost]
    [Authorize]
    public async Task<IActionResult> CreateList([FromBody] CreateMusicListCommand command)
    {
        var result = await _mediator.Send(command);

        if (result.Success)
        {
            return Ok(result);
        }

        return BadRequest(result);
    }

    [HttpPut("{listId:guid}")]
    [Authorize]
    public async Task<IActionResult> UpdateList(Guid listId, [FromBody] UpdateMusicListCommand command)
    {
        if (listId != command.ListId)
        {
            return BadRequest("List ID in URL doesn't match the one in request body");
        }

        var result = await _mediator.Send(command);

        if (result.Success)
        {
            return Ok(result);
        }

        return BadRequest(result);
    }

    [HttpDelete("{listId:guid}")]
    [Authorize]
    public async Task<IActionResult> DeleteList(Guid listId)
    {
        var command = new DeleteMusicListCommand { ListId = listId };
        var result = await _mediator.Send(command);

        if (result.Success)
        {
            return Ok(result);
        }

        return BadRequest(result);
    }

    [HttpPost("{listId:guid}/like")]
    [Authorize]
    public async Task<IActionResult> AddListLike(Guid listId, [FromBody] string userId)
    {
        var command = new AddListLikeCommand
        {
            ListId = listId,
            UserId = userId
        };

        var result = await _mediator.Send(command);

        if (result.Success)
        {
            return Ok(result);
        }

        return BadRequest(result);
    }

    [HttpDelete("{listId:guid}/like")]
    [Authorize]
    public async Task<IActionResult> RemoveListLike(Guid listId, [FromQuery] string userId)
    {
        var command = new RemoveListLikeCommand
        {
            ListId = listId,
            UserId = userId
        };

        var result = await _mediator.Send(command);

        if (result.Success)
        {
            return Ok(result);
        }

        return BadRequest(result);
    }

    [HttpGet("{listId:guid}/like/{userId}")]
    public async Task<IActionResult> CheckUserLikedList(Guid listId, string userId)
    {
        var command = new CheckUserLikedListCommand
        {
            ListId = listId,
            UserId = userId
        };

        var result = await _mediator.Send(command);

        if (result.Success)
        {
            return Ok(result);
        }

        return BadRequest(result);
    }
    
    [HttpPost("{listId:guid}/comment")]
    [Authorize]
    public async Task<IActionResult> AddListComment(Guid listId, [FromBody] AddCommentRequest request)
    {
        var command = new AddListCommentCommand
        {
            ListId = listId,
            UserId = request.UserId,
            CommentText = request.CommentText
        };

        var result = await _mediator.Send(command);

        if (result.Success)
        {
            return Ok(result);
        }

        return BadRequest(result);
    }

    [HttpDelete("comment/{commentId:guid}")]
    [Authorize]
    public async Task<IActionResult> DeleteListComment(Guid commentId, [FromQuery] string userId)
    {
        var command = new DeleteListCommentCommand
        {
            CommentId = commentId,
            UserId = userId
        };

        var result = await _mediator.Send(command);

        if (result.Success)
        {
            return Ok(result);
        }

        return BadRequest(result);
    }

    [HttpGet("{listId:guid}")]
    public async Task<IActionResult> GetListById(Guid listId)
    {
        var command = new GetListByIdCommand { ListId = listId };
        var result = await _mediator.Send(command);

        if (!result.Success)
        {
            return NotFound(result.ErrorMessage);
        }

        return Ok(result.List);
    }

    [HttpGet("{listId:guid}/items")]
    public async Task<IActionResult> GetListItems(Guid listId, [FromQuery] int? limit = null, [FromQuery] int? offset = null)
    {
        var command = new GetListItemsCommand
        {
            ListId = listId,
            Limit = limit,
            Offset = offset
        };

        var result = await _mediator.Send(command);

        if (!result.Success)
        {
            return NotFound(result.ErrorMessage);
        }

        return Ok(new {
            items = result.Items,
            totalCount = result.TotalCount
        });
    }

    [HttpGet("{listId:guid}/comments")]
    public async Task<IActionResult> GetListComments(Guid listId, [FromQuery] int? limit = null, [FromQuery] int? offset = null)
    {
        var command = new GetListCommentsCommand
        {
            ListId = listId,
            Limit = limit,
            Offset = offset
        };

        var result = await _mediator.Send(command);

        if (!result.Success)
        {
            return NotFound(result.ErrorMessage);
        }

        return Ok(new {
            comments = result.Comments,
            totalCount = result.TotalCount
        });
    }

    [HttpGet("by-user/{userId}")]
    public async Task<IActionResult> GetListsByUserId(
        string userId,
        [FromQuery] int? limit = null,
        [FromQuery] int? offset = null,
        [FromQuery] string? listType = null)  // Add this parameter
    {
        var command = new GetListsByUserIdCommand
        {
            UserId = userId,
            Limit = limit,
            Offset = offset,
            ListType = listType  // Set the list type filter
        };

        var result = await _mediator.Send(command);

        if (!result.Success)
        {
            return BadRequest(result.ErrorMessage);
        }

        return Ok(new {
            lists = result.Lists,
            totalCount = result.TotalCount
        });
    }

    [HttpGet("by-spotify-id/{spotifyId}")]
    public async Task<IActionResult> GetListsBySpotifyId(
        string spotifyId,
        [FromQuery] int? limit = null,
        [FromQuery] int? offset = null,
        [FromQuery] string? listType = null)  // Add this parameter
    {
        var command = new GetListsBySpotifyIdCommand
        {
            SpotifyId = spotifyId,
            Limit = limit,
            Offset = offset,
            ListType = listType  // Set the list type filter
        };

        var result = await _mediator.Send(command);

        if (!result.Success)
        {
            return BadRequest(result.ErrorMessage);
        }

        return Ok(new {
            lists = result.Lists,
            totalCount = result.TotalCount
        });
    }

    [HttpPost("{listId:guid}/items/insert")]
    [Authorize]
    public async Task<IActionResult> InsertListItem(Guid listId, [FromBody] InsertListItemRequest request)
    {
        var command = new InsertListItemCommand
        {
            ListId = listId,
            SpotifyId = request.SpotifyId,
            Position = request.Position
        };

        var result = await _mediator.Send(command);

        if (!result.Success)
        {
            return BadRequest(result.ErrorMessage);
        }

        return Ok(result);
    }
}

// Create a request DTO for adding comments
public class AddCommentRequest
{
    public string UserId { get; set; }
    public string CommentText { get; set; }
}

public class InsertListItemRequest
{
    public string SpotifyId { get; set; }
    public int Position { get; set; }
}