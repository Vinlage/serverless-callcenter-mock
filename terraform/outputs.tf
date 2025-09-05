output "queue_url"  { value = aws_sqs_queue.calls.id }
output "queue_arn"  { value = aws_sqs_queue.calls.arn }
output "table_name" { value = aws_dynamodb_table.call_logs.name }
/*output "lambda_name"{ value = aws_lambda_function.consumer.function_name }*/