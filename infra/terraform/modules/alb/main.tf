# ─── Application Load Balancer ────────────────────────────────────────────────
#
# Design decisions:
#   - ALB lives in the PUBLIC subnets — it's the only thing that touches
#     the public internet. ECS tasks stay in private subnets.
#   - HTTP (80) listener immediately redirects to HTTPS (443).
#     No cleartext traffic to the application ever.
#   - TLS termination at the ALB. The ALB-to-ECS connection uses HTTP on port
#     3000 inside the VPC (acceptable since the VPC is a trusted network).
#     For zero-trust environments, you'd use mutual TLS all the way.
#   - Security group: ALB only accepts 80 and 443 from 0.0.0.0/0.
#     CloudFront will further restrict this via WAF managed rule.
#   - Deletion protection: enabled in production. Prevents terraform destroy
#     from accidentally destroying traffic in production.
#   - Access logs: stored in S3. Required for compliance and debugging.

resource "aws_security_group" "alb" {
  name        = "${var.name}-alb-sg"
  description = "Allow HTTP and HTTPS inbound to ALB"
  vpc_id      = var.vpc_id

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "All outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${var.name}-alb-sg" }
}

resource "aws_lb" "main" {
  name               = "${var.name}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = var.public_subnet_ids

  # Prevent accidental deletion in production
  enable_deletion_protection = var.enable_deletion_protection

  # Enable access logs for compliance/debugging
  access_logs {
    bucket  = var.access_logs_bucket
    prefix  = "alb-logs"
    enabled = true
  }

  tags = { Name = "${var.name}-alb" }
}

# Target group — points at ECS tasks on port 3000
resource "aws_lb_target_group" "web" {
  name        = "${var.name}-web-tg"
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"  # Fargate uses IP mode, not instance mode

  health_check {
    enabled             = true
    path                = "/api/health"
    protocol            = "HTTP"
    port                = "traffic-port"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 5
    interval            = 30
    matcher             = "200"
  }

  # Drain connections gracefully before deregistering during deployments
  deregistration_delay = 30

  tags = { Name = "${var.name}-web-tg" }
}

# HTTP → HTTPS redirect
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"

    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

# HTTPS listener — forwards to target group
resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.main.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"  # TLS 1.3 + 1.2, no 1.0/1.1
  certificate_arn   = var.acm_certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.web.arn
  }
}
