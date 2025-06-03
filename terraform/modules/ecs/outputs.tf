output "ecs_cluster_id" {
  description = "The ID of the ECS cluster"
  value       = aws_ecs_cluster.main.id
}

output "ecs_cluster_name" {
  description = "The name of the ECS cluster"
  value       = aws_ecs_cluster.main.name
}

output "ecs_cluster_arn" {
  description = "The ARN of the ECS cluster"
  value       = aws_ecs_cluster.main.arn
}
#
# output "ecs_tasks_security_group_id" {
#   description = "The ID of the ECS tasks security group"
#   value       = aws_security_group.ecs_tasks_sg.id
# }

output "ecs_task_execution_role_arn" {
  description = "The ARN of the ECS task execution role"
  value       = aws_iam_role.ecs_task_execution_role.arn
}

output "ecs_task_role_arn" {
  description = "The ARN of the ECS task role"
  value       = aws_iam_role.ecs_task_role.arn
}

output "user_service_task_definition_arn" {
  description = "The ARN of the User Service task definition"
  value       = module.user_service.task_definition_arn
}

output "music_catalog_service_task_definition_arn" {
  description = "The ARN of the Music Catalog Service task definition"
  value       = module.music_catalog_service.task_definition_arn
}

output "music_interaction_service_task_definition_arn" {
  description = "The ARN of the Music Interaction Service task definition"
  value       = module.music_interaction_service.task_definition_arn
}

output "user_service_name" {
  description = "The name of the User Service"
  value       = aws_ecs_service.user_service.name
}

output "music_catalog_service_name" {
  description = "The name of the Music Catalog Service"
  value       = aws_ecs_service.music_catalog_service.name
}

output "music_interaction_service_name" {
  description = "The name of the Music Interaction Service"
  value       = aws_ecs_service.music_interaction_service.name
}

output "music_lists_service_task_definition_arn" {
  description = "The ARN of the Music Lists Service task definition"
  value       = module.music_lists_service.task_definition_arn
}

output "music_lists_service_name" {
  description = "The name of the Music Lists Service"
  value       = aws_ecs_service.music_lists_service.name
}

output "service_discovery_namespace_id" {
  description = "The ID of the Service Discovery namespace"
  value       = aws_service_discovery_private_dns_namespace.main.id
}

output "service_discovery_namespace_arn" {
  description = "The ARN of the Service Discovery namespace"
  value       = aws_service_discovery_private_dns_namespace.main.arn
}

output "service_discovery_namespace_name" {
  description = "The name of the Service Discovery namespace"
  value       = aws_service_discovery_private_dns_namespace.main.name
}
