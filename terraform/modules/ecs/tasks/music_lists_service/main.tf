resource "aws_ecs_task_definition" "music_lists_service" {
  family                   = "${var.environment}-music-lists-service"
  execution_role_arn       = var.ecs_task_execution_role_arn
  task_role_arn            = var.ecs_task_role_arn
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.service_config.cpu
  memory                   = var.service_config.memory

  container_definitions = jsonencode([
    {
      name      = "music-lists-service"
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
        # CORS configuration
        { name = "Cors__AllowedOrigins__0", value = var.environment == "prod" ? "https://${var.domain_name}" : "https://dev.${var.domain_name}" },
      ]

      # Access secrets from parameter store
      secrets = [
        # PostgreSQL connection string
        { name = "ConnectionStrings__PostgreSQL", valueFrom = var.postgres_connection_string_parameter },
        # Auth0 credentials
        { name = "Auth0__Domain", valueFrom = var.auth0_domain },
        { name = "Auth0__Audience", valueFrom = var.auth0_audience }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = var.cloudwatch_log_group_name
          "awslogs-region"        = var.region
          "awslogs-stream-prefix" = "music-lists-service"
        }
      }

      # Updated health check to use wget
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
      Name = "${var.environment}-music-lists-service"
    }
  )
}