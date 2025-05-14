using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MusicInteraction.Application;

namespace MusicInteraction.Presentation.Controllers;

[ApiController]
[Route("api/v1/grading-methods")]
public class GradingMethodController : ControllerBase
{
    private readonly IMediator mediator;

    public GradingMethodController(IMediator mediator)
    {
        this.mediator = mediator;
    }

    [HttpPost("create")]
    [Authorize]
    public async Task<IActionResult> CreateGradingMethod([FromBody] CreateGradingMethodCommand request)
    {
        var result = await mediator.Send(request);

        if (!result.Success)
            return BadRequest(result.ErrorMessage);

        return Ok(result);
    }

    [HttpGet("public-all")]
    public async Task<IActionResult> GetPublicGradingMethods()
    {
        var command = new GetPublicGradingMethodsCommand();
        var result = await mediator.Send(command);

        if (!result.Success)
            return BadRequest(result.ErrorMessage);

        return Ok(result.GradingMethods);
    }

    [HttpGet("by-id/{id}")]
    public async Task<IActionResult> GetGradingMethodById(Guid id)
    {
        var command = new GetGradingMethodByIdCommand
        {
            GradingMethodId = id
        };

        var result = await mediator.Send(command);

        if (!result.Success)
            return NotFound(result.ErrorMessage);

        return Ok(result.GradingMethod);
    }

    [HttpGet("by-creator-id/{creatorId}")]
    public async Task<IActionResult> GetGradingMethodsByCreatorId(string creatorId)
    {
        var command = new GetGradingMethodsByCreatorIdCommand()
        {
            CreatorId = creatorId
        };

        var result = await mediator.Send(command);

        if (!result.Success)
            return BadRequest(result.ErrorMessage);

        return Ok(result.GradingMethods);
    }

    [HttpDelete("by-id/{id}")]
    [Authorize]
    public async Task<IActionResult> DeleteGradingMethodById(Guid id)
    {
        var command = new DeleteGradingMethodCommand
        {
            GradingMethodId = id
        };

        var result = await mediator.Send(command);

        if (!result.Success)
            return BadRequest(result.ErrorMessage);

        return Ok();
    }

    [HttpPut]
    [Authorize]
    public async Task<IActionResult> UpdateGradingMethod([FromBody] UpdateGradingMethodCommand request)
    {
        var result = await mediator.Send(request);

        if (!result.Success)
            return BadRequest(result.ErrorMessage);

        return Ok(result);
    }
}