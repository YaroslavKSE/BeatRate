resource "aws_security_group" "rds_sg" {
  name        = "${var.environment}-rds-sg"
  description = "Security group for RDS PostgreSQL"
  vpc_id      = var.vpc_id

  # Allow PostgreSQL traffic from specified security groups only
  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = var.allowed_security_group_ids
    description     = "Allow PostgreSQL traffic from specified security groups"
  }
  ingress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = [var.private_subnet_cidr_a]
    description = "Allow PostgreSQL traffic from private subnet A"
  }

  ingress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = [var.private_subnet_cidr_b]
    description = "Allow PostgreSQL traffic from private subnet B"
  }

  # No direct outbound access needed for RDS
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
      Name = "${var.environment}-rds-sg"
    }
  )
}

# DB Subnet Group
resource "aws_db_subnet_group" "main" {
  name        = "${var.environment}-${var.db_name}-subnet-group"
  description = "DB subnet group for ${var.db_name}"
  subnet_ids  = var.subnet_ids

  tags = merge(
    var.common_tags,
    {
      Name = "${var.environment}-${var.db_name}-subnet-group"
    }
  )
}

# Random password generator for RDS
resource "random_password" "db_password" {
  length           = 16
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

# Store the password in SSM Parameter Store
resource "aws_ssm_parameter" "db_password" {
  name        = "/${var.environment}/database/${var.db_name}/password"
  description = "The password for ${var.db_name} RDS instance"
  type        = "SecureString"
  value       = random_password.db_password.result

  tags = var.common_tags
}

resource "aws_ssm_parameter" "db_connection_string" {
  name        = "/${var.environment}/database/connection_string"
  description = "PostgreSQL connection string for ${var.db_name}"
  type        = "SecureString"
  value       = "Host=${aws_db_instance.main.address};Port=${aws_db_instance.main.port};Database=${var.db_name};Username=${var.db_username};Password=${random_password.db_password.result}"

  tags = var.common_tags
}

# RDS PostgreSQL Instance
resource "aws_db_instance" "main" {
  identifier                = "${var.environment}-${var.db_name}"
  engine                    = "postgres"
  engine_version            = var.postgres_version
  instance_class            = var.instance_class
  allocated_storage         = var.allocated_storage
  max_allocated_storage     = var.max_allocated_storage
  storage_type              = "gp2"
  storage_encrypted         = var.storage_encrypted
  db_name                   = var.db_name
  username                  = var.db_username
  password                  = random_password.db_password.result
  port                      = 5432
  publicly_accessible       = false
  vpc_security_group_ids    = [aws_security_group.rds_sg.id]
  db_subnet_group_name      = aws_db_subnet_group.main.name
  parameter_group_name      = aws_db_parameter_group.main.name
  backup_retention_period   = var.backup_retention_period
  backup_window             = var.backup_window
  maintenance_window        = var.maintenance_window
  multi_az                  = var.multi_az
  skip_final_snapshot       = var.skip_final_snapshot
  final_snapshot_identifier = var.skip_final_snapshot ? null : "${var.environment}-${var.db_name}-final-snapshot-${formatdate("YYYYMMDDhhmmss", timestamp())}"

  deletion_protection = var.deletion_protection
  apply_immediately   = var.apply_immediately

  # Enable Performance Insights (included in free tier)
  performance_insights_enabled          = true
  performance_insights_retention_period = 7 # Free tier supports 7 days retention

  # Enable automated backups
  copy_tags_to_snapshot = true

  tags = merge(
    var.common_tags,
    {
      Name = "${var.environment}-${var.db_name}"
    }
  )
}

# DB Parameter Group
resource "aws_db_parameter_group" "main" {
  name        = "${var.environment}-${var.db_name}-pg17"
  family      = "postgres17"
  description = "Parameter group for ${var.environment} ${var.db_name} PostgreSQL 17"

  # Static parameters
  parameter {
    name         = "max_connections"
    value        = "100"
    apply_method = "pending-reboot" # Add this line
  }

  parameter {
    name         = "shared_buffers"
    value        = "16384"          # 16MB for free tier
    apply_method = "pending-reboot" # Add this line
  }

  parameter {
    name         = "work_mem"
    value        = "4096"           # 4MB for free tier
    apply_method = "pending-reboot" # Add this line
  }

  # Dynamic parameters don't need apply_method
  parameter {
    name  = "log_min_duration_statement"
    value = "1000" # Log statements taking more than 1 second
  }

  parameter {
    name  = "idle_in_transaction_session_timeout"
    value = "3600000" # 1 hour in milliseconds
  }

  tags = merge(
    var.common_tags,
    {
      Name = "${var.environment}-${var.db_name}-pg17"
    }
  )
}