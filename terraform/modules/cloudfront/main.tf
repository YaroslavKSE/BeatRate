# Create an Origin Access Control for CloudFront
resource "aws_cloudfront_origin_access_control" "frontend_oac" {
  name                              = "${var.environment}-frontend-oac"
  description                       = "Origin Access Control for ${var.environment} frontend S3 bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# S3 bucket policy to allow CloudFront access
resource "aws_s3_bucket_policy" "frontend" {
  bucket = var.bucket_id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowCloudFrontServicePrincipal"
        Effect    = "Allow"
        Principal = { Service = "cloudfront.amazonaws.com" }
        Action    = "s3:GetObject"
        Resource  = "${var.bucket_arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.frontend.arn
          }
        }
      }
    ]
  })

  depends_on = [aws_cloudfront_distribution.frontend]
}

# Create CloudFront distribution
resource "aws_cloudfront_distribution" "frontend" {
  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  price_class         = "PriceClass_100" # US, Canada, Europe
  comment             = "${var.environment} frontend distribution"
  aliases             = var.domain_aliases

  origin {
    domain_name              = var.bucket_regional_domain_name
    origin_id                = "S3-${var.bucket_id}"
    origin_access_control_id = aws_cloudfront_origin_access_control.frontend_oac.id
  }

  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "S3-${var.bucket_id}"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true

    min_ttl     = 0
    default_ttl = 3600
    max_ttl     = 86400

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }
  }

  # Cache behavior for index.html
  ordered_cache_behavior {
    path_pattern           = "index.html"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "S3-${var.bucket_id}"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true

    min_ttl     = 0
    default_ttl = 0
    max_ttl     = 0

    forwarded_values {
      query_string = true
      cookies {
        forward = "none"
      }
    }
  }

  # SPA support - serve index.html for 404s (single page application routing)
  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/index.html"
  }
  custom_error_response {
    error_code         = 403
    response_code      = 200
    response_page_path = "/index.html"
  }

  viewer_certificate {
    cloudfront_default_certificate = var.use_default_certificate
    acm_certificate_arn            = var.use_default_certificate ? null : var.acm_certificate_arn
    ssl_support_method             = var.use_default_certificate ? null : "sni-only"
    minimum_protocol_version       = var.use_default_certificate ? null : "TLSv1.2_2021"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  tags = merge(
    var.common_tags,
    {
      Name = "${var.environment}-frontend-cloudfront"
    }
  )
}

# Create an invalidation resource to clear cache after deployment
# resource "null_resource" "frontend_invalidation" {
#   triggers = {
#     timestamp = timestamp()
#   }
#
#   provisioner "local-exec" {
#     command = "aws cloudfront create-invalidation --distribution-id ${aws_cloudfront_distribution.frontend.id} --paths \\\"/*\\\""
#   }
#
#   depends_on = [aws_cloudfront_distribution.frontend]
# }