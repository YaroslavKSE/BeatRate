variable "region" {
  description = "AWS region where resources will be created"
  type        = string
  default     = "us-east-1"
}

### ---- General settings ---- ###

variable "project_name" {
  description = "Name of the project"
  type        = string
  default     = "imdb-for-music"
}

### ---- Frontend settings ---- ###

variable "frontend_project_path" {
  description = "Path to the frontend project directory"
  type        = string
  default     = "../frontend"
}

variable "build_and_upload_frontend" {
  description = "Whether to build and upload the frontend during apply"
  type        = bool
  default     = true
}

variable "force_destroy_s3" {
  description = "Whether to force destroy the S3 bucket even if it contains objects"
  type        = bool
  default     = true
}

variable "bucket_name" {
  description = "Name of the S3 bucket for frontend files"
  type        = string
  default     = "beatrate-frontend-bucket"
}

### ---- DNS settings ---- ###

variable "domain_name" {
  description = "Domain name for the application"
  type        = string
  default     = "academichub.net"
}

variable "use_acm_certificate" {
  description = "Whether to use a custom ACM certificate for CloudFront and ALB"
  type        = bool
  default     = true
}

variable "acm_certificate_arn" {
  description = "ARN of the ACM certificate to use for CloudFront and ALB (should be a wildcard certificate)"
  type        = string
  default     = null
  sensitive   = true
}

variable "create_api_records" {
  description = "Whether to create Route53 records for the API domain"
  type        = bool
  default     = true
}

### ---- RDS DB settings ---- ###

variable "rds_instance_class" {
  type = map(string)
  default = {
    dev  = "db.t4g.micro"
    prod = "db.t4g.micro"
  }
}

variable "rds_multi_az" {
  description = "Whether to enable Multi-AZ deployment for RDS"
  type        = bool
  default     = false
}

variable "rds_deletion_protection" {
  description = "Whether to enable deletion protection for RDS"
  type        = bool
  default     = false
}

variable "rds_skip_final_snapshot" {
  description = "Whether to skip final snapshot when destroying RDS"
  type        = bool
  default     = true
}

variable "rds_database_name" {
  description = "The name of RDS PostgresSQL database"
  type        = string
}

variable "rds_username" {
  description = "The username of RDS PostgresSQL database"
  type        = string
}

### ---- Redis Cache settings ---- ###

variable "redis_node_type" {
  description = "Redis node type"
  type        = string
}

### ---- MongoDB Atlas settings ---- ###
variable "mongo_atlas_project_id" {
  description = "MongoDB Atlas project ID"
  type        = string
  sensitive   = true
}

variable "mongodb_atlas_public_key" {
  description = "MongoDB Atlas public API key"
  type        = string
  sensitive   = true
}

variable "mongodb_atlas_private_key" {
  description = "MongoDB Atlas private API key"
  type        = string
  sensitive   = true
}

# MongoDB Atlas Configuration
variable "mongodb_atlas_region" {
  description = "MongoDB Atlas region mapping by environment"
  type        = map(string)
  default = {
    dev  = "US_EAST_1"
    prod = "US_EAST_1"
  }
}

variable "mongodb_instance_size" {
  description = "MongoDB Atlas instance size mapping by environment"
  type        = map(string)
  default = {
    dev  = "M10"
    prod = "M10"
  }
}

variable "mongodb_disk_size_gb" {
  description = "MongoDB Atlas disk size in GB mapping by environment"
  type        = map(number)
  default = {
    dev  = 10
    prod = 10
  }
}

variable "mongodb_database_name" {
  description = "Name of the MongoDB database"
  type        = string
  sensitive   = true
  default     = "MusicCatalog"
}

variable "mongodb_username" {
  description = "Username for MongoDB Atlas database user"
  type        = string
  sensitive   = true
  default     = "app_user"
}

### ---- ECR Repository URLs (pre-created) ---- ###
variable "user_service_repository_url" {
  description = "ECR repository URL for user service"
  type        = string
}

variable "music_catalog_service_repository_url" {
  description = "ECR repository URL for music catalog service"
  type        = string
}

variable "music_interaction_service_repository_url" {
  description = "ECR repository URL for music interaction service"
  type        = string
}

variable "music_lists_service_repository_url" {
  description = "ECR repository URL for music lists service"
  type        = string
}

# Image tags
variable "user_service_image_tag" {
  description = "Image tag for user service"
  type        = string
  default     = "latest"
}

variable "music_catalog_service_image_tag" {
  description = "Image tag for music catalog service"
  type        = string
  default     = "latest"
}

variable "music_interaction_service_image_tag" {
  description = "Image tag for music interaction service"
  type        = string
  default     = "latest"
}

#### ---- User Service Configuration ---- ####
variable "user_service_cpu" {
  description = "CPU units for user service"
  type        = number
  default     = 256
}

variable "user_service_memory" {
  description = "Memory for user service (MiB)"
  type        = number
  default     = 512
}

variable "user_service_desired_count" {
  description = "Desired number of user service tasks"
  type        = number
  default     = 1
}

variable "user_service_min_capacity" {
  description = "Minimum number of user service tasks"
  type        = number
  default     = 1
}

variable "user_service_max_capacity" {
  description = "Maximum number of user service tasks"
  type        = number
  default     = 3
}

#### ---- Music Catalog Service Configuration ---- ####

variable "music_catalog_service_cpu" {
  description = "CPU units for music catalog service"
  type        = number
  default     = 256
}

variable "music_catalog_service_memory" {
  description = "Memory for music catalog service (MiB)"
  type        = number
  default     = 512
}

variable "music_catalog_service_desired_count" {
  description = "Desired number of music catalog service tasks"
  type        = number
  default     = 1
}

variable "music_catalog_service_min_capacity" {
  description = "Minimum number of music catalog service tasks"
  type        = number
  default     = 1
}

variable "music_catalog_service_max_capacity" {
  description = "Maximum number of music catalog service tasks"
  type        = number
  default     = 3
}

variable "avatar_bucket_name" {
  description = "Name of the S3 bucket for user avatars"
  type        = string
}

variable "avatar_base_url" {
  description = "Base URL for accessing avatar images"
  type        = string
}

#### ---- Music Interaction Service Configuration ---- ####

variable "music_interaction_service_cpu" {
  description = "CPU units for music interaction service"
  type        = number
  default     = 256
}

variable "music_interaction_service_memory" {
  description = "Memory for music interaction service (MiB)"
  type        = number
  default     = 512
}

variable "music_interaction_service_desired_count" {
  description = "Desired number of music interaction service tasks"
  type        = number
  default     = 1
}

variable "music_interaction_service_min_capacity" {
  description = "Minimum number of music interaction service tasks"
  type        = number
  default     = 1
}

variable "music_interaction_service_max_capacity" {
  description = "Maximum number of music interaction service tasks"
  type        = number
  default     = 3
}

variable "music_interaction_db_name" {
  description = "Name of the database for music interaction service"
  type        = string
  default     = "musicinteraction"
}

#### ---- Music Lists Service Configuration ---- ####

variable "music_lists_service_image_tag" {
  description = "Image tag for music lists service"
  type        = string
  default     = "latest"
}

variable "music_lists_service_cpu" {
  description = "CPU units for music lists service"
  type        = number
  default     = 256
}

variable "music_lists_service_memory" {
  description = "Memory for music lists service (MiB)"
  type        = number
  default     = 512
}

variable "music_lists_service_desired_count" {
  description = "Desired number of music lists service tasks"
  type        = number
  default     = 1
}

variable "music_lists_service_min_capacity" {
  description = "Minimum number of music lists service tasks"
  type        = number
  default     = 1
}

variable "music_lists_service_max_capacity" {
  description = "Maximum number of music lists service tasks"
  type        = number
  default     = 3
}

variable "music_lists_db_name" {
  description = "Name of the database for music lists service"
  type        = string
  default     = "musiclists"
}

#### ---- Application secrets (Auth0) ---- ####

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

#### ---- Application secrets (Spotify) ---- ####

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