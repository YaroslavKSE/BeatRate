variable "environment" {
  description = "Environment name (e.g., dev, prod)"
  type        = string
}

variable "vpc_id" {
  description = "ID of the VPC"
  type        = string
}

variable "subnet_ids" {
  description = "List of subnet IDs for the ElastiCache subnet group (should be private subnets)"
  type        = list(string)
}

variable "allowed_security_group_ids" {
  description = "List of security group IDs allowed to access the Redis cluster"
  type        = list(string)
}

variable "node_type" {
  description = "ElastiCache node type (use cache.t2.micro or cache.t3.micro for dev/free tier)"
  type        = string
  default     = "cache.t3.micro"
}

variable "redis_version" {
  description = "Redis engine version"
  type        = string
  default     = "6.2"
}

variable "maintenance_window" {
  description = "Preferred maintenance window (UTC)"
  type        = string
  default     = "sun:05:00-sun:07:00"
}

variable "snapshot_window" {
  description = "Preferred snapshot window (UTC)"
  type        = string
  default     = "03:00-05:00"
}

variable "apply_immediately" {
  description = "Apply changes immediately instead of during maintenance window"
  type        = bool
  default     = false
}

variable "common_tags" {
  description = "Common tags to be applied to all resources"
  type        = map(string)
  default     = {}
}

variable "private_subnet_cidr_a" {
  description = "CIDR block for private subnet A"
  type        = string
}

variable "private_subnet_cidr_b" {
  description = "CIDR block for private subnet B"
  type        = string
}