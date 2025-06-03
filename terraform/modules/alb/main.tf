resource "aws_security_group" "alb_sg" {
  name        = "${var.environment}-alb-sg"
  description = "Security group for the Application Load Balancer"
  vpc_id      = var.vpc_id

  # Allow HTTP and HTTPS from anywhere
  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow HTTP traffic"
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow HTTPS traffic"
  }

  # Allow all outbound traffic
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound traffic"
  }

  tags = merge(
    var.common_tags,
    {
      Name = "${var.environment}-alb-sg"
    }
  )
}

# Security group for ECS tasks
resource "aws_security_group" "ecs_tasks_sg" {
  name        = "${var.environment}-ecs-tasks-sg"
  description = "Security group for ECS tasks"
  vpc_id      = var.vpc_id

  # Allow inbound from ALB
  ingress {
    from_port       = 80
    to_port         = 80
    protocol        = "tcp"
    security_groups = [aws_security_group.alb_sg.id]
    description     = "Allow HTTP traffic from ALB"
  }

  # Optional: Allow traffic between services if needed
  ingress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    self        = true
    description = "Allow all traffic between ECS tasks"
  }

  # Allow outbound internet access
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound traffic"
  }

  tags = merge(
    var.common_tags,
    {
      Name = "${var.environment}-ecs-tasks-sg"
    }
  )
}

# Create ALB
resource "aws_lb" "api_alb" {
  name               = "${var.environment}-api-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb_sg.id]
  subnets            = var.public_subnet_ids

  # enable_deletion_protection = var.environment == "prod" ? true : false

  tags = merge(
    var.common_tags,
    {
      Name = "${var.environment}-api-alb"
    }
  )
}

# Create HTTP listener (redirects to HTTPS)
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.api_alb.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"

    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

# Create HTTPS listener
resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.api_alb.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-2016-08"
  certificate_arn   = var.certificate_arn

  default_action {
    type = "fixed-response"

    fixed_response {
      content_type = "application/json"
      message_body = "{\"error\": \"Resource not found\"}"
      status_code  = "404"
    }
  }
}


# Create target groups for each service
resource "aws_lb_target_group" "user_service" {
  name        = "${var.environment}-user-service-tg"
  port        = 80
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  health_check {
    enabled             = true
    interval            = 30
    path                = "/health"
    port                = "traffic-port"
    healthy_threshold   = 3
    unhealthy_threshold = 3
    timeout             = 5
    matcher             = "200"
  }

  tags = merge(
    var.common_tags,
    {
      Name = "${var.environment}-user-service-tg"
    }
  )
}

resource "aws_lb_target_group" "music_catalog_service" {
  name        = "${var.environment}-music-catalog-tg"
  port        = 80
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  health_check {
    enabled             = true
    interval            = 30
    path                = "/health"
    port                = "traffic-port"
    healthy_threshold   = 3
    unhealthy_threshold = 3
    timeout             = 5
    matcher             = "200"
  }

  tags = merge(
    var.common_tags,
    {
      Name = "${var.environment}-music-catalog-tg"
    }
  )
}

resource "aws_lb_target_group" "music_interaction_service" {
  name        = "${var.environment}-rating-service-tg"
  port        = 80
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  health_check {
    enabled             = true
    interval            = 30
    path                = "/health"
    port                = "traffic-port"
    healthy_threshold   = 3
    unhealthy_threshold = 3
    timeout             = 5
    matcher             = "200"
  }

  tags = merge(
    var.common_tags,
    {
      Name = "${var.environment}-rating-service-tg"
    }
  )
}

resource "aws_lb_target_group" "music_lists_service" {
  name        = "${var.environment}-music-lists-tg"
  port        = 80
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  health_check {
    enabled             = true
    interval            = 30
    path                = "/health"
    port                = "traffic-port"
    healthy_threshold   = 3
    unhealthy_threshold = 3
    timeout             = 5
    matcher             = "200"
  }

  tags = merge(
    var.common_tags,
    {
      Name = "${var.environment}-music-lists-tg"
    }
  )
}

# Create path-based routing rules
# User Service routes
resource "aws_lb_listener_rule" "user_service" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 100

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.user_service.arn
  }

  condition {
    path_pattern {
      values = [
        "/api/v1/auth*",
        "/api/v1/users*",
        "/api/v1/public/users*"
      ]
    }
  }
}

# Music Catalog Service routes
resource "aws_lb_listener_rule" "music_catalog_service" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 200

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.music_catalog_service.arn
  }

  condition {
    path_pattern {
      values = [
        "/api/v1/catalog*"
      ]
    }
  }
}

# Music Interaction Service routes
resource "aws_lb_listener_rule" "music_interaction_service" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 300

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.music_interaction_service.arn
  }

  condition {
    path_pattern {
      values = [
        "/api/v1/interactions*",
        "/api/v1/review-interactions*",
        "/api/v1/grading-methods*"
      ]
    }
  }
}

# Music Lists Service routes
resource "aws_lb_listener_rule" "music_lists_service" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 400

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.music_lists_service.arn
  }

  condition {
    path_pattern {
      values = [
        "/api/v1/music-lists*"
      ]
    }
  }
}