resource "aws_s3_bucket" "frontend" {
  bucket        = var.bucket_name
  force_destroy = var.force_destroy

  tags = merge(
    var.common_tags,
    {
      Name = "${var.environment}-frontend-bucket"
    }
  )
}

# Block public access to the S3 bucket
resource "aws_s3_bucket_public_access_block" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Optionally build and upload the frontend
resource "null_resource" "build_frontend" {
  count = var.build_and_upload_frontend ? 1 : 0

  triggers = {
    timestamp = timestamp()
  }

  provisioner "local-exec" {
    # Use environment-specific build command
    command     = "cd ${var.frontend_project_path} && npm run build:${var.environment == "prod" ? "prod" : "staging"}"
    working_dir = var.frontend_project_path
  }
}

resource "null_resource" "upload_frontend" {
  count = var.build_and_upload_frontend ? 1 : 0

  triggers = {
    timestamp = timestamp()
  }

  provisioner "local-exec" {
    command = "aws s3 sync ${var.frontend_project_path}/dist/ s3://${aws_s3_bucket.frontend.bucket}/ --delete"
  }

  depends_on = [aws_s3_bucket.frontend, null_resource.build_frontend]
}