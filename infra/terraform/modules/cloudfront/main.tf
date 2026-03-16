# ─── CloudFront + WAF ─────────────────────────────────────────────────────────
#
# Design decisions:
#   - CloudFront sits in FRONT of the ALB. Users never talk to ALB directly.
#   - The ALB security group should be locked down to accept traffic only from
#     CloudFront's IP ranges (managed prefix list: com.amazonaws.global.cloudfront.origin-facing).
#     That prevents attackers from hitting the ALB directly to bypass WAF.
#   - WAF is attached to CloudFront (not ALB) so it filters at the edge,
#     closest to the attacker and farthest from your app servers.
#   - Cache behavior: API routes (/) are NEVER cached. Static assets have long TTL.
#   - HTTPS only. Redirect all HTTP. Minimum TLS 1.2.
#   - Custom error pages: return the Next.js 404/500 instead of CloudFront defaults.

# ─── WAF (must be in us-east-1 for CloudFront) ───────────────────────────────

resource "aws_wafv2_web_acl" "main" {
  provider    = aws.us_east_1
  name        = "${var.name}-waf"
  description = "WAF for LendStack CloudFront distribution"
  scope       = "CLOUDFRONT"

  default_action {
    allow {}
  }

  # AWS Managed Rules — free, maintained by AWS Security team
  rule {
    name     = "AWSManagedRulesCommonRuleSet"
    priority = 1

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"

        # Exclude SizeRestrictions_BODY — Next.js API routes can have large bodies
        rule_action_override {
          name = "SizeRestrictions_BODY"
          action_to_use {
            count {}
          }
        }
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "CommonRuleSet"
      sampled_requests_enabled   = true
    }
  }

  # Block known bad inputs (SQLi, XSS, command injection)
  rule {
    name     = "AWSManagedRulesKnownBadInputsRuleSet"
    priority = 2

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesKnownBadInputsRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "KnownBadInputs"
      sampled_requests_enabled   = true
    }
  }

  # Rate limiting: 2000 requests per 5 minutes per IP
  # Adjust based on expected legitimate traffic patterns
  rule {
    name     = "RateLimitRule"
    priority = 3

    action {
      block {}
    }

    statement {
      rate_based_statement {
        limit              = 2000
        aggregate_key_type = "IP"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "RateLimit"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "${var.name}-waf"
    sampled_requests_enabled   = true
  }

  tags = { Name = "${var.name}-waf" }
}

# ─── CloudFront Distribution ──────────────────────────────────────────────────

resource "aws_cloudfront_distribution" "main" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "LendStack CDN"
  default_root_object = ""
  aliases             = var.domain_names
  price_class         = "PriceClass_100" # US, Canada, Europe — cheapest
  web_acl_id          = aws_wafv2_web_acl.main.arn

  # Origin: the ALB
  origin {
    domain_name = var.alb_dns_name
    origin_id   = "alb"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only" # Always talk to ALB over HTTPS
      origin_ssl_protocols   = ["TLSv1.2"]

      # Connection timeout settings
      origin_read_timeout      = 60
      origin_keepalive_timeout = 60
    }

    # Custom header CloudFront adds to every request.
    # ALB can verify this header exists to reject direct access.
    custom_header {
      name  = "X-CloudFront-Secret"
      value = var.cloudfront_secret_header
    }
  }

  # Default cache behavior — for Next.js pages and API routes
  # API routes: NEVER cache (no-store)
  default_cache_behavior {
    target_origin_id       = "alb"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods         = ["GET", "HEAD"]

    # Use managed CachingDisabled policy for dynamic content
    cache_policy_id          = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad" # CachingDisabled
    origin_request_policy_id = "b689b0a8-53d0-40ab-baf2-68738e2966ac" # AllViewerExceptHostHeader

    compress    = true
    min_ttl     = 0
    default_ttl = 0
    max_ttl     = 0
  }

  # Static assets cache behavior: long TTL
  ordered_cache_behavior {
    path_pattern           = "/_next/static/*"
    target_origin_id       = "alb"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]

    cache_policy_id = "658327ea-f89d-4fab-a63d-7e88639e58f6" # CachingOptimized
    compress        = true
    min_ttl         = 86400    # 1 day
    default_ttl     = 604800   # 7 days
    max_ttl         = 31536000 # 1 year — Next.js static assets have content hashes
  }

  restrictions {
    geo_restriction {
      restriction_type = "none" # No geo-blocking by default
    }
  }

  viewer_certificate {
    acm_certificate_arn      = var.acm_certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  # Custom error responses — let Next.js handle 404/500
  custom_error_response {
    error_code            = 404
    response_code         = 404
    response_page_path    = "/404"
    error_caching_min_ttl = 10
  }

  custom_error_response {
    error_code            = 500
    response_code         = 500
    response_page_path    = "/500"
    error_caching_min_ttl = 0
  }

  tags = { Name = "${var.name}-cloudfront" }
}

