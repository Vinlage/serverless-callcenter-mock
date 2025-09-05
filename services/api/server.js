import 'dotenv/config';
import express from 'express';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';

const app = express();
const port = process.env.PORT || 3000;
const region = process.env.AWS_REGION || 'us-east-1';
const endpoint = process.env.AWS_ENDPOINT || 'http://localhost:4566';
const tableName = process.env.TABLE_NAME || 'CallLogs';

const ddb = new DynamoDBClient({ region, endpoint, credentials: { accessKeyId: 'test', secretAccessKey: 'test' } });
const doc = DynamoDBDocumentClient.from(ddb);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.get('/calls/:id', async (req, res) => {
  const { id } = req.params;
  const data = await doc.send(new GetCommand({ TableName: tableName, Key: { callId: id } }));
  if (!data.Item) return res.status(404).json({ error: 'Not found' });
  res.json(data.Item);
});

app.get('/calls', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
  try {
    const now = Date.now();
    const q = await doc.send(new QueryCommand({
      TableName: tableName,
      IndexName: 'gsi_startedAt',
      KeyConditionExpression: 'startedAt <= :now',
      ExpressionAttributeValues: { ':now': now },
      ScanIndexForward: false,
      Limit: limit
    }));
    return res.json(q.Items || []);
  } catch (e) {
    const s = await doc.send(new ScanCommand({ TableName: tableName, Limit: limit }));
    res.json(s.Items || []);
  }
});

app.listen(port, () => console.log(`Listening on http://localhost:${port}`));