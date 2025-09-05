provider "aws" {
  region                      = var.region
  access_key                  = "test"
  secret_key                  = "test"
  skip_credentials_validation = true
  skip_requesting_account_id  = true
  s3_use_path_style           = true

  endpoints {
    dynamodb = "http://localhost:4566"
    sqs      = "http://localhost:4566"
    lambda   = "http://localhost:4566"
    iam      = "http://localhost:4566"
    logs     = "http://localhost:4566"
    sts      = "http://localhost:4566"
  }
}

resource "aws_sqs_queue" "calls" {
  name                      = var.queue_name
  visibility_timeout_seconds = 30
  message_retention_seconds  = 86400
}

resource "aws_dynamodb_table" "call_logs" {
  name         = var.table_name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "callId"

  attribute { 
    name = "callId"    
    type = "S"
  }
  attribute {
    name = "startedAt" 
    type = "N"
  }

  global_secondary_index {
    name            = "gsi_startedAt"
    hash_key        = "startedAt"
    projection_type = "ALL"
  }
}

# --- Lambda packaging (from services/consumer) ---
data "archive_file" "consumer_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../services/consumer"
  output_path = "${path.module}/../.build/consumer.zip"
}

resource "aws_iam_role" "lambda_role" {
  name = "consumer-lambda-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy" "lambda_policy" {
  name = "consumer-inline"
  role = aws_iam_role.lambda_role.id
  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      { Effect = "Allow", Action = ["dynamodb:PutItem"], Resource = aws_dynamodb_table.call_logs.arn },
      { Effect = "Allow", Action = ["logs:CreateLogGroup","logs:CreateLogStream","logs:PutLogEvents"], Resource = "*" }
    ]
  })
}

resource "aws_lambda_function" "consumer" {
  function_name = "CallsConsumer"
  role          = aws_iam_role.lambda_role.arn
  handler       = "index.handler"
  runtime       = "nodejs20.x"
  filename      = data.archive_file.consumer_zip.output_path
  source_code_hash = data.archive_file.consumer_zip.output_base64sha256
  environment {
    variables = {
      TABLE_NAME = aws_dynamodb_table.call_logs.name
      REGION     = var.region
      ENDPOINT   = "http://host.docker.internal:4566"
    }
  }
}

resource "aws_lambda_event_source_mapping" "sqs_to_lambda" {
  event_source_arn  = aws_sqs_queue.calls.arn
  function_name     = aws_lambda_function.consumer.arn
  batch_size        = 10
  enabled           = true
}
