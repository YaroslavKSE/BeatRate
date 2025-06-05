variable "environment" {
  description = "Environment name (e.g., dev, prod)"
  type        = string
}

variable "region" {
  description = "AWS region"
  type        = string
}

variable "name" {
  description = "Base name for resources"
  type        = string
  default     = "music-app"
}

variable "domain_name" {
  description = "Domain name of the application"
  type        = string
}

variable "common_tags" {
  description = "Common tags to be applied to all resources"
  type        = map(string)
  default     = {}
}

variable "vpc_id" {
  description = "ID of the VPC"
  type        = string
}

variable "private_subnet_ids" {
  description = "List of private subnet IDs for ECS tasks"
  type        = list(string)
}

variable "alb_security_group_id" {
  description = "Security group ID for ALB"
  type        = string
}

variable "services" {
  description = "List of service names"
  type        = list(string)
  default     = ["user-service", "music-catalog-service", "music-interaction-service", "music-lists-service"]
}

variable "log_retention_days" {
  description = "Number of days to retain CloudWatch logs"
  type        = number
  default     = 30
}

variable "mongodb_database_name" {
  description = "MongoDb database name"
  type        = string
}

variable "user_service_config" {
  description = "Configuration for the User Service"
  type = object({
    ecr_repository_url = string
    image_tag          = string
    cpu                = number
    memory             = number
    desired_count      = number
    min_capacity       = number
    max_capacity       = number
    db_name            = string
  })
}

variable "avatar_bucket_name" {
  description = "Name of the S3 bucket for user avatars"
  type        = string
}

variable "avatar_base_url" {
  description = "Base URL for accessing avatar images"
  type        = string
}

variable "music_catalog_service_config" {
  description = "Configuration for the Music Catalog Service"
  type = object({
    ecr_repository_url = string
    image_tag          = string
    cpu                = number
    memory             = number
    desired_count      = number
    min_capacity       = number
    max_capacity       = number
  })
}

variable "music_interaction_service_config" {
  description = "Configuration for the Music Interaction Service"
  type = object({
    ecr_repository_url = string
    image_tag          = string
    cpu                = number
    memory             = number
    desired_count      = number
    min_capacity       = number
    max_capacity       = number
    db_name            = string
  })
}

variable "music_lists_service_config" {
  description = "Configuration for the Music Lists Service"
  type = object({
    ecr_repository_url = string
    image_tag          = string
    cpu                = number
    memory             = number
    desired_count      = number
    min_capacity       = number
    max_capacity       = number
    db_name            = string
  })
}

variable "user_service_target_group_arn" {
  description = "ARN of the user service target group"
  type        = string
}

variable "music_catalog_service_target_group_arn" {
  description = "ARN of the music catalog service target group"
  type        = string
}

variable "music_interaction_service_target_group_arn" {
  description = "ARN of the music interaction service target group"
  type        = string
}

variable "music_lists_service_target_group_arn" {
  description = "ARN of the music lists service target group"
  type        = string
}

# Parameter Store paths for connection strings
variable "postgres_connection_string_parameter" {
  description = "SSM Parameter Store path for PostgreSQL connection string"
  type        = string
}

variable "mongodb_connection_string_parameter" {
  description = "SSM Parameter Store path for MongoDB connection string"
  type        = string
}

variable "redis_connection_string_parameter" {
  description = "SSM Parameter Store path for Redis connection string"
  type        = string
}

# Auth0 credentials
variable "auth0_domain" {
  description = "Auth0 Domain"
  type        = string
  sensitive   = true
}

variable "auth0_client_id" {
  description = "Auth0 Client ID"
  type        = string
  sensitive   = true
}

variable "auth0_client_secret" {
  description = "Auth0 Client Secret"
  type        = string
  sensitive   = true
}

variable "auth0_audience" {
  description = "Auth0 Audience"
  type        = string
  sensitive   = true
}

variable "auth0_management_api_audience" {
  description = "Auth0 Management API Audience"
  type        = string
  sensitive   = true
}

# Spotify credentials
variable "spotify_client_id" {
  description = "Spotify Client ID"
  type        = string
  sensitive   = true
}

variable "spotify_client_secret" {
  description = "Spotify Client Secret"
  type        = string
  sensitive   = true
}

variable "ecs_security_group" {
  description = "ECS Security group ID"
  type        = list(string)
  default     = []
}
