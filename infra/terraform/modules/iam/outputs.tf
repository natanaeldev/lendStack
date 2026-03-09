output "execution_role_arn"      { value = aws_iam_role.ecs_execution.arn }
output "execution_role_name"     { value = aws_iam_role.ecs_execution.name }
output "web_task_role_arn"       { value = aws_iam_role.ecs_web_task.arn }
output "worker_task_role_arn"    { value = aws_iam_role.ecs_worker_task.arn }
output "github_actions_role_arn" { value = aws_iam_role.github_actions.arn }
