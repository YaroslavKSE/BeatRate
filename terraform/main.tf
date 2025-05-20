provider "aws" {
  region = var.region
}

provider "mongodbatlas" {
  public_key  = var.mongodb_atlas_public_key
  private_key = var.mongodb_atlas_private_key
}

locals {
  environment = terraform.workspace

  # Environment-specific configurations
  env_configs = {
    dev = {
      vpc_cidr              = "10.0.0.0/16"
      public_subnet_cidr_a  = "10.0.1.0/24"
      public_subnet_cidr_b  = "10.0.2.0/24"
      private_subnet_cidr_a = "10.0.3.0/24"
      private_subnet_cidr_b = "10.0.4.0/24"
      frontend_bucket       = "${var.project_name}-frontend-${terraform.workspace}"
      api_subdomain         = "api-dev"
    }

    prod = {
      vpc_cidr              = "10.1.0.0/16"
      public_subnet_cidr_a  = "10.1.1.0/24"
      public_subnet_cidr_b  = "10.1.2.0/24"
      private_subnet_cidr_a = "10.1.3.0/24"
      private_subnet_cidr_b = "10.1.4.0/24"
      frontend_bucket       = "${var.project_name}-frontend-${terraform.workspace}"
      api_subdomain         = "api"
    }
  }

  # Make sure we have a valid environment
  config = contains(keys(local.env_configs), local.environment) ? local.env_configs[local.environment] : local.env_configs["dev"]

  # Common tags for all resources
  common_tags = {
    Environment = local.environment
    ManagedBy   = "Terraform"
    Project     = var.project_name
  }
}

module "vpc" {
  source = "./modules/vpc"

  environment           = local.environment
  region                = var.region
  vpc_cidr              = local.config.vpc_cidr
  public_subnet_cidr_a  = local.config.public_subnet_cidr_a
  public_subnet_cidr_b  = local.config.public_subnet_cidr_b
  private_subnet_cidr_a = local.config.private_subnet_cidr_a
  private_subnet_cidr_b = local.config.private_subnet_cidr_b
  common_tags           = local.common_tags
}

module "s3" {
  source = "./modules/s3"

  environment               = local.environment
  bucket_name               = local.config.frontend_bucket
  frontend_project_path     = var.frontend_project_path
  build_and_upload_frontend = var.build_and_upload_frontend
  force_destroy             = var.force_destroy_s3
  common_tags               = local.common_tags
}

module "cloudfront" {
  source = "./modules/cloudfront"

  environment                 = local.environment
  bucket_id                   = module.s3.bucket_id
  bucket_arn                  = module.s3.bucket_arn
  bucket_regional_domain_name = module.s3.bucket_regional_domain_name
  domain_aliases              = var.use_acm_certificate ? [var.domain_name, "www.${var.domain_name}"] : []
  use_default_certificate     = !var.use_acm_certificate
  acm_certificate_arn         = var.acm_certificate_arn
  common_tags                 = local.common_tags

  depends_on = [module.s3]
}

# ALB module for API services
module "alb" {
  source = "./modules/alb"

  environment       = local.environment
  vpc_id            = module.vpc.vpc_id
  public_subnet_ids = module.vpc.public_subnet_ids # Using both public subnets for HA
  certificate_arn   = var.acm_certificate_arn      # Using the same wildcard certificate
  name_prefix       = "api"
  common_tags       = local.common_tags

  depends_on = [module.vpc]
}

module "route53" {
  source = "./modules/route53"

  domain_name               = var.domain_name
  cloudfront_domain_name    = module.cloudfront.cloudfront_domain_name
  cloudfront_hosted_zone_id = module.cloudfront.cloudfront_hosted_zone_id
  enable_ipv6               = false
  create_www_subdomain      = false
  create_api_records        = true
  api_subdomain             = local.config.api_subdomain
  alb_domain_name           = module.alb.alb_dns_name
  alb_hosted_zone_id        = module.alb.alb_zone_id
  common_tags               = local.common_tags

  depends_on = [module.cloudfront, module.alb]
}

# RDS Database module
module "rds" {
  source = "./modules/rds"

  environment                = local.environment
  vpc_id                     = module.vpc.vpc_id
  subnet_ids                 = module.vpc.private_subnet_ids
  allowed_security_group_ids = [module.alb.ecs_tasks_security_group_id]

  # Database settings
  db_name               = var.rds_database_name
  db_username           = var.rds_username
  postgres_version      = "17.2"
  instance_class        = lookup(var.rds_instance_class, local.environment, "db.t3.micro")
  allocated_storage     = 20
  max_allocated_storage = local.environment == "prod" ? 100 : 20
  storage_encrypted     = local.environment == "prod" ? true : false # Free tier limitation

  # Backup settings
  backup_retention_period = local.environment == "prod" ? 7 : 1
  skip_final_snapshot     = var.rds_skip_final_snapshot
  apply_immediately       = local.environment == "prod" ? false : true

  # High availability settings
  multi_az = var.rds_multi_az

  deletion_protection = var.rds_deletion_protection

  common_tags = local.common_tags
}

# Redis ElastiCache module
module "redis" {
  source = "./modules/redis"

  environment                = local.environment
  vpc_id                     = module.vpc.vpc_id
  subnet_ids                 = module.vpc.private_subnet_ids
  allowed_security_group_ids = [module.alb.ecs_tasks_security_group_id]

  # Redis settings
  node_type     = local.environment == "prod" ? "cache.t3.small" : "cache.t3.micro" # Near free tier
  redis_version = "6.2"

  # Maintenance settings
  maintenance_window = "sun:05:00-sun:07:00"
  snapshot_window    = "03:00-05:00"
  apply_immediately  = local.environment == "prod" ? false : true

  common_tags = local.common_tags
}

# MongoDB Atlas Module
module "mongodb" {
  source = "./modules/mongodb"

  environment  = local.environment
  project_name = var.project_name

  # MongoDB Atlas credentials
  mongo_atlas_project_id = var.mongo_atlas_project_id
  atlas_public_key       = var.mongodb_atlas_public_key
  atlas_private_key      = var.mongodb_atlas_private_key

  # Atlas configuration
  atlas_region  = lookup(var.mongodb_atlas_region, local.environment, "US_EAST_1")
  instance_size = lookup(var.mongodb_instance_size, local.environment, "M10")
  disk_size_gb  = lookup(var.mongodb_disk_size_gb, local.environment, 10)

  # Database settings
  db_name     = var.mongodb_database_name
  db_username = var.mongodb_username

  # Auto-scaling settings
  allow_cluster_scale_down = local.environment == "dev" ? true : false
  min_instance_size        = local.environment == "dev" ? "M10" : "M20"
  max_instance_size        = local.environment == "dev" ? "M20" : "M40"

  # Backup settings
  enable_backup = local.environment == "prod" ? true : true

  # VPC settings
  vpc_id                     = module.vpc.vpc_id
  private_subnet_ids         = module.vpc.private_subnet_ids
  allowed_security_group_ids = [module.alb.ecs_tasks_security_group_id]

  common_tags = local.common_tags
}

module "ssm_parameters" {
  source = "./modules/parameter-store"

  environment = local.environment
  common_tags = local.common_tags

  parameters = {
    "auth0/domain" = {
      description = "Auth0 Domain"
      type        = "SecureString"
    },
    "auth0/client_id" = {
      description = "Auth0 Client ID"
      type        = "SecureString"
    },
    "auth0/client_secret" = {
      description = "Auth0 Client Secret"
      type        = "SecureString"
    },
    "auth0/audience" = {
      description = "Auth0 Audience"
      type        = "SecureString"
    },
    "auth0/management_api_audience" = {
      description = "Auth0 Management API Audience"
      type        = "SecureString"
    },
    "spotify/client_id" = {
      description = "Spotify Client ID"
      type        = "SecureString"
    },
    "spotify/client_secret" = {
      description = "Spotify Client Secret"
      type        = "SecureString"
    }
  }

  parameter_values = {
    "auth0/domain"                  = var.auth0_domain
    "auth0/client_id"               = var.auth0_client_id
    "auth0/client_secret"           = var.auth0_client_secret
    "auth0/audience"                = var.auth0_audience
    "auth0/management_api_audience" = var.auth0_management_api_audience
    "spotify/client_id"             = var.spotify_client_id
    "spotify/client_secret"         = var.spotify_client_secret
  }
}

# ECS Module with direct secrets
module "ecs" {
  source = "./modules/ecs"

  environment                                = local.environment
  region                                     = var.region
  name                                       = var.project_name
  domain_name                                = var.domain_name
  alb_security_group_id                      = module.alb.security_group_id
  vpc_id                                     = module.vpc.vpc_id
  private_subnet_ids                         = module.vpc.private_subnet_ids
  ecs_security_group                         = [module.alb.security_group_id]
  user_service_target_group_arn              = module.alb.user_service_target_group_arn
  music_catalog_service_target_group_arn     = module.alb.music_catalog_target_group_arn
  music_interaction_service_target_group_arn = module.alb.rating_service_target_group_arn
  music_lists_service_target_group_arn       = module.alb.music_lists_target_group_arn

  # RDS configuration - passing parameter store variables that the tasks will access
  # rds_address_parameter                = "/${local.environment}/database/address"
  postgres_connection_string_parameter = "/${local.environment}/database/connection_string"

  # MongoDB configuration
  mongodb_connection_string_parameter = "/${local.environment}/mongodb/${var.mongodb_database_name}/connection_string"

  # Redis configuration
  redis_connection_string_parameter = "/${local.environment}/redis/endpoint"

  # Service configurations
  user_service_config = {
    ecr_repository_url = var.user_service_repository_url
    image_tag          = var.user_service_image_tag
    cpu                = var.user_service_cpu
    memory             = var.user_service_memory
    desired_count      = var.user_service_desired_count
    min_capacity       = var.user_service_min_capacity
    max_capacity       = var.user_service_max_capacity
    db_name            = var.rds_database_name
  }

  music_catalog_service_config = {
    ecr_repository_url = var.music_catalog_service_repository_url
    image_tag          = var.music_catalog_service_image_tag
    cpu                = var.music_catalog_service_cpu
    memory             = var.music_catalog_service_memory
    desired_count      = var.music_catalog_service_desired_count
    min_capacity       = var.music_catalog_service_min_capacity
    max_capacity       = var.music_catalog_service_max_capacity
  }

  music_interaction_service_config = {
    ecr_repository_url = var.music_interaction_service_repository_url
    image_tag          = var.music_interaction_service_image_tag
    cpu                = var.music_interaction_service_cpu
    memory             = var.music_interaction_service_memory
    desired_count      = var.music_interaction_service_desired_count
    min_capacity       = var.music_interaction_service_min_capacity
    max_capacity       = var.music_interaction_service_max_capacity
    db_name            = var.music_interaction_db_name
  }

  music_lists_service_config = {
    ecr_repository_url = var.music_lists_service_repository_url
    image_tag          = var.music_lists_service_image_tag
    cpu                = var.music_lists_service_cpu
    memory             = var.music_lists_service_memory
    desired_count      = var.music_lists_service_desired_count
    min_capacity       = var.music_lists_service_min_capacity
    max_capacity       = var.music_lists_service_max_capacity
    db_name            = var.music_lists_db_name
  }

  auth0_domain                  = module.ssm_parameters.parameter_arns["auth0/domain"]
  auth0_client_id               = module.ssm_parameters.parameter_arns["auth0/client_id"]
  auth0_client_secret           = module.ssm_parameters.parameter_arns["auth0/client_secret"]
  auth0_audience                = module.ssm_parameters.parameter_arns["auth0/audience"]
  auth0_management_api_audience = module.ssm_parameters.parameter_arns["auth0/management_api_audience"]

  spotify_client_id     = module.ssm_parameters.parameter_arns["spotify/client_id"]
  spotify_client_secret = module.ssm_parameters.parameter_arns["spotify/client_secret"]

  avatar_bucket_name = "beatrate-avatar-s3"
  avatar_base_url    = "https://beatrate-avatar-s3.s3.amazonaws.com"

  common_tags = local.common_tags

  depends_on = [
    module.alb,
    module.rds,
    module.redis,
    module.mongodb
  ]
}