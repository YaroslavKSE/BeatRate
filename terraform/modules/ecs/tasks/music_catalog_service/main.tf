resource "aws_ecs_task_definition" "music_catalog_service" {
  family                   = "${var.environment}-music-catalog-service"
  execution_role_arn       = var.ecs_task_execution_role_arn
  task_role_arn            = var.ecs_task_role_arn
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.service_config.cpu
  memory                   = var.service_config.memory

  container_definitions = jsonencode([
    {
      name      = "music-catalog-service"
      image     = "${var.service_config.ecr_repository_url}:${var.service_config.image_tag}"
      essential = true

      portMappings = [
        {
          name          = "http"
          containerPort = 80
          hostPort      = 80
          protocol      = "tcp"
          appProtocol   = "http"
        }
      ]

      # Standard environment variables
      environment = [
        { name = "ASPNETCORE_ENVIRONMENT", value = var.environment == "prod" ? "Production" : "Development" },
        { name = "Cors__AllowedOrigins__0", value = var.environment == "prod" ? "https://${var.domain_name}" : "https://dev.${var.domain_name}" },
      ]

      # Access secrets from parameter store
      secrets = [
        # MongoDB connection string
        { name = "MongoDb__ConnectionString", valueFrom = var.mongodb_connection_string_parameter },
        # Redis connection string
        { name = "ConnectionStrings__Redis", valueFrom = var.redis_connection_string_parameter },
        # Spotify API credentials
        { name = "Spotify__ClientId", valueFrom = var.spotify_client_id },
        { name = "Spotify__ClientSecret", valueFrom = var.spotify_client_secret }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = var.cloudwatch_log_group_name
          "awslogs-region"        = var.region
          "awslogs-stream-prefix" = "music-catalog-service"
        }
      }

      healthCheck = {
        command     = ["CMD-SHELL", "wget --no-verbose --spider http://localhost/health || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 60
      }
    }
  ])

  tags = merge(
    var.common_tags,
    {
      Name = "${var.environment}-music-catalog-service"
    }
  )
}