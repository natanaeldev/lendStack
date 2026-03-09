output "cluster_name"        { value = aws_ecs_cluster.main.name }
output "cluster_arn"         { value = aws_ecs_cluster.main.arn }
output "web_service_name"    { value = aws_ecs_service.web.name }
output "worker_service_name" { value = aws_ecs_service.worker.name }
output "web_ecr_url"         { value = aws_ecr_repository.web.repository_url }
output "worker_ecr_url"      { value = aws_ecr_repository.worker.repository_url }
output "ecs_tasks_sg_id"     { value = aws_security_group.ecs_tasks.id }
