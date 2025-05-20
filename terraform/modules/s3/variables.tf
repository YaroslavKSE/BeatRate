variable "environment" {
  description = "Environment name (e.g., dev, prod)"
  type        = string
}

variable "bucket_name" {
  description = "Name of the S3 bucket for frontend files"
  type        = string
  default     = "beatrate-frontend-bucket"
}

variable "frontend_project_path" {
  description = "Path to the frontend project directory"
  type        = string
  default     = "../frontend"
}

variable "build_and_upload_frontend" {
  description = "Whether to build and upload the frontend during apply"
  type        = bool
  default     = true
}

variable "force_destroy" {
  description = "Whether to force destroy the bucket even if it contains objects"
  type        = bool
  default     = true
}

variable "common_tags" {
  description = "Common tags to be applied to all resources"
  type        = map(string)
  default     = {}
}