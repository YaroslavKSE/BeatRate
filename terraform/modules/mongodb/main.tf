terraform {
  required_providers {
    mongodbatlas = {
      source  = "mongodb/mongodbatlas"
      version = "~> 1.31.0"
    }
  }
}

# Create a MongoDB Atlas Project
# resource "mongodbatlas_project" "main" {
#   name   = "${var.environment}-${var.project_name}"
#   org_id = var.atlas_org_id
# }

# Create a MongoDB Atlas Cluster
resource "mongodbatlas_advanced_cluster" "main" {
  project_id   = var.mongo_atlas_project_id
  name         = "${var.environment}-cluster"
  cluster_type = "REPLICASET"

  mongo_db_major_version = "8.0"

  replication_specs {
    #    num_shards = 1

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

  # termination_protection_enabled = var.environment == "prod" ? true : false
  # disk_size_gb                   = var.disk_size_gb
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

  # For monitoring
  scopes {
    name = mongodbatlas_advanced_cluster.main.name
    type = "CLUSTER"
  }
}

# Generate a random password for the database user without problematic special characters
resource "random_password" "db_password" {
  length  = 16
  special = true
  # Use a limited set of special characters that don't need URL encoding in connection strings
  override_special = "-_."
  # Alternatively, you can disable special characters completely:
  # special          = false
}

# Store the password in SSM Parameter Store
resource "aws_ssm_parameter" "db_password" {
  name        = "/${var.environment}/mongodb/${var.db_name}/password"
  description = "The password for MongoDB Atlas database user"
  type        = "SecureString"
  value       = random_password.db_password.result

  tags = var.common_tags
}

# Store connection string in SSM Parameter Store
resource "aws_ssm_parameter" "connection_string" {
  name        = "/${var.environment}/mongodb/${var.db_name}/connection_string"
  description = "The connection string for MongoDB Atlas"
  type        = "SecureString"
  value       = "mongodb+srv://${var.db_username}:${random_password.db_password.result}@${replace(mongodbatlas_advanced_cluster.main.connection_strings[0].standard_srv, "mongodb+srv://", "")}"

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
    from_port   = 27017
    to_port     = 27017
    protocol    = "tcp"
    cidr_blocks = [data.aws_vpc.selected.cidr_block]
    description = "Allow MongoDB traffic from VPC"
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
  private_dns_enabled = false # Changed from true to false

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