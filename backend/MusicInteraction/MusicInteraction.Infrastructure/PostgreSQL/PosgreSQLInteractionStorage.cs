using Microsoft.EntityFrameworkCore;
using MusicInteraction.Application.Interfaces;
using MusicInteraction.Domain;
using MusicInteraction.Infrastructure.PostgreSQL.Entities;
using MusicInteraction.Infrastructure.PostgreSQL.Mapping;

namespace MusicInteraction.Infrastructure.PostgreSQL
{
    public class PostgreSQLInteractionStorage : IInteractionStorage
    {
        private readonly MusicInteractionDbContext _dbContext;

        public PostgreSQLInteractionStorage(MusicInteractionDbContext dbContext)
        {
            _dbContext = dbContext;
        }

        public async Task AddInteractionAsync(InteractionsAggregate interaction)
        {
            // Begin transaction to ensure all related entities are saved together
            using var transaction = await _dbContext.Database.BeginTransactionAsync();
            try
            {
                var interactionEntity = InteractionMapper.ToEntity(interaction);

                await _dbContext.Interactions.AddAsync(interactionEntity);

                await _dbContext.SaveChangesAsync();

                if (interaction.IsLiked)
                {
                    // Create a new Like entity
                    var likeEntity = new LikeEntity
                    {
                        LikeId = Guid.NewGuid(),
                        AggregateId = interactionEntity.AggregateId
                    };
                    await _dbContext.Likes.AddAsync(likeEntity);
                }

                if (interaction.Review != null)
                {
                    var reviewEntity = ReviewMapper.ToEntity(interaction.Review);
                    reviewEntity.AggregateId = interactionEntity.AggregateId;
                    await _dbContext.Reviews.AddAsync(reviewEntity);
                }

                if (interaction.Rating != null)
                {
                    await RatingMapper.ToEntityAsync(interaction.Rating, _dbContext);
                }

                // Save all changes
                await _dbContext.SaveChangesAsync();
                await transaction.CommitAsync();
            }
            catch (Exception)
            {
                // Rollback transaction if any error occurs
                await transaction.RollbackAsync();
                throw;
            }
        }

        public async Task UpdateInteractionAsync(InteractionsAggregate interaction)
        {
            await using var transaction = await _dbContext.Database.BeginTransactionAsync();

            //Implement like changes
            var likeEntity = await _dbContext.Likes.FirstOrDefaultAsync(i => i.AggregateId == interaction.AggregateId);
            if (likeEntity == null && interaction.IsLiked)
            {
                likeEntity = new LikeEntity
                {
                    LikeId = Guid.NewGuid(),
                    AggregateId = interaction.AggregateId
                };
                await _dbContext.Likes.AddAsync(likeEntity);
            }
            else if(likeEntity != null && !interaction.IsLiked)
            {
                _dbContext.Likes.Remove(likeEntity);
            }

            //Implement review changes
            var reviewEntity =
                await _dbContext.Reviews.FirstOrDefaultAsync(i => i.AggregateId == interaction.AggregateId);
            if (reviewEntity != null)
            {
                if (interaction.Review == null || interaction.Review.ReviewText == "")
                {
                    _dbContext.Reviews.Remove(reviewEntity);
                }
                else if(interaction.Review.ReviewText != reviewEntity.ReviewText)
                {
                    reviewEntity.ReviewText = interaction.Review.ReviewText;
                    _dbContext.Reviews.Update(reviewEntity);
                }
            }
            else if (reviewEntity == null && interaction.Review != null && interaction.Review.ReviewText != "")
            {
                reviewEntity = ReviewMapper.ToEntity(interaction.Review);
                reviewEntity.AggregateId = interaction.AggregateId;
                await _dbContext.Reviews.AddAsync(reviewEntity);
            }

            //Implement rating changes
            var ratingEntity =
                await _dbContext.Ratings.FirstOrDefaultAsync(i => i.AggregateId == interaction.AggregateId);
            if (ratingEntity != null)
            {
                _dbContext.Ratings.Remove(ratingEntity);
            }
            if (interaction.Rating != null)
            {
                await RatingMapper.ToEntityAsync(interaction.Rating, _dbContext);
            }

            await _dbContext.SaveChangesAsync();
            await transaction.CommitAsync();
        }

        public async Task DeleteInteractionAsync(Guid interactionId)
        {
            await using var transaction = await _dbContext.Database.BeginTransactionAsync();
            try
            {
                // Find the interaction
                var interactionEntity = await _dbContext.Interactions
                    .FirstOrDefaultAsync(i => i.AggregateId == interactionId);

                if (interactionEntity == null)
                {
                    throw new KeyNotFoundException($"Interaction with ID {interactionId} not found");
                }

                // Simply remove the interaction - EF Core will handle cascade deletes
                _dbContext.Interactions.Remove(interactionEntity);

                await _dbContext.SaveChangesAsync();
                await transaction.CommitAsync();
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                Console.WriteLine($"Error deleting interaction: {ex.Message}");
                throw;
            }
        }

        public async Task<PaginatedResult<InteractionsAggregate>> GetInteractions(int? limit = null, int? offset = null)
        {
            IQueryable<InteractionAggregateEntity> query = _dbContext.Interactions
                .OrderByDescending(i => i.CreatedAt);

            // Get total count efficiently
            int totalCount = await query.CountAsync();

            // Apply pagination
            if (offset.HasValue)
            {
                query = query.Skip(offset.Value);
            }

            if (limit.HasValue)
            {
                query = query.Take(limit.Value);
            }

            query.Include(i => i.Rating)
                .Include(i => i.Review)
                .Include(i => i.Like);

            // Execute the query to get items
            var interactionEntities = await query.ToListAsync();

            // Map entities to domain objects
            List<InteractionsAggregate> result = new List<InteractionsAggregate>();
            foreach (var entity in interactionEntities)
            {
                var interaction = await InteractionMapper.ToDomain(entity, _dbContext);
                result.Add(interaction);
            }

            // Return both items and count
            return new PaginatedResult<InteractionsAggregate>(result, totalCount);
        }

        public async Task<InteractionsAggregate> GetInteractionById(Guid interactionId)
        {
            try
            {
                var interactionEntity = await _dbContext.Interactions
                    .Include(i => i.Rating)
                    .Include(i => i.Review)
                    .Include(i => i.Like)
                    .FirstOrDefaultAsync(i => i.AggregateId == interactionId);

                if (interactionEntity == null)
                {
                    return null;
                }
                InteractionsAggregate interaction = await InteractionMapper.ToDomain(interactionEntity, _dbContext);
                return interaction;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error retrieving interaction with ID {interactionId}: {ex.Message}");
                throw;
            }
        }

        public async Task<PaginatedResult<InteractionsAggregate>> GetInteractionsByUserId(string userId, int? limit = null, int? offset = null)
        {
            IQueryable<InteractionAggregateEntity> query = _dbContext.Interactions
                .Where(i => i.UserId == userId)
                .OrderByDescending(i => i.CreatedAt);

            // Get total count efficiently
            int totalCount = await query.CountAsync();

            // Apply pagination
            if (offset.HasValue)
            {
                query = query.Skip(offset.Value);
            }

            if (limit.HasValue)
            {
                query = query.Take(limit.Value);
            }

            query.Include(i => i.Rating)
                .Include(i => i.Review)
                .Include(i => i.Like);

            // Execute the query to get items
            var interactionEntities = await query.ToListAsync();

            // Map entities to domain objects
            List<InteractionsAggregate> result = new List<InteractionsAggregate>();
            foreach (var entity in interactionEntities)
            {
                var interaction = await InteractionMapper.ToDomain(entity, _dbContext);
                result.Add(interaction);
            }

            // Return both items and count
            return new PaginatedResult<InteractionsAggregate>(result, totalCount);
        }

        public async Task<PaginatedResult<InteractionsAggregate>> GetInteractionsByItemId(string itemId, int? limit = null, int? offset = null)
        {
            IQueryable<InteractionAggregateEntity> query = _dbContext.Interactions
                .Where(i => i.ItemId == itemId)
                .OrderByDescending(i => i.CreatedAt);

            // Get total count efficiently
            int totalCount = await query.CountAsync();

            // Apply pagination
            if (offset.HasValue)
            {
                query = query.Skip(offset.Value);
            }

            if (limit.HasValue)
            {
                query = query.Take(limit.Value);
            }

            query.Include(i => i.Rating)
                .Include(i => i.Review)
                .Include(i => i.Like);

            // Execute the query to get items
            var interactionEntities = await query.ToListAsync();

            // Map entities to domain objects
            List<InteractionsAggregate> result = new List<InteractionsAggregate>();
            foreach (var entity in interactionEntities)
            {
                var interaction = await InteractionMapper.ToDomain(entity, _dbContext);
                result.Add(interaction);
            }

            // Return both items and count
            return new PaginatedResult<InteractionsAggregate>(result, totalCount);
        }

        public async Task<PaginatedResult<InteractionsAggregate>> GetInteractionsByUserAndItem(string userId, string itemId, int? limit = null, int? offset = null)
        {
            IQueryable<InteractionAggregateEntity> query = _dbContext.Interactions
                .Where(i => i.UserId == userId && i.ItemId == itemId)
                .OrderByDescending(i => i.CreatedAt);

            // Get total count efficiently
            int totalCount = await query.CountAsync();

            // Apply pagination
            if (offset.HasValue)
            {
                query = query.Skip(offset.Value);
            }

            if (limit.HasValue)
            {
                query = query.Take(limit.Value);
            }

            query.Include(i => i.Rating)
                .Include(i => i.Review)
                .Include(i => i.Like);

            // Execute the query to get items
            var interactionEntities = await query.ToListAsync();

            // Map entities to domain objects
            List<InteractionsAggregate> result = new List<InteractionsAggregate>();
            foreach (var entity in interactionEntities)
            {
                var interaction = await InteractionMapper.ToDomain(entity, _dbContext);
                result.Add(interaction);
            }

            // Return both items and count
            return new PaginatedResult<InteractionsAggregate>(result, totalCount);
        }

        public async Task<PaginatedResult<InteractionsAggregate>> GetInteractionsByUserIds(List<string> userIds, int? limit = null, int? offset = null)
        {
            IQueryable<InteractionAggregateEntity> query = _dbContext.Interactions
                .Where(i => userIds.Contains(i.UserId))
                .OrderByDescending(i => i.CreatedAt);

            // Get total count efficiently
            int totalCount = await query.CountAsync();

            // Apply pagination
            if (offset.HasValue)
            {
                query = query.Skip(offset.Value);
            }

            if (limit.HasValue)
            {
                query = query.Take(limit.Value);
            }

            query.Include(i => i.Rating)
                .Include(i => i.Review)
                .Include(i => i.Like);

            // Execute the query to get items
            var interactionEntities = await query.ToListAsync();

            // Map entities to domain objects
            List<InteractionsAggregate> result = new List<InteractionsAggregate>();
            foreach (var entity in interactionEntities)
            {
                var interaction = await InteractionMapper.ToDomain(entity, _dbContext);
                result.Add(interaction);
            }

            // Return both items and count
            return new PaginatedResult<InteractionsAggregate>(result, totalCount);
        }

        public async Task<PaginatedResult<InteractionsAggregate>> GetInteractionsByItemIds(List<string> itemIds, int? limit = null, int? offset = null)
        {
            IQueryable<InteractionAggregateEntity> query = _dbContext.Interactions
                .Where(i => itemIds.Contains(i.ItemId))
                .OrderByDescending(i => i.CreatedAt);

            // Get total count efficiently
            int totalCount = await query.CountAsync();

            // Apply pagination
            if (offset.HasValue)
            {
                query = query.Skip(offset.Value);
            }

            if (limit.HasValue)
            {
                query = query.Take(limit.Value);
            }

            query.Include(i => i.Rating)
                .Include(i => i.Review)
                .Include(i => i.Like);

            // Execute the query to get items
            var interactionEntities = await query.ToListAsync();

            // Map entities to domain objects
            List<InteractionsAggregate> result = new List<InteractionsAggregate>();
            foreach (var entity in interactionEntities)
            {
                var interaction = await InteractionMapper.ToDomain(entity, _dbContext);
                result.Add(interaction);
            }

            // Return both items and count
            return new PaginatedResult<InteractionsAggregate>(result, totalCount);
        }

        public async Task<PaginatedResult<InteractionsAggregate>> GetReviewedInteractionsByItemId(string itemId, bool? useHotScore = true, int? limit = null, int? offset = null)
        {
            // Start with filtering interactions by itemId
            IQueryable<InteractionAggregateEntity> query = _dbContext.Interactions
                .Where(i => i.ItemId == itemId)
                .Where(i => _dbContext.Reviews.Any(r => r.AggregateId == i.AggregateId))
                .Include(i => i.Review);

            if (useHotScore.Equals(true))
            {
                query = query.OrderByDescending(i => i.Review.HotScore);
            }
            else
            {
                query = query.OrderByDescending(i => i.CreatedAt);
            }

            // Get total count efficiently
            int totalCount = await query.CountAsync();

            // Apply pagination
            if (offset.HasValue)
            {
                query = query.Skip(offset.Value);
            }

            if (limit.HasValue)
            {
                query = query.Take(limit.Value);
            }

            // Include related entities after pagination
            query = query
                .Include(i => i.Rating)
                .Include(i => i.Like);

            // Execute the query to get items
            var interactionEntities = await query.ToListAsync();

            // Map entities to domain objects
            List<InteractionsAggregate> result = new List<InteractionsAggregate>();
            foreach (var entity in interactionEntities)
            {
                var interaction = await InteractionMapper.ToDomain(entity, _dbContext);
                result.Add(interaction);
            }

            // Return both items and count
            return new PaginatedResult<InteractionsAggregate>(result, totalCount);
        }

        public async Task<ReviewLike> AddReviewLike(Guid reviewId, string userId)
        {
            // Check if the review exists
            var reviewEntity = await _dbContext.Reviews.FirstOrDefaultAsync(r => r.ReviewId == reviewId);
            if (reviewEntity == null)
            {
                throw new KeyNotFoundException($"Review with ID {reviewId} not found");
            }

            // Check if user already liked this review
            var existingLike = await _dbContext.ReviewLikes
                .FirstOrDefaultAsync(l => l.ReviewId == reviewId && l.UserId == userId);

            if (existingLike != null)
            {
                // User already liked this review
                return ReviewLikeMapper.ToDomain(existingLike);
            }

            // Create a new like
            var reviewLike = new ReviewLike(reviewId, userId);
            var reviewLikeEntity = ReviewLikeMapper.ToEntity(reviewLike);

            await _dbContext.ReviewLikes.AddAsync(reviewLikeEntity);

            // Mark review as dirty since like count changed
            reviewEntity.IsScoreDirty = true;
            _dbContext.Reviews.Update(reviewEntity);

            await _dbContext.SaveChangesAsync();

            return reviewLike;
        }

        public async Task<bool> RemoveReviewLike(Guid reviewId, string userId)
        {
            var likeEntity = await _dbContext.ReviewLikes
                .FirstOrDefaultAsync(rl => rl.ReviewId == reviewId && rl.UserId == userId);

            if (likeEntity == null)
            {
                return false;
            }

            var reviewEntity = await _dbContext.Reviews.FirstOrDefaultAsync(r => r.ReviewId == reviewId);
            if (reviewEntity != null)
            {
                // Mark review as dirty since like count changed
                reviewEntity.IsScoreDirty = true;
                _dbContext.Reviews.Update(reviewEntity);
            }

            _dbContext.ReviewLikes.Remove(likeEntity);
            await _dbContext.SaveChangesAsync();

            return true;
        }

        public async Task<bool> HasUserLikedReview(Guid reviewId, string userId)
        {
            return await _dbContext.ReviewLikes
                .AnyAsync(l => l.ReviewId == reviewId && l.UserId == userId);
        }

        public async Task<ReviewComment> AddReviewComment(Guid reviewId, string userId, string commentText)
        {
            // Check if the review exists
            var reviewEntity = await _dbContext.Reviews.FirstOrDefaultAsync(r => r.ReviewId == reviewId);
            if (reviewEntity == null)
            {
                throw new KeyNotFoundException($"Review with ID {reviewId} not found");
            }

            // Create a new comment
            var reviewComment = new ReviewComment(reviewId, userId, commentText);
            var commentEntity = ReviewCommentMapper.ToEntity(reviewComment);

            await _dbContext.ReviewComments.AddAsync(commentEntity);

            reviewEntity.IsScoreDirty = true;
            _dbContext.Reviews.Update(reviewEntity);

            await _dbContext.SaveChangesAsync();

            return reviewComment;
        }

        public async Task<bool> DeleteReviewComment(Guid commentId, string userId)
        {
            var commentEntity = await _dbContext.ReviewComments
                .FirstOrDefaultAsync(c => c.CommentId == commentId);

            if (commentEntity == null)
            {
                // Comment not found
                return false;
            }

            // Only allow the comment owner to delete it
            var reviewEntity = await _dbContext.Reviews.FirstOrDefaultAsync(r => r.ReviewId == commentEntity.ReviewId);
            if (reviewEntity != null)
            {
                // Mark review as dirty since comment count changed
                reviewEntity.IsScoreDirty = true;
                _dbContext.Reviews.Update(reviewEntity);
            }

            _dbContext.ReviewComments.Remove(commentEntity);
            await _dbContext.SaveChangesAsync();

            return true;
        }

        public async Task<PaginatedResult<ReviewComment>> GetReviewComments(Guid reviewId, int? limit = null, int? offset = null)
        {
            // Check if the review exists
            var reviewExists = await _dbContext.Reviews.AnyAsync(r => r.ReviewId == reviewId);
            if (!reviewExists)
            {
                throw new KeyNotFoundException($"Review with ID {reviewId} not found");
            }

            // Build the query but don't execute it yet
            IQueryable<ReviewCommentEntity> query = _dbContext.ReviewComments
                .Where(c => c.ReviewId == reviewId)
                .OrderByDescending(c => c.CommentedAt);

            // Get total count efficiently
            int totalCount = await query.CountAsync();

            // Apply pagination
            if (offset.HasValue)
            {
                query = query.Skip(offset.Value);
            }

            if (limit.HasValue)
            {
                query = query.Take(limit.Value);
            }

            // Execute the query to get items
            var commentEntities = await query.ToListAsync();

            // Map entities to domain objects
            var comments = commentEntities.Select(ReviewCommentMapper.ToDomain).ToList();

            // Return both items and count
            return new PaginatedResult<ReviewComment>(comments, totalCount);
        }

        public async Task<List<Like>> GetLikes()
        {
            var likeEntities = await _dbContext.Likes
                .Include(l => l.Interaction)
                .ToListAsync();

            List<Like> likes = new List<Like>();

            foreach (var entity in likeEntities)
            {
                var like = new Like(
                    entity.Interaction.AggregateId,
                    entity.Interaction.ItemId,
                    entity.Interaction.CreatedAt,
                    entity.Interaction.ItemType,
                    entity.Interaction.UserId
                );

                likes.Add(like);
            }

            return likes;
        }

        public async Task<List<Review>> GetReviews()
        {
            var reviewEntities = await _dbContext.Reviews.ToListAsync();
            List<Review> reviews = new List<Review>();

            foreach (var entity in reviewEntities)
            {
                var review = await ReviewMapper.ToDomain(entity, _dbContext);
                reviews.Add(review);
            }

            return reviews;
        }

        public async Task<List<Rating>> GetRatings()
        {
            var ratingEntities = await _dbContext.Ratings.ToListAsync();
            List<Rating> ratings = new List<Rating>();

            foreach (var entity in ratingEntities)
            {
                var rating = await RatingMapper.ToDomainAsync(entity, _dbContext);
                ratings.Add(rating);
            }

            return ratings;
        }

        public async Task<Rating> GetRatingById(Guid ratingId)
        {
            try
            {
                var ratingEntity = await _dbContext.Ratings
                    .Include(r => r.Interaction)
                    .FirstOrDefaultAsync(r => r.RatingId == ratingId);

                if (ratingEntity == null)
                {
                    return null;
                }

                return await RatingMapper.ToDomainAsync(ratingEntity, _dbContext);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error retrieving rating with ID {ratingId}: {ex.Message}");
                throw;
            }
        }

        public async Task<bool> IsEmpty()
        {
            return !await _dbContext.Interactions.AnyAsync();
        }
    }
}