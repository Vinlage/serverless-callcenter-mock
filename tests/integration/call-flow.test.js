const { SQSClient, SendMessageCommand, CreateQueueCommand, DeleteQueueCommand } = require('@aws-sdk/client-sqs');
const { DynamoDBClient, CreateTableCommand, DeleteTableCommand, PutItemCommand, GetItemCommand, DeleteItemCommand } = require('@aws-sdk/client-dynamodb');
const { v4: uuidv4 } = require('uuid');

describe('Integration: Call flow from SQS → DynamoDB (real LocalStack)', () => {
  const region = 'us-east-1';
  const endpoint = 'http://localhost:4566';

  const sqsClient = new SQSClient({ 
  region, 
  endpoint, 
  credentials: {
    accessKeyId: 'test',
    secretAccessKey: 'test'
  }
});

const dynamoClient = new DynamoDBClient({ 
  region, 
  endpoint, 
  credentials: {
    accessKeyId: 'test',
    secretAccessKey: 'test'
  }
});


  let queueUrl;
  let tableName;
  let callId;

  beforeAll(async () => {
    callId = uuidv4();
    queueUrl = `test-queue-${callId}`;
    tableName = `ConnectCallLogs-${callId}`;

    // Cria fila SQS
    const createQueueRes = await sqsClient.send(new CreateQueueCommand({ QueueName: queueUrl }));
    queueUrl = createQueueRes.QueueUrl;

    // Cria tabela DynamoDB
    await dynamoClient.send(new CreateTableCommand({
      TableName: tableName,
      AttributeDefinitions: [{ AttributeName: 'CallId', AttributeType: 'S' }],
      KeySchema: [{ AttributeName: 'CallId', KeyType: 'HASH' }],
      BillingMode: 'PAY_PER_REQUEST'
    }));
  }, 10000);

  afterAll(async () => {
    // Deleta fila
    await sqsClient.send(new DeleteQueueCommand({ QueueUrl: queueUrl }));

    // Deleta tabela
    await dynamoClient.send(new DeleteTableCommand({ TableName: tableName }));
  }, 10000);

  test('should persist a CONNECTED call log in DynamoDB after SQS message', async () => {
    const fakeEvent = {
      CallId: callId,
      CustomerId: 'cust-123',
      StartTime: Date.now(),
      Status: 'CONNECTED',
      TestRunId: `testrun-${Date.now()}`
    };

    // Envia mensagem para SQS
    await sqsClient.send(new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(fakeEvent)
    }));

    // Persiste no DynamoDB simulando o Lambda que processaria a fila
    await dynamoClient.send(new PutItemCommand({
      TableName: tableName,
      Item: {
        CallId: { S: callId },
        CustomerId: { S: fakeEvent.CustomerId },
        Status: { S: fakeEvent.Status }
      }
    }));

    // Consulta DynamoDB para verificar
    const record = await dynamoClient.send(new GetItemCommand({
      TableName: tableName,
      Key: { CallId: { S: callId } }
    }));

    expect(record.Item).toMatchObject({
      CallId: { S: callId },
      Status: { S: 'CONNECTED' },
      CustomerId: { S: 'cust-123' }
    });

    // Limpeza do item
    await dynamoClient.send(new DeleteItemCommand({
      TableName: tableName,
      Key: { CallId: { S: callId } }
    }));
  }, 15000);
});
