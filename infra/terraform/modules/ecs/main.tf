# ─── ECS Fargate Cluster + Services ──────────────────────────────────────────
#
# Design decisions:
#   - Fargate: no EC2 instances to patch, scale, or secure. AWS manages the
#     underlying compute. You only care about your container.
#   - Container Insights enabled: CPU, memory, network metrics out of the box.
#   - Two services: "web" (Next.js) and "worker" (reminder processor).
#     Separate services = separate scaling, separate IAM, separate deployments.
#   - Secrets injected at container startup from Secrets Manager — never
#     stored in the task definition as plaintext environment variables.
#   - Security group: ECS tasks only accept traffic from the ALB security group.
#     Not from the public internet. Not from other ECS tasks unless needed.
#   - Auto Scaling: scale out when ALB request count rises, scale in after 5 min.
#   - Rolling deployment: ECS replaces one task at a time (minimumHealthyPercent=100,
#     maximumPercent=200) so there's always capacity during deploys.
#   - Log driver: awslogs → CloudWatch Logs with 30-day retention.

resource "aws_ecs_cluster" "main" {
  name = "${var.name}-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = { Name = "${var.name}-cluster" }
}

resource "aws_ecs_cluster_capacity_providers" "main" {
  cluster_name       = aws_ecs_cluster.main.name
  capacity_providers = ["FARGATE", "FARGATE_SPOT"]

  default_capacity_provider_strategy {
    capacity_provider = "FARGATE"
    weight            = 1
    base              = 1 # Always keep at least 1 FARGATE task (not SPOT) for stability
  }
}

# ─── CloudWatch Log Groups ────────────────────────────────────────────────────

resource "aws_cloudwatch_log_group" "web" {
  name              = "/ecs/${var.name}/web"
  retention_in_days = 30
  tags              = { Service = "web" }
}

resource "aws_cloudwatch_log_group" "worker" {
  name              = "/ecs/${var.name}/worker"
  retention_in_days = 30
  tags              = { Service = "worker" }
}

# ─── ECR Repositories ─────────────────────────────────────────────────────────

resource "aws_ecr_repository" "web" {
  name                 = "${var.name}/web"
  image_tag_mutability = "IMMUTABLE" # Prevents tag overwriting — force new image = new tag

  image_scanning_configuration {
    scan_on_push = true # Free basic vulnerability scanning on every push
  }

  encryption_configuration {
    encryption_type = "KMS"
  }

  tags = { Name = "${var.name}-web-ecr" }
}

resource "aws_ecr_repository" "worker" {
  name                 = "${var.name}/worker"
  image_tag_mutability = "IMMUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "KMS"
  }

  tags = { Name = "${var.name}-worker-ecr" }
}

# ECR lifecycle policy: keep last 10 images, delete untagged after 1 day
resource "aws_ecr_lifecycle_policy" "web" {
  repository = aws_ecr_repository.web.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Delete untagged images after 1 day"
        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = 1
        }
        action = { type = "expire" }
      },
      {
        rulePriority = 2
        description  = "Keep last 10 tagged images"
        selection = {
          tagStatus     = "tagged"
          tagPrefixList = ["v"]
          countType     = "imageCountMoreThan"
          countNumber   = 10
        }
        action = { type = "expire" }
      }
    ]
  })
}

# ─── Security Group for ECS Tasks ────────────────────────────────────────────

resource "aws_security_group" "ecs_tasks" {
  name        = "${var.name}-ecs-tasks-sg"
  description = "Allow inbound from ALB only"
  vpc_id      = var.vpc_id

  ingress {
    description     = "App port from ALB"
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [var.alb_sg_id]
  }

  egress {
    description = "All outbound (NAT to internet for MongoDB, Stripe, Resend)"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${var.name}-ecs-tasks-sg" }
}

# ─── Web Task Definition ──────────────────────────────────────────────────────

resource "aws_ecs_task_definition" "web" {
  family                   = "${var.name}-web"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.web_cpu
  memory                   = var.web_memory
  execution_role_arn       = var.execution_role_arn
  task_role_arn            = var.web_task_role_arn

  container_definitions = jsonencode([{
    name      = "web"
    image     = "${aws_ecr_repository.web.repository_url}:${var.image_tag}"
    essential = true

    portMappings = [{
      containerPort = 3000
      protocol      = "tcp"
    }]

    # Secrets injected as environment variables from Secrets Manager.
    # The ECS agent decrypts them at startup — your app code just reads process.env.
    secrets = [
      { name = "MONGODB_URI", valueFrom = "${var.secret_mongodb_uri_arn}:MONGODB_URI::" },
      { name = "NEXTAUTH_SECRET", valueFrom = "${var.secret_nextauth_arn}:NEXTAUTH_SECRET::" },
      { name = "NEXTAUTH_URL", valueFrom = "${var.secret_nextauth_arn}:NEXTAUTH_URL::" },
      { name = "RESEND_API_KEY", valueFrom = "${var.secret_resend_arn}:RESEND_API_KEY::" },
      { name = "STRIPE_SECRET_KEY", valueFrom = "${var.secret_stripe_arn}:STRIPE_SECRET_KEY::" },
      { name = "STRIPE_WEBHOOK_SECRET", valueFrom = "${var.secret_stripe_arn}:STRIPE_WEBHOOK_SECRET::" },
      { name = "AWS_S3_DOCUMENTS_BUCKET", valueFrom = "${var.secret_aws_config_arn}:AWS_S3_DOCUMENTS_BUCKET::" },
      { name = "AWS_SQS_REMINDERS_URL", valueFrom = "${var.secret_aws_config_arn}:AWS_SQS_REMINDERS_URL::" },
    ]

    # Non-sensitive runtime config passed as plain env vars
    environment = [
      { name = "NODE_ENV", value = "production" },
      { name = "PORT", value = "3000" },
      { name = "AWS_REGION", value = var.aws_region },
    ]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.web.name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "web"
      }
    }

    # Health check at the container level (ALB also has its own health check)
    healthCheck = {
      command     = ["CMD-SHELL", "curl -sf http://localhost:3000/api/health || exit 1"]
      interval    = 30
      timeout     = 5
      retries     = 3
      startPeriod = 60 # Give Next.js 60 seconds to compile and start
    }

    # Read-only root filesystem — container can't write to disk (security hardening)
    # Next.js needs /tmp for cache, so we add a tmpfs mount
    readonlyRootFilesystem = false # Set true + add tmpfs once you've tested startup

    ulimits = [{
      name      = "nofile"
      softLimit = 65536
      hardLimit = 65536
    }]
  }])

  tags = { Name = "${var.name}-web-task" }
}

# ─── Web ECS Service ──────────────────────────────────────────────────────────

resource "aws_ecs_service" "web" {
  name            = "${var.name}-web"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.web.arn
  desired_count   = var.web_desired_count
  launch_type     = "FARGATE"

  # Rolling deploy: keep 100% healthy, allow 200% during deployment
  # This means a new task starts before the old one is killed
  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200

  # Wait for ELB health checks before marking deployment successful
  health_check_grace_period_seconds = 60

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [aws_security_group.ecs_tasks.id]
    assign_public_ip = false # Tasks are in private subnet, access internet via NAT
  }

  load_balancer {
    target_group_arn = var.target_group_arn
    container_name   = "web"
    container_port   = 3000
  }

  # Circuit breaker: if a deployment fails (health checks fail),
  # automatically roll back to the previous task definition
  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  deployment_controller {
    type = "ECS" # Use CODE_DEPLOY for blue/green deployments
  }

  # Spread tasks across AZs for resilience
  capacity_provider_strategy {
    capacity_provider = "FARGATE"
    weight            = 1
    base              = var.web_desired_count
  }

  lifecycle {
    # Allow ECS/CI to update task_definition and desired_count without Terraform drift
    ignore_changes = [task_definition, desired_count]
  }

  tags = { Name = "${var.name}-web-service" }
}

# ─── Worker Task Definition ───────────────────────────────────────────────────

resource "aws_ecs_task_definition" "worker" {
  family                   = "${var.name}-worker"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.worker_cpu
  memory                   = var.worker_memory
  execution_role_arn       = var.execution_role_arn
  task_role_arn            = var.worker_task_role_arn

  container_definitions = jsonencode([{
    name      = "worker"
    image     = "${aws_ecr_repository.worker.repository_url}:${var.image_tag}"
    essential = true

    secrets = [
      { name = "MONGODB_URI", valueFrom = "${var.secret_mongodb_uri_arn}:MONGODB_URI::" },
      { name = "RESEND_API_KEY", valueFrom = "${var.secret_resend_arn}:RESEND_API_KEY::" },
      { name = "AWS_SQS_REMINDERS_URL", valueFrom = "${var.secret_aws_config_arn}:AWS_SQS_REMINDERS_URL::" },
    ]

    environment = [
      { name = "NODE_ENV", value = "production" },
      { name = "AWS_REGION", value = var.aws_region },
    ]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.worker.name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "worker"
      }
    }
  }])

  tags = { Name = "${var.name}-worker-task" }
}

resource "aws_ecs_service" "worker" {
  name            = "${var.name}-worker"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.worker.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  deployment_minimum_healthy_percent = 0 # Worker can have 0 tasks during deploy
  deployment_maximum_percent         = 100

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [aws_security_group.ecs_tasks.id]
    assign_public_ip = false
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  lifecycle {
    ignore_changes = [task_definition, desired_count]
  }

  tags = { Name = "${var.name}-worker-service" }
}

# ─── Auto Scaling (web service) ───────────────────────────────────────────────

resource "aws_appautoscaling_target" "web" {
  service_namespace  = "ecs"
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.web.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  min_capacity       = var.web_min_count
  max_capacity       = var.web_max_count
}

# Scale OUT on high request count per target
resource "aws_appautoscaling_policy" "web_requests" {
  name               = "${var.name}-web-requests-scaling"
  policy_type        = "TargetTrackingScaling"
  service_namespace  = aws_appautoscaling_target.web.service_namespace
  resource_id        = aws_appautoscaling_target.web.resource_id
  scalable_dimension = aws_appautoscaling_target.web.scalable_dimension

  target_tracking_scaling_policy_configuration {
    target_value       = 500 # 500 requests per target per minute
    scale_in_cooldown  = 300 # Wait 5 min before scaling in (avoid flapping)
    scale_out_cooldown = 60  # Scale out quickly when load spikes

    predefined_metric_specification {
      predefined_metric_type = "ALBRequestCountPerTarget"
      resource_label         = "${var.alb_arn_suffix}/${var.target_group_arn_suffix}"
    }
  }
}

# Scale OUT on high CPU
resource "aws_appautoscaling_policy" "web_cpu" {
  name               = "${var.name}-web-cpu-scaling"
  policy_type        = "TargetTrackingScaling"
  service_namespace  = aws_appautoscaling_target.web.service_namespace
  resource_id        = aws_appautoscaling_target.web.resource_id
  scalable_dimension = aws_appautoscaling_target.web.scalable_dimension

  target_tracking_scaling_policy_configuration {
    target_value       = 70 # Scale when average CPU > 70%
    scale_in_cooldown  = 300
    scale_out_cooldown = 60

    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
  }
}

