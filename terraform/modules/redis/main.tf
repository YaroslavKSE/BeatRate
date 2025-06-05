resource "aws_security_group" "redis_sg" {
  name        = "${var.environment}-redis-sg"
  description = "Security group for Redis ElastiCache"
  vpc_id      = var.vpc_id

  # Allow Redis traffic from specified security groups only
  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = var.allowed_security_group_ids
    description     = "Allow Redis traffic from specified security groups"
  }

  ingress {
    from_port   = 6379
    to_port     = 6379
    protocol    = "tcp"
    cidr_blocks = [var.private_subnet_cidr_a]
    description = "Allow Redis traffic from private subnet A"
  }

  ingress {
    from_port   = 6379
    to_port     = 6379
    protocol    = "tcp"
    cidr_blocks = [var.private_subnet_cidr_b]
    description = "Allow Redi traffic from private subnet B"
  }

  # No direct outbound access needed for Redis
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
      Name = "${var.environment}-redis-sg"
    }
  )
}

# ElastiCache Subnet Group
resource "aws_elasticache_subnet_group" "redis" {
  name        = "${var.environment}-redis-subnet-group"
  description = "ElastiCache subnet group for Redis"
  subnet_ids  = var.subnet_ids

  tags = merge(
    var.common_tags,
    {
      Name = "${var.environment}-redis-subnet-group"
    }
  )
}

# ElastiCache Parameter Group
resource "aws_elasticache_parameter_group" "redis" {
  name        = "${var.environment}-redis-params"
  family      = "redis6.x"
  description = "Parameter group for ${var.environment} Redis cluster"

  parameter {
    name  = "maxmemory-policy"
    value = "volatile-lru"
  }

  tags = merge(
    var.common_tags,
    {
      Name = "${var.environment}-redis-params"
    }
  )
}

# ElastiCache Redis Cluster
resource "aws_elasticache_cluster" "redis" {
  cluster_id           = "${var.environment}-redis"
  engine               = "redis"
  node_type            = var.node_type
  num_cache_nodes      = 1
  parameter_group_name = aws_elasticache_parameter_group.redis.name
  subnet_group_name    = aws_elasticache_subnet_group.redis.name
  security_group_ids   = [aws_security_group.redis_sg.id]
  port                 = 6379

  # Free tier doesn't support encryption
  engine_version           = var.redis_version
  maintenance_window       = var.maintenance_window
  snapshot_window          = var.snapshot_window
  snapshot_retention_limit = var.environment == "prod" ? 7 : 1

  # Advanced settings
  apply_immediately          = var.apply_immediately
  auto_minor_version_upgrade = true

  tags = merge(
    var.common_tags,
    {
      Name = "${var.environment}-redis"
    }
  )
}

# Store the Redis endpoint in SSM Parameter Store for use by applications
resource "aws_ssm_parameter" "redis_endpoint" {
  name        = "/${var.environment}/redis/endpoint"
  description = "The endpoint for the Redis ElastiCache instance"
  type        = "String"
  value       = aws_elasticache_cluster.redis.cache_nodes[0].address

  tags = var.common_tags
}

# Store the Redis connection string in SSM Parameter Store for use by applications
resource "aws_ssm_parameter" "redis_connection_string" {
  name        = "/${var.environment}/redis/connection_string"
  description = "The connection string for the Redis ElastiCache instance"
  type        = "String"
  # Use simple hostname:port format for StackExchange.Redis
  value = "${aws_elasticache_cluster.redis.cache_nodes[0].address}:${aws_elasticache_cluster.redis.cache_nodes[0].port}"

  tags = var.common_tags
}