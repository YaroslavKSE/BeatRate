variable "environment" {
  description = "Environment name (e.g., dev, prod)"
  type        = string
}

variable "project_name" {
  description = "Project name for the MongoDB Atlas project"
  type        = string
}

variable "atlas_public_key" {
  description = "MongoDB Atlas public API key"
  type        = string
  sensitive   = true
}

variable "atlas_private_key" {
  description = "MongoDB Atlas private API key"
  type        = string
  sensitive   = true
}

variable "atlas_region" {
  description = "AWS region for MongoDB Atlas cluster"
  type        = string
  default     = "US_EAST_1"
}

variable "instance_size" {
  description = "MongoDB Atlas instance size"
  type        = string
  default     = "M10"
}

variable "disk_size_gb" {
  description = "Disk size in GB for MongoDB Atlas cluster"
  type        = number
  default     = 10
}

variable "oplog_size_mb" {
  description = "Oplog size in MB"
  type        = number
  default     = 1024
}

variable "allow_cluster_scale_down" {
  description = "Allow cluster to scale down"
  type        = bool
  default     = true
}

variable "min_instance_size" {
  description = "Minimum instance size for auto-scaling"
  type        = string
  default     = "M10"
}

variable "max_instance_size" {
  description = "Maximum instance size for auto-scaling"
  type        = string
  default     = "M40"
}

variable "enable_backup" {
  description = "Enable Atlas backup for the cluster"
  type        = bool
  default     = true
}

variable "db_name" {
  description = "Name of the database to create"
  type        = string
  default     = "app"
}

variable "db_username" {
  description = "Username for MongoDB Atlas database user"
  type        = string
  default     = "app_user"
}

variable "vpc_id" {
  description = "ID of the VPC where the MongoDB Atlas VPC endpoint will be created"
  type        = string
}

variable "private_subnet_ids" {
  description = "List of private subnet IDs for the MongoDB Atlas VPC endpoint"
  type        = list(string)
}

variable "allowed_security_group_ids" {
  description = "List of security group IDs allowed to access MongoDB Atlas"
  type        = list(string)
  default     = []
}

variable "common_tags" {
  description = "Common tags to be applied to all resources"
  type        = map(string)
  default     = {}
}

variable "mongo_atlas_project_id" {
  description = "Existing MongoDB Atlas project ID (if not creating a new one)"
  type        = string
  default     = null
}

variable "private_subnet_cidr_a" {
  description = "CIDR block for private subnet A"
  type        = string
}

variable "private_subnet_cidr_b" {
  description = "CIDR block for private subnet B"
  type        = string
}