output "task_definition_arn" {
  description = "ARN of the Music Lists Service task definition"
  value       = aws_ecs_task_definition.music_lists_service.arn
}

output "task_definition_family" {
  description = "Family of the Music Lists Service task definition"
  value       = aws_ecs_task_definition.music_lists_service.family
}

output "container_name" {
  description = "The name of the container in the Music Lists Service task definition"
  value       = "music-lists-service"
}