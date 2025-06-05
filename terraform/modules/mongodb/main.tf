# terraform/modules/mongodb/main.tf

terraform {
  required_providers {
    mongodbatlas = {
      source  = "mongodb/mongodbatlas"
      version = "~> 1.31.0"
    }
  }
}

# Create a MongoDB Atlas Cluster
resource "mongodbatlas_advanced_cluster" "main" {
  project_id   = var.mongo_atlas_project_id
  name         = "${var.environment}-cluster"
  cluster_type = "REPLICASET"

  mongo_db_major_version = "8.0"

  replication_specs {
    region_configs {
      provider_name = "AWS"
      region_name   = var.atlas_region

      electable_specs {
        instance_size = var.instance_size
        node_count    = 3
      }

      priority = 7

      read_only_specs {
        instance_size = var.instance_size
        node_count    = 0
      }

      auto_scaling {
        disk_gb_enabled = true
      }
    }
  }

  backup_enabled = var.enable_backup

  advanced_configuration {
    javascript_enabled                   = true
    minimum_enabled_tls_protocol         = "TLS1_2"
    oplog_size_mb                        = var.oplog_size_mb
    no_table_scan                        = false
    sample_refresh_interval_bi_connector = 300
  }
}

# Create a MongoDB Atlas database user
resource "mongodbatlas_database_user" "main" {
  username           = var.db_username
  password           = random_password.db_password.result
  project_id         = var.mongo_atlas_project_id
  auth_database_name = "admin"

  roles {
    role_name     = "readWrite"
    database_name = var.db_name
  }

  roles {
    role_name     = "dbAdmin"
    database_name = var.db_name
  }

  scopes {
    name = mongodbatlas_advanced_cluster.main.name
    type = "CLUSTER"
  }
}

# Generate a random password for the database user
resource "random_password" "db_password" {
  length           = 16
  special          = true
  override_special = "-_."
}

# Store the password in SSM Parameter Store
resource "aws_ssm_parameter" "db_password" {
  name        = "/${var.environment}/mongodb/${var.db_name}/password"
  description = "The password for MongoDB Atlas database user"
  type        = "SecureString"
  value       = random_password.db_password.result

  tags = var.common_tags
}

# Configure AWS PrivateLink for MongoDB Atlas
resource "mongodbatlas_privatelink_endpoint" "main" {
  project_id    = var.mongo_atlas_project_id
  provider_name = "AWS"
  region        = var.atlas_region
}

# Get VPC information
data "aws_vpc" "selected" {
  id = var.vpc_id
}

# Security Group for MongoDB Atlas VPC Endpoint
resource "aws_security_group" "mongodb_endpoint" {
  name        = "${var.environment}-mongodb-endpoint-sg"
  description = "Security group for MongoDB Atlas VPC Endpoint"
  vpc_id      = var.vpc_id

  ingress {
    from_port   = 1024
    to_port     = 65535
    protocol    = "tcp"
    cidr_blocks = [data.aws_vpc.selected.cidr_block]
    description = "Allow MongoDB traffic from VPC on all high ports"
  }

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
      Name = "${var.environment}-mongodb-endpoint-sg"
    }
  )
}

# Create AWS VPC Endpoint for MongoDB Atlas
resource "aws_vpc_endpoint" "mongodb" {
  vpc_id              = var.vpc_id
  service_name        = mongodbatlas_privatelink_endpoint.main.endpoint_service_name
  vpc_endpoint_type   = "Interface"
  subnet_ids          = var.private_subnet_ids
  security_group_ids  = [aws_security_group.mongodb_endpoint.id]
  private_dns_enabled = false

  tags = merge(
    var.common_tags,
    {
      Name = "${var.environment}-mongodb-endpoint"
    }
  )
}

# Get the AWS VPC Endpoint Service Name
resource "mongodbatlas_privatelink_endpoint_service" "main" {
  project_id          = var.mongo_atlas_project_id
  private_link_id     = mongodbatlas_privatelink_endpoint.main.private_link_id
  endpoint_service_id = aws_vpc_endpoint.mongodb.id
  provider_name       = "AWS"
}

# Allow access from the specified security groups
resource "mongodbatlas_project_ip_access_list" "main" {
  project_id = var.mongo_atlas_project_id
  cidr_block = data.aws_vpc.selected.cidr_block
  comment    = "CIDR block for ${var.environment} VPC"
}

# Store the PRIVATE connection string instead of public
resource "aws_ssm_parameter" "connection_string" {
  name        = "/${var.environment}/mongodb/${var.db_name}/connection_string"
  description = "The PRIVATE connection string for MongoDB Atlas via PrivateLink"
  type        = "SecureString"
  value = try(
    "mongodb+srv://${var.db_username}:${random_password.db_password.result}@${replace(mongodbatlas_advanced_cluster.main.connection_strings[0].private_endpoint[0].srv_connection_string, "mongodb+srv://", "")}"
  )

  tags = var.common_tags

  # Make sure this runs after the PrivateLink is fully configured
  depends_on = [
    mongodbatlas_privatelink_endpoint_service.main,
    aws_vpc_endpoint.mongodb
  ]
}

# Store both connection strings for debugging/flexibility
resource "aws_ssm_parameter" "connection_string_public" {
  name        = "/${var.environment}/mongodb/${var.db_name}/connection_string_public"
  description = "The PUBLIC connection string for MongoDB Atlas (for debugging)"
  type        = "SecureString"
  value       = "mongodb+srv://${var.db_username}:${random_password.db_password.result}@${replace(mongodbatlas_advanced_cluster.main.connection_strings[0].standard_srv, "mongodb+srv://", "")}"

  tags = var.common_tags
}

resource "aws_ssm_parameter" "connection_string_private" {
  name        = "/${var.environment}/mongodb/${var.db_name}/connection_string_private"
  description = "The PRIVATE connection string for MongoDB Atlas via PrivateLink"
  type        = "SecureString"
  value = try(
    mongodbatlas_advanced_cluster.main.connection_strings[0].private_endpoint[0].srv_connection_string,
    # Fallback to manually constructed private connection if the above doesn't work
    "mongodb+srv://${var.db_username}:${random_password.db_password.result}@${mongodbatlas_privatelink_endpoint.main.private_link_id}.${var.atlas_region}.vpce.amazonaws.com"
  )

  tags = var.common_tags

  depends_on = [
    mongodbatlas_privatelink_endpoint_service.main,
    aws_vpc_endpoint.mongodb
  ]
}