variable "domain_name" {
  description = "The domain name to point to CloudFront (e.g., academichub.net)"
  type        = string
}

variable "cloudfront_domain_name" {
  description = "The domain name of the CloudFront distribution"
  type        = string
}

variable "cloudfront_hosted_zone_id" {
  description = "The CloudFront distribution hosted zone ID"
  type        = string
  default     = "Z2FDTNDATAQYW2" # This is AWS's fixed ID for CloudFront distributions
}

variable "enable_ipv6" {
  description = "Whether to create AAAA records for IPv6 support"
  type        = bool
  default     = false
}

variable "create_www_subdomain" {
  description = "Whether to create records for the www subdomain"
  type        = bool
  default     = false
}

variable "create_api_records" {
  description = "Whether to create records for the API subdomain"
  type        = bool
  default     = true
}

variable "api_subdomain" {
  description = "The subdomain for the API (e.g., api for api.example.com)"
  type        = string
  default     = "api"
}

variable "alb_domain_name" {
  description = "The domain name of the ALB for API endpoints"
  type        = string
  default     = null
}

variable "alb_hosted_zone_id" {
  description = "The hosted zone ID of the ALB"
  type        = string
  default     = null
}

variable "common_tags" {
  description = "Common tags to be applied to all resources"
  type        = map(string)
  default     = {}
}