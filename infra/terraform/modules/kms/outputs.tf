output "s3_key_arn"      { value = aws_kms_key.s3.arn }
output "s3_key_id"       { value = aws_kms_key.s3.key_id }
output "secrets_key_arn" { value = aws_kms_key.secrets.arn }
output "secrets_key_id"  { value = aws_kms_key.secrets.key_id }
