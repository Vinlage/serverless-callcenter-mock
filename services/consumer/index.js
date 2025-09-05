import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { PutCommand, DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({
  region: process.env.REGION || 'us-east-1',
  endpoint: process.env.ENDPOINT || 'http://localhost:4566',
  credentials: { accessKeyId: 'test', secretAccessKey: 'test' }
});
const doc = DynamoDBDocumentClient.from(client, { marshallOptions: { removeUndefinedValues: true }});
const tableName = process.env.TABLE_NAME || 'CallLogs';

export const handler = async (event) => {
  const records = event.Records || [];
  for (const r of records) {
    const payload = JSON.parse(r.body);
    await doc.send(new PutCommand({ TableName: tableName, Item: payload }));
  }
  return { ok: true, count: records.length };
};